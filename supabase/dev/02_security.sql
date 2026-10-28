-- Somente o projeto DEV preparado por 01_schema.sql; Data API ainda desativada.
BEGIN;
SELECT private.assert_dev_environment('REPLACE_WITH_DEV_PROJECT_REF');

CREATE FUNCTION private.app_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM private.app_profiles WHERE user_id = auth.uid() AND is_active
$$;
CREATE FUNCTION private.internal_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NULL AND current_setting('role', true) IN ('none','postgres','supabase_admin')
$$;
CREATE FUNCTION public.get_my_profile() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('user_id', user_id, 'display_name', display_name, 'role', role, 'is_active', is_active)
  FROM private.app_profiles WHERE user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION private.app_role(), private.internal_admin(), public.get_my_profile() FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.app_role(), public.get_my_profile() TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA private TO authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles','vehicle_records','people','personal_vehicles','access_records','operational_movements','operational_photos','operational_checklist_items','vehicle_inspection_requests'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',t);
    EXECUTE format('CREATE POLICY operator_read ON public.%I FOR SELECT TO authenticated USING ((SELECT private.app_role()) IS NOT NULL)',t);
    EXECUTE format('CREATE POLICY admin_delete ON public.%I FOR DELETE TO authenticated USING ((SELECT private.app_role()) = ''admin'')',t);
  END LOOP;
END $$;

CREATE POLICY catalog_insert ON public.vehicles FOR INSERT TO authenticated WITH CHECK((SELECT private.app_role()) = 'admin');
CREATE POLICY catalog_update ON public.vehicles FOR UPDATE TO authenticated
  USING((SELECT private.app_role()) IS NOT NULL) WITH CHECK((SELECT private.app_role()) IS NOT NULL);
CREATE POLICY personal_vehicle_insert ON public.personal_vehicles FOR INSERT TO authenticated WITH CHECK((SELECT private.app_role()) = 'admin');
CREATE POLICY personal_vehicle_update ON public.personal_vehicles FOR UPDATE TO authenticated
  USING((SELECT private.app_role()) = 'admin') WITH CHECK((SELECT private.app_role()) = 'admin');
CREATE POLICY people_insert ON public.people FOR INSERT TO authenticated WITH CHECK(
  (SELECT private.app_role()) = 'admin' OR (
    (SELECT private.app_role()) = 'porteiro' AND person_type IN ('Visitante','Terceirizado') AND NOT is_driver AND is_active
    AND origin = 'manual' AND cnh_number IS NULL AND cnh_valid_until IS NULL AND cnh_file_path IS NULL AND cnh_file_url IS NULL
  )
);
CREATE POLICY people_update ON public.people FOR UPDATE TO authenticated
  USING((SELECT private.app_role()) = 'admin') WITH CHECK((SELECT private.app_role()) = 'admin');

CREATE POLICY record_insert ON public.vehicle_records FOR INSERT TO authenticated
  WITH CHECK((SELECT private.app_role()) IS NOT NULL AND status = 'Em uso');
CREATE POLICY record_update ON public.vehicle_records FOR UPDATE TO authenticated
  USING((SELECT private.app_role()) = 'admin' OR ((SELECT private.app_role()) = 'porteiro' AND status = 'Em uso'))
  WITH CHECK((SELECT private.app_role()) = 'admin' OR ((SELECT private.app_role()) = 'porteiro' AND status = 'Devolvido'));
CREATE POLICY movement_insert ON public.operational_movements FOR INSERT TO authenticated
  WITH CHECK((SELECT private.app_role()) IS NOT NULL AND status = 'Em aberto');
CREATE POLICY movement_update ON public.operational_movements FOR UPDATE TO authenticated
  USING((SELECT private.app_role()) = 'admin' OR ((SELECT private.app_role()) = 'porteiro' AND status = 'Em aberto'))
  WITH CHECK((SELECT private.app_role()) = 'admin' OR ((SELECT private.app_role()) = 'porteiro' AND status = 'Concluida'));
CREATE POLICY access_insert ON public.access_records FOR INSERT TO authenticated
  WITH CHECK((SELECT private.app_role()) IS NOT NULL AND status = 'Em aberto');
