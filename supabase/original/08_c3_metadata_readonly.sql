-- AUDITORIA COMPLEMENTAR C3. SOMENTE LEITURA. NAO E MIGRATION.
-- Executar inteiro, apenas no projeto original confirmado no painel.
-- Papel instalador auditado = current_user desta sessao; nao faz SET ROLE.
-- Nao le linhas de Auth/aplicacao/Storage nem executa geradores de IDs.
-- Salvar somente a coluna c3 em .secrets/original-c3.json; preservar auditorias.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='60s';
SET LOCAL lock_timeout='5s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL search_path=pg_catalog;
SET LOCAL row_security=off;

-- Guarda de recursos e acesso a catalogos; SELECT de tabelas de negocio nao e necessario.
-- PostgreSQL >=17: usa flags de membership introduzidas antes da versao 17.
WITH required_catalogs(name) AS (VALUES
 ('pg_namespace'),('pg_class'),('pg_attribute'),('pg_attrdef'),('pg_depend'),
 ('pg_sequence'),('pg_sequences'),('pg_roles'),('pg_auth_members'),('pg_constraint'),
 ('pg_index'),('pg_proc'),('pg_trigger'),('pg_event_trigger'),('pg_default_acl'),('pg_language'))
SELECT 1 / CASE WHEN
 pg_catalog.current_setting('server_version_num')::integer>=170000
 AND pg_catalog.current_setting('transaction_read_only')='on'
 AND pg_catalog.current_setting('transaction_isolation')='repeatable read'
 AND pg_catalog.current_setting('row_security')='off'
 AND pg_catalog.has_schema_privilege('pg_catalog','USAGE')
 AND (SELECT pg_catalog.bool_and(pg_catalog.has_table_privilege('pg_catalog.'||name,'SELECT')) FROM required_catalogs)
 AND (SELECT pg_catalog.count(*)=2 FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated'))
 AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to('abc','UTF8')),'hex')=
 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
 THEN 1 ELSE 0 END AS c3_catalog_guard;

WITH RECURSIVE role_names(label,name) AS (VALUES
 ('installer_current',current_user::text),('session_origin',session_user::text),
 ('app_anon','anon'),('app_authenticated','authenticated'),('server_service_role','service_role')),
roles AS (
 SELECT x.label,x.name,r.oid,r.rolsuper,r.rolinherit,r.rolbypassrls
 FROM role_names x LEFT JOIN pg_catalog.pg_roles r ON r.rolname=x.name
),
role_membership_closure(oid) AS (
 SELECT oid FROM roles WHERE oid IS NOT NULL
 UNION
 SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN role_membership_closure c ON c.oid=m.member
),
installer AS (SELECT * FROM roles WHERE label='installer_current'),
expected_schemas(name) AS (VALUES('public'),('auth'),('storage')),
schemas AS (
 SELECT e.name,n.oid,n.nspowner,
  pg_catalog.pg_has_role((SELECT oid FROM installer),n.nspowner,'USAGE') AS owner_authority,
  pg_catalog.has_schema_privilege(n.oid,'USAGE') AS schema_usage,
  pg_catalog.has_schema_privilege(n.oid,'CREATE') AS schema_create
 FROM expected_schemas e LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=e.name
),
expected_relations(schema_name,table_name,ownership_required) AS (VALUES
 ('public','access_records',true),('public','drivers',true),('public','operational_checklist_items',true),
 ('public','operational_movements',true),('public','operational_photos',true),('public','people',true),
 ('public','personal_vehicles',true),('public','vehicle_inspection_requests',true),
 ('public','vehicle_records',true),('public','vehicles',true),
 ('storage','objects',true),('storage','buckets',false),('auth','users',false)),
