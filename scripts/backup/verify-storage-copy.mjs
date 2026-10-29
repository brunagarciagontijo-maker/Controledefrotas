import { verifyLocalStorageCopy, compareLocalStorageCopies } from './storage-copy-model.mjs';

const values = new Map();
try {
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i], value = process.argv[i + 1];
    if (!['--manifest', '--root', '--restored-manifest', '--restored-root'].includes(key) || values.has(key) || !value) throw new Error('INVALID_ARGUMENTS');
    values.set(key, value);
  }
  if (!values.has('--manifest') || !values.has('--root') || values.has('--restored-manifest') !== values.has('--restored-root')) throw new Error('INVALID_ARGUMENTS');
  const source = await verifyLocalStorageCopy({ manifestPath: values.get('--manifest'), root: values.get('--root') });
  if (values.has('--restored-manifest')) {
    const restored = await verifyLocalStorageCopy({ manifestPath: values.get('--restored-manifest'), root: values.get('--restored-root') });
    const result = compareLocalStorageCopies(source, restored);
    console.log(JSON.stringify({ source: source.summary, restored: restored.summary, comparison: result }));
    if (!result.sameNamesPathsAndBytes || !result.sameMetadata) process.exitCode = 2;
  } else console.log(JSON.stringify(source.summary));
} catch (error) {
  const allowed = ['INVALID_ARGUMENTS', 'LOCAL_PATH_REQUIRED', 'PRIVATE_PATH_OUTSIDE_REPOSITORY_REQUIRED', 'SYNC_DIRECTORY_REFUSED', 'LOCAL_INPUT_TYPE_INVALID', 'MANIFEST_TOO_LARGE_FOR_THIS_VERIFIER', 'MANIFEST_INVALID', 'BUCKET_SCOPE_MISMATCH', 'OBJECT_METADATA_MISSING', 'DUPLICATE_OBJECT_OR_FILE', 'OBJECT_PATH_ESCAPE', 'OBJECT_SIZE_MISMATCH', 'OBJECT_HASH_MISMATCH', 'SOURCE_INVENTORY_COUNT_MISMATCH', 'UNMANIFESTED_FILES'];
  const code = allowed.includes(error?.code || error?.message) ? error.code || error.message : 'LOCAL_VERIFICATION_FAILED';
  console.log(JSON.stringify({ status: 'blocked', code, restoreVerified: false, storageBackupVerified: false }));
  process.exitCode = 1;
}
