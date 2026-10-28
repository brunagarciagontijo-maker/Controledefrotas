-- INCREMENTAL LOCAL. Contrato 5; depende de 001..006, sem alterar historico legado.
-- Nenhum SQL deste arquivo foi executado no original. Exige aprovacao do pacote exato.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='60s';
DO $$BEGIN
 IF 'REPLACE_SQL_APPROVAL'<>'APROVADO_EXPLICITAMENTE' OR NOT EXISTS(SELECT 1 FROM portaria.release_state
  WHERE project_ref='REPLACE_PROJECT_REF' AND recovery_strategy='REPLACE_RECOVERY_STRATEGY'
   AND recovery_evidence_sha256='REPLACE_RECOVERY_EVIDENCE_SHA256' AND schema_version IN(4,5))THEN RAISE EXCEPTION 'Contrato 4, recuperacao/dispensa e aprovacao especifica obrigatorios.';END IF;
 IF EXISTS(SELECT 1 FROM portaria.release_state WHERE schema_version=4)AND(to_regclass('portaria.oil_checks')IS NOT NULL OR EXISTS(
  SELECT 1 FROM information_schema.columns WHERE table_schema='portaria'AND(table_name='yard_checks'AND column_name='oil_rule_version'OR table_name='yard_items'AND column_name='found_report')))THEN RAISE EXCEPTION 'Objetos inesperados: inventariar sem sobrescrever.';END IF;
