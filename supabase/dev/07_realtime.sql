-- Execute SOMENTE depois de validar os perfis. Habilita apenas inspecoes.
BEGIN;
SELECT private.assert_dev_environment('REPLACE_WITH_DEV_PROJECT_REF');
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    RAISE EXCEPTION 'Publicacao Supabase Realtime ausente. Confira o projeto.';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='vehicle_inspection_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_inspection_requests;
  END IF;
END $$;
COMMIT;
