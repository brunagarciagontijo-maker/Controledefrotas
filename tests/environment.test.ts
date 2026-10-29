import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateDevEnvironment, parseDevTarget, assertApiUrl, assertPrivateFileUrl, extractDevLookup, UNCONFIGURED_TARGET } from '../src/lib/environment.ts';
import { BLOCKED_PROJECT_HASHES } from '../src/config/blockedProjects.ts';
import { isOwnedDevWorker } from '../src/lib/devServiceWorker.ts';

const ref = 'a'.repeat(20);
const key = 'sb_publishable_' + 'fictional_key_for_offline_tests_only';
const digest = async (text: string) => createHash('sha256').update(text).digest('hex');
const target = { environment: 'devcloud', projectRef: ref, publicKeySha256: await digest(key), appOrigin: 'http://127.0.0.1:5173', remoteEnabled: true };
const values = { VITE_SUPABASE_URL: `https://${ref}.supabase.co`, VITE_SUPABASE_ANON_KEY: key, VITE_PUBLIC_APP_URL: target.appOrigin };
const result = await validateDevEnvironment(values, target, 'devcloud');
assert.equal(result.ready, true);
if (!result.ready) throw new Error('Fixture invalida');
const config = result.config;

test('configuracao completa aceita somente o projeto DEV fixado', async () => {
  assert.equal((await validateDevEnvironment(values, target, 'devcloud', target.appOrigin)).ready, true);
});
test('arquivo alvo rejeita campos extras e valores nao tipados', () => {
  assert.deepEqual(parseDevTarget(target), target);
  assert.throws(() => parseDevTarget({ ...target, unexpected: 'nao_serializar' }));
  assert.throws(() => parseDevTarget({ ...target, remoteEnabled: 'true' }));
});
test('importar o SDK e os servicos nao habilita conexao sem runtime validado', async () => {
  const { getSupabase, supabase } = await import('../src/lib/supabase.ts');
  assert.throws(() => getSupabase(), /Conexao bloqueada/);
  assert.throws(() => supabase.from('people'), /Conexao bloqueada/);
});
test('ausencia de projeto e configuracao bloqueia sem executar fetch', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Rede proibida no teste'); };
  try {
    assert.equal((await validateDevEnvironment({}, UNCONFIGURED_TARGET, 'devcloud')).ready, false);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});
for (const [name, changes, alteredTarget, mode, origin] of [
  ['outro projeto', { VITE_SUPABASE_URL: `https://${'b'.repeat(20)}.supabase.co` }, {}, 'devcloud', undefined],
  ['dominio com sufixo malicioso', { VITE_SUPABASE_URL: values.VITE_SUPABASE_URL + '.example.invalid' }, {}, 'devcloud', undefined],
  ['http remoto', { VITE_SUPABASE_URL: values.VITE_SUPABASE_URL.replace('https:', 'http:') }, {}, 'devcloud', undefined],
  ['credenciais na URL', { VITE_SUPABASE_URL: `https://user:pass@${ref}.supabase.co` }, {}, 'devcloud', undefined],
  ['query no endpoint', { VITE_SUPABASE_URL: values.VITE_SUPABASE_URL + '?redirect=other' }, {}, 'devcloud', undefined],
  ['caminho no endpoint', { VITE_SUPABASE_URL: values.VITE_SUPABASE_URL + '/rest/v1' }, {}, 'devcloud', undefined],
  ['chave administrativa', { VITE_SUPABASE_ANON_KEY: 'sb_secret_' + 'not_a_real_secret_for_tests' }, {}, 'devcloud', undefined],
  ['chave de outro cadastro', { VITE_SUPABASE_ANON_KEY: key + '_other' }, {}, 'devcloud', undefined],
  ['QR apontando para sitio externo', { VITE_PUBLIC_APP_URL: 'https://other.example.invalid' }, {}, 'devcloud', undefined],
  ['origem diferente no navegador', {}, {}, 'devcloud', 'http://localhost:5173'],
  ['modo production', {}, {}, 'production', undefined],
  ['autorizacao remota desligada', {}, { remoteEnabled: false }, 'devcloud', undefined],
  ['identificacao vazia', {}, { projectRef: '' }, 'devcloud', undefined],
  ['hash vazio', {}, { publicKeySha256: '' }, 'devcloud', undefined],
] as const) {
  test(`rejeita ${name}`, async () => {
    assert.equal((await validateDevEnvironment({ ...values, ...changes }, { ...target, ...alteredTarget }, mode, origin)).ready, false);
  });
}
test('retorno de erro nao reproduz o valor da chave', async () => {
  const invalid = 'sb_secret_' + 'never_print_this_test_value';
  const rejected = await validateDevEnvironment({ ...values, VITE_SUPABASE_ANON_KEY: invalid }, target, 'devcloud');
  assert.equal(JSON.stringify(rejected).includes(invalid), false);
});
test('destino legado e bloqueado mesmo que seja pinado novamente', async () => {
  const fakeDigest = async (value: string) => value === ref ? BLOCKED_PROJECT_HASHES[0] : digest(value);
  assert.equal((await validateDevEnvironment(values, target, 'devcloud', undefined, fakeDigest)).ready, false);
});
test('JWT legado recusa role elevado, ref estranho e token vencido', async () => {
  for (const payload of [
    { role: 'service_role', ref, exp: 4102444800 },
    { role: 'anon', ref: 'b'.repeat(20), exp: 4102444800 },
    { role: 'anon', ref, exp: 1 },
  ]) {
    const candidate = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.offline_signature';
    assert.equal((await validateDevEnvironment({ ...values, VITE_SUPABASE_ANON_KEY: candidate }, { ...target, publicKeySha256: await digest(candidate) }, 'devcloud')).ready, false);
  }
});
test('fetch permite API DEV, recusa origem externa e outros caminhos', () => {
  assert.equal(assertApiUrl(config.supabaseUrl + '/rest/v1/people', config).origin, config.supabaseUrl);
  assert.throws(() => assertApiUrl('https://other.example.invalid/rest/v1/people', config));
  assert.throws(() => assertApiUrl(config.supabaseUrl + '/unrecognized', config));
});
test('arquivos precisam ser assinados e pertencer ao Storage DEV', () => {
  const allowed = config.supabaseUrl + '/storage/v1/object/sign/person-documents/id/file.pdf?token=ficticio';
  assert.equal(assertPrivateFileUrl(allowed, config), allowed);
  assert.throws(() => assertPrivateFileUrl(config.supabaseUrl + '/storage/v1/object/public/person-documents/id/file.pdf', config));
  assert.throws(() => assertPrivateFileUrl('https://other.example.invalid/file.pdf', config));
  const parcel = config.supabaseUrl + '/storage/v1/object/sign/portaria-parcels/id/parcel.jpg?token=ficticio';
  assert.equal(assertPrivateFileUrl(parcel, config), parcel);
  assert.throws(() => assertPrivateFileUrl(parcel.replace('/sign/', '/public/'), config));
  assert.throws(() => assertPrivateFileUrl(parcel.replace('/portaria-parcels/', '/unknown/'), config));
  assert.throws(() => assertPrivateFileUrl(parcel.split('?')[0], config));
});
test('QR local e identificadores simples funcionam; QR de outro ambiente falha', () => {
  assert.equal(extractDevLookup('101', ['veiculo'], target.appOrigin), '101');
  assert.equal(extractDevLookup(target.appOrigin + '/?tab=patio&veiculo=101', ['veiculo'], target.appOrigin), '101');
  for (const url of ['https://other.example.invalid/?veiculo=101','//other.example.invalid/?veiculo=101','javascript:alert(1)']) {
    assert.throws(() => extractDevLookup(url, ['veiculo'], target.appOrigin));
  }
});
test('HTML DEV nao registra service worker ou manifest de instalacao', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(html.includes('serviceWorker.register'), false);
  assert.equal(html.includes('rel="manifest"'), false);
});
test('limpeza de SW reconhece somente registro deste aplicativo na origem local', () => {
  const origin='http://127.0.0.1:5173';
  assert.equal(isOwnedDevWorker(origin+'/sw.js', origin+'/', origin), true);
  assert.equal(isOwnedDevWorker(origin+'/outro.js', origin+'/', origin), false);
  assert.equal(isOwnedDevWorker(origin+'/sw.js', origin+'/outro/', origin), false);
  assert.equal(isOwnedDevWorker('https://other.example.invalid/sw.js','https://other.example.invalid/','https://other.example.invalid'), false);
});

