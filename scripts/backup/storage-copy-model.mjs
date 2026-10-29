// Verificacao exclusivamente local. Nao importa SDK, rede ou executores de comandos.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ORIGINAL_BUCKETS = ['access-documents', 'driver-cnh-documents', 'person-documents', 'vehicle-operation-photos'];
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const opaqueFile = new RegExp(`^objects/${uuid}\\.bin$`);
const inside = (base, path) => { const child = relative(base, path); return child === '' || !isAbsolute(child) && child !== '..' && !child.startsWith('..' + sep); };
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

async function privatePath(value, kind) {
  if (typeof value !== 'string' || !value || /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith('\\\\') || value.startsWith('//')) fail('LOCAL_PATH_REQUIRED');
  const path = await realpath(resolve(value));
  if (path.startsWith('\\\\') || inside(workspace, path)) fail('PRIVATE_PATH_OUTSIDE_REPOSITORY_REQUIRED');
  // Heuristica adicional; nao comprova ausencia de sincronizacao nem criptografia.
  for (const variable of ['OneDrive', 'OneDriveCommercial', 'OneDriveConsumer', 'Dropbox']) {
    if (process.env[variable] && inside(resolve(process.env[variable]), path)) fail('SYNC_DIRECTORY_REFUSED');
  }
  if (/(?:^|[\\/])(?:OneDrive(?: - [^\\/]+)?|Dropbox|Google Drive)(?:[\\/]|$)/i.test(path)) fail('SYNC_DIRECTORY_REFUSED');
  const info = await stat(path);
  if (kind === 'file' ? !info.isFile() : !info.isDirectory()) fail('LOCAL_INPUT_TYPE_INVALID');
  return path;
}

export async function verifyLocalStorageCopy({ manifestPath, root }) {
  const path = await privatePath(manifestPath, 'file');
  const base = await privatePath(root, 'directory');
  const info = await stat(path);
  if (info.size > 64 * 1024 * 1024) fail('MANIFEST_TOO_LARGE_FOR_THIS_VERIFIER');
  const raw = await readFile(path);
  let manifest;
  try { manifest = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, '')); } catch { fail('MANIFEST_INVALID'); }
  if (!object(manifest) || manifest.format_version !== 1 || !new RegExp(`^${uuid}$`).test(manifest.snapshot_id) || !Array.isArray(manifest.buckets) || !Array.isArray(manifest.objects)) fail('MANIFEST_INVALID');
  if (manifest.buckets.length !== ORIGINAL_BUCKETS.length) fail('BUCKET_SCOPE_MISMATCH');
  const buckets = new Map();
  for (const row of manifest.buckets) {
    if (!object(row) || !ORIGINAL_BUCKETS.includes(row.id) || buckets.has(row.id) || !Number.isSafeInteger(row.expected_objects) || row.expected_objects < 0 || !object(row.configuration)) fail('BUCKET_SCOPE_MISMATCH');
    buckets.set(row.id, { ...row, checked: 0, bytes: 0 });
  }
  const records = new Map(), files = new Set();
  let bytes = 0;
  for (const row of manifest.objects) {
    if (!object(row) || !buckets.has(row.bucket) || typeof row.name !== 'string' || !row.name || !opaqueFile.test(row.file) || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || !/^[a-f0-9]{64}$/.test(row.sha256) || !object(row.metadata)) fail('MANIFEST_INVALID');
    if (row.metadata.bucket_id !== row.bucket || row.metadata.name !== row.name || typeof row.metadata.id !== 'string' || !Object.hasOwn(row.metadata, 'owner_id') || !Object.hasOwn(row.metadata, 'metadata')) fail('OBJECT_METADATA_MISSING');
    const identity = JSON.stringify([row.bucket, row.name]);
    if (records.has(identity) || files.has(row.file)) fail('DUPLICATE_OBJECT_OR_FILE');
    const local = await realpath(resolve(base, row.file));
    if (!inside(base, local) || inside(workspace, local)) fail('OBJECT_PATH_ESCAPE');
    const fileStat = await stat(local);
    if (!fileStat.isFile() || fileStat.size !== row.bytes) fail('OBJECT_SIZE_MISMATCH');
    const hash = createHash('sha256'); let actual = 0;
    for await (const chunk of createReadStream(local)) { hash.update(chunk); actual += chunk.length; }
    if (actual !== row.bytes || hash.digest('hex') !== row.sha256) fail('OBJECT_HASH_MISMATCH');
    records.set(identity, row); files.add(row.file);
    const bucket = buckets.get(row.bucket); bucket.checked++; bucket.bytes += actual; bytes += actual;
  }
  for (const row of buckets.values()) if (row.checked !== row.expected_objects) fail('SOURCE_INVENTORY_COUNT_MISMATCH');
  const objectDirectory = resolve(base, 'objects');
  const actualFiles = await readdir(objectDirectory, { withFileTypes: true });
  if (actualFiles.some(row => !row.isFile() || !files.has('objects/' + row.name)) || actualFiles.length !== files.size) fail('UNMANIFESTED_FILES');
  return {
    records, buckets,
    summary: { scope: 'local_storage_bytes_only', manifestSha256: createHash('sha256').update(raw).digest('hex'), objectsChecked: records.size, bytesChecked: bytes, buckets: [...buckets.values()].map(b => ({ bucket: b.id, objects: b.checked, bytes: b.bytes })), remoteSourceVerified: false, restoreVerified: false, storageBackupVerified: false },
  };
}

export function compareLocalStorageCopies(source, restored) {
  let missing = 0, extra = 0, content = 0, metadata = 0, identities = 0, configurations = 0;
  for (const [key, row] of source.records) {
    const copy = restored.records.get(key);
    if (!copy) { missing++; continue; }
    if (row.bytes !== copy.bytes || row.sha256 !== copy.sha256) content++;
    if (!same(row.metadata, copy.metadata)) metadata++;
    if (['id', 'bucket_id', 'name', 'owner_id'].some(field => !same(row.metadata[field], copy.metadata[field]))) identities++;
  }
  for (const key of restored.records.keys()) if (!source.records.has(key)) extra++;
  for (const [key, row] of source.buckets) if (!same(row.configuration, restored.buckets.get(key)?.configuration)) configurations++;
  return { scope: 'two_local_copies_only', sameNamesPathsAndBytes: !missing && !extra && !content, sameMetadata: !metadata && !configurations, missingObjects: missing, extraObjects: extra, contentMismatches: content, metadataMismatches: metadata, identityOrOwnerMismatches: identities, bucketConfigurationMismatches: configurations, restoreVerified: false, storageBackupVerified: false };
}
