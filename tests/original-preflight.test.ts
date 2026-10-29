import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comparePreflight, PREFLIGHT_SOURCES, readOnlySelect, unwrapAudit } from '../scripts/original-preflight-model.ts';

const expected = { targetSha256: 'a'.repeat(64), querySources: { synthetic: 'b'.repeat(64) } };
const names = ['access_records', 'drivers', 'operational_checklist_items', 'operational_movements', 'operational_photos', 'people',
  'personal_vehicles', 'vehicle_inspection_requests', 'vehicle_records', 'vehicles'];
function fixture() {
  const inventory = { format_version: 1, tables: [{ schema: 'public', name: 'sample', kind: 'r', rls: true, force_rls: false }],
    columns: [], constraints: [], indexes: [], functions: [] as Array<Record<string, unknown>>, triggers: [], policies: [], table_grants: [], buckets: [],
    migration_versions: ['20260101000000'], publications: [], auth: { users_table: true, identities_table: true, configuration: 'Mensagem informativa' }, migration_history_present: true };
  const managed = { managed_columns: [], function_grants: [] as Array<Record<string, unknown>> };
  const integrity = Array.from({ length: 14 }, (_, index) => ({ check_name: 'synthetic_' + String.fromCharCode(97 + index), problems: 0 }));
  const documents = { outside_without_open_by_status: [], document_references: [], person_http_urls: {}, storage_metadata: [] };
  const preservation = names.map(table_name => ({ table_name, row_count: 1, original_columns_sha256: 'd'.repeat(64) }));
  return { previous: structuredClone({ inventory, managed, integrity, documents }), snapshot: {
    format_version: 1, preflight_revision: 2, collected_at: '2026-10-28T12:00:00Z', target_label_sha256: expected.targetSha256,
    function_capabilities: { query_to_xml_execute: true, sha256_execute: true, native_guard_required_before_data: true },
    query_context: { row_security: 'off', search_path: 'pg_catalog, public, extensions' },
    query_source_sha256: expected.querySources, transaction_read_only: 'on', transaction_isolation: 'repeatable read', server_major: 17,
    portaria_schema_present: false, release_table_present: false,
    source_visibility: { expected_relations: 12, present_relations: 12, selectable_relations: 12,
      schema_accessible_relations: 12, rls_active_relations: 0, unfiltered_relations: 12 },
    inventory, managed_inventory: managed, integrity, documents_patio: documents, preservation,
  } };
}

test('os cinco SQLs revisados podem compor uma consulta sem transacoes/escritas internas', () => {
  for (const [, name] of PREFLIGHT_SOURCES) {
    const sql = readOnlySelect(readFileSync(new URL('../supabase/original/' + name, import.meta.url), 'utf8'));
    assert.match(sql, /^(SELECT|WITH)\b/); assert.ok(!sql.includes('ROLLBACK;')); assert.ok(!sql.includes('BEGIN TRANSACTION'));
  }
});

test('composicao recusa formatacao, DML em CTE, statements extras e XML com escrita', () => {
  const wrap = (body: string) => 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;\n' + body + ';\nROLLBACK;';
  for (const sql of ['```sql', wrap('SELECT 1; DELETE FROM x'), wrap('WITH x AS(DELETE FROM x RETURNING *)SELECT 1'),
    wrap("SELECT query_to_xml('DELETE FROM x',false,false,'')"), 'SELECT 1;', wrap('SELECT pg_read_file(1)')]) assert.throws(() => readOnlySelect(sql), /PREFLIGHT_INPUT_INVALID/);
  assert.equal(readOnlySelect(wrap("SELECT 'DELETE IS ONLY A SYNTHETIC STRING'")), "SELECT 'DELETE IS ONLY A SYNTHETIC STRING'");
});

test('snapshot igual nao declara conteudo historico comprovado sem baseline de digests', () => {
  const f = fixture(), result = comparePreflight(f.previous, [{ preflight: JSON.stringify(f.snapshot) }], expected);
  assert.equal(result.status, 'catalog_and_aggregates_match_manual_review_required');
  assert.equal(result.historicalContentMatches, null); assert.equal(result.previousPreservationBaselineAvailable, false);
  assert.equal(result.migrationExecutionAuthorized, false); assert.equal(result.remoteExecutionPerformedByComparator, false);
  assert.equal(result.currentPreservationTables, 10);
});

