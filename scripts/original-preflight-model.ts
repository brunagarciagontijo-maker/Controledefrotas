import { createHash } from 'node:crypto';
import { inventoryFingerprint, parseInventory } from './inventory-model.ts';

export const PREFLIGHT_SOURCES = [
  ['inventory', '00_inventory_readonly.sql'],
  ['managed_inventory', '00b_managed_contract_readonly.sql'],
  ['integrity', '01_integrity_readonly.sql'],
  ['documents_patio', '03_documents_patio_readonly.sql'],
  ['preservation', '04_preservation_readonly.sql'],
] as const;

const fail = (): never => { throw new Error('PREFLIGHT_INPUT_INVALID'); };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail();
export function unwrapAudit(value: unknown, column: string): Record<string, unknown> {
  let result = value;
  for (let i = 0; i < 5; i++) {
    if (typeof result === 'string') { try { result = JSON.parse(result); } catch { return fail(); } }
    else if (Array.isArray(result) && result.length === 1) result = result[0];
    else if (result && typeof result === 'object' && column in result) result = (result as Record<string, unknown>)[column];
    else return object(result);
  }
  return fail();
}

// Somente os cinco arquivos fixos revisados. Nao e um parser SQL generico.
export function readOnlySelect(source: string): string {
  if (source.includes('```') || source.includes('**')) return fail();
  let begins = 0, rollbacks = 0;
  const lines = source.split(/\r?\n/).filter(line => {
    const code = line.trim();
    if (code.startsWith('--') || !code) return false;
    if (/^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;$/i.test(code)) { begins++; return false; }
    if (/^ROLLBACK;$/i.test(code)) { rollbacks++; return false; }
    return !/^SET LOCAL (statement_timeout\s*=\s*'30s'|TIME ZONE 'UTC');$/i.test(code);
  });
  const body = lines.join('\n').trim().replace(/;$/, '');
  const code = body.replace(/'(?:''|[^'])*'/g, "''");
  if (begins !== 1 || rollbacks !== 1 || !/^(SELECT|WITH)\b/i.test(code) || code.includes(';') ||
      /\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|COPY|CALL|DO|GRANT|REVOKE|COMMIT|BEGIN|SET|RESET|pg_read_file|pg_read_binary_file|pg_ls_dir|set_config|dblink_exec|lo_export|lo_import|pg_notify)\b/i.test(code)) return fail();
  // query_to_xml e usado apenas para ler o ledger opcional sem referencia estatica.
  if (/\bquery_to_xml\s*\(/i.test(code) && !/query_to_xml\(\s*'SELECT version FROM supabase_migrations\.schema_migrations ORDER BY version'\s*,false,false,''\)/i.test(body)) return fail();
  return body;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => JSON.stringify(key) + ':' + canonical(entry)).join(',') + '}';
  return JSON.stringify(value);
}
function rows(value: unknown): unknown[] { return Array.isArray(value) ? value : fail(); }
function count(value: unknown): number {
  const parsed = typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? Number(value) : value;
  return typeof parsed === 'number' && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fail();
}
function compareRows(before: unknown, after: unknown) {
  const oldRows = rows(before).map(canonical).sort(), newRows = rows(after).map(canonical).sort();
  return { baselineEntries: oldRows.length, currentEntries: newRows.length, matches: canonical(oldRows) === canonical(newRows) };
}

