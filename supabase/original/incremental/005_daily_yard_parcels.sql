-- CANDIDATO LOCAL. Depois de 001..004, recuperacao/dispensa registrada e aprovacao especifica.
-- Nenhuma tabela publica, registro historico, flag de patio ou arquivo e reescrito.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF 'REPLACE_SQL_APPROVAL'<>'APROVADO_EXPLICITAMENTE' OR NOT EXISTS(SELECT 1 FROM portaria.release_state WHERE project_ref='REPLACE_PROJECT_REF' AND recovery_strategy='REPLACE_RECOVERY_STRATEGY' AND recovery_evidence_sha256='REPLACE_RECOVERY_EVIDENCE_SHA256' AND schema_version IN(2,3))THEN RAISE EXCEPTION 'Recuperacao/dispensa, revisao e aprovacao especifica obrigatorios.';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='portaria-parcels' AND public IS FALSE AND file_size_limit=10485760 AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp'] AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp'])THEN RAISE EXCEPTION 'Criar/conferir bucket privado portaria-parcels pelo painel/API, com aprovacao separada.';END IF;
 IF EXISTS(SELECT 1 FROM portaria.release_state WHERE schema_version=2) AND EXISTS(SELECT 1 FROM unnest(ARRAY['parcels','parcel_events','yard_sessions','yard_items','yard_checks'])AS t(name)WHERE to_regclass('portaria.'||t.name)IS NOT NULL)THEN RAISE EXCEPTION 'Objetos novos inesperados. Revisar sem sobrescrever.';END IF;
END $$;

CREATE TABLE IF NOT EXISTS portaria.parcels(
 id uuid PRIMARY KEY,recipient_name text NOT NULL CHECK(length(btrim(recipient_name))BETWEEN 1 AND 160),received_at timestamptz NOT NULL,
 received_by uuid NOT NULL REFERENCES auth.users(id)ON DELETE RESTRICT,received_by_name text NOT NULL,
 photo_path text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'Aguardando retirada' CHECK(status IN('Aguardando retirada','Encomenda retirada')),
 collector_name text,collected_at timestamptz,collected_by uuid REFERENCES auth.users(id)ON DELETE RESTRICT,collected_by_name text,
 CHECK(status='Aguardando retirada' AND collector_name IS NULL AND collected_at IS NULL AND collected_by IS NULL AND collected_by_name IS NULL OR status='Encomenda retirada' AND collector_name IS NOT NULL AND length(btrim(collector_name))BETWEEN 1 AND 160 AND collected_at IS NOT NULL AND collected_at>=received_at AND collected_by IS NOT NULL AND collected_by_name IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS portaria.parcel_events(
 request_id uuid PRIMARY KEY,parcel_id uuid NOT NULL REFERENCES portaria.parcels(id)ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN('received','collected')),actor uuid NOT NULL REFERENCES auth.users(id)ON DELETE RESTRICT,
 actor_name text NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),details jsonb NOT NULL,UNIQUE(parcel_id,kind)
);
CREATE TABLE IF NOT EXISTS portaria.yard_sessions(
 id uuid PRIMARY KEY,day date NOT NULL,reference_local timestamp NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES auth.users(id)ON DELETE RESTRICT,created_by_name text NOT NULL,CHECK(reference_local::date=day)
);
CREATE TABLE IF NOT EXISTS portaria.yard_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES portaria.yard_sessions(id)ON DELETE RESTRICT,
 vehicle_id uuid REFERENCES public.vehicles(id)ON DELETE RESTRICT,plate text NOT NULL,name text NOT NULL,
 expected text NOT NULL CHECK(expected IN('present','absent','unknown')),reasons jsonb NOT NULL CHECK(jsonb_typeof(reasons)='array'),
 UNIQUE(session_id,plate),UNIQUE(session_id,vehicle_id)
);
CREATE TABLE IF NOT EXISTS portaria.yard_checks(
 request_id uuid PRIMARY KEY,item_id uuid NOT NULL UNIQUE REFERENCES portaria.yard_items(id)ON DELETE RESTRICT,
 result text NOT NULL CHECK(result IN('OK','NOK')),observed boolean NOT NULL,notes text NOT NULL DEFAULT '',
 checked_at timestamptz NOT NULL DEFAULT now(),checked_by uuid NOT NULL REFERENCES auth.users(id)ON DELETE RESTRICT,checked_by_name text NOT NULL,
 CHECK(result='OK' OR btrim(notes)<>'')
);
CREATE INDEX IF NOT EXISTS portaria_parcels_received ON portaria.parcels(received_at DESC);
CREATE INDEX IF NOT EXISTS portaria_yard_day ON portaria.yard_sessions(day,reference_local DESC);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['parcels','parcel_events','yard_sessions','yard_items','yard_checks']LOOP
 EXECUTE format('ALTER TABLE portaria.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON portaria.%I FROM PUBLIC,anon,authenticated',t);