test('int8 textual e mensagem informativa nao causam falsa divergencia de banco', () => {
  const f = fixture(); f.snapshot.inventory.auth.configuration = 'Texto informativo revisado';
  const previous = { ...f.previous, integrity: f.previous.integrity.map(row => ({ ...row, problems: String(row.problems) })) };
  assert.equal(comparePreflight(previous, f.snapshot, expected).status, 'catalog_and_aggregates_match_manual_review_required');
});

test('mudanca em cada secao de catalogo, grants e ledger e divergencia', () => {
  for (const section of ['tables', 'columns', 'constraints', 'indexes', 'functions', 'triggers', 'policies', 'table_grants', 'buckets', 'migration_versions'] as const) {
    const f = fixture(); (f.snapshot.inventory[section] as unknown[]).push(section === 'migration_versions' ? '20260201000000' : { schema: 'public', name: 'synthetic_change', arguments: '', roles: [] });
    assert.equal(comparePreflight(f.previous, f.snapshot, expected).status, 'drift_detected', section);
  }
});

test('mudanca de contagem, Storage ou contrato gerenciado nao e ignorada', () => {
  let f = fixture(); f.snapshot.integrity[0].problems = 1;
  assert.equal(comparePreflight(f.previous, f.snapshot, expected).integrityMatches, false);
  f = fixture(); (f.snapshot.documents_patio.storage_metadata as unknown[]).push({ object_count: 237 });
  assert.equal(comparePreflight(f.previous, f.snapshot, expected).documentsMatches, false);
  f = fixture(); (f.snapshot.managed_inventory.managed_columns as unknown[]).push({ name: 'synthetic_change' });
  assert.equal(comparePreflight(f.previous, f.snapshot, expected).managedMatches, false);
});

test('permissoes insuficientes, schema portaria inesperado e snapshot errado impedem aceite', () => {
  let f = fixture(); f.snapshot.source_visibility.unfiltered_relations = 11;
  assert.equal(comparePreflight(f.previous, f.snapshot, expected).status, 'insufficient_read_coverage');
  f = fixture(); f.snapshot.portaria_schema_present = true;
  assert.equal(comparePreflight(f.previous, f.snapshot, expected).status, 'unexpected_existing_portaria');
  for (const change of [{ target_label_sha256: 'e'.repeat(64) }, { transaction_read_only: 'off' }, { transaction_isolation: 'read committed' },
    { query_source_sha256: {} }, { server_major: 18 }, { collected_at: 'not-a-date' }]) {
    f = fixture(); assert.throws(() => comparePreflight(f.previous, { ...f.snapshot, ...change }, expected), /PREFLIGHT_INPUT_INVALID/);
  }
});

test('digests anteriores detectam alteracao mesmo quando contagens coincidem', () => {
  const f = fixture(), prior = structuredClone(f.snapshot.preservation);
  assert.equal(comparePreflight({ ...f.previous, preservation: prior }, f.snapshot, expected).historicalContentMatches, true);
  f.snapshot.preservation[0].original_columns_sha256 = 'e'.repeat(64);
  const result = comparePreflight({ ...f.previous, preservation: prior }, f.snapshot, expected);
  assert.equal(result.status, 'drift_detected'); assert.equal(result.historicalContentMatches, false);
});

test('ausencia de tabela no digest ou checks duplicados nao gera falso sucesso', () => {
  let f = fixture(); f.snapshot.preservation.pop();
  assert.throws(() => comparePreflight(f.previous, f.snapshot, expected), /PREFLIGHT_INPUT_INVALID/);
  f = fixture(); f.snapshot.integrity[1].check_name = f.snapshot.integrity[0].check_name;
  assert.throws(() => comparePreflight(f.previous, f.snapshot, expected), /PREFLIGHT_INPUT_INVALID/);
});

