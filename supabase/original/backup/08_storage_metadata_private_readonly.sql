-- MANIFESTO PRIVADO, NAO RELATORIO: contem nomes/caminhos/metadados de documentos.
-- Uso futuro aprovado com psql --no-psqlrc --quiet --tuples-only --no-align
-- --set=ON_ERROR_STOP=1 --output
-- apontando para armazenamento criptografado FORA do repositorio/sincronizacao.
-- Nao colar resultados no chat, no Git ou em terminal/log compartilhado.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';SET LOCAL TIME ZONE 'UTC';
SELECT jsonb_build_object(
 'format_version',1,
 'snapshot_time',transaction_timestamp(),
 'unexpected_bucket_count',(SELECT count(*)FROM storage.buckets WHERE id NOT IN('access-documents','driver-cnh-documents','person-documents','vehicle-operation-photos')),
 'buckets',(SELECT coalesce(jsonb_agg(to_jsonb(b)ORDER BY id),'[]')FROM storage.buckets b),
 'objects',(SELECT coalesce(jsonb_agg(to_jsonb(o)ORDER BY bucket_id,name,id),'[]')FROM storage.objects o WHERE bucket_id IN('access-documents','driver-cnh-documents','person-documents','vehicle-operation-photos')),
 'limits','Metadados somente; nao contem bytes, hashes de conteudo ou prova de cobertura S3. Comparar inventario completo antes/depois.'
)AS private_storage_metadata;
ROLLBACK;