const executeFields = ['anon_execute', 'authenticated_execute'] as const;
type ExecuteField = typeof executeFields[number];
type Evidence = { status: 'known'; value: boolean } | { status: 'missing' | 'conflicting' };
function functionIndex(value: unknown, grantsOnly = false): Map<string, Record<string, unknown>[]> {
  const result = new Map<string, Record<string, unknown>[]>();
  for (const entry of rows(value)) {
    const row = object(entry);
    if (['schema', 'name', 'arguments'].some(key => typeof row[key] !== 'string') ||
        grantsOnly && Object.keys(row).some(key => !['schema', 'name', 'arguments', ...executeFields].includes(key)) ||
        executeFields.some(key => key in row && typeof row[key] !== 'boolean')) return fail();
    const key = JSON.stringify([row.schema, row.name, row.arguments]);
    result.set(key, [...(result.get(key) ?? []), row]);
  }
  return result;
}
function withoutExecute(value: unknown): unknown[] {
  return rows(value).map(entry => Object.fromEntries(Object.entries(object(entry)).filter(([key]) =>
    !executeFields.includes(key as ExecuteField))));
}
function executeEvidence(functions: Map<string, Record<string, unknown>[]>, grants: Map<string, Record<string, unknown>[]>,
  key: string, field: ExecuteField): Evidence {
  const definitions = functions.get(key) ?? [], supplemental = grants.get(key) ?? [];
  if (definitions.length !== 1) return { status: 'missing' };
  // Mesmo duplicatas concordantes nao sao evidencia univoca por assinatura.
  if (supplemental.length > 1) return { status: 'conflicting' };
  const values = [...definitions, ...supplemental].map(row => row[field]).filter(value => typeof value === 'boolean');
  if (!values.length) return { status: 'missing' };
  if (new Set(values).size !== 1) return { status: 'conflicting' };
  return { status: 'known', value: values[0] };
}
function compareFunctions(before: unknown, after: unknown, oldGrants: unknown, newGrants: unknown) {
  const oldFunctions = functionIndex(before), newFunctions = functionIndex(after);
  const oldSupplement = functionIndex(oldGrants, true), newSupplement = functionIndex(newGrants, true);
  // A definicao de cada funcao tem uma unica linha; overloads usam argumentos diferentes.
  if ([...oldFunctions.values(), ...newFunctions.values()].some(entries => entries.length !== 1)) return fail();
  const definitionMatches = compareRows(withoutExecute(before), withoutExecute(after)).matches;
  const keys = new Set([...oldFunctions.keys(), ...newFunctions.keys(), ...oldSupplement.keys(), ...newSupplement.keys()]);
  let coverageDifferences = 0, reconciledExecuteFields = 0, differingExecuteFields = 0, insufficientExecuteFields = 0;
  let baselineConflictingFields = 0, currentConflictingFields = 0;
  for (const key of keys) for (const field of executeFields) {
    const covered = (index: Map<string, Record<string, unknown>[]>) =>
      (index.get(key) ?? []).some(row => typeof row[field] === 'boolean');
    const coverageDiffers = covered(oldFunctions) !== covered(newFunctions) || covered(oldSupplement) !== covered(newSupplement);
    if (coverageDiffers) coverageDifferences++;
    const oldEvidence = executeEvidence(oldFunctions, oldSupplement, key, field);
    const newEvidence = executeEvidence(newFunctions, newSupplement, key, field);
    if (oldEvidence.status === 'conflicting') baselineConflictingFields++;
    if (newEvidence.status === 'conflicting') currentConflictingFields++;
    if (oldEvidence.status !== 'known' || newEvidence.status !== 'known') insufficientExecuteFields++;
    else if (oldEvidence.value !== newEvidence.value) differingExecuteFields++;
    else if (coverageDiffers) reconciledExecuteFields++;
  }
  const executeMatches = differingExecuteFields ? false : insufficientExecuteFields ? null : true;
  const matches = !definitionMatches || executeMatches === false ? false : executeMatches;
  return {
    baselineEntries: rows(before).length, currentEntries: rows(after).length, matches,
    evidence: {
      status: matches === false ? 'drift_detected' : matches === null ? 'insufficient_evidence' :
        coverageDifferences ? 'coverage_reconciled' : 'match',
      definitionMatches, executeMatches, coverageDifferences, reconciledExecuteFields,
      differingExecuteFields, insufficientExecuteFields, baselineConflictingFields, currentConflictingFields,
    },
  };
}