test('original exige autorizacao explicita metadata-only e mantem pinagem de projeto/chave', async()=>{
  const approved={...target,environment:'original',access:'metadata-only' as const,authorization:'ORIGINAL SOMENTE LEITURA' as const};
  const fakeDigest=async(value:string)=>value===ref?BLOCKED_PROJECT_HASHES[0]:digest(value);
  const original=await validateDevEnvironment(values,approved,'original',target.appOrigin,fakeDigest);
  assert.equal(original.ready,true);if(original.ready)assert.equal(original.config.access,'metadata-only');
  assert.equal((await validateDevEnvironment(values,{...target,environment:'original'},'original')).ready,false);
  assert.equal((await validateDevEnvironment({...values,VITE_SUPABASE_ANON_KEY:key+'_changed'},approved,'original')).ready,false);
  assert.throws(()=>parseDevTarget({...approved,access:'read-write'}));
});
test('SDK original nao pode criar sessao nem chamadas Auth em metadata-only',async()=>{
  const {initializeDevRuntime}=await import('../src/lib/runtime.ts');
  const {getSupabase}=await import('../src/lib/supabase.ts');
  initializeDevRuntime({...config,mode:'original',access:'metadata-only'});
  assert.throws(()=>getSupabase(),/SDK bloqueado/);
});
test('escrita original exige comprovacoes e frase distinta; trocar somente o modo nao libera',async()=>{
  const released={...target,environment:'original',access:'read-write' as const,authorization:'ORIGINAL COM ESCRITA APROVADA' as const,release:{inventorySha256:'1'.repeat(64),backupReceiptSha256:'2'.repeat(64),sqlBundleSha256:'3'.repeat(64),schemaVersion:5 as const}};
  assert.deepEqual(parseDevTarget(released),released);
  assert.throws(()=>parseDevTarget({...released,release:{...released.release,schemaVersion:2}}));
  const accepted=await validateDevEnvironment(values,released,'original');assert.equal(accepted.ready,true);if(accepted.ready)assert.equal(accepted.config.access,'read-write');
  for(const field of['inventorySha256','backupReceiptSha256','sqlBundleSha256'])assert.equal((await validateDevEnvironment(values,{...released,release:{...released.release,[field]:''}},'original')).ready,false);
  assert.equal((await validateDevEnvironment(values,{...released,authorization:'ORIGINAL SOMENTE LEITURA'},'original')).ready,false);
  const origin='https://portaria.example.invalid';
  assert.equal((await validateDevEnvironment({...values,VITE_PUBLIC_APP_URL:origin},{...released,appOrigin:origin},'original',origin)).ready,true);
  assert.equal((await validateDevEnvironment({...values,VITE_PUBLIC_APP_URL:origin},{...target,environment:'original',access:'metadata-only',authorization:'ORIGINAL SOMENTE LEITURA',appOrigin:origin},'original',origin)).ready,false);
});