END $$;
ALTER TABLE portaria.yard_checks ADD COLUMN IF NOT EXISTS oil_rule_version smallint NOT NULL DEFAULT 0;
ALTER TABLE portaria.yard_checks ALTER COLUMN oil_rule_version SET DEFAULT 1;
ALTER TABLE portaria.yard_items ADD COLUMN IF NOT EXISTS found_report jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS portaria_yard_found_request ON portaria.yard_items((found_report->>'request_id'))WHERE found_report IS NOT NULL;
CREATE TABLE IF NOT EXISTS portaria.oil_checks(
 request_id uuid PRIMARY KEY REFERENCES portaria.yard_checks(request_id)ON DELETE RESTRICT,
 vehicle_id uuid NOT NULL REFERENCES public.vehicles(id)ON DELETE RESTRICT,
 level text NOT NULL CHECK(level IN('normal','low','critical','unable')),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 checked_at timestamptz NOT NULL,
 checked_by uuid NOT NULL REFERENCES auth.users(id)ON DELETE RESTRICT,
 checked_by_name text NOT NULL CHECK(btrim(checked_by_name)<>''),
 previous_valid_id uuid REFERENCES portaria.oil_checks(request_id)ON DELETE RESTRICT,
 previous_attempt_id uuid REFERENCES portaria.oil_checks(request_id)ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS portaria_oil_vehicle_time ON portaria.oil_checks(vehicle_id,checked_at DESC,request_id DESC);
ALTER TABLE portaria.oil_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON portaria.oil_checks FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION portaria.oil_immutable()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
BEGIN RAISE EXCEPTION 'Historico de oleo e conferencias e imutavel.' USING ERRCODE='42501';END $$;
DROP TRIGGER IF EXISTS portaria_oil_immutable ON portaria.oil_checks;
CREATE TRIGGER portaria_oil_immutable BEFORE UPDATE OR DELETE ON portaria.oil_checks FOR EACH ROW EXECUTE FUNCTION portaria.oil_immutable();
DROP TRIGGER IF EXISTS portaria_yard_immutable ON portaria.yard_checks;
CREATE TRIGGER portaria_yard_immutable BEFORE UPDATE OR DELETE ON portaria.yard_checks FOR EACH ROW EXECUTE FUNCTION portaria.oil_immutable();
REVOKE ALL ON FUNCTION portaria.oil_immutable()FROM PUBLIC,anon,authenticated;

-- Guarda diferida: mesmo uma RPC antiga chamada por outro definer nao pode salvar novo OK sem oleo.
CREATE OR REPLACE FUNCTION portaria.oil_integrity()RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE c portaria.yard_checks%ROWTYPE;o portaria.oil_checks%ROWTYPE;vehicle uuid;
BEGIN
 SELECT * INTO c FROM portaria.yard_checks WHERE request_id=NEW.request_id;
 SELECT * INTO o FROM portaria.oil_checks WHERE request_id=NEW.request_id;
 IF c.oil_rule_version=1 AND c.result='OK' THEN
  SELECT vehicle_id INTO vehicle FROM portaria.yard_items WHERE id=c.item_id;
  IF o.request_id IS NULL OR vehicle IS NULL OR o.vehicle_id IS DISTINCT FROM vehicle OR o.checked_by IS DISTINCT FROM c.checked_by
   OR o.checked_by_name IS DISTINCT FROM c.checked_by_name OR o.checked_at IS DISTINCT FROM c.checked_at OR NOT c.observed THEN
   RAISE EXCEPTION 'OK exige veiculo identificado e oleo na mesma transacao.' USING ERRCODE='23514';END IF;
 ELSIF o.request_id IS NOT NULL THEN RAISE EXCEPTION 'Oleo somente em novo OK; historico legado e NOK preservados.' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portaria_oil_required ON portaria.yard_checks;
CREATE CONSTRAINT TRIGGER portaria_oil_required AFTER INSERT ON portaria.yard_checks DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION portaria.oil_integrity();
DROP TRIGGER IF EXISTS portaria_oil_link ON portaria.oil_checks;
CREATE CONSTRAINT TRIGGER portaria_oil_link AFTER INSERT ON portaria.oil_checks DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION portaria.oil_integrity();
REVOKE ALL ON FUNCTION portaria.oil_integrity()FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION portaria.oil_context(vehicle uuid,check_request uuid,checked timestamptz)RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''AS $$
DECLARE valid portaria.oil_checks%ROWTYPE;attempt portaria.oil_checks%ROWTYPE;current_row portaria.oil_checks%ROWTYPE;at_time timestamptz:=coalesce(checked,statement_timestamp());
BEGIN
 SELECT * INTO valid FROM portaria.oil_checks WHERE vehicle_id=vehicle AND level<>'unable'AND checked_at<=at_time ORDER BY checked_at DESC,request_id DESC LIMIT 1;
 SELECT * INTO attempt FROM portaria.oil_checks WHERE vehicle_id=vehicle AND checked_at<=at_time ORDER BY checked_at DESC,request_id DESC LIMIT 1;
 SELECT * INTO current_row FROM portaria.oil_checks WHERE request_id=check_request;
 RETURN jsonb_build_object('current',CASE WHEN current_row.request_id IS NOT NULL THEN to_jsonb(current_row)-'checked_by'-'previous_valid_id'-'previous_attempt_id'END,
  'latest_valid',CASE WHEN valid.request_id IS NOT NULL THEN to_jsonb(valid)-'checked_by'-'previous_valid_id'-'previous_attempt_id'END,
  'latest_attempt',CASE WHEN attempt.request_id IS NOT NULL THEN to_jsonb(attempt)-'checked_by'-'previous_valid_id'-'previous_attempt_id'END,
  'days_since_valid',CASE WHEN valid.request_id IS NOT NULL THEN greatest(0,(at_time AT TIME ZONE'America/Sao_Paulo')::date-(valid.checked_at AT TIME ZONE'America/Sao_Paulo')::date)END,'as_of',at_time);
END $$;
REVOKE ALL ON FUNCTION portaria.oil_context(uuid,uuid,timestamptz)FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.portaria_get_yard_session(session_id uuid)RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''AS $$
 SELECT to_jsonb(s)||jsonb_build_object('reference_local',to_char(s.reference_local,'YYYY-MM-DD"T"HH24:MI:SS'),'items',coalesce((
 SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('result',c.result,'meaning',c.meaning,'observed',c.observed,'notes',coalesce(c.notes,''),
  'checked_at',c.checked_at,'checked_by_name',c.checked_by_name,'oil',portaria.oil_context(i.vehicle_id,c.request_id,c.checked_at))
  ORDER BY CASE i.expected WHEN'present'THEN 0 WHEN'unknown'THEN 1 ELSE 2 END,i.plate)
 FROM portaria.yard_items i LEFT JOIN portaria.yard_checks c ON c.item_id=i.id WHERE i.session_id=s.id),'[]'::jsonb))
 FROM portaria.yard_sessions s WHERE s.id=$1 AND portaria.active_role()IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.portaria_get_yard_session(uuid)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portaria_get_yard_session(uuid)TO authenticated;

