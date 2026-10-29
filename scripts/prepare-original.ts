import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseInventory, inventoryFingerprint } from './inventory-model.ts';
import { ORIGINAL_MIGRATIONS } from '../src/config/originalRelease.ts';
import { originalSourceHashes } from './original-sources.ts';
import { recoveryApproval } from './recovery-approval.ts';
const path = '.secrets/original-inventory.json';
if (!existsSync(path))
    throw new Error('Inventario original ausente. Nao ha preparacao cega nem conexao remota.');
if (!existsSync('original.target.local.json'))
    throw new Error('Destino original nao configurado. Use original:configure localmente.');
const { parseDevTarget } = await import('../src/lib/environment.ts');
// Erros de JSON nao devem reproduzir trechos de arquivos privados no terminal.
const parsePrivateJson = (value: string): unknown => {
    try { return JSON.parse(value); }
    catch { throw new Error('Arquivo privado ausente ou JSON invalido. Nenhum conteudo sera exibido.'); }
};
const target = parseDevTarget(parsePrivateJson(readFileSync('original.target.local.json', 'utf8')));
if (target.environment !== 'original' || target.access !== 'metadata-only' || !/^[a-z0-9]{20}$/.test(target.projectRef))
    throw new Error('Destino incorreto.');
const raw = readFileSync(path, 'utf8');
const inventory = parseInventory(parsePrivateJson(raw));
const receiptPath = '.secrets/original-release-approval.json';
const receiptValue = existsSync(receiptPath) ? parsePrivateJson(readFileSync(receiptPath, 'utf8')) : {};
if (!receiptValue || typeof receiptValue !== 'object' || Array.isArray(receiptValue))
    throw new Error('Recibo de aprovacao invalido. Nenhum conteudo sera exibido.');
const receipt = receiptValue as Record<string, unknown>;
const inventorySha = createHash('sha256').update(raw).digest('hex');
const waiverPath = '.secrets/original-recovery-waiver.json';
const recovery = recoveryApproval(receipt, { projectRef: target.projectRef, inventorySha256: inventorySha },
    existsSync(waiverPath) ? readFileSync(waiverPath, 'utf8') : undefined);
const approved = receipt.sqlApproved === true && recovery !== null;
const output = '.cache/original-review/sql';
mkdirSync(output, { recursive: true });
const fingerprintQuery = readFileSync('supabase/original/structure_fingerprint.sql', 'utf8').replace(/--[^\n]*/g, '').trim().replace(/;$/, '');
const manifest: Record<string, string> = {};
for (const name of ORIGINAL_MIGRATIONS) {
    const sql = readFileSync('supabase/original/incremental/' + name, 'utf8')
        .replaceAll('REPLACE_PROJECT_REF', target.projectRef).replaceAll('REPLACE_BASELINE_HASH', inventoryFingerprint(inventory))
        .replaceAll('REPLACE_RECOVERY_STRATEGY', approved ? recovery!.strategy : 'RECUPERACAO_PENDENTE')
        .replaceAll('REPLACE_RECOVERY_EVIDENCE_SHA256', approved ? recovery!.evidenceSha256 : 'RECUPERACAO_PENDENTE')
        .replaceAll('REPLACE_SQL_APPROVAL', approved ? 'APROVADO_EXPLICITAMENTE' : 'APROVACAO_PENDENTE')
        .replaceAll('REPLACE_STRUCTURE_FINGERPRINT_QUERY', fingerprintQuery);
    writeFileSync(output + '/' + name, sql);
    manifest[name] = createHash('sha256').update(sql).digest('hex');
}
writeFileSync(output + '/sha256.json', JSON.stringify({ status: approved ? 'rendered_after_local_approval_receipt' : 'blocked_pending_recovery_decision_and_specific_sql_approval', inventorySha256: inventorySha,
    recoveryStrategy: approved ? recovery!.strategy : null, recoveryEvidenceSha256: approved ? recovery!.evidenceSha256 : null,
    backupReceiptSha256: approved && recovery!.strategy === 'verified-backup' ? recovery!.evidenceSha256 : null,
    sqlBundleSha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'), templateFiles:originalSourceHashes(), files: manifest }, null, 2) + '\n');
console.log('Candidatos gerados para revisao local. Nenhum SQL foi executado.');
console.log(approved ? 'Recibo local informado: a execucao remota ainda exige aprovacao humana dos arquivos finais e hashes.' : 'Bloqueios de recuperacao/dispensa e aprovacao permanecem nos arquivos gerados. Nao executar remotamente.');
