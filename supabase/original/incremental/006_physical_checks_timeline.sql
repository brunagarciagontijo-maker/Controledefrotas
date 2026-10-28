-- CANDIDATO LOCAL. Depende de 001..005 atuais, recuperacao/dispensa registrada e SQL aprovado.
-- Nenhuma atualizacao em massa nas tabelas publicas ou nos resultados anteriores.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='60s';
DO $$DECLARE definition text;BEGIN
 IF 'REPLACE_SQL_APPROVAL'<>'APROVADO_EXPLICITAMENTE'OR NOT EXISTS(SELECT 1 FROM portaria.release_state WHERE project_ref='REPLACE_PROJECT_REF'AND recovery_strategy='REPLACE_RECOVERY_STRATEGY'AND recovery_evidence_sha256='REPLACE_RECOVERY_EVIDENCE_SHA256'AND schema_version IN(3,4))THEN RAISE EXCEPTION 'Recuperacao/dispensa, contrato 3 e aprovacao especifica obrigatorios.';END IF;
 IF EXISTS(SELECT 1 FROM portaria.release_state WHERE schema_version=3)AND(to_regclass('portaria.operation_actors')IS NOT NULL OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='portaria'AND(table_name='yard_checks'AND column_name='meaning'OR table_name='yard_items'AND column_name='last_departure')))THEN RAISE EXCEPTION 'Objetos inesperados. Inventariar sem sobrescrever.';END IF;
 SELECT pg_get_constraintdef(oid)INTO definition FROM pg_constraint WHERE conrelid='portaria.yard_checks'::regclass AND conname='yard_checks_check';
 IF EXISTS(SELECT 1 FROM portaria.release_state WHERE schema_version=3)AND(definition IS NULL OR definition NOT LIKE '%result%'OR definition NOT LIKE '%notes%')THEN RAISE EXCEPTION 'Constraint anterior diferente da revisada.';END IF;
END $$;
-- O valor default inicial identifica linhas preexistentes, sem modificar seus campos.
ALTER TABLE portaria.yard_checks ADD COLUMN IF NOT EXISTS meaning text NOT NULL DEFAULT 'compatibility_v1';
ALTER TABLE portaria.yard_checks ALTER COLUMN meaning SET DEFAULT 'physical_v2';
ALTER TABLE portaria.yard_items ADD COLUMN IF NOT EXISTS last_departure jsonb;
ALTER TABLE portaria.yard_checks DROP CONSTRAINT IF EXISTS yard_checks_check;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='portaria.yard_checks'::regclass AND conname='yard_checks_meaning')THEN ALTER TABLE portaria.yard_checks ADD CONSTRAINT yard_checks_meaning CHECK(meaning IN('compatibility_v1','physical_v2'));END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='portaria.yard_checks'::regclass AND conname='yard_checks_physical_consistency')THEN ALTER TABLE portaria.yard_checks ADD CONSTRAINT yard_checks_physical_consistency CHECK(meaning<>'physical_v2'OR observed=(result='OK'));END IF;
END $$;

CREATE TABLE IF NOT EXISTS portaria.operation_actors(
 source text NOT NULL CHECK(source IN('movement','legacy','access','inspection')),record_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('in','out','requested','completed')),
 actor uuid NOT NULL REFERENCES auth.users(id)ON DELETE RESTRICT,actor_name text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(source,record_id,kind)
);
ALTER TABLE portaria.operation_actors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON portaria.operation_actors FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION portaria.capture_operation_actor()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE src text;event text;name_value text;
BEGIN
 IF auth.uid()IS NULL OR portaria.active_role()IS NULL THEN RETURN NEW;END IF;
 src:=CASE TG_TABLE_NAME WHEN'operational_movements'THEN'movement'WHEN'vehicle_records'THEN'legacy'WHEN'access_records'THEN'access'WHEN'vehicle_inspection_requests'THEN'inspection'END;
 IF TG_OP='INSERT'THEN event:=CASE src WHEN'access'THEN'in'WHEN'inspection'THEN'requested'ELSE'out'END;
 ELSIF src='movement'AND OLD.status='Em aberto'AND NEW.status='Concluida'THEN event:='in';
 ELSIF src='legacy'AND OLD.status='Em uso'AND NEW.status='Devolvido'THEN event:='in';
 ELSIF src='access'AND OLD.status='Em aberto'AND NEW.status='Concluido'THEN event:='out';
 ELSIF src='inspection'AND OLD.status='Pendente'AND NEW.status='Concluida'THEN event:='completed';
 END IF;
 IF event IS NOT NULL THEN SELECT display_name INTO name_value FROM portaria.profiles WHERE user_id=auth.uid();INSERT INTO portaria.operation_actors(source,record_id,kind,actor,actor_name)VALUES(src,NEW.id,event,auth.uid(),name_value)ON CONFLICT DO NOTHING;END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION portaria.capture_operation_actor()FROM PUBLIC,anon,authenticated;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['operational_movements','vehicle_records','access_records','vehicle_inspection_requests']LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS portaria_operation_actor ON public.%I',t);
 EXECUTE format('CREATE TRIGGER portaria_operation_actor AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION portaria.capture_operation_actor()',t);
