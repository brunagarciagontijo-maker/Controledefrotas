import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BLOCKED_PROJECT_HASHES } from '../src/config/blockedProjects.ts';

const index = process.argv.indexOf('--project-ref');
const projectRef = index >= 0 ? process.argv[index + 1] : '';
if (!/^[a-z0-9]{20}$/.test(projectRef || '') || BLOCKED_PROJECT_HASHES.includes(createHash('sha256').update(projectRef).digest('hex'))) {
  throw new Error('Informe --project-ref com o identificador de um projeto DEV novo e independente. Destinos legados sao bloqueados.');
}
const output = '.cache/devcloud-sql';
mkdirSync(output, {recursive:true});
const names = ['01_schema.sql','02_security.sql','03_storage.sql','04_test_profiles.sql','05_fixtures.sql','06_validate.sql','07_realtime.sql'];
for (const name of names) {
  const sql = readFileSync('supabase/dev/' + name,'utf8').replaceAll('REPLACE_WITH_DEV_PROJECT_REF',projectRef);
  writeFileSync(output + '/' + name, sql);
}
console.log('Pacote gerado em .cache/devcloud-sql. Nenhuma conexao ou SQL foi executado.');
console.log('Confira o projeto no painel antes de cada lote. Preencha os UUIDs de teste no lote 04.');
