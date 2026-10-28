-- MODELO PARA EXECUCAO FUTURA APROVADA. Somente catalogos, totais e capacidades.
-- Nao retorna nomes de pessoas, registros, senhas, chaves ou corpos de funcoes.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
WITH role_state AS(SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user),relations AS(
 SELECT n.nspname AS schema_name,c.oid,c.relrowsecurity,c.relforcerowsecurity,c.relowner
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN('r','p','m')AND n.nspname NOT IN('pg_catalog','information_schema')AND n.nspname NOT LIKE'pg_toast%'AND n.nspname NOT LIKE'pg_temp%'
)
SELECT jsonb_build_object(
 'server_major',current_setting('server_version_num')::integer/10000,
 'database_bytes',pg_database_size(current_database()),
 'required_schemas',jsonb_build_object('auth',to_regnamespace('auth')IS NOT NULL,'storage',to_regnamespace('storage')IS NOT NULL,'migration_history',to_regclass('supabase_migrations.schema_migrations')IS NOT NULL),
 'current_role_superuser',(SELECT rolsuper FROM role_state),
 'current_role_bypasses_rls',(SELECT rolbypassrls FROM role_state),
 'schemas',(SELECT coalesce(jsonb_agg(to_jsonb(s)ORDER BY s.schema_name),'[]')FROM(
  SELECT n.nspname AS schema_name,count(r.oid)AS relations,
   (SELECT count(*)FROM pg_proc p WHERE p.pronamespace=n.oid)AS functions,
   count(r.oid)FILTER(WHERE NOT has_table_privilege(r.oid,'SELECT'))AS without_select,
   count(r.oid)FILTER(WHERE relrowsecurity AND NOT(SELECT rolsuper OR rolbypassrls FROM role_state)AND(relforcerowsecurity OR NOT pg_has_role(relowner,'USAGE')))AS rls_needs_review
  FROM pg_namespace n LEFT JOIN relations r ON r.schema_name=n.nspname
  WHERE n.nspname NOT IN('pg_catalog','information_schema')AND n.nspname NOT LIKE'pg_toast%'AND n.nspname NOT LIKE'pg_temp%'
  GROUP BY n.oid,n.nspname)s),
 'extensions',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',extname,'version',extversion)ORDER BY extname),'[]')FROM pg_extension),
 'large_object_count',(SELECT count(*)FROM pg_largeobject_metadata),
 'cron_table_present',to_regclass('cron.job')IS NOT NULL,
 'vault_table_present',to_regclass('vault.secrets')IS NOT NULL,
 'pgsodium_schema_present',to_regnamespace('pgsodium')IS NOT NULL,
 'network_queue_present',to_regclass('net.http_request_queue')IS NOT NULL,
 'limits','Capacidades de catalogo nao comprovam exportacao integral, chaves de criptografia ou restauracao.'
)AS capabilities;
ROLLBACK;
