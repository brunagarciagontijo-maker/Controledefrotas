import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseDevTarget } from '../src/lib/environment.ts';
if (!existsSync('original.target.local.json'))
    throw new Error('Nao ha destino original configurado. Nenhuma alteracao realizada.');
let source: unknown;
try {
    source = JSON.parse(readFileSync('original.target.local.json', 'utf8'));
}
catch {
    throw new Error('Destino invalido. Nenhum valor sera exibido.');
}
const target = parseDevTarget(source);
if (target.environment !== 'original')
    throw new Error('Destino nao corresponde ao perfil original.');
const locked = { environment: 'original', projectRef: target.projectRef, publicKeySha256: target.publicKeySha256, appOrigin: target.appOrigin, remoteEnabled: target.remoteEnabled, access: 'metadata-only' as const, authorization: 'ORIGINAL SOMENTE LEITURA' as const };
writeFileSync('original.target.local.json', JSON.stringify(locked, null, 2) + '\n', { mode: 0o600 });
console.log('Configuracao local bloqueada para inventario. Feche as abas e reinicie o servidor para aplicar. Nenhuma sessao ou permissao remota foi alterada.');
