-- INVENTARIO SOMENTE LEITURA. Nao executar nenhum pacote DEV no banco original.
-- Conferir o projeto no painel. Exportar apenas a coluna inventory como JSON.
-- Nao consulta linhas de pessoas, usuarios, documentos ou storage.objects.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT jsonb_build_object(
  'format_version', 1,
  'collected_at', transaction_timestamp(),
  'server_version', current_setting('server_version'),
  'tables', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',c.relname,'kind',c.relkind,
    'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity
  ) ORDER BY n.nspname,c.relname),'[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','private','portaria') AND c.relkind IN ('r','p','v','m')),
  'columns', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema',table_schema,'table',table_name,'name',column_name,
    'type',udt_name,'nullable',is_nullable='YES',
    'has_default',column_default IS NOT NULL,
    'default_hash',md5(coalesce(column_default,''))
  ) ORDER BY table_schema,table_name,ordinal_position),'[]'::jsonb)
    FROM information_schema.columns WHERE table_schema IN ('public','private','portaria')),
  'constraints', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'table',c.relname,'name',k.conname,
    'type',k.contype,'validated',k.convalidated,
    'columns',(SELECT jsonb_agg(a.attname ORDER BY keys.ordinality)
      FROM unnest(k.conkey) WITH ORDINALITY keys(attnum,ordinality)
      JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=keys.attnum),
    'references',CASE WHEN k.confrelid<>0 THEN k.confrelid::regclass::text END,
    'definition_hash',md5(pg_get_constraintdef(k.oid))
  ) ORDER BY n.nspname,c.relname,k.conname),'[]'::jsonb)
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private','portaria')),
  'indexes',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'table',t.relname,'name',i.relname,
    'unique',x.indisunique,'valid',x.indisvalid,'definition_hash',md5(pg_get_indexdef(i.oid))
  ) ORDER BY n.nspname,t.relname,i.relname),'[]'::jsonb)
    FROM pg_index x JOIN pg_class t ON t.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname IN ('public','private','portaria')),
  'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',p.proname,'arguments',oidvectortypes(p.proargtypes),
    'returns',pg_get_function_result(p.oid),'security_definer',p.prosecdef,
    'volatility',p.provolatile,'definition_hash',md5(pg_get_functiondef(p.oid)),
    'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
    'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
    'search_path',(SELECT setting FROM unnest(p.proconfig) setting WHERE setting LIKE 'search_path=%' LIMIT 1)
  ) ORDER BY n.nspname,p.proname,oidvectortypes(p.proargtypes)),'[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','private','portaria') AND p.prokind IN ('f','p')),
  'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'table',c.relname,'name',t.tgname,
    'enabled',t.tgenabled,'function_schema',fn.nspname,'function',p.proname,
    'definition_hash',md5(pg_get_triggerdef(t.oid))
  ) ORDER BY n.nspname,c.relname,t.tgname),'[]'::jsonb)
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
    JOIN pg_namespace fn ON fn.oid=p.pronamespace
    WHERE n.nspname IN ('public','private','portaria','auth','storage') AND NOT t.tgisinternal),
  'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema',schemaname,'table',tablename,'name',policyname,
    'permissive',permissive,'roles',roles,'command',cmd,
    'using_hash',md5(coalesce(qual,'')),'check_hash',md5(coalesce(with_check,'')),
    'unconditional_using',qual='true','unconditional_check',with_check='true',
    'uses_auth_uid',coalesce(qual,'') LIKE '%auth.uid()%' OR coalesce(with_check,'') LIKE '%auth.uid()%'
  ) ORDER BY schemaname,tablename,policyname),'[]'::jsonb)
    FROM pg_policies WHERE schemaname IN ('public','private','portaria','storage')),
  'table_grants',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema',table_schema,'table',table_name,'role',grantee,'privilege',privilege_type
  ) ORDER BY table_schema,table_name,grantee,privilege_type),'[]'::jsonb)
    FROM information_schema.table_privileges
    WHERE table_schema IN ('public','private','portaria','storage') AND grantee IN ('anon','authenticated','PUBLIC')),
  'buckets',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types
  ) ORDER BY id),'[]'::jsonb) FROM storage.buckets),
  'auth',jsonb_build_object('users_table',to_regclass('auth.users') IS NOT NULL,
    'identities_table',to_regclass('auth.identities') IS NOT NULL,
    'configuration','Conferir manualmente providers, signup, URLs, MFA e hooks; nao exportar usuarios.'),
  'publications',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'publication',pubname,'schema',schemaname,'table',tablename
  ) ORDER BY pubname,schemaname,tablename),'[]'::jsonb) FROM pg_publication_tables),
  'migration_history_present',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
  'migration_versions', CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
    THEN (SELECT coalesce(jsonb_agg(x.version),'[]'::jsonb)
      FROM XMLTABLE('/table/row' PASSING query_to_xml(
        'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version',false,false,'')
        COLUMNS version text PATH 'version') x)
    ELSE '[]'::jsonb END
) AS inventory;
ROLLBACK;
