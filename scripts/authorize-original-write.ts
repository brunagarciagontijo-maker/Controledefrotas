// Preparado para uma etapa FUTURA. Nao executado nesta entrega.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { parseDevTarget } from '../src/lib/environment.ts';
import { ORIGINAL_MIGRATIONS, ORIGINAL_SCHEMA_VERSION } from '../src/config/originalRelease.ts';
import { currentOriginalSources } from './original-sources.ts';
import { recoveryApproval } from './recovery-approval.ts';
const fail = () => { throw new Error('Liberacao bloqueada. Faltam recuperacao/dispensa registrada, inventario, SQL exato aprovado/aplicado, validacao e aprovacao especifica das operacoes do aplicativo.'); };
if (!stdin.isTTY)
    fail();
const load = (path: string): unknown => { if (!existsSync(path))
    return fail(); try {
    return JSON.parse(readFileSync(path, 'utf8'));
}
catch {
    return fail();
} };
const target = parseDevTarget(load('original.target.local.json'));
const receipt = load('.secrets/original-release-approval.json') as Record<string, unknown>;
const manifest = load('.cache/original-review/sql/sha256.json') as {
    status: string;
    inventorySha256: string;
    backupReceiptSha256: string;
    recoveryStrategy: string;
    recoveryEvidenceSha256: string;
    files: Record<string, string>;
    templateFiles:Record<string,string>;
};
if(!currentOriginalSources(manifest?.templateFiles))fail();
if (!manifest || !manifest.files || typeof manifest.files !== 'object' || Object.keys(manifest.files).length !== ORIGINAL_MIGRATIONS.length || !ORIGINAL_MIGRATIONS.every(name => /^[a-f0-9]{64}$/.test(manifest.files[name] || '')))
    fail();
if (target.environment !== 'original' || target.access !== 'metadata-only' || receipt.projectRef !== target.projectRef || !existsSync('.secrets/original-inventory.json'))
    fail();
if(target.appOrigin.startsWith('https:')&&receipt.deploymentApproved!==true)fail();
const inventorySha = createHash('sha256').update(readFileSync('.secrets/original-inventory.json')).digest('hex');
const bundleSha = createHash('sha256').update(JSON.stringify(manifest.files)).digest('hex');
const waiverPath = '.secrets/original-recovery-waiver.json';
const recovery = recoveryApproval(receipt, { projectRef: target.projectRef, inventorySha256: inventorySha },
    existsSync(waiverPath) ? readFileSync(waiverPath, 'utf8') : undefined);
if (!recovery || manifest.status !== 'rendered_after_local_approval_receipt' || manifest.recoveryStrategy !== recovery.strategy ||
    manifest.recoveryEvidenceSha256 !== recovery.evidenceSha256 ||
    manifest.backupReceiptSha256 !== (recovery.strategy === 'verified-backup' ? recovery.evidenceSha256 : null) ||
    manifest.inventorySha256 !== inventorySha || receipt.approvedSqlBundleSha256 !== bundleSha ||
    ['sqlApproved', 'remoteMigrationsApplied', 'postflightValidated', 'frontendOperationsApproved'].some(field => receipt[field] !== true))
    fail();
for (const [name, hash] of Object.entries(manifest.files)) {
    if (!(ORIGINAL_MIGRATIONS as readonly string[]).includes(name))
        fail();
    const sql = readFileSync('.cache/original-review/sql/' + name);
    if (createHash('sha256').update(sql).digest('hex') !== hash)
        fail();
}
const prompt = createInterface({ input: stdin, output: stdout });
try {
    console.log('Esta autorizacao habilita Auth e operacoes REAIS do aplicativo no original. Nenhuma conexao e realizada por este comando.');
    if (recovery!.strategy === 'no-backup-risk-accepted') console.log('SEM BACKUP: perda de registros/arquivos pode ser irrecuperavel. A dispensa nao autoriza exclusoes.');
    if (await prompt.question('Somente apos aprovacao especifica, digite ORIGINAL COM ESCRITA APROVADA: ') !== 'ORIGINAL COM ESCRITA APROVADA')
        fail();
    const recoveryRelease = recovery!.strategy === 'no-backup-risk-accepted'
        ? { recoveryStrategy: 'no-backup-risk-accepted' as const, recoveryWaiverSha256: recovery!.evidenceSha256 }
        : { backupReceiptSha256: recovery!.evidenceSha256 };
    const released = parseDevTarget({ ...target, access: 'read-write', authorization: 'ORIGINAL COM ESCRITA APROVADA', release: { inventorySha256: inventorySha, ...recoveryRelease, sqlBundleSha256: bundleSha, schemaVersion: ORIGINAL_SCHEMA_VERSION } });
    writeFileSync('original.target.local.json', JSON.stringify(released, null, 2) + '\n', { mode: 0o600 });
    console.log('Liberacao local registrada. O frontend ainda confere o marcador remoto e o perfil ativo. Reinicie o servidor.');
}
finally {
    prompt.close();
}