CREATE OR REPLACE FUNCTION public.portaria_check_yard_with_oil(payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE actor uuid:=auth.uid();actor_name text;request uuid;session uuid;item uuid;result_value text;note text;presence boolean;
 r portaria.yard_items%ROWTYPE;c portaria.yard_checks%ROWTYPE;o portaria.oil_checks%ROWTYPE;
 level_value text;oil_note text;previous_valid uuid;previous_attempt uuid;previous_at timestamptz;checked_time timestamptz;
BEGIN
 IF actor IS NULL OR portaria.active_role()IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(payload)IS DISTINCT FROM'object'OR EXISTS(SELECT 1 FROM jsonb_object_keys(payload)k WHERE k NOT IN('request_id','session_id','item_id','result','notes','observed','oil'))THEN RAISE EXCEPTION 'Conteudo de conferencia invalido.';END IF;
 request:=(payload->>'request_id')::uuid;session:=(payload->>'session_id')::uuid;item:=(payload->>'item_id')::uuid;
 result_value:=payload->>'result';note:=btrim(coalesce(payload->>'notes',''));
 IF request IS NULL OR session IS NULL OR item IS NULL OR result_value IS NULL OR result_value NOT IN('OK','NOK')OR length(note)>2000 OR jsonb_typeof(payload->'observed')IS DISTINCT FROM'boolean'THEN RAISE EXCEPTION 'Resultado invalido.';END IF;
 presence:=(payload->>'observed')::boolean;IF presence IS DISTINCT FROM(result_value='OK')THEN RAISE EXCEPTION 'OK significa encontrado; NOK significa nao encontrado.';END IF;
 IF result_value='OK'THEN
  IF jsonb_typeof(payload->'oil')IS DISTINCT FROM'object'OR EXISTS(SELECT 1 FROM jsonb_object_keys(payload->'oil')k WHERE k NOT IN('level','notes'))THEN RAISE EXCEPTION 'Nivel de oleo obrigatorio.';END IF;
  level_value:=payload->'oil'->>'level';oil_note:=btrim(coalesce(payload->'oil'->>'notes',''));
  IF level_value IS NULL OR level_value NOT IN('normal','low','critical','unable')OR length(oil_note)>2000 THEN RAISE EXCEPTION 'Nivel ou observacao de oleo invalido.';END IF;
 ELSIF payload->'oil'IS NOT NULL AND payload->'oil'<>'null'::jsonb THEN RAISE EXCEPTION 'NOK nao registra oleo.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(request::text,0));
 SELECT * INTO r FROM portaria.yard_items WHERE id=item AND session_id=session FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Item inexistente.';END IF;
 SELECT * INTO c FROM portaria.yard_checks WHERE request_id=request;
 IF FOUND THEN
  SELECT * INTO o FROM portaria.oil_checks WHERE request_id=request;
  IF c.item_id<>item OR c.checked_by<>actor OR c.result<>result_value OR c.observed<>presence OR c.notes<>note
   OR(result_value='OK'AND(o.request_id IS NULL OR o.level<>level_value OR o.notes<>oil_note))THEN RAISE EXCEPTION 'Tentativa ja utilizada com outro conteudo.';END IF;
  RETURN public.portaria_get_yard_session(session);
 END IF;
 IF EXISTS(SELECT 1 FROM portaria.yard_items WHERE found_report->>'request_id'=request::text)THEN RAISE EXCEPTION 'Tentativa ja utilizada.';END IF;
 IF EXISTS(SELECT 1 FROM portaria.yard_checks WHERE item_id=item)THEN RAISE EXCEPTION 'Resultado ja registrado. Inicie outra referencia.';END IF;
 checked_time:=clock_timestamp();
 IF result_value='OK'THEN
  PERFORM 1 FROM public.vehicles v WHERE v.id=r.vehicle_id AND upper(btrim(v.plate))=upper(btrim(r.plate))FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Identificacao valida do veiculo obrigatoria; confira cadastro e referencia.';END IF;
  SELECT request_id,checked_at INTO previous_attempt,previous_at FROM portaria.oil_checks WHERE vehicle_id=r.vehicle_id ORDER BY checked_at DESC,request_id DESC LIMIT 1;
  SELECT request_id INTO previous_valid FROM portaria.oil_checks WHERE vehicle_id=r.vehicle_id AND level<>'unable'ORDER BY checked_at DESC,request_id DESC LIMIT 1;
  checked_time:=greatest(clock_timestamp(),coalesce(previous_at+interval'1 microsecond',checked_time));
 END IF;
 SELECT display_name INTO actor_name FROM portaria.profiles WHERE user_id=actor;
 INSERT INTO portaria.yard_checks(request_id,item_id,result,observed,notes,checked_at,checked_by,checked_by_name,meaning,oil_rule_version)
 VALUES(request,item,result_value,presence,note,checked_time,actor,actor_name,'physical_v2',1);
 IF result_value='OK'THEN INSERT INTO portaria.oil_checks(request_id,vehicle_id,level,notes,checked_at,checked_by,checked_by_name,previous_valid_id,previous_attempt_id)
  VALUES(request,r.vehicle_id,level_value,oil_note,checked_time,actor,actor_name,previous_valid,previous_attempt);END IF;
 RETURN public.portaria_get_yard_session(session);
END $$;
REVOKE ALL ON FUNCTION public.portaria_check_yard_with_oil(jsonb)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portaria_check_yard_with_oil(jsonb)TO authenticated;

-- Achados sem cadastro continuam registraveis, mas pendentes: nunca viram oleo por coincidencia de placa.
CREATE OR REPLACE FUNCTION public.portaria_report_unidentified_yard_vehicle(payload jsonb)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''AS $$
DECLARE actor uuid:=auth.uid();actor_name text;request uuid;session uuid;plate_value text;description text;note text;old portaria.yard_items%ROWTYPE;
BEGIN
 IF actor IS NULL OR portaria.active_role()IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(payload)IS DISTINCT FROM'object'OR EXISTS(SELECT 1 FROM jsonb_object_keys(payload)k WHERE k NOT IN('request_id','session_id','plate','name','notes'))THEN RAISE EXCEPTION 'Conteudo invalido.';END IF;
 request:=(payload->>'request_id')::uuid;session:=(payload->>'session_id')::uuid;plate_value:=upper(btrim(payload->>'plate'));description:=btrim(coalesce(payload->>'name',''));note:=btrim(coalesce(payload->>'notes',''));
 IF request IS NULL OR session IS NULL OR plate_value IS NULL OR length(plate_value)NOT BETWEEN 1 AND 16 OR length(description)>160 OR length(note)NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Placa e divergencia obrigatorias.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(request::text,0));
 PERFORM 1 FROM portaria.yard_sessions WHERE id=session FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Conferencia inexistente.';END IF;
 SELECT * INTO old FROM portaria.yard_items WHERE found_report->>'request_id'=request::text;
 IF FOUND THEN IF old.session_id<>session OR old.plate<>plate_value OR old.name<>description OR old.found_report->>'notes'<>note OR old.found_report->>'reported_by'<>actor::text THEN RAISE EXCEPTION 'Tentativa ja utilizada.';END IF;RETURN public.portaria_get_yard_session(session);END IF;
 IF EXISTS(SELECT 1 FROM portaria.yard_checks WHERE request_id=request)THEN RAISE EXCEPTION 'Tentativa ja utilizada.';END IF;
 IF EXISTS(SELECT 1 FROM portaria.yard_items WHERE session_id=session AND plate=plate_value)THEN RAISE EXCEPTION 'Veiculo ja listado. Use a linha existente.';END IF;
 SELECT display_name INTO actor_name FROM portaria.profiles WHERE user_id=actor;
 INSERT INTO portaria.yard_items(session_id,plate,name,expected,reasons,found_report)VALUES(session,plate_value,description,'unknown','["encontrado_nao_listado","identificacao_pendente"]',
  jsonb_build_object('request_id',request,'notes',note,'reported_at',clock_timestamp(),'reported_by',actor,'reported_by_name',actor_name));
 RETURN public.portaria_get_yard_session(session);
