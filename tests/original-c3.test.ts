import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = readFileSync(new URL('../supabase/original/08_c3_metadata_readonly.sql', import.meta.url), 'utf8');
type Row = Record<string, unknown>;
const list = (value: unknown) => { assert.ok(Array.isArray(value)); return value as Row[]; };
let db: PGlite;
async function audit(role?: 'probe_installer' | 'anon' | 'authenticated' | 'set_only_installer') {
  if (role) await db.exec('SET ROLE ' + role); // Exclusivamente papel ficticio do motor em memoria.
  try {
    const results = await db.exec(sql);
    assert.equal(results.find(result => 'c3_catalog_guard' in (result.rows[0] ?? {}))?.rows[0].c3_catalog_guard, 1);
    const result = results.find(result => 'c3' in (result.rows[0] ?? {}))?.rows[0].c3;
    assert.ok(result && typeof result === 'object');
    return result as Row;
  } finally {
    await db.exec('ROLLBACK; RESET ROLE');
  }
}
const sequence = (result: Row, name: string) => { const found = list(result.sequences).find(row => row.name === name); assert.ok(found); return found; };
const check = (result: Row, name: string, object?: string) => list(result.checks).filter(row => row.check_name === name && (!object || row.object_name === object));
const states = async () => (await db.query(`SELECT 'small' AS name,last_value::text,is_called FROM public.small_ids
 UNION ALL SELECT 'vehicle',last_value::text,is_called FROM public.vehicles_mobile_code_seq
 UNION ALL SELECT 'descending',last_value::text,is_called FROM public.descending_ids ORDER BY name`)).rows;

