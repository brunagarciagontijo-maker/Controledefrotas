import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import { validateDevEnvironment } from '../src/lib/environment.ts';

if (!stdin.isTTY) throw new Error('Execute interativamente. Nao passe chaves em argumentos, scripts ou chat.');
let hidden = false;
const output = Object.assign(new Writable({ write(chunk, _encoding, done) { if (!hidden) stdout.write(chunk); done(); } }), { isTTY: true, columns: stdout.columns });
const prompt = createInterface({ input: stdin, output, terminal: true });
try {
  console.log('Configuracao local apenas: nenhuma conexao sera realizada.');
  console.log('Use somente um projeto novo, independente, com SQL DEV aplicado e permissoes validadas.');
  const confirmation = await prompt.question('Digite DEV NOVO para confirmar essas condicoes: ');
  if (confirmation !== 'DEV NOVO') throw new Error('Configuracao cancelada.');
  if (existsSync('.env.devcloud.local') || existsSync('devcloud.target.local.json')) {
    if (await prompt.question('Arquivos locais existem. Digite SUBSTITUIR DEV para troca-los: ') !== 'SUBSTITUIR DEV') throw new Error('Configuracao cancelada.');
  }
  const projectRef = (await prompt.question('Identificador do projeto DEV (20 caracteres): ')).trim();
  stdout.write('Chave PUBLICA DEV (entrada oculta; nunca secret/service_role): ');
  hidden = true;
  let publicKey: string;
  try { publicKey = (await prompt.question('')).trim(); }
  finally { hidden = false; stdout.write('\n'); }
  const appOrigin = 'http://127.0.0.1:5173';
  const target = { environment: 'devcloud', projectRef, publicKeySha256: createHash('sha256').update(publicKey).digest('hex'), appOrigin, remoteEnabled: true };
  const values = { VITE_SUPABASE_URL: 'https://' + projectRef + '.supabase.co', VITE_SUPABASE_ANON_KEY: publicKey, VITE_PUBLIC_APP_URL: appOrigin };
  const result = await validateDevEnvironment(values, target, 'devcloud', undefined, async text => createHash('sha256').update(text).digest('hex'));
  if (!result.ready) throw new Error(result.issues.join(' '));
  writeFileSync('.env.devcloud.local', Object.entries(values).map(([name,value]) => name + '=' + value).join('\n') + '\n', {mode:0o600});
  writeFileSync('devcloud.target.local.json', JSON.stringify(target,null,2) + '\n', {mode:0o600});
  console.log('Arquivos locais ignorados criados. Nenhum valor foi reproduzido na saida. Reinicie npm run dev.');
} finally { prompt.close(); }
