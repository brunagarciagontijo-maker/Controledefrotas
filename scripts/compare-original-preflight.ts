import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseDevTarget } from '../src/lib/environment.ts';
import { comparePreflight, PREFLIGHT_SOURCES, sourceDigest } from './original-preflight-model.ts';
import { BLOCKED_PROJECT_HASHES } from '../src/config/blockedProjects.ts';
import { currentOriginalSources } from './original-sources.ts';
import { ORIGINAL_MIGRATIONS } from '../src/config/originalRelease.ts';

const directory = '.cache/original-review/final-preflight';
try {
  const target = parseDevTarget(JSON.parse(readFileSync('original.target.local.json', 'utf8')));
  if (target.environment !== 'original' || target.access !== 'metadata-only' || target.release ||
      !BLOCKED_PROJECT_HASHES.includes(sourceDigest(target.projectRef))) throw new Error('INVALID_TARGET');
  const review = JSON.parse(readFileSync('.cache/original-review/sql/sha256.json', 'utf8'));
  const currentTemplates = currentOriginalSources(review.templateFiles);
  const candidatesIntact = review.files && Object.keys(review.files).length === ORIGINAL_MIGRATIONS.length &&
    ORIGINAL_MIGRATIONS.every(name => review.files[name] === sourceDigest(readFileSync('.cache/original-review/sql/' + name, 'utf8'))) &&
    review.sqlBundleSha256 === sourceDigest(JSON.stringify(review.files));
  const renderedInventoryMatchesReference = review.inventorySha256 === sourceDigest(readFileSync('.secrets/original-inventory.json', 'utf8'));
  const file = '.secrets/original-final-preflight.json';
  if (!existsSync(file)) {
    mkdirSync(directory, { recursive: true });
    const pending = { status: 'pending_manual_readonly_snapshot', freshRemoteStateConfirmed: false,
      sourceProfile: 'metadata-only', remoteQueriesExecuted: 0, sdkBypassUsed: false,
      candidateTemplatesCurrent: currentTemplates,
      renderedCandidatesIntact: Boolean(candidatesIntact), renderedInventoryMatchesReference,
      previousPreservationBaselineAvailable: existsSync('.secrets/original-preservation.json'),
      migrationExecutionAuthorized: false };
    writeFileSync(directory + '/comparison.json', JSON.stringify(pending, null, 2) + '\n');
    console.log(JSON.stringify(pending)); process.exitCode = 2;
  } else {
    const load = (name: string): unknown => JSON.parse(readFileSync('.secrets/' + name, 'utf8'));
    const result = comparePreflight({ inventory: load('original-inventory.json'), managed: load('original-managed-inventory.json'),
      integrity: load('original-integrity.json'), documents: load('original-documents-patio.json'),
      ...(existsSync('.secrets/original-preservation.json') ? { preservation: load('original-preservation.json') } : {}) }, load('original-final-preflight.json'),
    { targetSha256: sourceDigest(target.projectRef), querySources: Object.fromEntries(PREFLIGHT_SOURCES.map(([key, name]) => [key, sourceDigest(readFileSync('supabase/original/' + name, 'utf8'))])) });
    mkdirSync(directory, { recursive: true });
    const report = { ...result, candidateTemplatesCurrent: currentTemplates, renderedCandidatesIntact: Boolean(candidatesIntact),
      renderedInventoryMatchesReference, finalCompatibilityApproved: false };
    writeFileSync(directory + '/comparison.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
    if (result.status !== 'catalog_and_aggregates_match_manual_review_required' || result.unexpectedPortariaSchema ||
      !currentTemplates || !candidatesIntact || !renderedInventoryMatchesReference) process.exitCode = 1;
  }
} catch {
  console.error('Comparacao bloqueada: arquivo privado ausente/incompleto, contrato inesperado ou snapshot invalido. Nenhum trecho sera exibido.');
  process.exitCode = 1;
}