test('erros e relatorios nao reproduzem valores individuais de entrada', () => {
  assert.throws(() => unwrapAudit('{PRIVATE_CANARY_NEVER_PRINT', 'preflight'), /^Error: PREFLIGHT_INPUT_INVALID$/);
  const f = fixture(); (f.snapshot.inventory.columns as unknown[]).push({ name: 'PRIVATE_CANARY_NEVER_PRINT' });
  assert.ok(!JSON.stringify(comparePreflight(f.previous, f.snapshot, expected)).includes('PRIVATE_CANARY_NEVER_PRINT'));
});

function functionFixture() {
  const f = fixture();
  const definition = { schema: 'public', name: 'synthetic_function', arguments: 'text',
    returns: 'text', security_definer: false, volatility: 'v', definition_hash: 'e'.repeat(32) };
  const grants = { schema: definition.schema, name: definition.name, arguments: definition.arguments,
    anon_execute: true, authenticated_execute: false };
  f.previous.inventory.functions.push(structuredClone(definition));
  f.snapshot.inventory.functions.push({ ...definition, anon_execute: true, authenticated_execute: false });
  f.previous.managed.function_grants.push(structuredClone(grants));
  f.snapshot.managed_inventory.function_grants.push(structuredClone(grants));
  return f;
}

test('EXECUTE ausente no inventario antigo e reconciliado exclusivamente com o 00b anterior', () => {
  const f = functionFixture(), result = comparePreflight(f.previous, f.snapshot, expected);
  assert.equal(result.status, 'catalog_and_aggregates_match_manual_review_required');
  assert.equal(result.metadata.functions.matches, true); assert.equal(result.managedMatches, true);
  assert.equal(result.functionComparison.status, 'coverage_reconciled');
  assert.equal(result.functionComparison.reconciledExecuteFields, 2);
  assert.equal(result.insufficientAuditEvidence, false); assert.equal(result.migrationExecutionAuthorized, false);
  assert.equal('anon_execute' in f.previous.inventory.functions[0], false); // Entrada privada nunca e normalizada in-place.
});

test('diferenca real de EXECUTE em qualquer papel continua sendo drift', () => {
  for (const field of ['anon_execute', 'authenticated_execute'] as const) {
    const f = functionFixture(), value = !f.snapshot.inventory.functions[0][field];
    f.snapshot.inventory.functions[0][field] = value;
    f.snapshot.managed_inventory.function_grants[0][field] = value;
    const result = comparePreflight(f.previous, f.snapshot, expected);
    assert.equal(result.status, 'drift_detected'); assert.equal(result.functionComparison.differingExecuteFields, 1);
    assert.equal(result.metadata.functions.matches, false); assert.equal(result.managedMatches, false);
  }
});

test('mudancas de corpo, security definer e demais atributos nunca sao descartadas como cobertura', () => {
  for (const [field, value] of [['definition_hash', 'f'.repeat(32)], ['security_definer', true], ['returns', 'boolean']]) {
    const f = functionFixture(); f.snapshot.inventory.functions[0][String(field)] = value;
    const result = comparePreflight(f.previous, f.snapshot, expected);
    assert.equal(result.status, 'drift_detected'); assert.equal(result.functionComparison.definitionMatches, false);
  }
});

test('sem evidencia anterior de EXECUTE o resultado e insuficiente, mesmo que o atual exista', () => {
  const f = functionFixture(); f.previous.managed.function_grants = [];
  const result = comparePreflight(f.previous, f.snapshot, expected);
  assert.equal(result.status, 'insufficient_audit_evidence'); assert.equal(result.insufficientAuditEvidence, true);
  assert.equal(result.metadata.functions.matches, null); assert.equal(result.managedMatches, null);
  assert.equal(result.functionComparison.insufficientExecuteFields, 2); assert.equal(result.migrationExecutionAuthorized, false);
});

test('inventario completo anterior tambem pode suprir cobertura ausente no complemento', () => {
  const f = functionFixture(); f.previous.inventory.functions[0] = structuredClone(f.snapshot.inventory.functions[0]);
  f.previous.managed.function_grants = [];
  const result = comparePreflight(f.previous, f.snapshot, expected);
  assert.equal(result.status, 'catalog_and_aggregates_match_manual_review_required');
  assert.equal(result.functionComparison.status, 'coverage_reconciled'); assert.equal(result.managedMatches, true);
});