END LOOP;END $$;

CREATE OR REPLACE FUNCTION portaria.yard_last_departure(vehicle uuid,reference timestamp)RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''AS $$
 WITH v AS(SELECT id,plate FROM public.vehicles WHERE id=$1),candidates AS(
 SELECT m.entry_date+m.entry_time AS at,m.exit_date+m.exit_time AS returned,upper(btrim(m.driver_name))AS driver,'movement'AS source,m.id FROM public.operational_movements m,v WHERE m.vehicle_id=v.id AND upper(btrim(m.vehicle_plate))=upper(btrim(v.plate))AND m.entry_date+m.entry_time<=$2
 UNION ALL SELECT r.pickup_date+r.pickup_time,r.return_date+r.return_time,upper(btrim(r.pickup_name)),'legacy',r.id FROM public.vehicle_records r,v WHERE upper(btrim(r.vehicle_plate))=upper(btrim(v.plate))AND r.pickup_date+r.pickup_time<=$2
 ),latest AS(SELECT * FROM candidates WHERE at=(SELECT max(at)FROM candidates)),safe AS(
 SELECT count(*)=1 OR(count(*)=2 AND count(DISTINCT source)=2 AND count(DISTINCT jsonb_build_array(returned,driver))=1 AND bool_and(coalesce(driver,'')<>''))AS ok FROM latest)
 SELECT(SELECT jsonb_build_object('at',to_char(at,'YYYY-MM-DD"T"HH24:MI:SS'),'source',source,'record_id',id)FROM latest WHERE(SELECT ok FROM safe)ORDER BY source DESC LIMIT 1)