CREATE POLICY access_update ON public.access_records FOR UPDATE TO authenticated
  USING((SELECT private.app_role()) = 'admin' OR ((SELECT private.app_role()) = 'porteiro' AND status = 'Em aberto'))
  WITH CHECK((SELECT private.app_role()) = 'admin' OR ((SELECT private.app_role()) = 'porteiro' AND status = 'Concluido'));
CREATE POLICY photo_insert ON public.operational_photos FOR INSERT TO authenticated
  WITH CHECK((SELECT private.app_role()) IS NOT NULL AND file_path LIKE movement_id::text || '/%');
CREATE POLICY photo_update ON public.operational_photos FOR UPDATE TO authenticated
  USING((SELECT private.app_role()) = 'admin') WITH CHECK((SELECT private.app_role()) = 'admin');
CREATE POLICY checklist_insert ON public.operational_checklist_items FOR INSERT TO authenticated
  WITH CHECK((SELECT private.app_role()) IS NOT NULL);
CREATE POLICY checklist_update ON public.operational_checklist_items FOR UPDATE TO authenticated
  USING((SELECT private.app_role()) IS NOT NULL) WITH CHECK((SELECT private.app_role()) IS NOT NULL);
CREATE POLICY inspection_insert ON public.vehicle_inspection_requests FOR INSERT TO authenticated
  WITH CHECK((SELECT private.app_role()) = 'admin' AND status = 'Pendente');
CREATE POLICY inspection_update ON public.vehicle_inspection_requests FOR UPDATE TO authenticated
  USING((SELECT private.app_role()) = 'admin' OR ((SELECT private.app_role()) = 'porteiro' AND status = 'Pendente'))
  WITH CHECK((SELECT private.app_role()) = 'admin' OR ((SELECT private.app_role()) = 'porteiro' AND status = 'Concluida'));

