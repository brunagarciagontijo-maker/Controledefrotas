-- CANDIDATO. Preserva policies historicas; adiciona restricoes cumulativas.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM portaria.release_state WHERE project_ref='REPLACE_PROJECT_REF' AND recovery_strategy='REPLACE_RECOVERY_STRATEGY' AND recovery_evidence_sha256='REPLACE_RECOVERY_EVIDENCE_SHA256' AND schema_version IN(1,2)) OR 'REPLACE_SQL_APPROVAL'<>'APROVADO_EXPLICITAMENTE' THEN RAISE EXCEPTION 'Revisao/recuperacao/aprovacao nao correspondem.'; END IF;
END $$;
CREATE OR REPLACE FUNCTION portaria.active_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT role FROM portaria.profiles WHERE user_id=auth.uid() AND is_active $$;
CREATE OR REPLACE FUNCTION public.portaria_get_profile() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('user_id',user_id,'display_name',display_name,'role',role,'is_active',is_active) FROM portaria.profiles WHERE user_id=auth.uid() $$;
CREATE OR REPLACE FUNCTION public.portaria_get_environment() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('project_ref',project_ref,'environment','original','schema_version',schema_version,'backup_sha256',backup_sha256,'recovery_strategy',recovery_strategy,'recovery_evidence_sha256',recovery_evidence_sha256) FROM portaria.release_state $$;
REVOKE ALL ON FUNCTION portaria.active_role(),public.portaria_get_profile(),public.portaria_get_environment() FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA portaria TO authenticated;
GRANT EXECUTE ON FUNCTION portaria.active_role(),public.portaria_get_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.portaria_get_environment() TO anon,authenticated;