$$;
REVOKE ALL ON FUNCTION portaria.yard_last_departure(uuid,timestamp)FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.portaria_get_yard_session(session_id uuid)RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT to_jsonb(s)||jsonb_build_object('reference_local',to_char(s.reference_local,'YYYY-MM-DD"T"HH24:MI:SS'),'items',coalesce((SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('result',c.result,'meaning',c.meaning,'observed',c.observed,'notes',coalesce(c.notes,''),'checked_at',c.checked_at,'checked_by_name',c.checked_by_name)ORDER BY CASE i.expected WHEN'present'THEN 0 WHEN'unknown'THEN 1 ELSE 2 END,i.plate)FROM portaria.yard_items i LEFT JOIN portaria.yard_checks c ON c.item_id=i.id WHERE i.session_id=s.id),'[]'::jsonb))FROM portaria.yard_sessions s WHERE s.id=$1 AND portaria.active_role()IS NOT NULL
$$;
CREATE OR REPLACE FUNCTION public.portaria_start_yard_session(payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();actor_name text;request uuid;day_value date;reference_value timestamp;old portaria.yard_sessions%ROWTYPE;
BEGIN
 IF actor IS NULL OR portaria.active_role()IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
 request:=(payload->>'request_id')::uuid;day_value:=(payload->>'day')::date;reference_value:=(payload->>'reference_local')::timestamp;
 IF request IS NULL OR reference_value IS NULL OR day_value IS NULL OR reference_value::date<>day_value OR reference_value>now()AT TIME ZONE'America/Sao_Paulo'THEN RAISE EXCEPTION 'Referencia invalida ou futura.';END IF;
 -- SHARE impede mudancas nas fontes durante a captura, respeitando lock_timeout.
 LOCK TABLE public.vehicles,public.operational_movements,public.vehicle_records IN SHARE MODE;
 PERFORM pg_advisory_xact_lock(hashtextextended(request::text,0));SELECT * INTO old FROM portaria.yard_sessions WHERE id=request;
 IF FOUND THEN IF old.created_by<>actor OR old.day<>day_value OR old.reference_local<>reference_value THEN RAISE EXCEPTION 'Tentativa ja utilizada.';END IF;RETURN public.portaria_get_yard_session(request);END IF;
 SELECT display_name INTO actor_name FROM portaria.profiles WHERE user_id=actor;
 INSERT INTO portaria.yard_sessions(id,day,reference_local,created_by,created_by_name)VALUES(request,day_value,reference_value,actor,actor_name);
 INSERT INTO portaria.yard_items(session_id,vehicle_id,plate,name,expected,reasons,last_departure)
 SELECT request,v.id,upper(btrim(v.plate)),v.name,e.value->>'expected',e.value->'reasons',portaria.yard_last_departure(v.id,reference_value)FROM public.vehicles v CROSS JOIN LATERAL(SELECT portaria.yard_expected(v.id,reference_value)AS value)e;
 RETURN public.portaria_get_yard_session(request);
END $$;
CREATE OR REPLACE FUNCTION public.portaria_check_yard_item(payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();actor_name text;request uuid;session uuid;item uuid;result_value text;note text;presence boolean;r portaria.yard_items%ROWTYPE;c portaria.yard_checks%ROWTYPE;
BEGIN
 IF actor IS NULL OR portaria.active_role()IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
 request:=(payload->>'request_id')::uuid;session:=(payload->>'session_id')::uuid;item:=(payload->>'item_id')::uuid;result_value:=payload->>'result';note:=left(btrim(coalesce(payload->>'notes','')),2000);
 IF request IS NULL OR session IS NULL OR item IS NULL OR result_value NOT IN('OK','NOK')OR result_value IS NULL OR jsonb_typeof(payload->'observed')IS DISTINCT FROM'boolean'THEN RAISE EXCEPTION 'Resultado invalido.';END IF;
 presence:=(payload->>'observed')::boolean;SELECT * INTO r FROM portaria.yard_items WHERE id=item AND session_id=session FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Item inexistente.';END IF;
 SELECT * INTO c FROM portaria.yard_checks WHERE request_id=request;
 IF FOUND THEN IF c.item_id<>item OR c.checked_by<>actor OR c.result<>result_value OR c.observed<>presence OR c.notes<>note THEN RAISE EXCEPTION 'Tentativa ja utilizada.';END IF;RETURN public.portaria_get_yard_session(session);END IF;
 IF EXISTS(SELECT 1 FROM portaria.yard_checks WHERE item_id=item)THEN RAISE EXCEPTION 'Resultado ja registrado. Inicie outra referencia para nova conferencia.';END IF;
 IF presence IS DISTINCT FROM(result_value='OK')THEN RAISE EXCEPTION 'OK significa encontrado; NOK significa nao encontrado.';END IF;
 SELECT display_name INTO actor_name FROM portaria.profiles WHERE user_id=actor;
 INSERT INTO portaria.yard_checks(request_id,item_id,result,observed,notes,checked_by,checked_by_name)VALUES(request,item,result_value,presence,note,actor,actor_name);RETURN public.portaria_get_yard_session(session);
END $$;
CREATE OR REPLACE FUNCTION public.portaria_found_yard_vehicle(payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();actor_name text;session uuid;request uuid;plate_value text;description text;note text;item uuid;previous portaria.yard_checks%ROWTYPE;
BEGIN
 IF actor IS NULL OR portaria.active_role()IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
 session:=(payload->>'session_id')::uuid;request:=(payload->>'request_id')::uuid;plate_value:=upper(btrim(payload->>'plate'));description:=left(coalesce(payload->>'name',''),160);note:=left(btrim(coalesce(payload->>'notes','')),2000);
 IF session IS NULL OR request IS NULL OR plate_value IS NULL OR length(plate_value)NOT BETWEEN 1 AND 16 OR note=''THEN RAISE EXCEPTION 'Placa e divergencia obrigatorias.';END IF;
 PERFORM 1 FROM portaria.yard_sessions WHERE id=session FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Conferencia inexistente.';END IF;
 SELECT * INTO previous FROM portaria.yard_checks WHERE request_id=request;
 IF FOUND THEN IF previous.checked_by<>actor OR previous.notes<>note OR NOT EXISTS(SELECT 1 FROM portaria.yard_items WHERE id=previous.item_id AND session_id=session AND plate=plate_value AND name=description)THEN RAISE EXCEPTION 'Tentativa ja utilizada.';END IF;RETURN public.portaria_get_yard_session(session);END IF;
 IF EXISTS(SELECT 1 FROM portaria.yard_items WHERE session_id=session AND plate=plate_value)THEN RAISE EXCEPTION 'Veiculo ja listado. Conferir a linha existente.';END IF;
 SELECT display_name INTO actor_name FROM portaria.profiles WHERE user_id=actor;
 INSERT INTO portaria.yard_items(session_id,plate,name,expected,reasons)VALUES(session,plate_value,description,'absent','["encontrado_nao_listado"]')RETURNING id INTO item;
 INSERT INTO portaria.yard_checks(request_id,item_id,result,observed,notes,checked_by,checked_by_name)VALUES(request,item,'OK',true,note,actor,actor_name);RETURN public.portaria_get_yard_session(session);
END $$;
-- Autoria consultavel somente por perfil ativo, sem exportar contas Auth ou documentos.
CREATE OR REPLACE FUNCTION portaria.timeline_actor(src text,record uuid,event text,creator uuid DEFAULT NULL)RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''AS $$
 SELECT coalesce((SELECT actor_name FROM portaria.operation_actors WHERE source=$1 AND record_id=$2 AND kind=$3),(SELECT display_name FROM portaria.profiles WHERE user_id=$4))
$$;
REVOKE ALL ON FUNCTION portaria.timeline_actor(text,uuid,text,uuid)FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.portaria_timeline_sources()RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''AS $$
BEGIN
 IF auth.uid()IS NULL OR portaria.active_role()IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.'USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object(
 'movements',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'short_code',m.short_code,'vehicle_plate',m.vehicle_plate,'driver_name',m.driver_name,'entry_date',m.entry_date,'entry_time',m.entry_time,'exit_date',m.exit_date,'exit_time',m.exit_time,'operation_type',m.operation_type,'actor_name',portaria.timeline_actor('movement',m.id,'out',m.created_by),'return_actor_name',portaria.timeline_actor('movement',m.id,'in')))FROM public.operational_movements m),'[]'::jsonb),
 'records',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'vehicle_plate',r.vehicle_plate,'pickup_name',r.pickup_name,'return_name',r.return_name,'pickup_date',r.pickup_date,'pickup_time',r.pickup_time,'return_date',r.return_date,'return_time',r.return_time,'actor_name',portaria.timeline_actor('legacy',r.id,'out',r.created_by),'return_actor_name',portaria.timeline_actor('legacy',r.id,'in')))FROM public.vehicle_records r),'[]'::jsonb),
 'accesses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'short_code',a.short_code,'person_name',a.person_name,'person_type',a.person_type,'vehicle_plate',a.vehicle_plate,'entry_date',a.entry_date,'entry_time',a.entry_time,'exit_date',a.exit_date,'exit_time',a.exit_time,'actor_name',portaria.timeline_actor('access',a.id,'in',a.created_by),'return_actor_name',portaria.timeline_actor('access',a.id,'out')))FROM public.access_records a),'[]'::jsonb),
 'parcels',coalesce((SELECT jsonb_agg(to_jsonb(p)-'photo_path'-'received_by'-'collected_by')FROM portaria.parcels p),'[]'::jsonb),
 'yards',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'plate',i.plate,'expected',i.expected,'observed',c.observed,'result',c.result,'checked_at',c.checked_at,'checked_by_name',c.checked_by_name,'notes',c.notes,'meaning',c.meaning,'reference_local',to_char(s.reference_local,'YYYY-MM-DD"T"HH24:MI:SS'),'source','yard'))FROM portaria.yard_checks c JOIN portaria.yard_items i ON i.id=c.item_id JOIN portaria.yard_sessions s ON s.id=i.session_id),'[]'::jsonb)||coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'plate',v.plate,'expected',CASE WHEN c.expected THEN'present'ELSE'absent'END,'observed',c.observed,'result',NULL,'checked_at',c.created_at,'checked_by_name',p.display_name,'notes',c.notes,'meaning','compatibility_v1','reference_local',to_char(c.created_at AT TIME ZONE'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI:SS'),'source','legacy_yard'))FROM portaria.conferences c LEFT JOIN public.vehicles v ON v.id=c.vehicle_id LEFT JOIN portaria.profiles p ON p.user_id=c.reported_by),'[]'::jsonb),
 'inspections',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'vehicle_plate',i.vehicle_plate,'vehicle_name',i.vehicle_name,'created_at',i.created_at,'completed_at',i.completed_at,'requested_by',i.requested_by,'completed_by',i.completed_by,'notes',i.notes,'completed_notes',i.completed_notes,'actor_name',portaria.timeline_actor('inspection',i.id,'requested',i.requested_by_user_id),'return_actor_name',portaria.timeline_actor('inspection',i.id,'completed',i.completed_by_user_id)))FROM public.vehicle_inspection_requests i),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.portaria_timeline_sources()FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portaria_timeline_sources()TO authenticated;
UPDATE portaria.release_state SET schema_version=4 WHERE schema_version IN(3,4);
COMMIT;
