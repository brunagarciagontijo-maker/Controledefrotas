-- Verificacao administrativa de estrutura. Nao substitui testes RLS como usuario.
BEGIN;
SELECT private.assert_dev_environment('REPLACE_WITH_DEV_PROJECT_REF');
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles','vehicle_records','people','drivers','personal_vehicles','access_records','operational_movements','operational_photos','operational_checklist_items','vehicle_inspection_requests'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'RLS ausente na tabela %.',t;
    END IF;
    IF has_table_privilege('anon',format('public.%I',t),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
      RAISE EXCEPTION 'Privilegio anonimo inesperado na tabela %.',t;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated','private.app_profiles','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'A estrutura de perfis esta exposta.';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND (qual='true' OR with_check='true')) THEN
    RAISE EXCEPTION 'Politica publica ampla encontrada.';
  END IF;
  IF (SELECT count(*) FROM storage.buckets WHERE id IN ('vehicle-operation-photos','person-documents','access-documents') AND NOT public AND file_size_limit=10485760) <> 3 THEN
    RAISE EXCEPTION 'Buckets privados ou limites incorretos.';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='operational_movements' AND column_name='driver_cnh_valid_until' AND is_nullable<>'YES') THEN
    RAISE EXCEPTION 'Validade opcional de CNH nao foi preparada.';
  END IF;
  IF (SELECT count(*) FROM private.app_profiles WHERE is_active AND role='admin') < 1 THEN
    RAISE EXCEPTION 'Nenhum administrador DEV habilitado.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.operational_photos WHERE file_url<>'') OR EXISTS(SELECT 1 FROM public.people WHERE coalesce(cnh_file_url,'')<>'') THEN
    RAISE EXCEPTION 'URLs persistidas de arquivos nao sao permitidas.';
  END IF;
END $$;
SELECT 'Estrutura DEV verificada. Teste os perfis e arquivos pelo aplicativo.' AS resultado;
COMMIT;
