import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { recoveryApproval } from '../scripts/recovery-approval.ts';
import { originalSourceHashes } from '../scripts/original-sources.ts';
import { NO_BACKUP_ACKNOWLEDGEMENT, approvedOriginalRelease, originalReleaseMatches } from '../src/config/originalRelease.ts';
import { parseDevTarget, validateDevEnvironment } from '../src/lib/environment.ts';

const context = { projectRef: 'a'.repeat(20), inventorySha256: 'b'.repeat(64) };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const waiver = () => ({ version: 1, scope: 'original-001-007', ...context, templateFiles: originalSourceHashes(),
  accepted: true, acceptedAt: '2026-01-01T00:00:00.000Z', acknowledgement: NO_BACKUP_ACKNOWLEDGEMENT });
const receipt = (raw: string) => ({ ...context, recoveryStrategy: 'no-backup-risk-accepted', recoveryWaiverSha256: digest(raw),
  backupReceiptSha256: '', restoreVerified: false, storageBackupVerified: false });

test('dispensa exige documento exato, destino, inventario e sete templates atuais, sem declarar backup', () => {
  const raw = JSON.stringify(waiver()), input = receipt(raw);
  assert.deepEqual(recoveryApproval(input, context, raw), { strategy: 'no-backup-risk-accepted', evidenceSha256: digest(raw) });
  assert.equal(input.restoreVerified, false); assert.equal(input.storageBackupVerified, false);
  assert.equal(recoveryApproval(input, context), null);
  assert.equal(recoveryApproval({ ...input, recoveryWaiverSha256: '0'.repeat(64) }, context, raw), null);
  assert.equal(recoveryApproval(input, { ...context, projectRef: 'c'.repeat(20) }, raw), null);
  assert.equal(recoveryApproval(input, { ...context, inventorySha256: 'c'.repeat(64) }, raw), null);
});

test('dispensa ausente, generica, nao aceita, com segredo adicional ou fonte antiga falha fechada', () => {
  for (const change of [{ accepted: false }, { scope: 'all-databases' }, { acknowledgement: '' },
    { acceptedAt: '2099-01-01T00:00:00.000Z' }, { acceptedAt: '2026-02-30T00:00:00.000Z' },
    { templateFiles: {} }, { templateFiles: { ...originalSourceHashes(), '001_foundation.sql': '0'.repeat(64) } },
    { secret: 'FICTITIOUS_CANARY_NEVER_PRINT' }]) {
    const raw = JSON.stringify({ ...waiver(), ...change });
    assert.equal(recoveryApproval(receipt(raw), context, raw), null);
  }
  for (const raw of ['{bad FICTITIOUS_CANARY_NEVER_PRINT', 'null', '[]']) assert.equal(recoveryApproval(receipt(raw), context, raw), null);
});

test('dispensa nao permite misturar backup falso, restauracao afirmada ou estrategia desconhecida', () => {
  const raw = JSON.stringify(waiver());
  for (const change of [{ restoreVerified: true }, { storageBackupVerified: true }, { backupReceiptSha256: 'c'.repeat(64) }, { recoveryStrategy: 'skip-all-checks' }]) {
    assert.equal(recoveryApproval({ ...receipt(raw), ...change }, context, raw), null);
  }
  const verified = { ...context, backupReceiptSha256: 'c'.repeat(64), restoreVerified: true, storageBackupVerified: true };
  assert.deepEqual(recoveryApproval(verified, context), { strategy: 'verified-backup', evidenceSha256: 'c'.repeat(64) });
  assert.equal(recoveryApproval({ ...verified, restoreVerified: false }, context), null);
});

test('liberacao e marcador diferenciam dispensa e backup; campos misturados ou versao anterior falham', () => {
  const release = { inventorySha256: context.inventorySha256, sqlBundleSha256: 'c'.repeat(64), schemaVersion: 5 as const,
    recoveryStrategy: 'no-backup-risk-accepted' as const, recoveryWaiverSha256: 'd'.repeat(64) };
  const marker = { schema_version: 5, recovery_strategy: release.recoveryStrategy, recovery_evidence_sha256: release.recoveryWaiverSha256, backup_sha256: null };
  assert.equal(approvedOriginalRelease(release), true); assert.equal(originalReleaseMatches(marker, release), true);
  for (const value of [{ ...marker, recovery_evidence_sha256: 'e'.repeat(64) }, { ...marker, backup_sha256: 'd'.repeat(64) },
    { ...marker, recovery_strategy: 'verified-backup' }, { ...marker, schema_version: 3 }]) assert.equal(originalReleaseMatches(value, release), false);
  assert.equal(approvedOriginalRelease({ ...release, backupReceiptSha256: 'd'.repeat(64) }), false);
  assert.equal(approvedOriginalRelease({ ...release, recoveryWaiverSha256: '' }), false);
  const backup = { inventorySha256: release.inventorySha256, sqlBundleSha256: release.sqlBundleSha256, schemaVersion: 5 as const, backupReceiptSha256: 'd'.repeat(64) };
  assert.equal(originalReleaseMatches({ ...marker, recovery_strategy: 'verified-backup', backup_sha256: 'd'.repeat(64) }, backup), true);
  assert.equal(originalReleaseMatches(marker, backup), false);
});

test('dispensa isolada nao ativa SDK: escrita exige frase, pinagem e pacote final completos', async () => {
  const key = 'sb_publishable_' + 'f'.repeat(30), origin = 'http://127.0.0.1:5173';
  const release = { inventorySha256: context.inventorySha256, sqlBundleSha256: 'c'.repeat(64), schemaVersion: 5 as const,
    recoveryStrategy: 'no-backup-risk-accepted' as const, recoveryWaiverSha256: 'd'.repeat(64) };
  const target = { environment: 'original', projectRef: context.projectRef, publicKeySha256: digest(key), appOrigin: origin,
    remoteEnabled: true, access: 'read-write' as const, authorization: 'ORIGINAL COM ESCRITA APROVADA' as const, release };
  assert.deepEqual(parseDevTarget(target), target);
  const input = { VITE_SUPABASE_URL: `https://${context.projectRef}.supabase.co`, VITE_SUPABASE_ANON_KEY: key, VITE_PUBLIC_APP_URL: origin };
  assert.equal((await validateDevEnvironment(input, target, 'original', origin)).ready, true);
  assert.equal((await validateDevEnvironment({ ...input, VITE_SUPABASE_ANON_KEY: key + 'changed' }, target, 'original', origin)).ready, false);
  assert.throws(() => parseDevTarget({ ...target, authorization: 'ORIGINAL SOMENTE LEITURA' }));
  assert.throws(() => parseDevTarget({ ...target, release: { recoveryStrategy: 'no-backup-risk-accepted' } }));
});