DO $$ DECLARE t text; manage text; seq record; BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles','vehicle_records','people','personal_vehicles','access_records','operational_movements','operational_photos','operational_checklist_items','vehicle_inspection_requests'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS portaria_active_gate ON public.%I',t);
    EXECUTE format('CREATE POLICY portaria_active_gate ON public.%I AS RESTRICTIVE FOR ALL TO anon,authenticated USING ((SELECT portaria.active_role()) IS NOT NULL) WITH CHECK ((SELECT portaria.active_role()) IS NOT NULL)',t);
    EXECUTE format('DROP POLICY IF EXISTS portaria_authenticated_read ON public.%I',t);
    EXECUTE format('CREATE POLICY portaria_authenticated_read ON public.%I FOR SELECT TO authenticated USING ((SELECT portaria.active_role()) IS NOT NULL)',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon',t);
    EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM authenticated',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
    manage := CASE WHEN t IN ('vehicles','personal_vehicles') THEN '(SELECT portaria.active_role())=''admin''' WHEN t='people' THEN '(SELECT portaria.active_role())=''admin'' OR ((SELECT portaria.active_role())=''porteiro'' AND person_type IN (''Visitante'',''Terceirizado'') AND NOT is_driver AND is_active AND origin=''manual'' AND cnh_number IS NULL AND cnh_valid_until IS NULL AND cnh_file_path IS NULL AND cnh_file_url IS NULL)' WHEN t IN ('vehicle_records','operational_movements') THEN 'false' WHEN t='vehicle_inspection_requests' THEN '(SELECT portaria.active_role())=''admin'' AND status=''Pendente''' WHEN t='access_records' THEN '(SELECT portaria.active_role()) IS NOT NULL AND status=''Em aberto''' ELSE '(SELECT portaria.active_role()) IS NOT NULL' END;
    EXECUTE format('DROP POLICY IF EXISTS portaria_insert_gate ON public.%I',t);
    EXECUTE format('CREATE POLICY portaria_insert_gate ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s)',t,manage);
    EXECUTE format('DROP POLICY IF EXISTS portaria_write_permit ON public.%I',t);
    EXECUTE format('CREATE POLICY portaria_write_permit ON public.%I FOR ALL TO authenticated USING ((SELECT portaria.active_role()) IS NOT NULL) WITH CHECK ((SELECT portaria.active_role()) IS NOT NULL)',t);
    EXECUTE format('DROP POLICY IF EXISTS portaria_update_gate ON public.%I',t);
    manage := CASE WHEN t IN ('operational_photos','operational_checklist_items') THEN 'false' WHEN t IN ('vehicles','people','personal_vehicles') THEN '(SELECT portaria.active_role())=''admin''' ELSE '(SELECT portaria.active_role()) IS NOT NULL' END;
    EXECUTE format('CREATE POLICY portaria_update_gate ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',t,manage,manage);
    EXECUTE format('DROP POLICY IF EXISTS portaria_delete_gate ON public.%I',t);
    -- Historico operacional nao e apagado pela API, nem por administrador.
    -- Catalogos com vinculos tambem nao podem disparar cascatas sobre o historico.
    manage := CASE t
      WHEN 'vehicles' THEN '(SELECT portaria.active_role())=''admin'' AND NOT EXISTS(SELECT 1 FROM public.operational_movements m WHERE m.vehicle_id=vehicles.id OR upper(btrim(m.vehicle_plate))=upper(btrim(vehicles.plate))) AND NOT EXISTS(SELECT 1 FROM public.vehicle_records r WHERE upper(btrim(r.vehicle_plate))=upper(btrim(vehicles.plate))) AND NOT EXISTS(SELECT 1 FROM public.vehicle_inspection_requests i WHERE i.vehicle_id=vehicles.id)'
      WHEN 'people' THEN '(SELECT portaria.active_role())=''admin'' AND NOT EXISTS(SELECT 1 FROM public.access_records a WHERE a.person_id=people.id OR a.host_person_id=people.id) AND NOT EXISTS(SELECT 1 FROM public.operational_movements m WHERE m.driver_id=people.id) AND NOT EXISTS(SELECT 1 FROM public.personal_vehicles p JOIN public.access_records a ON a.personal_vehicle_id=p.id WHERE p.person_id=people.id)'
      WHEN 'personal_vehicles' THEN '(SELECT portaria.active_role())=''admin'' AND NOT EXISTS(SELECT 1 FROM public.access_records a WHERE a.personal_vehicle_id=personal_vehicles.id)'
      ELSE 'false' END;
    EXECUTE format('CREATE POLICY portaria_delete_gate ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',t,manage);
  END LOOP;
  FOR seq IN SELECT DISTINCT n.nspname,c.relname FROM pg_depend d JOIN pg_attrdef a ON a.oid=d.objid JOIN pg_class c ON c.oid=d.refobjid AND c.relkind='S' JOIN pg_namespace n ON n.oid=c.relnamespace WHERE a.adrelid IN ('public.vehicles'::regclass,'public.people'::regclass,'public.personal_vehicles'::regclass,'public.access_records'::regclass,'public.operational_movements'::regclass) LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated',seq.nspname);
    EXECUTE format('GRANT USAGE ON SEQUENCE %I.%I TO authenticated',seq.nspname,seq.relname);
  END LOOP;
  -- A tabela drivers legada nao e usada pelo novo frontend; fecha os acessos da API.
  IF to_regclass('public.drivers') IS NOT NULL THEN
    ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
    -- RLS nao protege TRUNCATE/REFERENCES. Revogar grants sem tocar no historico.
    REVOKE ALL ON public.drivers FROM PUBLIC,anon,authenticated;
    DROP POLICY IF EXISTS portaria_legacy_closed ON public.drivers;
    CREATE POLICY portaria_legacy_closed ON public.drivers AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
  END IF;
  FOREACH t IN ARRAY ARRAY['vehicle_records','operational_movements','access_records','operational_photos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL',t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_by SET DEFAULT auth.uid()',t);
  END LOOP;
END $$;
-- Remove somente a obrigatoriedade inconsistente; nao preenche nem altera valores existentes.
ALTER TABLE public.operational_movements ALTER COLUMN driver_cnh_valid_until DROP NOT NULL;
ALTER TABLE public.vehicle_inspection_requests ADD COLUMN IF NOT EXISTS requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.vehicle_inspection_requests ADD COLUMN IF NOT EXISTS completed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION portaria.inspection_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_name text;
BEGIN
  IF portaria.active_role() IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
  SELECT display_name INTO actor_name FROM portaria.profiles WHERE user_id=auth.uid();
  IF TG_OP='INSERT' THEN
    IF portaria.active_role()<>'admin' OR NEW.status<>'Pendente' THEN RAISE EXCEPTION 'Somente administrador solicita inspecao.' USING ERRCODE='42501';END IF;
    NEW.requested_by:=actor_name;NEW.requested_by_user_id:=auth.uid();NEW.created_at:=now();NEW.completed_by:=NULL;NEW.completed_by_user_id:=NULL;NEW.completed_at:=NULL;
  ELSE
    IF portaria.active_role()='porteiro' AND(OLD.status<>'Pendente' OR NEW.status<>'Concluida' OR (to_jsonb(NEW)-ARRAY['status','checklist','completed_notes','completed_by','completed_by_user_id','completed_at','updated_at'])IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['status','checklist','completed_notes','completed_by','completed_by_user_id','completed_at','updated_at']))THEN RAISE EXCEPTION 'Somente conclusao da inspecao pendente.' USING ERRCODE='42501';END IF;
    NEW.requested_by:=OLD.requested_by;NEW.requested_by_user_id:=OLD.requested_by_user_id;NEW.id:=OLD.id;NEW.created_at:=OLD.created_at;
    IF OLD.status='Pendente' AND NEW.status='Concluida' THEN NEW.completed_by:=actor_name;NEW.completed_by_user_id:=auth.uid();NEW.completed_at:=now();ELSE NEW.completed_by:=OLD.completed_by;NEW.completed_by_user_id:=OLD.completed_by_user_id;NEW.completed_at:=OLD.completed_at;END IF;
  END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portaria_inspection_identity ON public.vehicle_inspection_requests;
CREATE TRIGGER portaria_inspection_identity BEFORE INSERT OR UPDATE ON public.vehicle_inspection_requests FOR EACH ROW EXECUTE FUNCTION portaria.inspection_identity();
REVOKE ALL ON FUNCTION portaria.inspection_identity() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION portaria.guard_existing_operation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE allowed text[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF portaria.active_role() IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
  IF TG_OP='INSERT' THEN NEW.created_by:=auth.uid();NEW.created_at:=now(); RETURN NEW;END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN RAISE EXCEPTION 'Autoria e identificacao imutaveis.' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='operational_movements' THEN
    IF EXISTS(SELECT 1 FROM portaria.departures WHERE movement_id=OLD.id) AND ((to_jsonb(NEW)-ARRAY['exit_date','exit_time','exit_odometer','exit_fuel_level','exit_observations','checklist','status','updated_at'])IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['exit_date','exit_time','exit_odometer','exit_fuel_level','exit_observations','checklist','status','updated_at']) OR OLD.status<>'Em aberto' OR NEW.status<>'Concluida') THEN RAISE EXCEPTION 'Saida confirmada e imutavel; somente retorno do registro aberto.' USING ERRCODE='42501';END IF;
    IF EXISTS(SELECT 1 FROM portaria.departures WHERE movement_id=OLD.id) AND(NEW.checklist-'entry')IS DISTINCT FROM(OLD.checklist-'entry')THEN RAISE EXCEPTION 'Confirmacao Cobli e checklist de saida sao imutaveis.' USING ERRCODE='42501';END IF;
  END IF;
  IF portaria.active_role()='porteiro' THEN
    allowed:=CASE TG_TABLE_NAME WHEN 'vehicle_records' THEN ARRAY['return_date','return_time','return_name','return_signature','observations','status','updated_at'] WHEN 'operational_movements' THEN ARRAY['exit_date','exit_time','exit_odometer','exit_fuel_level','exit_observations','checklist','status','updated_at'] WHEN 'access_records' THEN ARRAY['exit_date','exit_time','status','updated_at'] ELSE ARRAY[]::text[] END;
    IF (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN RAISE EXCEPTION 'Alteracao fora das permissoes do porteiro.' USING ERRCODE='42501';END IF;
    IF OLD.status NOT IN ('Em aberto','Em uso') OR NEW.status NOT IN ('Concluida','Concluido','Devolvido') THEN RAISE EXCEPTION 'Somente conclusao de registro aberto.' USING ERRCODE='42501';END IF;
  END IF;
  IF TG_TABLE_NAME='operational_movements' THEN
    IF NEW.status='Concluida' AND (NEW.exit_date IS NULL OR NEW.exit_time IS NULL OR NEW.exit_odometer IS NULL OR NEW.exit_fuel_level IS NULL OR NEW.exit_odometer<OLD.entry_odometer OR NEW.exit_date+NEW.exit_time<OLD.entry_date+OLD.entry_time) THEN RAISE EXCEPTION 'Retorno incompleto ou inconsistente.';END IF;
  ELSIF TG_TABLE_NAME='access_records' THEN
    IF NEW.status='Concluido' AND (NEW.exit_date IS NULL OR NEW.exit_time IS NULL OR NEW.exit_date+NEW.exit_time<OLD.entry_date+OLD.entry_time) THEN RAISE EXCEPTION 'Saida de pessoa incompleta.';END IF;
  ELSIF TG_TABLE_NAME='vehicle_records' THEN
    IF NEW.status='Devolvido' AND (NEW.return_date IS NULL OR NEW.return_time IS NULL OR nullif(btrim(NEW.return_name),'') IS NULL OR nullif(btrim(NEW.return_signature),'') IS NULL OR NEW.return_date+NEW.return_time<OLD.pickup_date+OLD.pickup_time) THEN RAISE EXCEPTION 'Devolucao incompleta ou inconsistente.';END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text;BEGIN
  FOREACH t IN ARRAY ARRAY['vehicle_records','operational_movements','access_records','operational_photos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS portaria_identity_guard ON public.%I',t);
    EXECUTE format('CREATE TRIGGER portaria_identity_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION portaria.guard_existing_operation()',t);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION portaria.guard_existing_operation() FROM PUBLIC,anon,authenticated;

-- C3 confirmou EXECUTE/USAGE anonimos nos geradores publicos. Nao avanca/reset sequencias.
DO $$DECLARE s record;BEGIN
 FOR s IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'AND c.relkind='S'AND c.relname IN('people_short_code_seq','personal_vehicles_short_code_seq','access_records_short_code_seq','operational_movements_short_code_seq','vehicles_mobile_code_seq','drivers_short_code_seq','vehicles_short_code_seq')LOOP
  EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC,anon',s.nspname,s.relname);
  EXECUTE format('REVOKE UPDATE,SELECT ON SEQUENCE %I.%I FROM authenticated',s.nspname,s.relname);
  IF s.relname IN('drivers_short_code_seq','vehicles_short_code_seq')THEN EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM authenticated',s.nspname,s.relname);
  ELSE EXECUTE format('GRANT USAGE ON SEQUENCE %I.%I TO authenticated',s.nspname,s.relname);END IF;
  IF has_sequence_privilege('anon',s.oid,'USAGE,UPDATE')THEN RAISE EXCEPTION 'Privilegio anonimo persistiu na sequencia: %',s.relname;END IF;
 END LOOP;
END $$;
DO $generators$ BEGIN
 IF to_regprocedure('public.generate_short_code(regclass)')IS NOT NULL THEN
  IF(SELECT proargnames[1]FROM pg_proc WHERE oid='public.generate_short_code(regclass)'::regprocedure)IS DISTINCT FROM'sequence_name'THEN RAISE EXCEPTION 'Assinatura do gerador difere do contrato revisado.';END IF;
  EXECUTE $definition$CREATE OR REPLACE FUNCTION public.generate_short_code(sequence_name regclass)RETURNS text LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''AS $body$
  BEGIN
   IF(auth.uid()IS NOT NULL OR current_user IN('anon','authenticated'))AND portaria.active_role()IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.'USING ERRCODE='42501';END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=sequence_name AND n.nspname='public'AND c.relname IN('people_short_code_seq','personal_vehicles_short_code_seq','access_records_short_code_seq','operational_movements_short_code_seq')AND c.relkind='S')THEN RAISE EXCEPTION 'Sequencia fora do contrato.';END IF;
   RETURN pg_catalog.lpad(pg_catalog.nextval(sequence_name)::text,5,'0');
  END $body$$definition$;
  REVOKE ALL ON FUNCTION public.generate_short_code(regclass)FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.generate_short_code(regclass)TO authenticated;
 END IF;
 IF to_regprocedure('public.generate_vehicle_mobile_code()')IS NOT NULL THEN
  EXECUTE $definition$CREATE OR REPLACE FUNCTION public.generate_vehicle_mobile_code()RETURNS text LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''AS $body$
  DECLARE next_code bigint;BEGIN
   IF(auth.uid()IS NOT NULL OR current_user IN('anon','authenticated'))AND portaria.active_role()IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.'USING ERRCODE='42501';END IF;
   next_code:=pg_catalog.nextval('public.vehicles_mobile_code_seq');IF next_code>999 THEN RAISE EXCEPTION 'Limite de codigos curtos de veiculos atingido';END IF;RETURN next_code::text;
  END $body$$definition$;
  REVOKE ALL ON FUNCTION public.generate_vehicle_mobile_code()FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.generate_vehicle_mobile_code()TO authenticated;
 END IF;
END $generators$;
COMMIT;
