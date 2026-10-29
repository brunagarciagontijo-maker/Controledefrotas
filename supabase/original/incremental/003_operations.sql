-- CANDIDATO. Somente apos 001/002 e revisao de Storage; uso requer perfis aprovados.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM portaria.release_state WHERE project_ref='REPLACE_PROJECT_REF' AND recovery_strategy='REPLACE_RECOVERY_STRATEGY' AND recovery_evidence_sha256='REPLACE_RECOVERY_EVIDENCE_SHA256' AND schema_version IN(1,2)) OR 'REPLACE_SQL_APPROVAL'<>'APROVADO_EXPLICITAMENTE' THEN RAISE EXCEPTION 'Revisao/recuperacao/aprovacao nao correspondem.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='portaria-evidence' AND NOT public AND file_size_limit=10485760 AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp'] AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']) THEN RAISE EXCEPTION 'Criar/conferir o bucket privado portaria-evidence pelo painel/API Storage, com aprovacao especifica, antes deste lote.';END IF;
  IF(SELECT count(*)FROM information_schema.columns WHERE table_schema='storage' AND table_name='objects' AND column_name IN('bucket_id','name','owner_id','metadata'))<>4 THEN RAISE EXCEPTION 'Contrato do Storage difere. Confira 00b_managed_contract_readonly.sql antes de adaptar este lote.';END IF;
END $$;
-- Buckets sao gerenciados pelo servico Storage. Este SQL nao altera suas linhas.

CREATE OR REPLACE FUNCTION portaria.evidence_path_valid(path text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT path !~ '\.\.' AND path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(pneus|luzes|vidros|limpeza|odometro|avarias)/[0-9a-f-]{36}\.(jpg|png|webp)$'
$$;
CREATE OR REPLACE FUNCTION portaria.application_bucket_private(bucket text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id=$1 AND NOT public AND id IN('portaria-evidence','access-documents','person-documents','vehicle-operation-photos','driver-cnh-documents')) $$;
REVOKE ALL ON FUNCTION portaria.application_bucket_private(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION portaria.application_bucket_private(text) TO authenticated;
GRANT USAGE ON SCHEMA portaria TO anon;
GRANT EXECUTE ON FUNCTION portaria.active_role() TO anon;
REVOKE ALL ON FUNCTION portaria.evidence_path_valid(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION portaria.evidence_path_valid(text) TO authenticated;
DROP POLICY IF EXISTS portaria_storage_active ON storage.objects;
CREATE POLICY portaria_storage_active ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(
 bucket_id NOT IN ('portaria-evidence','access-documents','person-documents','vehicle-operation-photos','driver-cnh-documents') OR (SELECT portaria.active_role()) IS NOT NULL
) WITH CHECK(
 bucket_id NOT IN ('portaria-evidence','access-documents','person-documents','vehicle-operation-photos','driver-cnh-documents') OR (SELECT portaria.active_role()) IS NOT NULL
);
DROP POLICY IF EXISTS portaria_evidence_read ON storage.objects;
CREATE POLICY portaria_evidence_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='portaria-evidence' AND (SELECT portaria.active_role()) IS NOT NULL);
DROP POLICY IF EXISTS portaria_evidence_insert ON storage.objects;
CREATE POLICY portaria_evidence_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='portaria-evidence' AND (SELECT portaria.active_role()) IS NOT NULL AND split_part(name,'/',1)=auth.uid()::text AND portaria.evidence_path_valid(name));
-- Restricoes adicionais neutralizam policies historicas permissivas tambem para este bucket.
DROP POLICY IF EXISTS portaria_evidence_insert_guard ON storage.objects;
CREATE POLICY portaria_evidence_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'portaria-evidence' OR (split_part(name,'/',1)=auth.uid()::text AND portaria.evidence_path_valid(name)));
DROP POLICY IF EXISTS portaria_private_upload_guard ON storage.objects;
CREATE POLICY portaria_private_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id NOT IN('portaria-evidence','access-documents','person-documents','vehicle-operation-photos','driver-cnh-documents') OR portaria.application_bucket_private(bucket_id));
DROP POLICY IF EXISTS portaria_evidence_no_update ON storage.objects;
CREATE POLICY portaria_evidence_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'portaria-evidence') WITH CHECK(bucket_id<>'portaria-evidence');
DROP POLICY IF EXISTS portaria_evidence_no_delete ON storage.objects;
CREATE POLICY portaria_evidence_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'portaria-evidence');
-- Evidencias confirmadas sao imutaveis; limpeza de orfaos exige operacao administrativa revisada.

