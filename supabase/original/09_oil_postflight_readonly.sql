-- SOMENTE LEITURA. Manual, depois de 007 aprovada/aplicada. Nao retorna dados pessoais.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';SET LOCAL search_path=pg_catalog;SET LOCAL row_security=off;
SELECT 'schema_version_5'AS check_name,count(*)AS total FROM portaria.release_state WHERE schema_version=5
UNION ALL SELECT 'new_ok_without_oil',count(*)FROM portaria.yard_checks c WHERE c.oil_rule_version=1 AND c.result='OK'AND NOT EXISTS(SELECT 1 FROM portaria.oil_checks o WHERE o.request_id=c.request_id)
UNION ALL SELECT 'invalid_oil_link',count(*)FROM portaria.oil_checks o LEFT JOIN portaria.yard_checks c ON c.request_id=o.request_id LEFT JOIN portaria.yard_items i ON i.id=c.item_id
 WHERE c.request_id IS NULL OR c.result<>'OK'OR NOT c.observed OR c.oil_rule_version<>1 OR i.vehicle_id IS DISTINCT FROM o.vehicle_id OR c.checked_by IS DISTINCT FROM o.checked_by OR c.checked_at IS DISTINCT FROM o.checked_at
UNION ALL SELECT 'old_rpc_app_execute',count(*)FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'AND p.proname IN('portaria_check_yard_item','portaria_found_yard_vehicle','portaria_register_conference')
 AND(pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'))
UNION ALL SELECT 'private_application_buckets',count(*)FROM storage.buckets WHERE id IN('person-documents','driver-cnh-documents','access-documents','vehicle-operation-photos','portaria-evidence','portaria-parcels')AND public IS FALSE
UNION ALL SELECT 'oil_rls_enabled',count(*)FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='portaria'AND c.relname='oil_checks'AND c.relrowsecurity
UNION ALL SELECT 'oil_direct_app_table_privileges',count(*)FROM(VALUES('anon'),('authenticated'))r(name)
 WHERE pg_catalog.has_table_privilege(r.name,'portaria.oil_checks','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');
-- Esperado: schema_version_5=1; private_application_buckets=6; oil_rls_enabled=1; demais=0.
ROLLBACK;
