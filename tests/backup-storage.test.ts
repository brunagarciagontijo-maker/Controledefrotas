import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';

const script = fileURLToPath(new URL('../scripts/backup/verify-storage-copy.mjs', import.meta.url));
const repo = resolve(dirname(script), '../..');
const bucketIds = ['access-documents', 'driver-cnh-documents', 'person-documents', 'vehicle-operation-photos'];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'portaria-private-proof-'));
  const source = join(root, 'source'); mkdirSync(join(source, 'objects'), { recursive: true });
  const payload = Buffer.from('SYNTHETIC_PRIVATE_CONTENT_CANARY');
  const row = (name: string, bytes: Buffer) => {
    const file = `objects/${randomUUID()}.bin`; writeFileSync(join(source, file), bytes);
    return { bucket: bucketIds[0], name, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), metadata: { id: randomUUID(), bucket_id: bucketIds[0], name, owner_id: null, metadata: { size: bytes.length, mimetype: 'image/jpeg' }, version: 'synthetic' } };
  };
  const manifest = { format_version: 1, snapshot_id: randomUUID(), buckets: bucketIds.map((id, i) => ({ id, expected_objects: i === 0 ? 2 : 0, configuration: { id, public: false } })), objects: [row('FICTICIO_CANARY/CON.jpg', payload), row('ficticio_canary/con.jpg', Buffer.alloc(0))] };
  const path = join(root, 'manifest.private.json');
  const save = () => writeFileSync(path, JSON.stringify(manifest)); save();
  const run = (extra: string[] = []) => spawnSync(process.execPath, [script, '--manifest', path, '--root', source, ...extra], { encoding: 'utf8' });
  const clean = () => {
    const actual = realpathSync(root), parent = realpathSync(tmpdir());
    assert.equal(dirname(actual), parent); assert.ok(basename(actual).startsWith('portaria-private-proof-'));
    rmSync(actual, { recursive: true, force: true }); // Somente a pasta temporaria verificada criada por este teste.
  };
  return { root, source, manifest, path, save, run, clean };
}

