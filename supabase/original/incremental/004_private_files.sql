-- CANDIDATO. Muda acesso dos buckets, preservando objetos e caminhos existentes.
-- Somente em janela aprovada, com estrategia de recuperacao aceita e frontend privado pronto.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM portaria.release_state WHERE project_ref='REPLACE_PROJECT_REF' AND recovery_strategy='REPLACE_RECOVERY_STRATEGY' AND recovery_evidence_sha256='REPLACE_RECOVERY_EVIDENCE_SHA256' AND schema_version=2) OR 'REPLACE_SQL_APPROVAL'<>'APROVADO_EXPLICITAMENTE' THEN RAISE EXCEPTION 'Revisao/recuperacao/aprovacao nao correspondem.';END IF;
  IF(SELECT count(*) FROM storage.buckets WHERE id IN ('vehicle-operation-photos','person-documents','access-documents','driver-cnh-documents') AND public IS FALSE)<>4 THEN RAISE EXCEPTION 'Conferir os quatro buckets existentes e sua privacidade pelo painel/API Storage em operacao aprovada separadamente.';END IF;
END $$;
-- Nao contornar triggers de protecao do servico Storage com SQL direto.
-- Supabase permite policies via supautils, sem ownership. Grants gerenciados nao sao revogaveis por postgres.
-- Nao fingir que REVOKE remove grants do provedor; manter ownership e fechar mutacoes via RLS.
DO $$DECLARE owner_access boolean;policy_config jsonb;BEGIN
 SELECT pg_has_role(relowner,'USAGE')INTO owner_access FROM pg_class WHERE oid='storage.objects'::regclass;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='storage.buckets'::regclass AND relrowsecurity)THEN RAISE EXCEPTION 'RLS gerenciada deve estar habilitada; nao alterar tabelas Storage.';END IF;
 IF owner_access THEN
  REVOKE ALL ON storage.buckets FROM PUBLIC,anon,authenticated;
  REVOKE ALL ON storage.objects FROM PUBLIC,anon,authenticated;
 ELSE
  policy_config:=nullif(current_setting('supautils.policy_grants',true),'')::jsonb;
  IF NOT coalesce(policy_config->current_user ? 'storage.objects',false)OR NOT coalesce(policy_config->current_user ? 'storage.buckets',false)THEN RAISE EXCEPTION 'Suporte gerenciado a policies nao comprovado. Conferir 10_storage_platform_readonly.sql; nao trocar owner/roles.';END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('anon','authenticated')AND rolcanlogin)THEN RAISE EXCEPTION 'Papeis da aplicacao nao podem ter login SQL direto.';END IF;
 END IF;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;
DROP POLICY IF EXISTS portaria_bucket_read_gate ON storage.buckets;
CREATE POLICY portaria_bucket_read_gate ON storage.buckets AS RESTRICTIVE FOR SELECT TO anon,authenticated USING((SELECT portaria.active_role())IS NOT NULL AND id IN('person-documents','driver-cnh-documents','access-documents','vehicle-operation-photos','portaria-evidence','portaria-parcels'));
DROP POLICY IF EXISTS portaria_bucket_read ON storage.buckets;
CREATE POLICY portaria_bucket_read ON storage.buckets FOR SELECT TO authenticated USING((SELECT portaria.active_role())IS NOT NULL);
DROP POLICY IF EXISTS portaria_bucket_no_insert ON storage.buckets;
CREATE POLICY portaria_bucket_no_insert ON storage.buckets AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(false);
DROP POLICY IF EXISTS portaria_bucket_no_update ON storage.buckets;
CREATE POLICY portaria_bucket_no_update ON storage.buckets AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(false)WITH CHECK(false);
DROP POLICY IF EXISTS portaria_bucket_no_delete ON storage.buckets;
CREATE POLICY portaria_bucket_no_delete ON storage.buckets AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(false);
DROP POLICY IF EXISTS portaria_storage_insert_role ON storage.objects;
CREATE POLICY portaria_storage_insert_role ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
 bucket_id NOT IN ('person-documents','driver-cnh-documents') OR (SELECT portaria.active_role())='admin'
);
DROP POLICY IF EXISTS portaria_storage_update_role ON storage.objects;
CREATE POLICY portaria_storage_update_role ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(
 bucket_id NOT IN ('person-documents','driver-cnh-documents','access-documents','vehicle-operation-photos')
) WITH CHECK(bucket_id NOT IN ('person-documents','driver-cnh-documents','access-documents','vehicle-operation-photos'));
DROP POLICY IF EXISTS portaria_storage_delete_role ON storage.objects;
CREATE POLICY portaria_storage_delete_role ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(
 bucket_id NOT IN ('person-documents','driver-cnh-documents','access-documents','vehicle-operation-photos')
);
CREATE OR REPLACE FUNCTION public.portaria_document_bucket(file_path text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE matches integer;result text;
BEGIN
  IF portaria.active_role() IS NULL OR NOT EXISTS(SELECT 1 FROM public.people p WHERE p.cnh_file_path=$1) THEN RAISE EXCEPTION 'Documento nao autorizado.' USING ERRCODE='42501';END IF;
  SELECT count(*),min(o.bucket_id) INTO matches,result FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id WHERE o.name=$1 AND o.bucket_id IN ('person-documents','driver-cnh-documents') AND NOT b.public;
  IF matches<>1 THEN RAISE EXCEPTION 'Documento ausente ou caminho ambiguo; revisar Storage sem fallback.';END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.portaria_document_bucket(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portaria_document_bucket(text) TO authenticated;
COMMIT;
