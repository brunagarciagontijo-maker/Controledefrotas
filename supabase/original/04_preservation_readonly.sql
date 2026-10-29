-- Salvar antes e depois da janela SEM operacoes concorrentes; comparar por tabela.
-- Retorna somente totais e SHA-256 agregados, nunca IDs ou conteudo de registros.
-- Compara todos os campos originais: subtrai apenas as seis colunas de autoria
-- ausentes no inventario inicial e adicionadas por 002. Nao comprova backup nem
-- a integridade dos arquivos binarios Storage; estes exigem manifesto separado.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL TIME ZONE 'UTC';
WITH expected_tables(name) AS (
  VALUES('access_records'),('drivers'),('operational_checklist_items'),('operational_movements'),('operational_photos'),('people'),('personal_vehicles'),('vehicle_inspection_requests'),('vehicle_records'),('vehicles')
), historical_rows AS (
  SELECT 'access_records' AS name,id::text AS row_id,to_jsonb(t)-'created_by' AS content FROM public.access_records t
  UNION ALL SELECT 'drivers',id::text,to_jsonb(t) FROM public.drivers t
  UNION ALL SELECT 'operational_checklist_items',id::text,to_jsonb(t) FROM public.operational_checklist_items t
  UNION ALL SELECT 'operational_movements',id::text,to_jsonb(t)-'created_by' FROM public.operational_movements t
  UNION ALL SELECT 'operational_photos',id::text,to_jsonb(t)-'created_by' FROM public.operational_photos t
  UNION ALL SELECT 'people',id::text,to_jsonb(t) FROM public.people t
  UNION ALL SELECT 'personal_vehicles',id::text,to_jsonb(t) FROM public.personal_vehicles t
  UNION ALL SELECT 'vehicle_inspection_requests',id::text,to_jsonb(t)-ARRAY['requested_by_user_id','completed_by_user_id'] FROM public.vehicle_inspection_requests t
  UNION ALL SELECT 'vehicle_records',id::text,to_jsonb(t)-'created_by' FROM public.vehicle_records t
  UNION ALL SELECT 'vehicles',id::text,to_jsonb(t) FROM public.vehicles t
), row_hashes AS (
  SELECT name,row_id,encode(sha256(convert_to(content::text,'UTF8')),'hex') AS row_sha256 FROM historical_rows
)
SELECT e.name AS table_name,count(h.row_id) AS row_count,
  encode(sha256(convert_to(coalesce(string_agg(h.row_id||':'||h.row_sha256,E'\n' ORDER BY h.row_id COLLATE "C"),''),'UTF8')),'hex') AS original_columns_sha256
FROM expected_tables e LEFT JOIN row_hashes h ON h.name=e.name
GROUP BY e.name ORDER BY e.name;
ROLLBACK;
