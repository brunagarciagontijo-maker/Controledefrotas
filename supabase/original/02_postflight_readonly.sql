BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT 'active_admins' AS check_name,count(*) AS total FROM portaria.profiles WHERE role='admin' AND is_active
UNION ALL SELECT 'public_application_buckets',count(*) FROM storage.buckets WHERE id IN ('person-documents','access-documents','vehicle-operation-photos','driver-cnh-documents','portaria-evidence') AND public
UNION ALL SELECT 'departures_without_movement',count(*) FROM portaria.departures d WHERE NOT EXISTS(SELECT 1 FROM public.operational_movements m WHERE m.id=d.movement_id)
UNION ALL SELECT 'incomplete_required_evidence',count(*) FROM portaria.departures WHERE NOT cobli_associated AND(jsonb_array_length(photos)<>6 OR btrim(driver_reason)='')
UNION ALL SELECT 'inactive_or_missing_profiles',count(*) FROM auth.users u WHERE NOT EXISTS(SELECT 1 FROM portaria.profiles p WHERE p.user_id=u.id AND p.is_active);
-- Totais nao substituem validacao por JWT real com usuarios autorizados.
ROLLBACK;
