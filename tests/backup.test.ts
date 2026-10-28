import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,unlinkSync,rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('verificacao de backup nao declara restauracao validada nem aceita backup no repositorio',()=>{
  const root=mkdtempSync(join(tmpdir(),'portaria-backup-test-'));const work=join(root,'workspace');mkdirSync(work);
  const outside=join(root,'backup.fake');const inside=join(work,'backup.fake');
  writeFileSync(outside,'FICTIONAL_BACKUP_CANARY');writeFileSync(inside,'FICTIONAL_BACKUP_CANARY');
  const script=fileURLToPath(new URL('../scripts/verify-backup.mjs',import.meta.url));
  try{
    const rejected=spawnSync(process.execPath,[script,'--file',inside],{cwd:work,encoding:'utf8'});assert.notEqual(rejected.status,0);
    const accepted=spawnSync(process.execPath,[script,'--file',outside],{cwd:work,encoding:'utf8'});assert.equal(accepted.status,0,accepted.stderr);assert.ok(!accepted.stdout.includes('FICTIONAL_BACKUP_CANARY'));
    const receipt=JSON.parse(readFileSync(join(work,'.secrets/backup-receipts/database.json'),'utf8'));assert.equal(receipt.restoreVerified,false);assert.equal(receipt.storageBackupVerified,false);assert.equal(receipt.scope,'checksum_only');assert.match(receipt.sha256,/^[a-f0-9]{64}$/);
  }finally{
    // Apenas arquivos criados por este teste, sem remocao recursiva ou caminhos derivados de dados externos.
    unlinkSync(outside);unlinkSync(inside);const receipt=resolve(work,'.secrets/backup-receipts/database.json');
    try{unlinkSync(receipt);rmdirSync(join(work,'.secrets/backup-receipts'));rmdirSync(join(work,'.secrets'));}catch{/* Arquivos podem nao existir se a validacao interromper antes de gravar. */}
    rmdirSync(work);rmdirSync(root);
  }
});