END LOOP;END $$;

CREATE OR REPLACE FUNCTION portaria.parcel_path_valid(path text)RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' AND path !~ '\.\.'$$;
REVOKE ALL ON FUNCTION portaria.parcel_path_valid(text)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION portaria.parcel_path_valid(text)TO authenticated;
CREATE OR REPLACE FUNCTION portaria.parcel_bucket_private()RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''AS $$SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id='portaria-parcels'AND public IS FALSE)$$;
REVOKE ALL ON FUNCTION portaria.parcel_bucket_private()FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION portaria.parcel_bucket_private()TO authenticated;
DROP POLICY IF EXISTS portaria_parcels_active ON storage.objects;
CREATE POLICY portaria_parcels_active ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(bucket_id<>'portaria-parcels' OR(SELECT portaria.active_role())IS NOT NULL)WITH CHECK(bucket_id<>'portaria-parcels' OR(SELECT portaria.active_role())IS NOT NULL);
DROP POLICY IF EXISTS portaria_parcels_read ON storage.objects;
CREATE POLICY portaria_parcels_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='portaria-parcels' AND(SELECT portaria.active_role())IS NOT NULL);
DROP POLICY IF EXISTS portaria_parcels_insert ON storage.objects;
CREATE POLICY portaria_parcels_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='portaria-parcels' AND(SELECT portaria.active_role())IS NOT NULL);
DROP POLICY IF EXISTS portaria_parcels_insert_guard ON storage.objects;
CREATE POLICY portaria_parcels_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'portaria-parcels' OR(portaria.parcel_path_valid(name)AND split_part(name,'/',1)=auth.uid()::text AND portaria.parcel_bucket_private()));
DROP POLICY IF EXISTS portaria_parcels_no_update ON storage.objects;
CREATE POLICY portaria_parcels_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'portaria-parcels')WITH CHECK(bucket_id<>'portaria-parcels');
DROP POLICY IF EXISTS portaria_parcels_no_delete ON storage.objects;
CREATE POLICY portaria_parcels_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'portaria-parcels');

CREATE OR REPLACE FUNCTION public.portaria_list_parcels()RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT coalesce(jsonb_agg(to_jsonb(p)ORDER BY p.received_at DESC),'[]'::jsonb)FROM portaria.parcels p WHERE portaria.active_role()IS NOT NULL$$;
CREATE OR REPLACE FUNCTION public.portaria_receive_parcel(payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE request uuid;actor uuid:=auth.uid();actor_name text;r portaria.parcels%ROWTYPE;received timestamptz;path text;recipient text;
BEGIN
 IF actor IS NULL OR portaria.active_role()IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(payload)IS DISTINCT FROM'object' THEN RAISE EXCEPTION 'Recebimento invalido.';END IF;
 request:=(payload->>'request_id')::uuid;recipient:=btrim(payload->>'recipient_name');path:=payload->>'photo_path';received:=(payload->>'received_local')::timestamp AT TIME ZONE 'America/Sao_Paulo';
 IF request IS NULL OR recipient IS NULL OR length(recipient)NOT BETWEEN 1 AND 160 OR received IS NULL OR received>now()+interval'1 minute' THEN RAISE EXCEPTION 'Destinatario ou data invalidos.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(request::text,0));SELECT * INTO r FROM portaria.parcels WHERE id=request;
 IF FOUND THEN IF r.received_by<>actor OR r.recipient_name<>recipient OR r.received_at<>received OR r.photo_path<>path THEN RAISE EXCEPTION 'Tentativa ja usada com outro conteudo.';END IF;RETURN to_jsonb(r);END IF;
 IF NOT coalesce(portaria.parcel_path_valid(path),false)OR split_part(path,'/',1)<>actor::text OR split_part(path,'/',2)<>request::text THEN RAISE EXCEPTION 'Caminho de fotografia invalido.';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='portaria-parcels' AND public IS FALSE)OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='portaria-parcels' AND name=path AND owner_id=actor::text AND metadata->>'mimetype'IN('image/jpeg','image/png','image/webp')AND coalesce((metadata->>'size')::bigint,0)BETWEEN 1 AND 10485760)THEN RAISE EXCEPTION 'Fotografia privada obrigatoria.';END IF;
 SELECT display_name INTO actor_name FROM portaria.profiles WHERE user_id=actor;
 INSERT INTO portaria.parcels(id,recipient_name,received_at,received_by,received_by_name,photo_path)VALUES(request,recipient,received,actor,actor_name,path)RETURNING * INTO r;
 INSERT INTO portaria.parcel_events(request_id,parcel_id,kind,actor,actor_name,details)VALUES(request,request,'received',actor,actor_name,jsonb_build_object('received_at',received,'photo_path',path));RETURN to_jsonb(r);
