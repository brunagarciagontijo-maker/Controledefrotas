import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createNetlifyProductionTarget, type NetlifyProductionContract } from '../scripts/netlify-production.ts';
import { originalSourceHashes } from '../scripts/original-sources.ts';
import { BLOCKED_PROJECT_HASHES } from '../src/config/blockedProjects.ts';

const ref = 'a'.repeat(20);
const key = 'sb_publishable_fictitious_key_for_isolated_netlify_tests';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const hash = async (text: string) => text === ref ? BLOCKED_PROJECT_HASHES[0] : sha(text);
const contract: NetlifyProductionContract = {
  version: 1, branch: 'main', origin: 'https://controledeportariagontijo.netlify.app', siteName: 'controledeportariagontijo',
  repository: 'brunagarciagontijo-maker/Controledefrotas', projectRefSha256: BLOCKED_PROJECT_HASHES[0], publicKeySha256: sha(key),
  release: { inventorySha256: '1'.repeat(64), sqlBundleSha256: '2'.repeat(64), schemaVersion: 5,
    recoveryStrategy: 'no-backup-risk-accepted', recoveryWaiverSha256: '3'.repeat(64) }, templateFiles: originalSourceHashes(),
};
const env = { NETLIFY: 'true', CONTEXT: 'production', BRANCH: 'main', PULL_REQUEST: 'false', SITE_NAME: contract.siteName,
  URL: contract.origin, REPOSITORY_URL: 'https://github.com/' + contract.repository + '.git' };
const input = { VITE_SUPABASE_URL: `https://${ref}.supabase.co`, VITE_SUPABASE_ANON_KEY: key, VITE_PUBLIC_APP_URL: contract.origin };

test('CI main constrói configuração original contrato 5 sem arquivos privados nem rede', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Network forbidden'); };
  try {
    const target = await createNetlifyProductionTarget(env, input, contract, hash);
    assert.equal(target.environment, 'original'); assert.equal(target.access, 'read-write');
    assert.equal(target.appOrigin, contract.origin); assert.equal(target.release?.schemaVersion, 5); assert.equal(calls, 0);
    assert.equal(JSON.stringify(target).includes(key), false);
  } finally { globalThis.fetch = previous; }
});

for (const [name, changes] of [
  ['desenvolvimento', { BRANCH: 'desenvolvimento' }], ['branch deploy', { CONTEXT: 'branch-deploy' }],
  ['deploy preview', { CONTEXT: 'deploy-preview' }], ['pull request', { PULL_REQUEST: 'true' }],
  ['preview server', { NETLIFY_PREVIEW_SERVER: 'true' }], ['other site', { SITE_NAME: 'other' }],
  ['other URL', { URL: 'https://other.netlify.app' }], ['other repository', { REPOSITORY_URL: 'https://github.com/other/repo.git' }],
  ['missing platform context', { NETLIFY: undefined }], ['unknown client variable', { VITE_SECRET: 'fictitious_secret' }],
] as const) {
  test(`CI blocks ${name} without a fallback`, async () => {
    await assert.rejects(() => createNetlifyProductionTarget({ ...env, ...changes }, input, contract, hash), /bloqueado/);
  });
}

test('CI rejects wrong Supabase, wrong key, local origin, old release and changed migrations', async () => {
  for (const changed of [{ ...input, VITE_SUPABASE_URL: 'https://' + 'b'.repeat(20) + '.supabase.co' },
    { ...input, VITE_SUPABASE_ANON_KEY: key + '_wrong' }, { ...input, VITE_PUBLIC_APP_URL: 'http://127.0.0.1:5173' }]) {
    await assert.rejects(() => createNetlifyProductionTarget(env, changed, contract, hash));
  }
  await assert.rejects(() => createNetlifyProductionTarget(env, input, { ...contract, release: { ...contract.release, schemaVersion: 4 } } as unknown as NetlifyProductionContract, hash));
  await assert.rejects(() => createNetlifyProductionTarget(env, input, { ...contract, templateFiles: {} }, hash));
});

test('CI refuses concatenated keys even if their fingerprint was configured', async () => {
  const jwt = 'eyJ' + 'a'.repeat(12) + '.eyJ' + 'b'.repeat(12) + '.' + 'c'.repeat(43) + 'sb_publishable_fictitious';
  await assert.rejects(() => createNetlifyProductionTarget(env, { ...input, VITE_SUPABASE_ANON_KEY: jwt }, { ...contract, publicKeySha256: sha(jwt) }, hash));
});

test('CI rejects the old domain in platform context, client origin and a substituted contract', async () => {
  const oldOrigin = 'https://controledefrotasgontijo.netlify.app';
  const oldSite = 'controledefrotasgontijo';
  await assert.rejects(() => createNetlifyProductionTarget({ ...env, URL: oldOrigin, SITE_NAME: oldSite }, input, contract, hash));
  await assert.rejects(() => createNetlifyProductionTarget(env, { ...input, VITE_PUBLIC_APP_URL: oldOrigin }, contract, hash));
  await assert.rejects(() => createNetlifyProductionTarget({ ...env, URL: oldOrigin, SITE_NAME: oldSite },
    { ...input, VITE_PUBLIC_APP_URL: oldOrigin }, { ...contract, origin: oldOrigin, siteName: oldSite }, hash));
});

test('npm run build and Netlify use original production mode; devcloud stays explicit', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts.build, 'npm run typecheck && vite build --mode original');
  assert.equal(pkg.scripts['build:dev'], 'npm run typecheck && vite build --mode devcloud');
  assert.equal(pkg.scripts['build:netlify'], 'npm run build');
  const config = readFileSync('netlify.toml', 'utf8');
  assert.ok(config.includes('command = "npm run build"'));
  assert.ok(config.includes('publish = "dist"'));
  const published = JSON.parse(readFileSync('netlify/production-contract.json', 'utf8'));
  assert.equal(published.origin, contract.origin);
  assert.equal(published.siteName, contract.siteName);
  assert.equal(published.branch, 'main');
  assert.equal(published.release.schemaVersion, 5);
});

test('ignore command skips development and previews; main proceeds to the strict guard', () => {
  const run = (changes: Record<string, string>) => spawnSync(process.execPath, ['scripts/netlify-ignore.mjs'], { env: { ...env, ...changes }, encoding: 'utf8' });
  assert.equal(run({}).status, 1);
  assert.equal(run({ BRANCH: 'desenvolvimento' }).status, 0);
  assert.equal(run({ CONTEXT: 'deploy-preview' }).status, 0);
  assert.equal(run({ PULL_REQUEST: 'true' }).status, 0);
});

test('CI ignores local dotenv files and deployment config includes no secret key', () => {
  const config = readFileSync('vite.config.ts', 'utf8');
  assert.ok(config.includes('envDir: false'));
  assert.ok(config.indexOf('if (netlify)') < config.indexOf('else if (!offline && existsSync(targetFile))'));
  const published = readFileSync('netlify/production-contract.json', 'utf8');
  assert.equal(/sb_publishable_|eyJ[A-Za-z0-9_-]+\.|sb_secret_|\buser_id\b/.test(published), false);
});
