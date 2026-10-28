-- Diagnostico agregado adicional. Nao baixa arquivos nem acessa URLs persistidas.
-- Apenas contagens/nomes dos quatro buckets ja inventariados. Nenhum ID pessoal,
-- caminho, URL, token, nome de pessoa ou documento e retornado.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
WITH outside_review AS (
  SELECT v.status FROM public.vehicles v
  WHERE NOT v.in_patio
    AND NOT EXISTS(SELECT 1 FROM public.operational_movements m WHERE m.status='Em aberto' AND (m.vehicle_id=v.id OR upper(btrim(m.vehicle_plate))=upper(btrim(v.plate))))
    AND NOT EXISTS(SELECT 1 FROM public.vehicle_records r WHERE r.status='Em uso' AND upper(btrim(r.vehicle_plate))=upper(btrim(v.plate)))
), document_refs AS (
  SELECT 'person'::text AS kind,p.id,nullif(btrim(p.cnh_file_path),'') AS path,
    ARRAY['person-documents','driver-cnh-documents']::text[] AS buckets,
    coalesce(p.cnh_file_url ~* '^https?://',false) AS has_http_url
  FROM public.people p WHERE nullif(btrim(p.cnh_file_path),'') IS NOT NULL OR nullif(btrim(p.cnh_file_url),'') IS NOT NULL
  UNION ALL SELECT 'access',a.id,nullif(btrim(a.document_file_path),''),ARRAY['access-documents'],false
  FROM public.access_records a WHERE nullif(btrim(a.document_file_path),'') IS NOT NULL
  UNION ALL SELECT 'movement_photo',p.id,nullif(btrim(p.file_path),''),ARRAY['vehicle-operation-photos'],false
  FROM public.operational_photos p
), matches AS (
  SELECT r.kind,r.id,r.path,r.has_http_url,count(o.id) AS object_matches
  FROM document_refs r LEFT JOIN storage.objects o ON o.name=r.path AND o.bucket_id=ANY(r.buckets)
  GROUP BY r.kind,r.id,r.path,r.has_http_url
)
SELECT jsonb_build_object(
  'outside_without_open_by_status',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) FROM(SELECT status,count(*) AS total FROM outside_review GROUP BY status ORDER BY status)s),
  'document_references',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) FROM(
    SELECT kind,count(*) AS total,
      count(*) FILTER(WHERE path IS NULL) AS without_path,
      count(*) FILTER(WHERE path IS NOT NULL AND object_matches=0) AS missing_object,
      count(*) FILTER(WHERE object_matches=1) AS unique_object,
      count(*) FILTER(WHERE object_matches>1) AS ambiguous_object
    FROM matches GROUP BY kind ORDER BY kind)s),
  'person_http_urls',(SELECT jsonb_build_object(
    'total',count(*),'without_path',count(*) FILTER(WHERE path IS NULL),
    'with_missing_object',count(*) FILTER(WHERE path IS NOT NULL AND object_matches=0),
    'with_unique_object',count(*) FILTER(WHERE object_matches=1),
    'with_ambiguous_object',count(*) FILTER(WHERE object_matches>1)) FROM matches WHERE kind='person' AND has_http_url),
  'storage_metadata',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) FROM(
    SELECT b.id AS bucket,b.public,count(o.id) AS object_count,
      coalesce(sum(CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,18}$' THEN (o.metadata->>'size')::bigint ELSE 0 END),0) AS reported_bytes,
      count(o.id) FILTER(WHERE o.owner_id IS NULL) AS without_owner
    FROM storage.buckets b LEFT JOIN storage.objects o ON o.bucket_id=b.id
    WHERE b.id IN('person-documents','driver-cnh-documents','access-documents','vehicle-operation-photos')
    GROUP BY b.id,b.public ORDER BY b.id)s),
  'limits','Objeto listado nao comprova bytes recuperaveis. URL HTTP nao comprova exposicao nem origem. Nenhuma URL foi acessada; nenhum estado de patio foi alterado.'
) AS review;
ROLLBACK;
