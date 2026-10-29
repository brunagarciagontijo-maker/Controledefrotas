-- Complemento opcional ao inventario inicial: somente metadados de Storage/Auth e EXECUTE.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT jsonb_build_object(
 'managed_columns',(SELECT jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'name',column_name,'type',udt_name,'nullable',is_nullable='YES')ORDER BY table_schema,table_name,ordinal_position)FROM information_schema.columns WHERE(table_schema='storage' AND table_name IN('buckets','objects'))OR(table_schema='auth' AND table_name IN('users','identities'))),
 'function_grants',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',oidvectortypes(p.proargtypes),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'))ORDER BY n.nspname,p.proname)FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private','portaria')AND p.prokind IN('f','p'))
)AS managed_inventory;
ROLLBACK;
