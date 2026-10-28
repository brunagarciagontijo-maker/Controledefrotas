-- COMPLEMENTO PONTUAL DO C3: Supabase gerenciado usa supautils para policies.
-- SOMENTE LEITURA; nao testa CREATE POLICY, nao muda owner/roles/permissoes.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';SET LOCAL search_path=pg_catalog;SET LOCAL row_security=off;
WITH configuration AS(SELECT nullif(pg_catalog.current_setting('supautils.policy_grants',true),'')AS policy_grants)
SELECT pg_catalog.jsonb_build_object('audit','storage_platform_capabilities','format_version',1,
 'collected_at',pg_catalog.transaction_timestamp(),'installer_current_user',current_user,
 'transaction_read_only',pg_catalog.current_setting('transaction_read_only'),
 'policy_setting_present',c.policy_grants IS NOT NULL,
 'objects_policy_granted_to_current_role',c.policy_grants::jsonb->current_user ? 'storage.objects',
 'buckets_policy_granted_to_current_role',c.policy_grants::jsonb->current_user ? 'storage.buckets',
 'storage_rls',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('table',t.relname,'enabled',t.relrowsecurity)ORDER BY t.relname)
  FROM pg_catalog.pg_class t JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='storage'AND t.relname IN('objects','buckets')AND t.relkind='r'),
 'application_roles_with_login',(SELECT pg_catalog.count(*)FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated','service_role')AND rolcanlogin),
 'authenticator_schema_settings',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.substr(setting,18)),'[]'::jsonb)
  FROM pg_catalog.pg_db_role_setting d JOIN pg_catalog.pg_roles r ON r.oid=d.setrole
  CROSS JOIN LATERAL pg_catalog.unnest(d.setconfig)setting WHERE r.rolname='authenticator'AND setting LIKE 'pgrst.db_schemas=%'),
 'limits','Configuracao ausente nao comprova proibicao nem permissao. Conferir Data API > Exposed schemas no painel. Nenhum DDL executado.',
 'migration_execution_authorized',false)AS storage_capabilities FROM configuration c;
ROLLBACK;
