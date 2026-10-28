-- SOMENTE LEITURA. Uso manual futuro, apenas depois de 005 aprovada e aplicada.
-- Nao exporta nomes, placas, caminhos, UUIDs de usuarios nem fotografias.
BEGIN READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT 'schema_version_3'AS check_name,count(*)AS total FROM portaria.release_state WHERE schema_version=3
UNION ALL SELECT 'private_parcels_bucket',count(*)FROM storage.buckets WHERE id='portaria-parcels'AND public IS FALSE AND file_size_limit=10485760
UNION ALL SELECT 'parcels_missing_private_photo',count(*)FROM portaria.parcels p WHERE NOT EXISTS(SELECT 1 FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id WHERE b.id='portaria-parcels'AND b.public IS FALSE AND o.name=p.photo_path)
UNION ALL SELECT 'parcels_missing_receipt_event',count(*)FROM portaria.parcels p WHERE NOT EXISTS(SELECT 1 FROM portaria.parcel_events e WHERE e.parcel_id=p.id AND e.kind='received'AND e.actor=p.received_by)
UNION ALL SELECT 'collected_without_event',count(*)FROM portaria.parcels p WHERE p.status='Encomenda retirada'AND NOT EXISTS(SELECT 1 FROM portaria.parcel_events e WHERE e.parcel_id=p.id AND e.kind='collected'AND e.actor=p.collected_by)
UNION ALL SELECT 'waiting_with_collection_event',count(*)FROM portaria.parcels p WHERE p.status='Aguardando retirada'AND EXISTS(SELECT 1 FROM portaria.parcel_events e WHERE e.parcel_id=p.id AND e.kind='collected')
UNION ALL SELECT 'yard_checks_orphaned',count(*)FROM portaria.yard_checks c WHERE NOT EXISTS(SELECT 1 FROM portaria.yard_items i JOIN portaria.yard_sessions s ON s.id=i.session_id WHERE i.id=c.item_id)
UNION ALL SELECT 'yard_unknown_marked_ok',count(*)FROM portaria.yard_checks c JOIN portaria.yard_items i ON i.id=c.item_id WHERE i.expected='unknown'AND c.result='OK'
UNION ALL SELECT 'yard_nok_without_note',count(*)FROM portaria.yard_checks WHERE result='NOK'AND btrim(notes)=''
UNION ALL SELECT 'unreferenced_parcel_photos_review_only',count(*)FROM storage.objects o WHERE o.bucket_id='portaria-parcels'AND NOT EXISTS(SELECT 1 FROM portaria.parcels p WHERE p.photo_path=o.name);
COMMIT;
