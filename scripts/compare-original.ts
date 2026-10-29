import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { parseInventory, inventoryFingerprint } from './inventory-model.ts';
const path = '.secrets/original-inventory.json';
if (!existsSync(path))
    throw new Error('Inventario ainda ausente. Siga ORIGINAL_ACCESS.md. Nenhuma conexao sera tentada.');
const raw = readFileSync(path, 'utf8');
let parsed: unknown;
try {
    parsed = JSON.parse(raw);
}
catch {
    throw new Error('JSON de inventario invalido. Nenhum conteudo sera exibido.');
}
const inventory = parseInventory(parsed);
const db = new PGlite();
try {
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;CREATE SCHEMA storage;CREATE TABLE storage.objects(id uuid);`);
    await db.exec(readFileSync('supabase/dev/01_schema.sql', 'utf8').replaceAll('REPLACE_WITH_DEV_PROJECT_REF', 'a'.repeat(20)));
    const expected = (await db.query<{
        table_name: string;
        column_name: string;
        udt_name: string;
        is_nullable: string;
        default_hash: string;
    }>(`SELECT table_name,column_name,udt_name,is_nullable,md5(coalesce(column_default,''))AS default_hash FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows;
    const differences = expected.flatMap(column => { const actual = inventory.columns.find(row => row.schema === 'public' && row.table === column.table_name && row.name === column.column_name); if (!actual)
        return [{ table: column.table_name, column: column.column_name, issue: 'missing' }]; const issues = []; if (actual.type !== column.udt_name)
        issues.push({ table: column.table_name, column: column.column_name, issue: 'different_type' }); if (actual.nullable !== (column.is_nullable === 'YES'))
        issues.push({ table: column.table_name, column: column.column_name, issue: 'different_nullability' }); return issues; });
    const history = JSON.parse(readFileSync('supabase/dev/history-manifest.json', 'utf8')) as {
        files: Array<{
            name: string;
        }>;
    };
    const repositoryVersions = history.files.map(file => file.name.split('_')[0]);
    const report = { source: 'metadados originais fornecidos pelo painel; sem registros pessoais', inventorySha256: createHash('sha256').update(raw).digest('hex'), structureFingerprint: inventoryFingerprint(inventory), differences,
        defaultDifferences: expected.filter(column => { const actual = inventory.columns.find(row => row.schema === 'public' && row.table === column.table_name && row.name === column.column_name); return actual && actual.default_hash !== column.default_hash; }).map(column => ({ table: column.table_name, column: column.column_name })),
        migrationVersionMismatch: { onlyOriginal: inventory.migration_versions.filter(version => !repositoryVersions.includes(version)), onlyRepository: repositoryVersions.filter(version => !inventory.migration_versions.includes(version)) },
        rlsDisabled: inventory.tables.filter(row => row.schema === 'public' && row.kind === 'r' && !row.rls).map(row => row.name),
        broadPolicies: inventory.policies.filter(row => row.unconditional_using === true || row.unconditional_check === true).map(row => ({ schema: row.schema, table: row.table, name: row.name, command: row.command, roles: row.roles })),
        publicBuckets: inventory.buckets.filter(row => row.public === true).map(row => row.id),
        requiredRpcs: ['portaria_get_environment', 'portaria_get_profile', 'portaria_register_departure', 'portaria_register_conference', 'portaria_list_conferences'].map(name => ({ name, present: inventory.functions.some(row => row.schema === 'public' && row.name === name) })),
        historicalMigrationCount: inventory.migration_versions.length,
        limits: ['Hashes nao demonstram equivalencia semantica de funcoes/policies/indices/constraints.', 'Nullability diferente nao comprova que existam valores nulos.', 'Default diferente nao autoriza reescrever registros ou sequencias existentes.', 'Auth, Storage fisico e backup devem ser conferidos no painel.', 'O complemento 00b permite conferir EXECUTE e colunas gerenciadas ausentes da primeira exportacao.', 'Diferencas nao autorizam correcao automatica nem descarte de dados.'] };
    mkdirSync('.cache/original-review', { recursive: true });
    writeFileSync('.cache/original-review/comparison.json', JSON.stringify(report, null, 2) + '\n');
    console.log(`Comparacao local pronta: ${differences.length} diferencas de colunas/tipos/nullability; ${report.broadPolicies.length} policies amplas; ${report.publicBuckets.length} buckets publicos.`);
    console.log('Detalhes somente de metadados em .cache/original-review/comparison.json. Nenhuma operacao remota executada.');
}
finally {
    await db.close();
}