test('verificador local cobre quatro buckets, nomes sensiveis ao caso e arquivo vazio sem divulgar conteudo', () => {
  const f = fixture(); try {
    const result = f.run(); assert.equal(result.status, 0, result.stdout);
    const value = JSON.parse(result.stdout); assert.equal(value.objectsChecked, 2); assert.equal(value.buckets.length, 4);
    assert.equal(value.restoreVerified, false); assert.equal(value.storageBackupVerified, false); assert.equal(value.remoteSourceVerified, false);
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_CONTENT_CANARY|FICTICIO_CANARY|CON\.jpg|owner_id/);
  } finally { f.clean(); }
});
test('arquivo corrompido do mesmo tamanho e detectado pelo hash', () => {
  const f = fixture(); try { writeFileSync(join(f.source, f.manifest.objects[0].file), Buffer.alloc(f.manifest.objects[0].bytes)); const r = f.run(); assert.equal(r.status, 1); assert.match(r.stdout, /OBJECT_HASH_MISMATCH/); } finally { f.clean(); }
});
test('contagem divergente e bucket omitido nao permitem validar copia parcial', () => {
  const f = fixture(); try { f.manifest.buckets[0].expected_objects++; f.save(); assert.match(f.run().stdout, /SOURCE_INVENTORY_COUNT_MISMATCH/); f.manifest.buckets.pop(); f.save(); assert.match(f.run().stdout, /BUCKET_SCOPE_MISMATCH/); } finally { f.clean(); }
});
test('nomes duplicados e caminhos de arquivos fora do pacote sao recusados sem ecoar nomes', () => {
  const f = fixture(); try { f.manifest.objects[1].name = f.manifest.objects[0].name; f.manifest.objects[1].metadata.name = f.manifest.objects[0].name; f.save(); assert.match(f.run().stdout, /DUPLICATE_OBJECT_OR_FILE/); f.manifest.objects[0].file = '../outside.bin'; f.save(); assert.match(f.run().stdout, /MANIFEST_INVALID/); } finally { f.clean(); }
});
test('arquivos extras, metadados ausentes e JSON invalido bloqueiam a verificacao', () => {
  const f = fixture(); try {
    writeFileSync(join(f.source, 'objects', 'extra.fake'), 'SYNTHETIC'); assert.match(f.run().stdout, /UNMANIFESTED_FILES/);
    f.manifest.objects[0].metadata = {} as typeof f.manifest.objects[0]['metadata']; f.save(); assert.match(f.run().stdout, /OBJECT_METADATA_MISSING/);
    writeFileSync(f.path, '{PRIVATE_CONTENT_CANARY'); const r = f.run(); assert.match(r.stdout, /MANIFEST_INVALID/); assert.doesNotMatch(r.stdout + r.stderr, /PRIVATE_CONTENT_CANARY/);
  } finally { f.clean(); }
});
test('dados dentro do repositorio e entradas HTTP nao sao lidos', () => {
  const f = fixture(); try { const r = f.run(['--restored-manifest', join(repo, 'package.json'), '--restored-root', repo]); assert.match(r.stdout, /PRIVATE_PATH_OUTSIDE_REPOSITORY_REQUIRED/); const remote = spawnSync(process.execPath, [script, '--manifest', 'https://example.invalid/private', '--root', f.source], { encoding: 'utf8' }); assert.equal(remote.status, 1); assert.match(remote.stdout, /LOCAL_PATH_REQUIRED/); } finally { f.clean(); }
});
test('comparacao de duas copias iguais nao declara restauracao concluida', () => {
  const f = fixture(); try { const r = f.run(['--restored-manifest', f.path, '--restored-root', f.source]); assert.equal(r.status, 0); const value = JSON.parse(r.stdout); assert.equal(value.comparison.sameNamesPathsAndBytes, true); assert.equal(value.comparison.sameMetadata, true); assert.equal(value.comparison.restoreVerified, false); } finally { f.clean(); }
});
test('mudanca de ID/proprietario exige revisao mesmo com bytes identicos', () => {
  const f = fixture(); try { const copy = JSON.parse(readFileSync(f.path, 'utf8')); copy.objects[0].metadata.id = randomUUID(); copy.objects[0].metadata.owner_id = 'ACTOR_FICTICIO'; const path = join(f.root, 'restored.private.json'); writeFileSync(path, JSON.stringify(copy)); const r = f.run(['--restored-manifest', path, '--restored-root', f.source]); assert.equal(r.status, 2); const value = JSON.parse(r.stdout); assert.equal(value.comparison.sameNamesPathsAndBytes, true); assert.equal(value.comparison.identityOrOwnerMismatches, 1); assert.equal(value.comparison.restoreVerified, false); assert.doesNotMatch(r.stdout, /ACTOR_FICTICIO|FICTICIO_CANARY/); } finally { f.clean(); }
});
test('os dois SQLs preparados funcionam em PostgreSQL em memoria sem consulta remota', async () => {
  const db = new PGlite(); try {
    await db.exec("CREATE SCHEMA storage;CREATE SCHEMA auth;CREATE SCHEMA supabase_migrations;CREATE TABLE supabase_migrations.schema_migrations(version text);CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean);CREATE TABLE storage.objects(id uuid,bucket_id text,name text,owner_id text,metadata jsonb);INSERT INTO storage.buckets VALUES('access-documents',false),('person-documents',false),('driver-cnh-documents',true),('vehicle-operation-photos',true);INSERT INTO storage.objects VALUES(gen_random_uuid(),'access-documents','PRIVATE_FAKE_CANARY/photo.jpg',NULL,'{}');");
    await db.exec('CREATE SCHEMA functions_only;CREATE FUNCTION functions_only.fictional()RETURNS int LANGUAGE sql AS $$SELECT 1$$');
    const capabilities = await db.exec(readFileSync(new URL('../supabase/original/backup/07_capabilities_readonly.sql', import.meta.url), 'utf8'));
    const row = capabilities.find(r => r.rows?.[0] && 'capabilities' in r.rows[0])?.rows[0].capabilities as { required_schemas: { auth: boolean }; schemas: Array<{schema_name:string;relations:number;functions:number}> };
    assert.equal(row.required_schemas.auth, true); assert.doesNotMatch(JSON.stringify(capabilities), /PRIVATE_FAKE_CANARY/);
    assert.equal(Number(row.schemas.find(s=>s.schema_name==='functions_only')?.relations),0);assert.equal(Number(row.schemas.find(s=>s.schema_name==='functions_only')?.functions),1);
    const metadata = await db.exec(readFileSync(new URL('../supabase/original/backup/08_storage_metadata_private_readonly.sql', import.meta.url), 'utf8'));
    const snapshot = metadata.find(r => r.rows?.[0] && 'private_storage_metadata' in r.rows[0])?.rows[0].private_storage_metadata as { objects: Array<{ owner_id: unknown }>; buckets: unknown[] };
    assert.equal(snapshot.buckets.length, 4); assert.equal(snapshot.objects.length, 1); assert.equal(snapshot.objects[0].owner_id, null);
  } finally { await db.close(); }
});