CREATE OR REPLACE FUNCTION public.portaria_register_departure(payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();request uuid;v public.vehicles%ROWTYPE;d public.people%ROWTYPE;
  movement public.operational_movements%ROWTYPE;previous portaria.departures%ROWTYPE;
  associated boolean;photos jsonb;photo jsonb;item text;path text;plate text;payload_hash text;checklist_snapshot jsonb;
BEGIN
  IF actor IS NULL OR portaria.active_role() IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
  IF jsonb_typeof(payload) IS DISTINCT FROM 'object' OR jsonb_typeof(payload->'cobli_associated') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Selecione a associacao Cobli.';END IF;
  IF jsonb_typeof(payload->'pickup_signature')IS DISTINCT FROM'string' OR length(payload->>'pickup_signature')>2097152 OR payload->>'pickup_signature' !~ '^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+={0,2}$' THEN RAISE EXCEPTION 'Assinatura PNG do responsavel obrigatoria.';END IF;
  request:=(payload->>'request_id')::uuid;IF request IS NULL THEN RAISE EXCEPTION 'Identificador da tentativa obrigatorio.';END IF;
  -- Serializa repeticoes da mesma tentativa antes de procurar resultado existente.
  PERFORM pg_advisory_xact_lock(hashtextextended(request::text,0));
  payload_hash:=md5(payload::text);
  SELECT * INTO previous FROM portaria.departures WHERE request_id=request;
  IF FOUND THEN
    IF previous.confirmed_by<>actor OR previous.input_hash<>payload_hash THEN RAISE EXCEPTION 'Tentativa ja utilizada com outro conteudo.';END IF;
    SELECT * INTO movement FROM public.operational_movements WHERE id=previous.movement_id;RETURN to_jsonb(movement);
  END IF;
  SELECT * INTO v FROM public.vehicles WHERE id=(payload->>'vehicle_id')::uuid FOR UPDATE;
  IF NOT FOUND OR v.status<>'Ativo' OR NOT coalesce(v.in_patio,false) THEN RAISE EXCEPTION 'Veiculo indisponivel.';END IF;
  plate:=upper(btrim(v.plate));
  IF EXISTS(SELECT 1 FROM public.vehicle_records WHERE upper(btrim(vehicle_plate))=plate AND status='Em uso') OR EXISTS(SELECT 1 FROM public.operational_movements WHERE vehicle_id=v.id AND status='Em aberto') THEN RAISE EXCEPTION 'Veiculo ja possui saida aberta.' USING ERRCODE='23505';END IF;
  SELECT * INTO d FROM public.people WHERE id=(payload->>'driver_id')::uuid AND is_active AND is_driver;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motorista ativo obrigatorio.';END IF;
  IF nullif(btrim(v.fixed_driver_name),'') IS NOT NULL AND lower(btrim(v.fixed_driver_name))<>lower(btrim(d.name)) THEN RAISE EXCEPTION 'Veiculo reservado para outro condutor fixo.';END IF;
  IF (payload->>'entry_odometer')::numeric<0 OR (payload->>'entry_odometer') IS NULL THEN RAISE EXCEPTION 'Odometro invalido.';END IF;
  associated:=(payload->>'cobli_associated')::boolean;photos:=coalesce(payload->'photos','[]'::jsonb);
  IF jsonb_typeof(photos)<>'array' THEN RAISE EXCEPTION 'Evidencias invalidas.';END IF;
  IF NOT associated THEN
    IF NOT portaria.application_bucket_private('portaria-evidence')THEN RAISE EXCEPTION 'Bucket de evidencias precisa permanecer privado.';END IF;
    IF nullif(btrim(payload->>'driver_reason'),'') IS NULL THEN RAISE EXCEPTION 'Motivo informado pelo motorista obrigatorio.';END IF;
    IF jsonb_array_length(photos)<>6 THEN RAISE EXCEPTION 'Checklist exige seis fotografias.';END IF;
    FOREACH item IN ARRAY ARRAY['pneus','luzes','vidros','limpeza','odometro','avarias'] LOOP
      IF (SELECT count(*) FROM jsonb_array_elements(photos) p WHERE p->>'item'=item)<>1 THEN RAISE EXCEPTION 'Fotografia obrigatoria ausente ou repetida.';END IF;
    END LOOP;
    IF (SELECT count(DISTINCT p->>'path') FROM jsonb_array_elements(photos)p)<>6 THEN RAISE EXCEPTION 'Use evidencias distintas por item.';END IF;
    FOR photo IN SELECT * FROM jsonb_array_elements(photos) LOOP
      path:=photo->>'path';
      IF NOT coalesce(portaria.evidence_path_valid(path),false) OR split_part(path,'/',1)<>actor::text OR split_part(path,'/',2)<>request::text OR split_part(path,'/',3)<>photo->>'item' THEN RAISE EXCEPTION 'Caminho de evidencia invalido.';END IF;
      IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='portaria-evidence' AND name=path AND owner_id=actor::text AND metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp') AND coalesce((metadata->>'size')::bigint,0) BETWEEN 1 AND 10485760) THEN RAISE EXCEPTION 'Foto privada nao encontrada ou formato invalido.';END IF;
    END LOOP;
  ELSE
    IF jsonb_array_length(photos)<>0 THEN RAISE EXCEPTION 'Associacao confirmada dispensa envio de checklist fotografico.';END IF;
  END IF;
  checklist_snapshot:=jsonb_build_object('pickup_signature',payload->>'pickup_signature','operation_reason',left(btrim(coalesce(payload->'checklist'->>'operation_reason','')),2000),'authorization_note',left(btrim(coalesce(payload->'checklist'->>'authorization_note','')),2000),'cobli_associated',associated,'evidence_required',NOT associated,'photo_count',jsonb_array_length(photos),'driver_reason',CASE WHEN associated THEN '' ELSE btrim(payload->>'driver_reason')END);
  IF NOT associated THEN checklist_snapshot:=checklist_snapshot||jsonb_build_object('exit',(SELECT jsonb_object_agg(p->>'item',jsonb_build_object('ok',false,'note','Fotografia registrada; condicao nao declarada automaticamente.'))FROM jsonb_array_elements(photos)p));END IF;
  INSERT INTO public.operational_movements(vehicle_id,vehicle_plate,operation_type,driver_id,driver_name,driver_cnh_number,driver_cnh_valid_until,entry_date,entry_time,entry_odometer,entry_fuel_level,entry_observations,checklist,status,created_by)
  VALUES(v.id,v.plate,payload->>'operation_type',d.id,d.name,d.cnh_number,d.cnh_valid_until,(payload->>'entry_date')::date,(payload->>'entry_time')::time,(payload->>'entry_odometer')::numeric,payload->>'entry_fuel_level',coalesce(payload->>'entry_observations',''),checklist_snapshot,'Em aberto',actor) RETURNING * INTO movement;
  INSERT INTO portaria.departures(request_id,movement_id,input_hash,cobli_associated,driver_reason,photos,confirmed_by)VALUES(request,movement.id,payload_hash,associated,CASE WHEN associated THEN '' ELSE btrim(payload->>'driver_reason') END,photos,actor);
  UPDATE public.vehicles SET in_patio=false WHERE id=v.id;
  RETURN to_jsonb(movement);
END $$;

CREATE OR REPLACE FUNCTION public.portaria_register_conference(vehicle_id uuid,observed_present boolean,notes text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.vehicles%ROWTYPE;expected_present boolean;result portaria.conferences%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR portaria.active_role() IS NULL THEN RAISE EXCEPTION 'Perfil nao autorizado.' USING ERRCODE='42501';END IF;
  IF observed_present IS NULL THEN RAISE EXCEPTION 'Confirme a presenca fisica.';END IF;
  SELECT * INTO v FROM public.vehicles WHERE id=vehicle_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Veiculo nao encontrado.';END IF;
  expected_present:=v.in_patio AND NOT(EXISTS(SELECT 1 FROM public.operational_movements WHERE (public.operational_movements.vehicle_id=v.id OR upper(btrim(vehicle_plate))=upper(btrim(v.plate))) AND status='Em aberto') OR EXISTS(SELECT 1 FROM public.vehicle_records WHERE upper(btrim(vehicle_plate))=upper(btrim(v.plate)) AND status='Em uso'));
  INSERT INTO portaria.conferences(vehicle_id,expected,observed,notes,reported_by)VALUES(v.id,expected_present,observed_present,left(coalesce(btrim(notes),''),2000),auth.uid())RETURNING * INTO result;
  RETURN to_jsonb(result);
END $$;
CREATE OR REPLACE FUNCTION public.portaria_list_conferences() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY created_at DESC),'[]'::jsonb) FROM(SELECT * FROM portaria.conferences WHERE portaria.active_role() IS NOT NULL ORDER BY created_at DESC LIMIT 100)c $$;
CREATE OR REPLACE FUNCTION public.portaria_movement_evidence(movement_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(photos,'[]'::jsonb) FROM portaria.departures d WHERE d.movement_id=$1 AND portaria.active_role() IS NOT NULL $$;
REVOKE ALL ON FUNCTION public.portaria_register_departure(jsonb),public.portaria_register_conference(uuid,boolean,text),public.portaria_list_conferences(),public.portaria_movement_evidence(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portaria_register_departure(jsonb),public.portaria_register_conference(uuid,boolean,text),public.portaria_list_conferences(),public.portaria_movement_evidence(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION portaria.access_document_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.people%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.people WHERE id=NEW.person_id;
  IF NOT FOUND OR NOT p.is_active THEN RAISE EXCEPTION 'Pessoa inativa ou inexistente.';END IF;
  NEW.person_type:=p.person_type;NEW.person_name:=p.name;
  IF p.person_type='Funcionario' THEN NEW.reason:='';RETURN NEW;END IF;
  IF nullif(btrim(NEW.reason),'') IS NULL OR NEW.document_file_path IS NULL OR NEW.document_file_type IS NULL THEN RAISE EXCEPTION 'Motivo e documento obrigatorios.';END IF;
  IF p.person_type='Visitante' AND NEW.document_file_type NOT IN ('image/jpeg','image/png','image/webp') THEN RAISE EXCEPTION 'Foto do documento do visitante obrigatoria.';END IF;
  IF p.person_type='Terceirizado' AND NEW.document_file_type NOT IN ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif') THEN RAISE EXCEPTION 'Documento do terceirizado invalido.';END IF;
  SELECT name INTO NEW.host_person_name FROM public.people WHERE id=NEW.host_person_id AND person_type='Funcionario' AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Responsavel ativo obrigatorio.';END IF;
  IF split_part(NEW.document_file_path,'/',1)<>p.id::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='access-documents' AND name=NEW.document_file_path AND owner_id=auth.uid()::text AND metadata->>'mimetype'=NEW.document_file_type AND coalesce((metadata->>'size')::bigint,0) BETWEEN 1 AND 10485760) THEN RAISE EXCEPTION 'Documento privado ausente ou invalido.';END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='access-documents' AND NOT public) THEN RAISE EXCEPTION 'Bucket de documentos precisa ser privado antes da ativacao.';END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portaria_access_document ON public.access_records;
CREATE TRIGGER portaria_access_document BEFORE INSERT ON public.access_records FOR EACH ROW EXECUTE FUNCTION portaria.access_document_guard();
CREATE OR REPLACE FUNCTION portaria.return_availability() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE affected_id uuid;
BEGIN
  -- Somente uma devolucao real muda a flag. Edicao ou exclusao de historico
  -- nao presume presenca fisica nem reconcilia automaticamente os 17 casos.
  IF TG_TABLE_NAME='operational_movements' THEN
    IF OLD.status<>'Em aberto' OR NEW.status<>'Concluida' THEN RETURN NULL;END IF;
    affected_id:=NEW.vehicle_id;
  ELSE
    IF OLD.status<>'Em uso' OR NEW.status<>'Devolvido' THEN RETURN NULL;END IF;
    SELECT id INTO affected_id FROM public.vehicles WHERE upper(btrim(plate))=upper(btrim(NEW.vehicle_plate));
  END IF;
  PERFORM 1 FROM public.vehicles WHERE id=affected_id FOR UPDATE;
  UPDATE public.vehicles v SET in_patio=NOT(EXISTS(SELECT 1 FROM public.operational_movements m WHERE (m.vehicle_id=v.id OR upper(btrim(m.vehicle_plate))=upper(btrim(v.plate))) AND m.status='Em aberto') OR EXISTS(SELECT 1 FROM public.vehicle_records r WHERE upper(btrim(r.vehicle_plate))=upper(btrim(v.plate)) AND r.status='Em uso')) WHERE v.id=affected_id;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS portaria_return_availability ON public.operational_movements;
CREATE TRIGGER portaria_return_availability AFTER UPDATE OF status ON public.operational_movements FOR EACH ROW EXECUTE FUNCTION portaria.return_availability();
DROP TRIGGER IF EXISTS portaria_return_availability ON public.vehicle_records;
CREATE TRIGGER portaria_return_availability AFTER UPDATE OF status ON public.vehicle_records FOR EACH ROW EXECUTE FUNCTION portaria.return_availability();
REVOKE ALL ON FUNCTION portaria.access_document_guard(),portaria.return_availability() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION portaria.materialize_checklist() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE phase_name text;source_key text;item record;
BEGIN
 -- Nunca reinterpretar checklists de movimentos anteriores a esta atualizacao.
 IF TG_OP='UPDATE' AND NOT EXISTS(SELECT 1 FROM portaria.departures WHERE movement_id=NEW.id) THEN RETURN NULL;END IF;
 IF TG_OP='INSERT' AND jsonb_typeof(NEW.checklist->'cobli_associated')IS DISTINCT FROM'boolean' THEN RETURN NULL;END IF;
 FOR phase_name,source_key IN SELECT * FROM(VALUES('Saida','exit'),('Entrada','entry'))p(phase_name,source_key)LOOP
  IF TG_OP='UPDATE' AND phase_name='Saida' THEN CONTINUE;END IF;
  IF phase_name='Entrada' AND NEW.status<>'Concluida' THEN CONTINUE;END IF;
  IF jsonb_typeof(NEW.checklist->source_key)IS DISTINCT FROM'object' THEN CONTINUE;END IF;
  FOR item IN SELECT * FROM(VALUES('pneus','Pneus e estepe'),('luzes','Luzes e sinalizacao'),('vidros','Vidros e espelhos'),('limpeza','Limpeza geral'),('odometro','Odometro conferido'),('avarias','Avarias e estado geral'))x(key,label)LOOP
   INSERT INTO public.operational_checklist_items(movement_id,phase,item_key,item_label,is_ok,note)VALUES(NEW.id,phase_name,item.key,item.label,coalesce((NEW.checklist->source_key->item.key->>'ok')::boolean,false),coalesce(NEW.checklist->source_key->item.key->>'note',''))ON CONFLICT(movement_id,phase,item_key)DO NOTHING;
  END LOOP;
 END LOOP;RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS portaria_materialize_checklist ON public.operational_movements;
CREATE TRIGGER portaria_materialize_checklist AFTER INSERT OR UPDATE ON public.operational_movements FOR EACH ROW EXECUTE FUNCTION portaria.materialize_checklist();
REVOKE ALL ON FUNCTION portaria.materialize_checklist() FROM PUBLIC,anon,authenticated;
UPDATE portaria.release_state SET schema_version=2;
COMMIT;