END $$;
REVOKE ALL ON FUNCTION public.portaria_report_unidentified_yard_vehicle(jsonb)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portaria_report_unidentified_yard_vehicle(jsonb)TO authenticated;

CREATE OR REPLACE FUNCTION public.portaria_vehicle_oil_history(vehicle_id uuid,before_at timestamptz DEFAULT NULL,before_request uuid DEFAULT NULL)RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid()IS NULL OR portaria.active_role()IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
 IF vehicle_id IS NULL OR(before_at IS NULL)<>(before_request IS NULL)OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=vehicle_id)THEN RAISE EXCEPTION 'Veiculo/cursor invalido.';END IF;
 WITH rows AS(SELECT o.* FROM portaria.oil_checks o WHERE o.vehicle_id=$1 AND($2 IS NULL OR(o.checked_at,o.request_id)<($2,$3))ORDER BY o.checked_at DESC,o.request_id DESC LIMIT 26),
 page AS(SELECT * FROM rows ORDER BY checked_at DESC,request_id DESC LIMIT 25)
 SELECT jsonb_build_object('events',coalesce((SELECT jsonb_agg(to_jsonb(p)-'checked_by'-'previous_valid_id'-'previous_attempt_id'ORDER BY checked_at DESC,request_id DESC)FROM page p),'[]'::jsonb),
  'next_cursor',CASE WHEN(SELECT count(*)FROM rows)>25 THEN(SELECT jsonb_build_object('checked_at',checked_at,'request_id',request_id)FROM page ORDER BY checked_at,request_id LIMIT 1)END)INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.portaria_vehicle_oil_history(uuid,timestamptz,uuid)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portaria_vehicle_oil_history(uuid,timestamptz,uuid)TO authenticated;

REVOKE ALL ON FUNCTION public.portaria_check_yard_item(jsonb),public.portaria_found_yard_vehicle(jsonb),public.portaria_register_conference(uuid,boolean,text)FROM PUBLIC,anon,authenticated;
UPDATE portaria.release_state SET schema_version=5 WHERE schema_version IN(4,5);
COMMIT;
