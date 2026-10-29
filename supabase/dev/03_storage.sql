-- Somente DEV. Buckets privados; nenhuma URL publica persistida.
BEGIN;
SELECT private.assert_dev_environment('REPLACE_WITH_DEV_PROJECT_REF');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname NOT LIKE 'portaria_dev_%') THEN
    RAISE EXCEPTION 'Existem politicas Storage nao previstas. Revise antes de continuar.';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('vehicle-operation-photos','person-documents','access-documents') AND public) THEN
    RAISE EXCEPTION 'Bucket inesperadamente publico. Nao continuar.';
  END IF;
END $$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
('vehicle-operation-photos','vehicle-operation-photos',false,10485760,ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
('person-documents','person-documents',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']),
('access-documents','access-documents',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT(id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE FUNCTION private.storage_target_exists(bucket text, object_name text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE object_id uuid;
BEGIN
  IF object_name LIKE '%..%' OR object_name LIKE '%://%' OR object_name LIKE '%//%'
    OR split_part(object_name,'/',1) !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    OR length(split_part(object_name,'/',2)) = 0 THEN RETURN false; END IF;
  object_id := split_part(object_name,'/',1)::uuid;
  IF bucket IN ('person-documents','access-documents') THEN
    RETURN EXISTS(SELECT 1 FROM public.people WHERE id = object_id);
  ELSIF bucket = 'vehicle-operation-photos' THEN
    RETURN EXISTS(SELECT 1 FROM public.operational_movements WHERE id = object_id);
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION private.storage_target_exists(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.storage_target_exists(text,text) TO authenticated;

CREATE POLICY portaria_dev_read ON storage.objects FOR SELECT TO authenticated USING(
  (SELECT private.app_role()) IS NOT NULL AND private.storage_target_exists(bucket_id,name)
);
CREATE POLICY portaria_dev_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(
  private.storage_target_exists(bucket_id,name) AND (
    (SELECT private.app_role()) = 'admin' OR
    ((SELECT private.app_role()) = 'porteiro' AND bucket_id IN ('access-documents','vehicle-operation-photos'))
  )
);
CREATE POLICY portaria_dev_delete ON storage.objects FOR DELETE TO authenticated USING(
  private.storage_target_exists(bucket_id,name) AND (
    (SELECT private.app_role()) = 'admin' OR
    ((SELECT private.app_role()) = 'porteiro' AND bucket_id IN ('access-documents','vehicle-operation-photos') AND owner_id = auth.uid()::text)
  )
);
-- Sem UPDATE: uploads utilizam upsert=false. Nao alterar RLS global de storage.objects.
COMMIT;