export interface PreviousAudits {
  inventory: unknown; managed: unknown; integrity: unknown; documents: unknown; preservation?: unknown;
}
export function comparePreflight(previous: PreviousAudits, fresh: unknown,
  expected: { targetSha256: string; querySources: Record<string, string> }) {
  const snapshot = unwrapAudit(fresh, 'preflight');
  const capabilities = object(snapshot.function_capabilities), context = object(snapshot.query_context);
  if (snapshot.format_version !== 1 || snapshot.preflight_revision !== 2 ||
      ['query_to_xml_execute', 'sha256_execute', 'native_guard_required_before_data'].some(key => capabilities[key] !== true) ||
      context.row_security !== 'off' || context.search_path !== 'pg_catalog, public, extensions' ||
      snapshot.target_label_sha256 !== expected.targetSha256 ||
      snapshot.transaction_read_only !== 'on' || snapshot.transaction_isolation !== 'repeatable read' ||
      snapshot.server_major !== 17 || canonical(snapshot.query_source_sha256) !== canonical(expected.querySources) ||
      typeof snapshot.collected_at !== 'string' || !Number.isFinite(Date.parse(snapshot.collected_at)) ||
      typeof snapshot.portaria_schema_present !== 'boolean' || typeof snapshot.release_table_present !== 'boolean') return fail();
  const visibility = object(snapshot.source_visibility);
  const wholeScopeVisible = visibility.expected_relations === 12 && visibility.present_relations === 12 &&
    visibility.selectable_relations === 12 && visibility.schema_accessible_relations === 12 &&
    visibility.unfiltered_relations === 12 && visibility.rls_active_relations === 0;
  const original = parseInventory(previous.inventory), current = parseInventory(snapshot.inventory);
  const oldManaged = unwrapAudit(previous.managed, 'managed_inventory'), newManaged = object(snapshot.managed_inventory);
  const functions = compareFunctions(original.functions, current.functions, oldManaged.function_grants, newManaged.function_grants);
  const sections = ['tables', 'columns', 'constraints', 'indexes', 'triggers', 'policies', 'table_grants', 'buckets', 'migration_versions'] as const;
  const metadata = { ...Object.fromEntries(sections.map(key => [key, compareRows(original[key], current[key])])),
    functions: { baselineEntries: functions.baselineEntries, currentEntries: functions.currentEntries, matches: functions.matches } };
  const oldInventory = unwrapAudit(previous.inventory, 'inventory'), newInventory = unwrapAudit(snapshot.inventory, 'inventory');
  // Campos adicionais fora do fingerprint tambem precisam de comparacao.
  for (const key of ['publications', 'auth', 'migration_history_present']) {
    if (!(key in oldInventory) || !(key in newInventory)) return fail();
  }
  const oldAuth = object(oldInventory.auth), newAuth = object(newInventory.auth);
  const extraMetadataMatches = compareRows(oldInventory.publications, newInventory.publications).matches &&
    oldInventory.migration_history_present === newInventory.migration_history_present &&
    ['users_table', 'identities_table'].every(key => typeof oldAuth[key] === 'boolean' && oldAuth[key] === newAuth[key]);
  const managedColumnsMatch = compareRows(oldManaged.managed_columns, newManaged.managed_columns).matches;
  const managedMatches = managedColumnsMatch ? functions.evidence.executeMatches : false;
  const checks = rows(snapshot.integrity), oldChecks = rows(previous.integrity);
  const checkMap = (input: unknown[]) => new Map(input.map(entry => {
    const row = object(entry);
    if (typeof row.check_name !== 'string' || !/^[a-z_]+$/.test(row.check_name)) return fail();
    return [row.check_name, count(row.problems)] as const;
  }));
  const beforeChecks = checkMap(oldChecks), afterChecks = checkMap(checks);
  if (beforeChecks.size !== oldChecks.length || afterChecks.size !== checks.length || beforeChecks.size !== 14 || afterChecks.size !== 14) return fail();
  const integrityMatches = [...beforeChecks].every(([key, count]) => afterChecks.get(key) === count);
  const oldDocuments = unwrapAudit(previous.documents, 'review'), newDocuments = object(snapshot.documents_patio);
  const documentsMatches = ['outside_without_open_by_status', 'document_references', 'person_http_urls', 'storage_metadata']
    .every(key => key in oldDocuments && key in newDocuments && canonical(oldDocuments[key]) === canonical(newDocuments[key]));
  const preservationRows = rows(snapshot.preservation);
  const preservationNames = ['access_records', 'drivers', 'operational_checklist_items', 'operational_movements', 'operational_photos', 'people', 'personal_vehicles', 'vehicle_inspection_requests', 'vehicle_records', 'vehicles'];
  const seen = new Set<string>();
  for (const value of preservationRows) {
    const row = object(value);
    if (typeof row.table_name !== 'string' || !preservationNames.includes(row.table_name) || seen.has(row.table_name) ||
        !Number.isSafeInteger(row.row_count) || (row.row_count as number) < 0 ||
        typeof row.original_columns_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.original_columns_sha256)) return fail();
    seen.add(row.table_name);
  }
  if (seen.size !== 10) return fail();
  const historicalContentMatches = previous.preservation === undefined ? null : compareRows(previous.preservation, preservationRows).matches;
  const exactFingerprintMatches = inventoryFingerprint(original) === inventoryFingerprint(current);
  const hasDrift = Object.values(metadata).some(section => section.matches === false) || !extraMetadataMatches || managedMatches === false ||
    !integrityMatches || !documentsMatches || !exactFingerprintMatches || historicalContentMatches === false;
  const insufficientAuditEvidence = functions.evidence.insufficientExecuteFields > 0;
  const unexpectedPortariaSchema = snapshot.portaria_schema_present || snapshot.release_table_present;
  return {
    status: !wholeScopeVisible ? 'insufficient_read_coverage' : unexpectedPortariaSchema ? 'unexpected_existing_portaria' :
      hasDrift ? 'drift_detected' : insufficientAuditEvidence ? 'insufficient_audit_evidence' : 'catalog_and_aggregates_match_manual_review_required',
    collectedAt: snapshot.collected_at,
    remoteExecutionPerformedByComparator: false, metadata, extraMetadataMatches, managedMatches, integrityMatches, documentsMatches,
    functionComparison: functions.evidence, managedColumnsMatch, insufficientAuditEvidence,
    exactFingerprintMatches, wholeScopeVisible,
    historicalContentMatches, previousPreservationBaselineAvailable: previous.preservation !== undefined,
    currentPreservationTables: seen.size,
    unexpectedPortariaSchema,
    migrationExecutionAuthorized: false,
    limits: ['Rotulo do projeto nao comprova origem: confirmar projeto no painel.',
      'Contagens iguais nao comprovam IDs ou conteudo antigo sem baseline anterior de digests.',
      'Nenhum documento/arquivo foi baixado; metadados Storage nao comprovam bytes.',
      'Nenhuma aprovacao de SQL de alteracao, Auth, Storage, RLS ou escrita e emitida por esta comparacao.'],
  };
}

export const sourceDigest = (text: string) => createHash('sha256').update(text).digest('hex');
