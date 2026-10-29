-- SOMENTE LEITURA. Uso manual futuro depois de 006 aprovada/aplicada.
BEGIN READ ONLY;SET LOCAL statement_timeout='30s';
SELECT 'schema_version_4'AS check_name,count(*)AS total FROM portaria.release_state WHERE schema_version=4
UNION ALL SELECT 'recovery_marker_inconsistent',count(*)FROM portaria.release_state WHERE
 recovery_strategy NOT IN('verified-backup','no-backup-risk-accepted')OR recovery_evidence_sha256 !~ '^[a-f0-9]{64}$'OR
 (recovery_strategy='no-backup-risk-accepted'AND backup_sha256 IS NOT NULL)OR
 (recovery_strategy='verified-backup'AND backup_sha256 IS DISTINCT FROM recovery_evidence_sha256)
UNION ALL SELECT 'private_application_buckets',count(*)FROM storage.buckets WHERE id IN('person-documents','driver-cnh-documents','access-documents','vehicle-operation-photos','portaria-evidence','portaria-parcels')AND public IS FALSE
UNION ALL SELECT 'physical_results_inconsistent',count(*)FROM portaria.yard_checks WHERE meaning='physical_v2'AND observed IS DISTINCT FROM(result='OK')
UNION ALL SELECT 'check_meaning_unknown',count(*)FROM portaria.yard_checks WHERE meaning NOT IN('compatibility_v1','physical_v2')
UNION ALL SELECT 'departure_after_reference',count(*)FROM portaria.yard_items i JOIN portaria.yard_sessions s ON s.id=i.session_id WHERE i.last_departure IS NOT NULL AND(i.last_departure->>'at')::timestamp>s.reference_local
UNION ALL SELECT 'new_actor_without_profile',count(*)FROM portaria.operation_actors a WHERE NOT EXISTS(SELECT 1 FROM portaria.profiles p WHERE p.user_id=a.actor);
-- Informativos: nao precisam ser zero. Nao corrigir resultados antigos em massa.
SELECT meaning,count(*)AS total FROM portaria.yard_checks GROUP BY meaning ORDER BY meaning;
ROLLBACK;