test('evidencia ausente do snapshot atual nao e preenchida a partir do passado', () => {
  const f = functionFixture(); delete f.snapshot.inventory.functions[0].authenticated_execute;
  delete f.snapshot.managed_inventory.function_grants[0].authenticated_execute;
  const result = comparePreflight(f.previous, f.snapshot, expected);
  assert.equal(result.status, 'insufficient_audit_evidence'); assert.equal(result.functionComparison.insufficientExecuteFields, 1);
});

test('conflitos entre inventario e complemento, anteriores ou atuais, nao geram aprovacao', () => {
  for (const side of ['baseline', 'current'] as const) {
    const f = functionFixture();
    if (side === 'baseline') f.previous.inventory.functions[0].anon_execute = false;
    else f.snapshot.managed_inventory.function_grants[0].anon_execute = false;
    const result = comparePreflight(f.previous, f.snapshot, expected);
    assert.equal(result.status, 'insufficient_audit_evidence');
    assert.equal(result.functionComparison[side === 'baseline' ? 'baselineConflictingFields' : 'currentConflictingFields'], 1);
  }
});

test('assinatura exige schema e argumentos exatos; overloads nao emprestam EXECUTE', () => {
  for (const [field, value] of [['schema', 'private'], ['arguments', 'uuid']]) {
    const f = functionFixture(); f.previous.managed.function_grants[0][field] = value;
    const result = comparePreflight(f.previous, f.snapshot, expected);
    assert.equal(result.status, 'insufficient_audit_evidence'); assert.equal(result.migrationExecutionAuthorized, false);
  }
});

test('complementos duplicados sao ambiguos mesmo quando concordam', () => {
  for (const side of ['baseline', 'current']) {
    const f = functionFixture();
    const grants = side === 'baseline' ? f.previous.managed.function_grants : f.snapshot.managed_inventory.function_grants;
    grants.push(structuredClone(grants[0]));
    const result = comparePreflight(f.previous, f.snapshot, expected);
    assert.equal(result.status, 'insufficient_audit_evidence'); assert.equal(result.migrationExecutionAuthorized, false);
  }
});

test('divergencia real em outro escopo nao e ocultada por evidencia EXECUTE insuficiente', () => {
  const f = functionFixture(); f.previous.managed.function_grants = [];
  f.snapshot.integrity[0].problems = 1;
  const result = comparePreflight(f.previous, f.snapshot, expected);
  assert.equal(result.status, 'drift_detected'); assert.equal(result.insufficientAuditEvidence, true);
});

test('revisao, contexto, capacidades nativas e cobertura RLS/USAGE sao exigidos', () => {
  const changes = [{ preflight_revision: 1 }, { function_capabilities: {} },
    { function_capabilities: { query_to_xml_execute: true, sha256_execute: false, native_guard_required_before_data: true } },
    { query_context: { row_security: 'on', search_path: 'pg_catalog, public, extensions' } },
    { query_context: { row_security: 'off', search_path: 'public, pg_catalog' } }];
  for (const change of changes) {
    const f = fixture(); assert.throws(() => comparePreflight(f.previous, { ...f.snapshot, ...change }, expected), /PREFLIGHT_INPUT_INVALID/);
  }
  for (const change of [{ schema_accessible_relations: 11 }, { rls_active_relations: 1 }]) {
    const f = fixture(); Object.assign(f.snapshot.source_visibility, change);
    assert.equal(comparePreflight(f.previous, f.snapshot, expected).status, 'insufficient_read_coverage');
  }
});

test('dados de EXECUTE malformados ou campos extras do complemento nao sao aceitos silenciosamente', () => {
  for (const change of [{ anon_execute: null }, { authenticated_execute: 'false' }, { unexpected_grant: true }]) {
    const f = functionFixture(); Object.assign(f.snapshot.managed_inventory.function_grants[0], change);
    assert.throws(() => comparePreflight(f.previous, f.snapshot, expected), /PREFLIGHT_INPUT_INVALID/);
  }
});
