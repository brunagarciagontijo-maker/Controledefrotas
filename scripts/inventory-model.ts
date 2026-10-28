import { createHash } from 'node:crypto';
export type InventoryRow = Record<string, unknown>;
export interface Inventory {
    format_version: number;
    tables: InventoryRow[];
    columns: InventoryRow[];
    constraints: InventoryRow[];
    indexes: InventoryRow[];
    functions: InventoryRow[];
    triggers: InventoryRow[];
    policies: InventoryRow[];
    table_grants: InventoryRow[];
    buckets: InventoryRow[];
    migration_versions: string[];
}
export function parseInventory(value: unknown): Inventory {
    let object = value;
    if (Array.isArray(object) && object.length === 1)
        object = object[0];
    if (object && typeof object === 'object' && 'inventory' in object)
        object = (object as {
            inventory: unknown;
        }).inventory;
    if (typeof object === 'string') {
        try {
            object = JSON.parse(object);
        }
        catch {
            throw new Error('JSON de inventario invalido. Nenhum conteudo sera exibido.');
        }
    }
    if (!object || typeof object !== 'object' || (object as {
        format_version: unknown;
    }).format_version !== 1)
        throw new Error('Formato de inventario invalido. Copie somente o objeto inventory.');
    const row = object as Record<string, unknown>;
    for (const field of ['tables', 'columns', 'constraints', 'indexes', 'functions', 'triggers', 'policies', 'table_grants', 'buckets', 'migration_versions'])
        if (!Array.isArray(row[field]))
            throw new Error('Inventario incompleto. Execute novamente o SQL somente leitura.');
    return object as Inventory;
}
export function inventoryFingerprint(inventory: Inventory): string {
    const entries: Array<[
        string,
        string
    ]> = [];
    for (const row of inventory.tables)
        entries.push([`table:${row.schema}.${row.name}`, `${row.kind}|${row.rls}|${row.force_rls}`]);
    for (const row of inventory.columns)
        entries.push([`column:${row.schema}.${row.table}.${row.name}`, `${row.type}|${row.nullable}|${row.default_hash}`]);
    for (const kind of ['constraints', 'indexes', 'triggers'] as const)
        for (const row of inventory[kind])
            entries.push([`${kind}:${row.schema}.${row.table}.${row.name}`, String(row.definition_hash)]);
    for (const row of inventory.functions)
        entries.push([`function:${row.schema}.${row.name}(${row.arguments})`, String(row.definition_hash)]);
    for (const row of inventory.policies)
        entries.push([`policy:${row.schema}.${row.table}.${row.name}`, `${row.permissive}|${(row.roles as string[]).join(',')}|${row.command}|${row.using_hash}|${row.check_hash}`]);
    for (const row of inventory.table_grants)
        entries.push([`grant:${row.schema}.${row.table}.${row.role}.${row.privilege}`, '1']);
    for (const row of inventory.buckets)
        entries.push([`bucket:${row.id}`, `${row.public}|${row.file_size_limit ?? ''}|${(row.allowed_mime_types as string[] | null)?.join(',') ?? ''}`]);
    entries.sort((a, b) => Buffer.compare(Buffer.from(a[0]), Buffer.from(b[0])));
    return createHash('md5').update(entries.map(([key, value]) => `${key}|${value}`).join('\n')).digest('hex');
}