before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE ROLE probe_installer; CREATE ROLE owner_group; CREATE ROLE set_only_installer NOINHERIT;
    GRANT owner_group TO set_only_installer WITH INHERIT FALSE, SET TRUE;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,encrypted_password text);
    CREATE TABLE auth.identities(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id));
    INSERT INTO auth.users VALUES('10000000-0000-4000-8000-000000000001','PERSONAL_CANARY@example.invalid','PASSWORD_CANARY_DO_NOT_EXPORT');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
    CREATE TABLE storage.buckets(id text PRIMARY KEY);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY,name text);
    INSERT INTO storage.objects VALUES('20000000-0000-4000-8000-000000000001','DOCUMENT_PATH_CANARY/private.pdf');
    CREATE SEQUENCE public.vehicles_mobile_code_seq MINVALUE 101 MAXVALUE 999 START 101 CACHE 5;
    CREATE SEQUENCE public.people_code_seq;
    CREATE SEQUENCE public.small_ids MINVALUE 1 MAXVALUE 5 CACHE 2;
    CREATE SEQUENCE public.descending_ids MINVALUE 0 MAXVALUE 10 START 10 INCREMENT -2 CACHE 2;
    CREATE SEQUENCE public.cyclic_ids MINVALUE 1 MAXVALUE 3 CYCLE;
    CREATE SEQUENCE public.bigint_ids START 9223372036854775806 MAXVALUE 9223372036854775807;
    SELECT nextval('public.small_ids'); SELECT nextval('public.descending_ids'); SELECT nextval('public.cyclic_ids');
    SELECT nextval('public.bigint_ids');
    CREATE FUNCTION public.generate_vehicle_mobile_code() RETURNS text LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'APPLICATION_CALL_CANARY'; RETURN nextval('public.vehicles_mobile_code_seq')::text; END $$;
    CREATE FUNCTION public.generate_short_code(sequence_name regclass) RETURNS text LANGUAGE sql AS $$ SELECT nextval(sequence_name)::text $$;
    CREATE FUNCTION public.policy_probe() RETURNS boolean LANGUAGE plpgsql VOLATILE AS $$ BEGIN RAISE EXCEPTION 'POLICY_CALL_CANARY'; END $$;`);
  for (const name of ['access_records', 'drivers', 'operational_checklist_items', 'operational_movements', 'operational_photos', 'people',
    'personal_vehicles', 'vehicle_inspection_requests', 'vehicle_records', 'vehicles']) {
    await db.exec(`CREATE TABLE public.${name}(id uuid PRIMARY KEY,notes text);
      ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY probe_rls ON public.${name} USING(public.policy_probe());`);
  }
  await db.exec(`ALTER TABLE public.vehicles ADD COLUMN short_code text DEFAULT public.generate_vehicle_mobile_code();
    ALTER SEQUENCE public.vehicles_mobile_code_seq OWNED BY public.vehicles.short_code;
    ALTER TABLE public.people ADD COLUMN short_code text DEFAULT nextval('public.people_code_seq');
    GRANT USAGE ON SEQUENCE public.people_code_seq TO anon;
    GRANT SELECT ON public.vehicles TO probe_installer;
    ALTER TABLE public.drivers OWNER TO owner_group;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;`);
});
after(async () => { await db?.close(); });

test('complemento Storage consulta somente configuracao especifica e nao presume suporte ausente', async () => {
  const platform = readFileSync(new URL('../supabase/original/10_storage_platform_readonly.sql', import.meta.url), 'utf8');
  const code = platform.replace(/--[^\n]*/g, '').replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(code, /\b(CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE|EXECUTE|CALL|SET ROLE)\b/i);
  const run = async () => (await db.exec(platform)).find(r => r.rows[0] && 'storage_capabilities' in r.rows[0])?.rows[0].storage_capabilities as Row;
  const missing = await run(); assert.equal(missing.policy_setting_present, false); assert.equal(missing.objects_policy_granted_to_current_role, null);
  const actor = String((await db.query<{name:string}>('SELECT current_user AS name')).rows[0].name);
  await db.query("SELECT set_config('supautils.policy_grants',$1,false)", [JSON.stringify({ [actor]: ['storage.objects', 'storage.buckets'] })]);
  try { const present = await run(); assert.equal(present.objects_policy_granted_to_current_role, true); assert.equal(present.buckets_policy_granted_to_current_role, true); assert.equal(present.migration_execution_authorized, false); }
  finally { await db.query("SELECT set_config('supautils.policy_grants','',false)"); }
});

test('C3 somente leitura nao tem comandos de escrita, SQL dinamico ou chamadas de aplicacao', () => {
  const code = sql.replace(/--[^\n]*/g, '').replace(/'(?:''|[^'])*'/g, "''");
  assert.match(code, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/);
  assert.match(code, /ROLLBACK;\s*$/);
  assert.doesNotMatch(code, /\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|COPY|DO|CALL|EXECUTE|RESET|COMMIT)\b/i);
  assert.doesNotMatch(code, /\b(nextval|setval|set_config|query_to_xml|dblink|pg_read_file|pg_read_binary_file|lo_export)\s*\(/i);
  assert.doesNotMatch(code, /\b(?:FROM|JOIN)\s+(?:public|auth|storage)\./i);
  assert.doesNotMatch(code, /\bpg_authid\b|\brolpassword\b|\bSET\s+(?:LOCAL\s+)?ROLE\b/i);
  assert.doesNotMatch(code, /\b(?:public|auth|storage)\.\w+\s*\(/i);
});

test('arquivo integral resolve aliases, tipos, ACLs e agregados sem exportar dados privados', async () => {
  const result = await audit();
  assert.equal(result.audit, 'original_complement_c3'); assert.equal(result.format_version, 1);
  const context = result.context as Row;
  assert.equal(context.transaction_read_only, 'on'); assert.equal(context.transaction_isolation, 'repeatable read');
  assert.equal(context.search_path, 'pg_catalog'); assert.equal(context.application_rows_read, false);
  assert.equal(result.migration_execution_authorized, false); assert.equal(result.compatibility_approved, false);
  assert.equal(list(result.installation_relations).length, 13);
  assert.equal(list(result.auth_relations).length, 2);
  assert.ok(list(result.auth_constraints).some(row => row.type === 'f'));
  assert.ok(list(result.auth_indexes).some(row => row.primary === true));
  assert.ok(list(result.auth_dependency_edges).length > 0);
  assert.doesNotMatch(JSON.stringify(result), /PERSONAL_CANARY|PASSWORD_CANARY|DOCUMENT_PATH_CANARY|APPLICATION_CALL_CANARY|POLICY_CALL_CANARY/);
});

test('nenhuma sequencia avanca nem muda is_called durante a auditoria', async () => {
  const beforeStates = await states(); await audit(); assert.deepEqual(await states(), beforeStates);
});

test('sequencia nao utilizada permanece com capacidade desconhecida, nunca zero presumido', async () => {
  const seq = sequence(await audit(), 'vehicles_mobile_code_seq');
  assert.equal(seq.last_reserved_value, null); assert.equal(seq.remaining_unreserved_positions, null);
  assert.equal(seq.capacity_evidence, 'unknown_unstarted_or_no_privilege_or_standby');
});

test('cache e incremento negativo geram estimativas conservadoras a partir da fronteira reservada', async () => {
  const result = await audit(), small = sequence(result, 'small_ids'), descending = sequence(result, 'descending_ids');
  assert.equal(small.last_reserved_value, '2'); assert.equal(small.remaining_unreserved_positions, '3');
  assert.equal(descending.last_reserved_value, '8'); assert.equal(descending.remaining_unreserved_positions, '4');
  assert.equal(small.capacity_evidence, 'reserved_boundary_not_exact_available_ids');
});

test('ciclo nao e tratado como disponibilidade ilimitada de identificadores unicos', async () => {
  const seq = sequence(await audit(), 'cyclic_ids');
  assert.equal(seq.cycle, true); assert.equal(seq.remaining_unreserved_positions, null);
  assert.equal(seq.capacity_evidence, 'cycle_requires_collision_review');
});

test('bigint e capacidade sao exportados como texto sem arredondamento JavaScript', async () => {
  const seq = sequence(await audit(), 'bigint_ids');
  assert.equal(seq.last_reserved_value, '9223372036854775806');
  assert.equal(seq.max, '9223372036854775807'); assert.equal(seq.remaining_unreserved_positions, '1');
});

test('dependencia de default e ownership sao separados da chamada interna PLpgSQL', async () => {
  const result = await audit(), people = sequence(result, 'people_code_seq'), vehicle = sequence(result, 'vehicles_mobile_code_seq');
  assert.equal(people.covered_by_002_default_dependency_grant, true);
  assert.equal(vehicle.covered_by_002_default_dependency_grant, false);
  assert.ok(list(vehicle.ownership_dependencies).some(row => row.table === 'vehicles'));
  const generator = list(result.generators_and_auth_uid).find(row => row.name === 'generate_vehicle_mobile_code');
  assert.ok(generator); assert.ok(list(generator.default_dependents).some(row => row.table === 'vehicles'));
});

test('exposicao efetiva da sequencia e EXECUTE do gerador sao relatados separadamente', async () => {
  const result = await audit(), seq = sequence(result, 'people_code_seq');
  assert.equal(list(seq.effective_privileges).find(row => row.role_label === 'app_anon')?.can_advance_by_oid, true);
  assert.equal(list(seq.effective_privileges).find(row => row.role_label === 'app_authenticated')?.can_advance_by_oid, false);
  assert.ok(list(seq.acl).some(row => row.grantee === 'anon' && row.privilege === 'USAGE'));
  assert.ok(list(result.generators_and_auth_uid).every(row => /^[a-f0-9]{32}$/.test(String(row.definition_hash))));
});

test('SELECT nao comprova ownership de instalacao nem ignora RLS', async () => {
  const result = await audit('probe_installer');
  const relation = list(result.installation_relations).find(row => row.table === 'vehicles'); assert.ok(relation);
  assert.equal(relation.installer_select_granted, true); assert.equal(relation.installer_owner_authority, false);
  assert.equal(relation.installer_rls_active, true);
  assert.equal(check(result, 'alter_trigger_policy_owner_authority', 'public.vehicles')[0].result, 'blocked');
  assert.equal(check(result, 'create_schema_in_database')[0].result, 'blocked');
  assert.equal(sequence(result, 'small_ids').last_reserved_value, null);
});

test('possibilidade de SET ROLE nao e tratada como heranca imediata de ownership', async () => {
  const result = await audit('set_only_installer');
  const relation = list(result.installation_relations).find(row => row.table === 'drivers'); assert.ok(relation);
  assert.equal(relation.installer_owner_authority, false); assert.equal(relation.installer_could_set_owner_role, true);
  assert.equal(check(result, 'alter_trigger_policy_owner_authority', 'public.drivers')[0].result, 'blocked');
  assert.ok(list(result.memberships).some(row => row.member === 'set_only_installer' && row.inherit_option === false && row.set_option === true));
});

test('REFERENCES apenas na coluna id e suficiente, sem exigir ownership do Auth', async () => {
  await db.exec('GRANT USAGE ON SCHEMA auth TO probe_installer; GRANT REFERENCES(id) ON auth.users TO probe_installer');
  try {
    const result = await audit('probe_installer');
    assert.equal(check(result, 'auth_users_id_references')[0].result, 'pass');
    const relation = list(result.installation_relations).find(row => row.schema === 'auth' && row.table === 'users');
    assert.equal(relation?.installer_owner_authority, false);
  } finally { await db.exec('REVOKE REFERENCES(id) ON auth.users FROM probe_installer; REVOKE USAGE ON SCHEMA auth FROM probe_installer'); }
});

test('ACL de coluna nao desaparece na verificacao de grants da tabela', async () => {
  await db.exec('GRANT REFERENCES(id) ON public.drivers TO anon');
  try {
    const relation = list((await audit()).installation_relations).find(row => row.schema === 'public' && row.table === 'drivers');
    assert.ok(relation);
    assert.ok(list(relation.column_acl).some(row => row.column === 'id' && row.grantee === 'anon' && row.privilege === 'REFERENCES'));
    assert.equal(list(relation.effective_privileges).find(row => row.role_label === 'app_anon')?.references_granted, false);
  } finally { await db.exec('REVOKE REFERENCES(id) ON public.drivers FROM anon'); }
});

test('PK deferrable nao e aceita como chave referenciavel pelas novas FKs', async () => {
  await db.exec('ALTER TABLE auth.identities DROP CONSTRAINT identities_user_id_fkey; ALTER TABLE auth.users DROP CONSTRAINT users_pkey; ALTER TABLE auth.users ADD PRIMARY KEY(id) DEFERRABLE');
  try { assert.equal(check(await audit(), 'auth_users_id_eligible_unique_key')[0].result, 'blocked'); }
  finally { await db.exec('ALTER TABLE auth.users DROP CONSTRAINT users_pkey; ALTER TABLE auth.users ADD PRIMARY KEY(id); ALTER TABLE auth.identities ADD FOREIGN KEY(user_id) REFERENCES auth.users(id)'); }
});

test('objeto ausente e diagnosticado sem SELECT sobre relacao inexistente', async () => {
  await db.exec('ALTER TABLE auth.users RENAME TO fixture_users_hidden');
  try {
    const result = await audit();
    assert.equal(check(result, 'expected_physical_relation', 'auth.users')[0].result, 'blocked');
    assert.equal(check(result, 'auth_users_id_uuid_not_null')[0].result, 'blocked');
  } finally { await db.exec('ALTER TABLE auth.fixture_users_hidden RENAME TO users'); }
});

test('default privileges ficam explicitos sem aplicar concessoes', async () => {
  assert.ok(list((await audit()).installer_default_acl_overrides).some(row => row.schema === 'public' && row.grantee === 'authenticated' && row.privilege === 'SELECT'));
});

test('service_role ausente permanece ausente e nao empresta privilegios de outro papel', async () => {
  await db.exec('DROP ROLE service_role');
  try {
    const result = await audit();
    assert.equal(list(result.roles).find(row => row.label === 'server_service_role')?.present, false);
    const grants = list(sequence(result, 'people_code_seq').effective_privileges).find(row => row.role_label === 'server_service_role');
    assert.equal(grants?.usage, null); assert.equal(grants?.can_advance_by_oid, null);
  } finally { await db.exec('CREATE ROLE service_role'); }
});

test('anon/authenticated ausentes abortam em vez de presumir ambiente original', async () => {
  await db.exec('ALTER ROLE anon RENAME TO fixture_anon_hidden');
  try { await assert.rejects(() => audit(), error => (error as { code: string }).code === '22012'); }
  finally { await db.exec('ALTER ROLE fixture_anon_hidden RENAME TO anon'); }
});

test('event trigger e inventariado sem executar sua funcao', async () => {
  await db.exec(`CREATE FUNCTION public.fixture_ddl_probe() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'DDL_CALL_CANARY'; END $$;
    CREATE EVENT TRIGGER fixture_ddl_probe ON ddl_command_start WHEN TAG IN('CREATE TABLE') EXECUTE FUNCTION public.fixture_ddl_probe();`);
  try {
    const result = await audit();
    assert.equal(check(result, 'ddl_event_triggers_review')[0].result, 'needs_review');
    assert.ok(list(result.ddl_event_triggers).some(row => row.name === 'fixture_ddl_probe'));
    assert.doesNotMatch(JSON.stringify(result), /DDL_CALL_CANARY/);
  } finally { await db.exec('DROP EVENT TRIGGER fixture_ddl_probe; DROP FUNCTION public.fixture_ddl_probe()'); }
});

test('falta de SELECT em catalogo aborta pela guarda, sem contornar protecao', async () => {
  await db.exec('REVOKE SELECT ON pg_catalog.pg_sequences FROM PUBLIC');
  try { await assert.rejects(() => audit('probe_installer'), error => ['22012', '42501'].includes((error as { code: string }).code)); }
  finally { await db.exec('GRANT SELECT ON pg_catalog.pg_sequences TO PUBLIC'); }
});

test('falta de EXECUTE no SHA nativo aborta sem fallback', async () => {
  await db.exec('REVOKE EXECUTE ON FUNCTION pg_catalog.sha256(bytea) FROM PUBLIC');
  try { await assert.rejects(() => audit('probe_installer'), error => (error as { code: string }).code === '42501'); }
  finally { await db.exec('GRANT EXECUTE ON FUNCTION pg_catalog.sha256(bytea) TO PUBLIC'); }
});