relations AS (
 SELECT e.*,c.oid,c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,
  pg_catalog.pg_has_role((SELECT oid FROM installer),c.relowner,'USAGE') AS owner_authority,
  pg_catalog.pg_has_role((SELECT oid FROM installer),c.relowner,'SET') AS could_set_owner_role,
  pg_catalog.has_table_privilege(c.oid,'SELECT') AS select_granted,
  pg_catalog.row_security_active(c.oid) AS installer_rls_active
 FROM expected_relations e LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=e.schema_name
 LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=e.table_name
),
sequences AS (
 SELECT c.oid,c.relname,n.nspname,c.relowner,c.relacl,q.seqstart,q.seqmin,q.seqmax,
  q.seqincrement,q.seqcache,q.seqcycle,v.last_value,
  EXISTS(SELECT 1 FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_attrdef a ON a.oid=d.objid
   JOIN pg_catalog.pg_class t ON t.oid=a.adrelid JOIN pg_catalog.pg_namespace tn ON tn.oid=t.relnamespace
   WHERE d.classid='pg_catalog.pg_attrdef'::pg_catalog.regclass AND d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass
   AND d.refobjid=c.oid AND tn.nspname='public'
   AND t.relname IN('vehicles','people','personal_vehicles','access_records','operational_movements')) AS covered_by_002_grant
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_sequence q ON q.seqrelid=c.oid
 LEFT JOIN pg_catalog.pg_sequences v ON v.schemaname=n.nspname AND v.sequencename=c.relname
 WHERE c.relkind='S' AND n.nspname<>'information_schema' AND n.nspname!~'^pg_'
),
auth_relations AS (
 SELECT c.oid,c.relname,c.relkind,c.relowner,c.relrowsecurity,c.relforcerowsecurity
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='auth' AND c.relkind IN('r','p')
),
auth_id AS (
 SELECT r.oid AS table_oid,r.relkind,a.attnum,a.atttypid,a.attnotnull,
  pg_catalog.has_column_privilege(r.oid,a.attnum,'REFERENCES') AS installer_references,
  EXISTS(SELECT 1 FROM pg_catalog.pg_index i WHERE i.indrelid=r.oid AND i.indisunique
   AND i.indisvalid AND i.indisready AND i.indimmediate AND i.indnkeyatts=1
   AND i.indkey[0]=a.attnum AND i.indpred IS NULL AND i.indexprs IS NULL) AS eligible_unique_key
 FROM relations r LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid AND a.attname='id'
  AND a.attnum>0 AND NOT a.attisdropped
 WHERE r.schema_name='auth' AND r.table_name='users'
),
functions AS (
 SELECT p.oid,p.proname,n.nspname,p.proowner,p.prosecdef,p.provolatile,p.proargtypes,
  p.prorettype,l.lanname
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_catalog.pg_language l ON l.oid=p.prolang
 WHERE p.prokind IN('f','p') AND (
  n.nspname IN('public','private','portaria') AND
   (p.proname IN('generate_short_code','generate_vehicle_mobile_code','update_updated_at_column') OR p.proname LIKE 'portaria\_%' ESCAPE '\')
  OR n.nspname='auth' AND p.proname='uid' AND p.pronargs=0)
),
languages AS (
 SELECT x.name,l.oid,l.lanpltrusted,pg_catalog.has_language_privilege(l.oid,'USAGE') AS installer_usage
 FROM (VALUES('sql'),('plpgsql'))x(name) LEFT JOIN pg_catalog.pg_language l ON l.lanname=x.name
),
checks AS (
 SELECT 'installer_is_not_application_role' AS check_name,'current_user' AS object_name,
  CASE WHEN current_user::text IN('anon','authenticated','service_role') THEN 'blocked' ELSE 'pass' END AS result
 UNION ALL SELECT 'create_schema_in_database','portaria',
  CASE WHEN pg_catalog.has_database_privilege(pg_catalog.current_database(),'CREATE') THEN 'pass' ELSE 'blocked' END
 UNION ALL SELECT 'expected_schema_usage',name,CASE WHEN schema_usage IS TRUE THEN 'pass' ELSE 'blocked' END FROM schemas
 UNION ALL SELECT 'create_public_functions','public',CASE WHEN schema_create IS TRUE THEN 'pass' ELSE 'blocked' END FROM schemas WHERE name='public'
 UNION ALL SELECT 'expected_physical_relation',schema_name||'.'||table_name,
  CASE WHEN oid IS NOT NULL AND relkind='r' THEN 'pass' ELSE 'blocked' END FROM relations
 UNION ALL SELECT 'alter_trigger_policy_owner_authority',schema_name||'.'||table_name,
  CASE WHEN owner_authority IS TRUE THEN 'pass' ELSE 'blocked' END FROM relations WHERE ownership_required
 UNION ALL SELECT 'bucket_acl_revoke_authority','storage.buckets',
  CASE WHEN owner_authority IS TRUE THEN 'pass' ELSE 'needs_review' END FROM relations WHERE schema_name='storage' AND table_name='buckets'
 UNION ALL SELECT 'auth_users_id_uuid_not_null','auth.users.id',
  CASE WHEN atttypid='pg_catalog.uuid'::pg_catalog.regtype AND attnotnull IS TRUE THEN 'pass' ELSE 'blocked' END FROM auth_id
 UNION ALL SELECT 'auth_users_id_eligible_unique_key','auth.users.id',CASE WHEN eligible_unique_key THEN 'pass' ELSE 'blocked' END FROM auth_id
 UNION ALL SELECT 'auth_users_id_references','auth.users.id',CASE WHEN installer_references IS TRUE THEN 'pass' ELSE 'blocked' END FROM auth_id
 UNION ALL SELECT 'function_language_usage',name,CASE WHEN installer_usage IS TRUE THEN 'pass' ELSE 'blocked' END FROM languages
 UNION ALL SELECT 'auth_uid_available_to_installer','auth.uid()',CASE WHEN EXISTS(
  SELECT 1 FROM functions WHERE nspname='auth' AND proname='uid' AND prorettype='pg_catalog.uuid'::pg_catalog.regtype
   AND pg_catalog.has_function_privilege(oid,'EXECUTE')) THEN 'pass' ELSE 'blocked' END
 UNION ALL SELECT 'fresh_portaria_namespace','portaria',CASE WHEN pg_catalog.to_regnamespace('portaria') IS NULL THEN 'pass' ELSE 'needs_review' END
 UNION ALL SELECT 'existing_portaria_rpc_review','public.portaria_*',CASE WHEN EXISTS(
  SELECT 1 FROM functions WHERE nspname='public' AND proname LIKE 'portaria\_%' ESCAPE '\') THEN 'needs_review' ELSE 'pass' END
 UNION ALL SELECT 'ddl_event_triggers_review','database',CASE WHEN EXISTS(
  SELECT 1 FROM pg_catalog.pg_event_trigger WHERE evtenabled<>'D') THEN 'needs_review' ELSE 'pass' END
)
SELECT pg_catalog.jsonb_build_object(
 'format_version',1,'audit','original_complement_c3','collected_at',pg_catalog.transaction_timestamp(),
 'server_major',pg_catalog.current_setting('server_version_num')::integer/10000,
 'context',pg_catalog.jsonb_build_object('installer_current_user',current_user,'session_user',session_user,
  'transaction_read_only',pg_catalog.current_setting('transaction_read_only'),
  'transaction_isolation',pg_catalog.current_setting('transaction_isolation'),
  'row_security',pg_catalog.current_setting('row_security'),'search_path',pg_catalog.current_setting('search_path'),
  'application_rows_read',false,'sequence_calls_executed',false,'installer_role_switch_executed',false),
 'roles',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('label',label,'role',name,
  'present',oid IS NOT NULL,'superuser',rolsuper,'inherits',rolinherit,'bypass_rls',rolbypassrls) ORDER BY label) FROM roles),
 'memberships',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'member',member.rolname,'granted_role',parent.rolname,'grantor',grantor.rolname,
  'admin_option',m.admin_option,'inherit_option',m.inherit_option,'set_option',m.set_option)
  ORDER BY member.rolname,parent.rolname),'[]'::jsonb)
  FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles member ON member.oid=m.member
  JOIN pg_catalog.pg_roles parent ON parent.oid=m.roleid LEFT JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor
  WHERE m.member IN(SELECT oid FROM role_membership_closure)),
 'schemas',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',s.name,'present',s.oid IS NOT NULL,
  'owner',o.rolname,'installer_owner_authority',s.owner_authority,'installer_usage',s.schema_usage,
  'installer_create',s.schema_create,'installer_usage_grant_option',pg_catalog.has_schema_privilege(s.oid,'USAGE WITH GRANT OPTION')) ORDER BY s.name)
  FROM schemas s LEFT JOIN pg_catalog.pg_roles o ON o.oid=s.nspowner),
 'installation_relations',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'schema',r.schema_name,'table',r.table_name,'present',r.oid IS NOT NULL,'kind',r.relkind,'owner',o.rolname,
  'ownership_required_for_alter_or_policy',r.ownership_required,'installer_owner_authority',r.owner_authority,
  'installer_could_set_owner_role',r.could_set_owner_role,'installer_select_granted',r.select_granted,
  'installer_rls_active',r.installer_rls_active,'rls_enabled',r.relrowsecurity,'force_rls',r.relforcerowsecurity,
  'effective_privileges',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role_label',x.label,
   'select_granted',pg_catalog.has_table_privilege(x.oid,r.oid,'SELECT'),
   'insert_granted',pg_catalog.has_table_privilege(x.oid,r.oid,'INSERT'),
   'update_granted',pg_catalog.has_table_privilege(x.oid,r.oid,'UPDATE'),
   'delete_granted',pg_catalog.has_table_privilege(x.oid,r.oid,'DELETE'),
   'truncate_granted',pg_catalog.has_table_privilege(x.oid,r.oid,'TRUNCATE'),
   'references_granted',pg_catalog.has_table_privilege(x.oid,r.oid,'REFERENCES'),
   'trigger_granted',pg_catalog.has_table_privilege(x.oid,r.oid,'TRIGGER'),
   'references_id_granted',CASE WHEN r.schema_name='auth' THEN
    (SELECT pg_catalog.has_column_privilege(x.oid,r.oid,a.attnum,'REFERENCES') FROM pg_catalog.pg_attribute a
     WHERE a.attrelid=r.oid AND a.attname='id' AND a.attnum>0 AND NOT a.attisdropped) END) ORDER BY x.label) FROM roles x),
  'acl',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END,
   'grantor',go.rolname,'privilege',a.privilege_type,'grant_option',a.is_grantable)
   ORDER BY a.grantee,a.grantor,a.privilege_type),'[]'::jsonb)
   FROM pg_catalog.aclexplode(coalesce(r.relacl,pg_catalog.acldefault('r',r.relowner)))a
   LEFT JOIN pg_catalog.pg_roles gr ON gr.oid=a.grantee LEFT JOIN pg_catalog.pg_roles go ON go.oid=a.grantor),
  'column_acl',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('column',c.attname,
   'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END,'grantor',go.rolname,
   'privilege',a.privilege_type,'grant_option',a.is_grantable) ORDER BY c.attnum,a.grantee,a.privilege_type),'[]'::jsonb)
   FROM pg_catalog.pg_attribute c CROSS JOIN LATERAL pg_catalog.aclexplode(c.attacl)a
   LEFT JOIN pg_catalog.pg_roles gr ON gr.oid=a.grantee LEFT JOIN pg_catalog.pg_roles go ON go.oid=a.grantor
   WHERE c.attrelid=r.oid AND c.attnum>0 AND NOT c.attisdropped
    AND (r.schema_name<>'auth' OR c.attname='id')))
  ORDER BY r.schema_name,r.table_name) FROM relations r LEFT JOIN pg_catalog.pg_roles o ON o.oid=r.relowner),
 'sequences',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'oid',s.oid,'schema',s.nspname,'name',s.relname,'owner',o.rolname,
  'installer_owner_authority',pg_catalog.pg_has_role((SELECT oid FROM installer),s.relowner,'USAGE'),
  'installer_could_set_owner_role',pg_catalog.pg_has_role((SELECT oid FROM installer),s.relowner,'SET'),
  'start',s.seqstart::text,'min',s.seqmin::text,'max',s.seqmax::text,
  'increment',s.seqincrement::text,'cache',s.seqcache::text,'cycle',s.seqcycle,'last_reserved_value',s.last_value::text,
  'remaining_unreserved_positions',CASE WHEN s.last_value IS NOT NULL AND NOT s.seqcycle THEN
   greatest(0::numeric,pg_catalog.floor(CASE WHEN s.seqincrement>0 THEN (s.seqmax::numeric-s.last_value)/s.seqincrement
    ELSE (s.last_value::numeric-s.seqmin)/(-s.seqincrement::numeric) END))::text END,
  'capacity_evidence',CASE WHEN s.last_value IS NULL THEN 'unknown_unstarted_or_no_privilege_or_standby'
   WHEN s.seqcycle THEN 'cycle_requires_collision_review' ELSE 'reserved_boundary_not_exact_available_ids' END,
  'covered_by_002_default_dependency_grant',s.covered_by_002_grant,
  'effective_privileges',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role_label',r.label,
   'schema_usage',pg_catalog.has_schema_privilege(r.oid,s.nspname,'USAGE'),
   'usage',pg_catalog.has_sequence_privilege(r.oid,s.oid,'USAGE'),'select',pg_catalog.has_sequence_privilege(r.oid,s.oid,'SELECT'),
   'update',pg_catalog.has_sequence_privilege(r.oid,s.oid,'UPDATE'),
   'can_advance_by_oid',pg_catalog.has_sequence_privilege(r.oid,s.oid,'USAGE') OR pg_catalog.has_sequence_privilege(r.oid,s.oid,'UPDATE'),
   'installer_can_grant_usage',CASE WHEN r.label='installer_current' THEN pg_catalog.has_sequence_privilege(s.oid,'USAGE WITH GRANT OPTION') END,
   'installer_can_grant_schema_usage',CASE WHEN r.label='installer_current' THEN pg_catalog.has_schema_privilege(s.nspname,'USAGE WITH GRANT OPTION') END)
   ORDER BY r.label) FROM roles r),
  'acl',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END,
   'grantor',go.rolname,'privilege',a.privilege_type,'grant_option',a.is_grantable)
   ORDER BY a.grantee,a.grantor,a.privilege_type),'[]'::jsonb)
   FROM pg_catalog.aclexplode(coalesce(s.relacl,pg_catalog.acldefault('S',s.relowner)))a
   LEFT JOIN pg_catalog.pg_roles gr ON gr.oid=a.grantee LEFT JOIN pg_catalog.pg_roles go ON go.oid=a.grantor),
  'ownership_dependencies',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',n.nspname,
   'table',c.relname,'column',a.attname,'kind',d.deptype) ORDER BY n.nspname,c.relname,a.attname),'[]'::jsonb)
   FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_class c ON c.oid=d.refobjid
   JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=d.refobjsubid
   WHERE d.classid='pg_catalog.pg_class'::pg_catalog.regclass AND d.objid=s.oid
    AND d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass AND d.deptype IN('a','i')),
  'catalog_dependency_edges',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('dependent_catalog',dc.relname,
   'dependent_oid',d.objid,'dependent_sub_id',d.objsubid,'referenced_catalog',rc.relname,
   'referenced_oid',d.refobjid,'referenced_sub_id',d.refobjsubid,'kind',d.deptype)
   ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid),'[]'::jsonb)
   FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_class dc ON dc.oid=d.classid JOIN pg_catalog.pg_class rc ON rc.oid=d.refclassid
   WHERE d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass AND d.refobjid=s.oid
    OR d.classid='pg_catalog.pg_class'::pg_catalog.regclass AND d.objid=s.oid),
  'default_dependencies',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',n.nspname,'table',t.relname,
   'column',a.attname,'kind',d.deptype,'default_hash',pg_catalog.md5(pg_catalog.pg_get_expr(ad.adbin,ad.adrelid)))
   ORDER BY n.nspname,t.relname,a.attname),'[]'::jsonb)
   FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_attrdef ad ON ad.oid=d.objid JOIN pg_catalog.pg_class t ON t.oid=ad.adrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum=ad.adnum
   WHERE d.classid='pg_catalog.pg_attrdef'::pg_catalog.regclass AND d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass AND d.refobjid=s.oid),
  'catalog_function_dependencies',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',n.nspname,
   'name',p.proname,'arguments',pg_catalog.oidvectortypes(p.proargtypes),'kind',d.deptype) ORDER BY n.nspname,p.proname,p.oid),'[]'::jsonb)
   FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_proc p ON p.oid=d.objid JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE d.classid='pg_catalog.pg_proc'::pg_catalog.regclass AND d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass AND d.refobjid=s.oid))
  ORDER BY s.nspname,s.relname),'[]'::jsonb) FROM sequences s LEFT JOIN pg_catalog.pg_roles o ON o.oid=s.relowner),
 'generators_and_auth_uid',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',f.oid,'schema',f.nspname,'name',f.proname,
  'arguments',pg_catalog.oidvectortypes(f.proargtypes),'returns',pg_catalog.pg_get_function_result(f.oid),'owner',o.rolname,
  'security_definer',f.prosecdef,'volatility',f.provolatile,'language',f.lanname,
  'definition_hash',pg_catalog.md5(pg_catalog.pg_get_functiondef(f.oid)),
  'installer_owner_authority',pg_catalog.pg_has_role((SELECT oid FROM installer),f.proowner,'USAGE'),
  'execute_privileges',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role_label',r.label,
   'execute',pg_catalog.has_function_privilege(r.oid,f.oid,'EXECUTE')) ORDER BY r.label) FROM roles r),
  'default_dependents',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',n.nspname,'table',t.relname,
   'column',a.attname) ORDER BY n.nspname,t.relname,a.attname),'[]'::jsonb)
   FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_attrdef ad ON ad.oid=d.objid JOIN pg_catalog.pg_class t ON t.oid=ad.adrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum=ad.adnum
   WHERE d.classid='pg_catalog.pg_attrdef'::pg_catalog.regclass AND d.refclassid='pg_catalog.pg_proc'::pg_catalog.regclass AND d.refobjid=f.oid))
  ORDER BY f.nspname,f.proname,pg_catalog.oidvectortypes(f.proargtypes)),'[]'::jsonb) FROM functions f LEFT JOIN pg_catalog.pg_roles o ON o.oid=f.proowner),
 'auth_relations',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',a.oid,'table',a.relname,'kind',a.relkind,
  'owner',r.rolname,'rls_enabled',a.relrowsecurity,'force_rls',a.relforcerowsecurity) ORDER BY a.relname),'[]'::jsonb)
  FROM auth_relations a LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.relowner),
 'auth_id_reference_contract',(SELECT pg_catalog.jsonb_build_object('id_present',attnum IS NOT NULL,
  'id_uuid',atttypid='pg_catalog.uuid'::pg_catalog.regtype,'id_not_null',attnotnull,
  'eligible_unique_key',eligible_unique_key,'installer_references_id',installer_references) FROM auth_id),
 'auth_constraints',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',c.oid,'table_oid',c.conrelid,'schema',n.nspname,'table',t.relname,
  'name',c.conname,'type',c.contype,'validated',c.convalidated,'deferrable',c.condeferrable,'initially_deferred',c.condeferred,
  'columns',(SELECT pg_catalog.jsonb_agg(a.attname ORDER BY k.pos) FROM pg_catalog.unnest(c.conkey) WITH ORDINALITY k(num,pos)
   JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num),
  'reference_schema',rn.nspname,'reference_table',rt.relname,
  'definition_hash',pg_catalog.md5(pg_catalog.pg_get_constraintdef(c.oid))) ORDER BY n.nspname,t.relname,c.conname),'[]'::jsonb)
  FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
  LEFT JOIN pg_catalog.pg_class rt ON rt.oid=c.confrelid LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid=rt.relnamespace
  WHERE c.conrelid IN(SELECT oid FROM auth_relations) OR c.confrelid IN(SELECT oid FROM auth_relations)),
 'auth_indexes',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',ic.oid,'table_oid',t.oid,'table',t.relname,'name',ic.relname,
  'primary',i.indisprimary,'unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready,'immediate',i.indimmediate,
  'key_columns',i.indnkeyatts,'included_columns',i.indnatts-i.indnkeyatts,
  'partial',i.indpred IS NOT NULL,'expression',i.indexprs IS NOT NULL,
  'definition_hash',pg_catalog.md5(pg_catalog.pg_get_indexdef(ic.oid))) ORDER BY t.relname,ic.relname),'[]'::jsonb)
  FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid JOIN auth_relations t ON t.oid=i.indrelid),
 'auth_dependency_edges',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('dependent_catalog',dc.relname,
  'dependent_oid',d.objid,'dependent_sub_id',d.objsubid,'referenced_catalog',rc.relname,
  'referenced_oid',d.refobjid,'referenced_sub_id',d.refobjsubid,'kind',d.deptype)
  ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid),'[]'::jsonb)
  FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_class dc ON dc.oid=d.classid JOIN pg_catalog.pg_class rc ON rc.oid=d.refclassid
  WHERE d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass AND d.refobjid IN(SELECT oid FROM auth_relations)
   OR d.classid='pg_catalog.pg_class'::pg_catalog.regclass AND d.objid IN(SELECT oid FROM auth_relations)),
 'managed_triggers',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',n.nspname,'table',c.relname,
  'name',t.tgname,'enabled',t.tgenabled,'function_schema',fn.nspname,'function',p.proname,
  'security_definer',p.prosecdef,'definition_hash',pg_catalog.md5(pg_catalog.pg_get_triggerdef(t.oid)))
  ORDER BY n.nspname,c.relname,t.tgname),'[]'::jsonb)
  FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace fn ON fn.oid=p.pronamespace
  WHERE n.nspname IN('auth','storage') AND NOT t.tgisinternal),
 'ddl_event_triggers',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',e.evtname,'event',e.evtevent,
  'enabled',e.evtenabled,'tags',e.evttags,'function_schema',n.nspname,'function',p.proname,'security_definer',p.prosecdef)
  ORDER BY e.evtname),'[]'::jsonb) FROM pg_catalog.pg_event_trigger e
  JOIN pg_catalog.pg_proc p ON p.oid=e.evtfoid JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace),
 'installer_default_acl_overrides',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'schema',coalesce(n.nspname,'<global>'),'object_type',d.defaclobjtype,
  'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END,'grantor',go.rolname,
  'privilege',a.privilege_type,'grant_option',a.is_grantable) ORDER BY d.defaclnamespace,d.defaclobjtype,a.grantee,a.privilege_type),'[]'::jsonb)
  FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl)a LEFT JOIN pg_catalog.pg_roles gr ON gr.oid=a.grantee
  LEFT JOIN pg_catalog.pg_roles go ON go.oid=a.grantor WHERE d.defaclrole=(SELECT oid FROM installer)
   AND (d.defaclnamespace=0 OR n.nspname IN('public','portaria'))),
 'checks',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) ORDER BY check_name,object_name) FROM checks c),
 'limits',pg_catalog.jsonb_build_array(
  'Somente catalogos; SELECT/grants nao comprovam leitura integral sob RLS nem comportamento HTTP.',
  'Valores de sequencias nao sao snapshot MVCC; cache/concorrencia/NULL impedem capacidade exata.',
  'Dependencias de PLpgSQL/SQL textual/dinamico podem nao constar em pg_depend; ausencia nao prova independencia.',
  'Limites adicionais e seguranca do corpo dos geradores exigem revisao sem executa-los; corpos nao exportados.',
  'Ownership herdado imediatamente e separado de possibilidade de SET ROLE; nenhum SET ROLE foi executado.',
  'ACLs de tabela/coluna, grant options/cadeias, default ACLs e event triggers exigem revisao; nao usar CASCADE automaticamente.',
  'Permissoes de painel/API, bloqueios do provedor, usuarios/perfis Auth e documentos nao sao validados por esta coleta.'),
 'migration_execution_authorized',false,'compatibility_approved',false
) AS c3;
ROLLBACK;