END $$;
CREATE OR REPLACE FUNCTION public.portaria_collect_parcel(payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();request uuid;parcel uuid;collector text;actor_name text;r portaria.parcels%ROWTYPE;e portaria.parcel_events%ROWTYPE;
BEGIN
 IF actor IS NULL OR portaria.active_role()IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
 request:=(payload->>'request_id')::uuid;parcel:=(payload->>'parcel_id')::uuid;collector:=btrim(payload->>'collector_name');
 IF request IS NULL OR parcel IS NULL OR collector IS NULL OR length(collector)NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Informe quem retirou.';END IF;
 SELECT * INTO r FROM portaria.parcels WHERE id=parcel FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Encomenda inexistente.';END IF;
 SELECT * INTO e FROM portaria.parcel_events WHERE request_id=request;
 IF FOUND THEN IF e.parcel_id<>parcel OR e.kind<>'collected'OR e.actor<>actor OR e.details->>'collector_name'<>collector THEN RAISE EXCEPTION 'Tentativa ja usada.';END IF;RETURN to_jsonb(r);END IF;
 IF r.status<>'Aguardando retirada' THEN RAISE EXCEPTION 'Encomenda ja retirada.';END IF;
 SELECT display_name INTO actor_name FROM portaria.profiles WHERE user_id=actor;
 UPDATE portaria.parcels SET status='Encomenda retirada',collector_name=collector,collected_at=now(),collected_by=actor,collected_by_name=actor_name WHERE id=parcel RETURNING * INTO r;
 INSERT INTO portaria.parcel_events(request_id,parcel_id,kind,actor,actor_name,details)VALUES(request,parcel,'collected',actor,actor_name,jsonb_build_object('collector_name',collector));RETURN to_jsonb(r);
END $$;

-- Reconstrucao conservadora pelos dois fluxos. UNION elimina intervalos identicos.
CREATE OR REPLACE FUNCTION portaria.yard_expected(vehicle uuid,reference timestamp)RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH v AS(SELECT * FROM public.vehicles WHERE id=$1),intervals AS(
  SELECT m.entry_date+m.entry_time AS departure,m.exit_date+m.exit_time AS returned,m.status='Em aberto' AS is_open FROM public.operational_movements m,v WHERE m.vehicle_id=v.id OR upper(btrim(m.vehicle_plate))=upper(btrim(v.plate))
  UNION SELECT r.pickup_date+r.pickup_time,r.return_date+r.return_time,r.status='Em uso' FROM public.vehicle_records r,v WHERE upper(btrim(r.vehicle_plate))=upper(btrim(v.plate))
 ),relevant AS(SELECT * FROM intervals WHERE departure<=$2),latest AS(SELECT max(returned)FILTER(WHERE returned>=departure AND returned<=$2)AS ret FROM relevant),facts AS(
  SELECT latest.ret,
   EXISTS(SELECT 1 FROM relevant r WHERE((r.returned IS NULL AND NOT r.is_open)OR r.returned<r.departure)AND(latest.ret IS NULL OR r.departure>=latest.ret))AS incomplete,
   EXISTS(SELECT 1 FROM relevant r WHERE r.is_open AND r.returned IS NOT NULL OR(r.returned>$2 OR r.returned IS NULL AND r.is_open)AND latest.ret>r.departure)AS overlap,
   EXISTS(SELECT 1 FROM relevant r WHERE r.returned>$2 OR r.returned IS NULL AND r.is_open)AS outside,
   EXISTS(SELECT 1 FROM public.operational_movements m,v WHERE m.entry_date+m.entry_time<=$2 AND(m.vehicle_id=v.id AND upper(btrim(m.vehicle_plate))<>upper(btrim(v.plate))OR m.vehicle_id<>v.id AND upper(btrim(m.vehicle_plate))=upper(btrim(v.plate))))AS identity_changed,
   EXISTS(SELECT 1 FROM v WHERE NOT in_patio AND NOT EXISTS(SELECT 1 FROM intervals WHERE is_open AND returned IS NULL))AS current_review
  FROM latest
 ),state AS(SELECT *,CASE WHEN incomplete OR overlap OR identity_changed THEN'unknown'WHEN outside THEN'absent'WHEN ret IS NOT NULL THEN'present'ELSE'unknown'END AS expected FROM facts)
 SELECT jsonb_build_object('expected',expected,'reasons',to_jsonb(array_remove(ARRAY[CASE WHEN identity_changed THEN'identidade_placa_alterada'WHEN incomplete THEN'historico_incompleto'WHEN overlap THEN'fluxos_sobrepostos'WHEN expected='unknown'THEN'sem_evidencia_historica'END,CASE WHEN current_review THEN'fora_sem_saida_aberta_revisar'END],NULL)))FROM state
$$;
REVOKE ALL ON FUNCTION portaria.yard_expected(uuid,timestamp)FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.portaria_list_yard_sessions(check_day date)RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT coalesce(jsonb_agg(to_jsonb(s)ORDER BY reference_local DESC,created_at DESC),'[]'::jsonb)FROM portaria.yard_sessions s WHERE s.day=$1 AND portaria.active_role()IS NOT NULL$$;
CREATE OR REPLACE FUNCTION public.portaria_get_yard_session(session_id uuid)RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT to_jsonb(s)||jsonb_build_object('reference_local',to_char(s.reference_local,'YYYY-MM-DD"T"HH24:MI:SS'),'items',coalesce((SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('result',c.result,'observed',c.observed,'notes',coalesce(c.notes,''),'checked_at',c.checked_at,'checked_by_name',c.checked_by_name)ORDER BY CASE i.expected WHEN'present'THEN 0 WHEN'unknown'THEN 1 ELSE 2 END,i.plate)FROM portaria.yard_items i LEFT JOIN portaria.yard_checks c ON c.item_id=i.id WHERE i.session_id=s.id),'[]'::jsonb))FROM portaria.yard_sessions s WHERE s.id=$1 AND portaria.active_role()IS NOT NULL
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
 INSERT INTO portaria.yard_items(session_id,vehicle_id,plate,name,expected,reasons)
 SELECT request,v.id,upper(btrim(v.plate)),v.name,e.value->>'expected',e.value->'reasons'FROM public.vehicles v CROSS JOIN LATERAL(SELECT portaria.yard_expected(v.id,reference_value)AS value)e;
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
 IF result_value='OK'AND(r.expected='unknown'OR presence<>(r.expected='present'))OR result_value='NOK'AND(note=''OR r.expected<>'unknown'AND presence=(r.expected='present'))THEN RAISE EXCEPTION 'Informe a divergencia e presenca coerentes.';END IF;
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
 INSERT INTO portaria.yard_checks(request_id,item_id,result,observed,notes,checked_by,checked_by_name)VALUES(request,item,'NOK',true,note,actor,actor_name);RETURN public.portaria_get_yard_session(session);
END $$;
CREATE OR REPLACE FUNCTION public.portaria_legacy_yard_day(check_day date)RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'created_at',c.created_at,'plate',v.plate,'expected',c.expected,'observed',c.observed,'notes',c.notes)ORDER BY c.created_at),'[]'::jsonb)FROM portaria.conferences c JOIN public.vehicles v ON v.id=c.vehicle_id WHERE(c.created_at AT TIME ZONE'America/Sao_Paulo')::date=$1 AND portaria.active_role()IS NOT NULL$$;

DO $$DECLARE fn record;BEGIN FOR fn IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND p.proname IN('portaria_list_parcels','portaria_receive_parcel','portaria_collect_parcel','portaria_list_yard_sessions','portaria_get_yard_session','portaria_start_yard_session','portaria_check_yard_item','portaria_found_yard_vehicle','portaria_legacy_yard_day')LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',fn.signature);
END LOOP;END $$;
UPDATE portaria.release_state SET schema_version=3 WHERE schema_version IN(2,3);
COMMIT;
