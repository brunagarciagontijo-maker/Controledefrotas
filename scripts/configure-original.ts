import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
import { existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateDevEnvironment } from '../src/lib/environment.ts';
if (!stdin.isTTY)
    throw new Error('Execute no terminal local interativo. Nao informe chaves em argumentos.');
let hidden = false;
const output = Object.assign(new Writable({ write(chunk, _encoding, done) { if (!hidden)
        stdout.write(chunk); done(); } }), { isTTY: true, columns: stdout.columns });
const prompt = createInterface({ input: stdin, output, terminal: true });
try {
    console.log('Apenas configuracao local. Nao cria sessao, nao conecta e nao autoriza escrita no projeto original.');
    const authorization = await prompt.question('Digite ORIGINAL SOMENTE LEITURA: ');
    if (authorization !== 'ORIGINAL SOMENTE LEITURA')
        throw new Error('Configuracao cancelada.');
    if (existsSync('.env.original.local') || existsSync('original.target.local.json'))
        if (await prompt.question('Digite SUBSTITUIR ORIGINAL para trocar a configuracao existente: ') !== 'SUBSTITUIR ORIGINAL')
            throw new Error('Configuracao cancelada.');
    const projectRef = (await prompt.question('Identificador do projeto autorizado (20 caracteres): ')).trim();
    stdout.write('Chave publica anon/publishable (entrada oculta): ');
    hidden = true;
    let key: string;
    try {
        key = (await prompt.question('')).trim();
    }
    finally {
        hidden = false;
        stdout.write('\n');
    }
    const digest = async (value: string) => createHash('sha256').update(value).digest('hex');
    const target = { environment: 'original', projectRef, publicKeySha256: await digest(key), appOrigin: 'http://127.0.0.1:5173', remoteEnabled: true, access: 'metadata-only' as const, authorization: 'ORIGINAL SOMENTE LEITURA' as const };
    const env = { VITE_SUPABASE_URL: `https://${projectRef}.supabase.co`, VITE_SUPABASE_ANON_KEY: key, VITE_PUBLIC_APP_URL: target.appOrigin };
    const validation = await validateDevEnvironment(env, target, 'original', undefined, digest);
    if (!validation.ready)
        throw new Error(validation.issues.join(' '));
    writeFileSync('.env.original.local', Object.entries(env).map(([name, value]) => `${name}=${value}`).join('\n') + '\n', { mode: 0o600 });
    writeFileSync('original.target.local.json', JSON.stringify(target, null, 2) + '\n', { mode: 0o600 });
    console.log('Destino fixado localmente. Nenhum valor foi exibido. npm run dev:original permanece limitado ao inventario.');
}
finally {
    prompt.close();
}
