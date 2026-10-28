import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { parseDevTarget } from '../src/lib/environment.ts';
import { BLOCKED_PROJECT_HASHES } from '../src/config/blockedProjects.ts';
import { PREFLIGHT_SOURCES, readOnlySelect, sourceDigest } from './original-preflight-model.ts';

try {
  const target = parseDevTarget(JSON.parse(readFileSync('original.target.local.json', 'utf8')));
  if (target.environment !== 'original' || target.access !== 'metadata-only' || target.release ||
      !BLOCKED_PROJECT_HASHES.includes(sourceDigest(target.projectRef))) throw new Error('TARGET_NOT_APPROVED');
  const sources = Object.fromEntries(PREFLIGHT_SOURCES.map(([key, file]) => [key, readFileSync('supabase/original/' + file, 'utf8')]));
  const hashes = Object.fromEntries(PREFLIGHT_SOURCES.map(([key]) => [key, sourceDigest(sources[key])]));
  const scalar = (key: 'inventory' | 'managed_inventory' | 'documents_patio', column: string) =>
    `(SELECT ${column} FROM (${readOnlySelect(sources[key])}) AS snapshot_${key})`;
  const aggregate = (key: 'integrity' | 'preservation') =>
    `(SELECT coalesce(jsonb_agg(to_jsonb(snapshot_${key})),'[]'::jsonb) FROM (${readOnlySelect(sources[key])}) AS snapshot_${key})`;
  const sql = `-- PREFLIGHT MANUAL SOMENTE LEITURA. Nao e migration; nao executar pacote DEV.
-- Conferir o projeto original no painel: o rotulo abaixo NAO comprova origem.
-- Uma transacao/snapshot, somente metadados, totais e digests; sem baixar arquivos.
-- Salvar a coluna preflight em .secrets/original-final-preflight.json, sem sobrescrever auditorias.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='60s';
SET LOCAL lock_timeout='5s';
SET LOCAL TIME ZONE 'UTC';
SELECT jsonb_build_object(
 'format_version',1,'collected_at',transaction_timestamp(),
 'target_label_sha256','${sourceDigest(target.projectRef)}',
 'query_source_sha256','${JSON.stringify(hashes)}'::jsonb,
 'server_major',current_setting('server_version_num')::integer/10000,
 'transaction_read_only',current_setting('transaction_read_only'),
 'transaction_isolation',current_setting('transaction_isolation'),
 'portaria_schema_present',to_regnamespace('portaria')IS NOT NULL,
 'release_table_present',to_regclass('portaria.release_state')IS NOT NULL,
 'source_visibility',(WITH expected(schema_name,table_name)AS(VALUES
 ('public','access_records'),('public','drivers'),('public','operational_checklist_items'),
 ('public','operational_movements'),('public','operational_photos'),('public','people'),
 ('public','personal_vehicles'),('public','vehicle_inspection_requests'),('public','vehicle_records'),('public','vehicles'),
 ('storage','buckets'),('storage','objects')),
 scope AS(SELECT c.oid,c.relrowsecurity,c.relforcerowsecurity,c.relowner FROM expected e
 LEFT JOIN pg_namespace n ON n.nspname=e.schema_name LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.table_name AND c.relkind IN('r','p'))
 SELECT jsonb_build_object('expected_relations',12,'present_relations',count(oid),
 'selectable_relations',count(oid)FILTER(WHERE has_table_privilege(oid,'SELECT')),
 'unfiltered_relations',count(oid)FILTER(WHERE has_table_privilege(oid,'SELECT')AND(NOT relrowsecurity OR
 (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user)OR(NOT relforcerowsecurity AND pg_has_role(relowner,'USAGE')))))FROM scope),
 'inventory',${scalar('inventory', 'inventory')},
 'managed_inventory',${scalar('managed_inventory', 'managed_inventory')},
 'integrity',${aggregate('integrity')},
 'documents_patio',${scalar('documents_patio', 'review')},
 'preservation',${aggregate('preservation')}
) AS preflight;
ROLLBACK;
`;
  const output = '.cache/original-review/final-preflight';
  mkdirSync(output, { recursive: true });
  writeFileSync(output + '/07_final_preflight_readonly.sql', sql);
  writeFileSync(output + '/manifest.json', JSON.stringify({ status: 'manual_readonly_not_executed', targetLabelSha256: sourceDigest(target.projectRef),
    querySources: hashes, sqlSha256: sourceDigest(sql), migrationExecutionAuthorized: false }, null, 2) + '\n');
  console.log('Pacote manual somente leitura preparado em .cache/original-review/final-preflight. Nenhuma consulta remota executada.');
} catch { console.error('Preparo bloqueado: conferir destino metadata-only e os cinco SQLs locais. Nenhum valor privado sera exibido.'); process.exitCode = 1; }