-- A autorizacao de coluna e feita no servidor, alem da RLS de linha.
CREATE FUNCTION private.guard_vehicle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.internal_admin() THEN RETURN NEW; END IF;
  IF private.app_role() IS NULL THEN RAISE EXCEPTION 'Perfil inativo ou nao autorizado.' USING ERRCODE = '42501'; END IF;
  IF private.app_role() <> 'admin' AND
     (to_jsonb(NEW) - ARRAY['in_patio','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['in_patio','updated_at']) THEN
    RAISE EXCEPTION 'Apenas administrador pode alterar cadastro da frota.' USING ERRCODE = '42501';
  END IF;
  IF private.app_role() = 'porteiro' AND NEW.in_patio IS DISTINCT FROM NOT (
    EXISTS(SELECT 1 FROM public.vehicle_records WHERE upper(btrim(vehicle_plate))=upper(btrim(NEW.plate)) AND status='Em uso') OR
    EXISTS(SELECT 1 FROM public.operational_movements WHERE vehicle_id=NEW.id AND status='Em aberto')
  ) THEN
    RAISE EXCEPTION 'Disponibilidade deve corresponder as retiradas registradas.' USING ERRCODE='23514';
  END IF;
  NEW.id := OLD.id; NEW.created_at := OLD.created_at;
  RETURN NEW;
END $$;
CREATE TRIGGER a_guard_vehicle BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION private.guard_vehicle();

CREATE FUNCTION private.guard_operation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE allowed_columns text[];
BEGIN
  IF private.internal_admin() THEN RETURN NEW; END IF;
  IF private.app_role() IS NULL THEN RAISE EXCEPTION 'Perfil inativo ou nao autorizado.' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Autoria invalida.' USING ERRCODE = '42501';
    END IF;
    NEW.created_by := auth.uid(); NEW.created_at := now();
  ELSE
    IF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Identificacao e autoria sao imutaveis.' USING ERRCODE = '42501';
    END IF;
    IF private.app_role() = 'porteiro' THEN
      allowed_columns := CASE TG_TABLE_NAME
        WHEN 'vehicle_records' THEN ARRAY['return_date','return_time','return_name','return_signature','observations','status','updated_at']
        WHEN 'operational_movements' THEN ARRAY['exit_date','exit_time','exit_odometer','exit_fuel_level','exit_observations','checklist','driver_id','driver_name','driver_cnh_number','driver_cnh_valid_until','status','updated_at']
        WHEN 'access_records' THEN ARRAY['exit_date','exit_time','status','updated_at']
        ELSE ARRAY[]::text[] END;
      IF (to_jsonb(NEW) - allowed_columns) IS DISTINCT FROM (to_jsonb(OLD) - allowed_columns) THEN
        RAISE EXCEPTION 'Alteracao fora da permissao do porteiro.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_guard_record BEFORE INSERT OR UPDATE ON public.vehicle_records FOR EACH ROW EXECUTE FUNCTION private.guard_operation();
CREATE TRIGGER a_guard_movement BEFORE INSERT OR UPDATE ON public.operational_movements FOR EACH ROW EXECUTE FUNCTION private.guard_operation();
CREATE TRIGGER a_guard_access BEFORE INSERT OR UPDATE ON public.access_records FOR EACH ROW EXECUTE FUNCTION private.guard_operation();
CREATE TRIGGER a_guard_photo BEFORE INSERT OR UPDATE ON public.operational_photos FOR EACH ROW EXECUTE FUNCTION private.guard_operation();

CREATE FUNCTION private.inspection_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor text;
BEGIN
  IF private.internal_admin() THEN RETURN NEW; END IF;
  IF private.app_role() IS NULL THEN RAISE EXCEPTION 'Perfil inativo ou nao autorizado.' USING ERRCODE = '42501'; END IF;
  SELECT display_name INTO actor FROM private.app_profiles WHERE user_id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    NEW.requested_by_user_id := auth.uid(); NEW.requested_by := actor;
    NEW.completed_by := NULL; NEW.completed_by_user_id := NULL; NEW.completed_at := NULL;
  ELSE
    IF private.app_role() = 'porteiro' AND
      (to_jsonb(NEW) - ARRAY['status','checklist','completed_notes','completed_at','updated_at','completed_by','completed_by_user_id'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','checklist','completed_notes','completed_at','updated_at','completed_by','completed_by_user_id']) THEN
      RAISE EXCEPTION 'Apenas a conclusao da inspecao e permitida.' USING ERRCODE = '42501';
    END IF;
    NEW.requested_by_user_id := OLD.requested_by_user_id; NEW.requested_by := OLD.requested_by;
    NEW.id := OLD.id; NEW.created_at := OLD.created_at;
    IF OLD.status = 'Pendente' AND NEW.status = 'Concluida' THEN
      NEW.completed_by_user_id := auth.uid(); NEW.completed_by := actor; NEW.completed_at := now();
    ELSE
      NEW.completed_by_user_id := OLD.completed_by_user_id; NEW.completed_by := OLD.completed_by; NEW.completed_at := OLD.completed_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_inspection_identity BEFORE INSERT OR UPDATE ON public.vehicle_inspection_requests FOR EACH ROW EXECUTE FUNCTION private.inspection_identity();

-- Serializa retiradas por veiculo nos dois fluxos e mantem disponibilidade atomica.
CREATE FUNCTION private.reserve_vehicle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE vehicle uuid; plate_value text; vehicle_status text;
BEGIN
  IF TG_TABLE_NAME = 'vehicle_records' THEN
    NEW.vehicle_plate := upper(btrim(NEW.vehicle_plate));
    SELECT id, plate, status INTO vehicle, plate_value, vehicle_status FROM public.vehicles WHERE upper(btrim(plate)) = NEW.vehicle_plate FOR UPDATE;
  ELSE
    SELECT id, plate, status INTO vehicle, plate_value, vehicle_status FROM public.vehicles WHERE id = NEW.vehicle_id FOR UPDATE;
    NEW.vehicle_plate := plate_value;
  END IF;
  IF vehicle IS NULL THEN RAISE EXCEPTION 'Veiculo nao cadastrado.' USING ERRCODE = '23503'; END IF;
  IF NEW.status IN ('Em uso','Em aberto') THEN
    IF vehicle_status <> 'Ativo' THEN RAISE EXCEPTION 'Veiculo nao esta ativo.' USING ERRCODE = '23514'; END IF;
    IF EXISTS (SELECT 1 FROM public.vehicle_records WHERE upper(btrim(vehicle_plate)) = upper(btrim(plate_value)) AND status = 'Em uso' AND (TG_TABLE_NAME <> 'vehicle_records' OR id <> NEW.id))
       OR EXISTS (SELECT 1 FROM public.operational_movements WHERE vehicle_id = vehicle AND status = 'Em aberto' AND (TG_TABLE_NAME <> 'operational_movements' OR id <> NEW.id)) THEN
      RAISE EXCEPTION 'Veiculo ja possui retirada em aberto.' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER b_reserve_vehicle BEFORE INSERT OR UPDATE ON public.vehicle_records FOR EACH ROW EXECUTE FUNCTION private.reserve_vehicle();
CREATE TRIGGER b_reserve_vehicle BEFORE INSERT OR UPDATE ON public.operational_movements FOR EACH ROW EXECUTE FUNCTION private.reserve_vehicle();
CREATE UNIQUE INDEX one_open_vehicle_record ON public.vehicle_records(upper(btrim(vehicle_plate))) WHERE status = 'Em uso';
CREATE UNIQUE INDEX one_open_operational_movement ON public.operational_movements(vehicle_id) WHERE status = 'Em aberto';

CREATE FUNCTION private.sync_patio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE plates text[]; p text;
BEGIN
  IF TG_OP = 'DELETE' THEN plates := ARRAY[OLD.vehicle_plate];
  ELSIF TG_OP = 'UPDATE' THEN plates := ARRAY[OLD.vehicle_plate, NEW.vehicle_plate];
  ELSE plates := ARRAY[NEW.vehicle_plate]; END IF;
  FOREACH p IN ARRAY plates LOOP
    UPDATE public.vehicles v SET in_patio = NOT (
      EXISTS (SELECT 1 FROM public.vehicle_records r WHERE upper(btrim(r.vehicle_plate)) = upper(btrim(v.plate)) AND r.status = 'Em uso') OR
      EXISTS (SELECT 1 FROM public.operational_movements m WHERE m.vehicle_id = v.id AND m.status = 'Em aberto')
    ), updated_at = now() WHERE upper(btrim(v.plate)) = upper(btrim(p));
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER sync_patio AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_records FOR EACH ROW EXECUTE FUNCTION private.sync_patio();
CREATE TRIGGER sync_patio AFTER INSERT OR UPDATE OR DELETE ON public.operational_movements FOR EACH ROW EXECUTE FUNCTION private.sync_patio();

-- Checklist e movimento sao gravados na mesma transacao, sem segunda chamada HTTP.
CREATE FUNCTION private.materialize_checklist() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE phase_name text; source_key text; item record;
BEGIN
  FOR phase_name,source_key IN SELECT * FROM (VALUES ('Saida','exit'),('Entrada','entry')) p(phase_name,source_key) LOOP
    IF phase_name='Entrada' AND NEW.status<>'Concluida' THEN CONTINUE; END IF;
    IF jsonb_typeof(NEW.checklist -> source_key) IS DISTINCT FROM 'object' THEN CONTINUE; END IF;
    FOR item IN SELECT * FROM (VALUES ('pneus','Pneus e estepe'),('luzes','Luzes e sinalizacao'),('vidros','Vidros e espelhos'),('limpeza','Limpeza geral'),('odometro','Odometro conferido'),('avarias','Sem avarias aparentes')) x(key,label) LOOP
      INSERT INTO public.operational_checklist_items(movement_id,phase,item_key,item_label,is_ok,note)
      VALUES(NEW.id,phase_name,item.key,item.label,coalesce((NEW.checklist -> source_key -> item.key ->> 'ok')::boolean,false),coalesce(NEW.checklist -> source_key -> item.key ->> 'note',''))
      ON CONFLICT(movement_id,phase,item_key) DO UPDATE SET is_ok=EXCLUDED.is_ok,note=EXCLUDED.note,updated_at=now();
    END LOOP;
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER materialize_checklist AFTER INSERT OR UPDATE ON public.operational_movements FOR EACH ROW EXECUTE FUNCTION private.materialize_checklist();
REVOKE ALL ON FUNCTION private.materialize_checklist() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION private.guard_vehicle(), private.guard_operation(), private.inspection_identity(), private.reserve_vehicle(), private.sync_patio() FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.get_dev_environment() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('project_ref',project_ref,'environment',environment,'schema_version',schema_version) FROM private.portaria_dev_environment
$$;
REVOKE ALL ON FUNCTION public.get_dev_environment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dev_environment() TO anon, authenticated;
-- RPC publica limitada a identificacao nao secreta do ambiente; nao expoe dados operacionais.
-- Realtime sera habilitado manualmente SOMENTE depois dos testes de permissoes.
COMMIT;
