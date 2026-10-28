import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Somente PostgreSQL WASM em memoria. Auth/Storage abaixo sao contratos minimos
// para testar SQL real; nao substituem testes futuros dos servicos gerenciados.
const projectRef = 'a'.repeat(20);
const admin = '90000000-0000-4000-8000-000000000001';
const gate = '90000000-0000-4000-8000-000000000002';
const inactive = '90000000-0000-4000-8000-000000000003';
const unassigned = '90000000-0000-4000-8000-000000000004';
let db: PGlite;
const sqlFile = (name: string) => readFileSync(new URL('../supabase/dev/' + name, import.meta.url), 'utf8').replaceAll('REPLACE_WITH_DEV_PROJECT_REF', projectRef);

async function asRole(role: 'anon' | 'authenticated', user: string | null, action: () => Promise<void>) {
  await db.exec('BEGIN; SET LOCAL ROLE ' + role);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [user || '']);
  try { await action(); } finally { await db.exec('ROLLBACK'); }
}
const first = async (query: string, params?: unknown[]) => (await db.query<Record<string, unknown>>(query, params)).rows[0];

describe('Schema e autorizacao DEV em PostgreSQL real em memoria', { concurrency: false }, () => {
  before(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon,authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text,owner_id text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage TO anon,authenticated;
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
      INSERT INTO auth.users VALUES ('${admin}'),('${gate}'),('${inactive}'),('${unassigned}');
    `);
    for (const name of ['01_schema.sql','02_security.sql','03_storage.sql']) await db.exec(sqlFile(name));
    await db.exec(sqlFile('04_test_profiles.sql').replaceAll('REPLACE_ADMIN_USER_UUID', admin).replaceAll('REPLACE_GATE_USER_UUID', gate).replaceAll('REPLACE_INACTIVE_USER_UUID', inactive));
    await db.exec(sqlFile('05_fixtures.sql'));
    await db.exec(sqlFile('06_validate.sql'));
  });
  after(async () => { await db?.close(); });

  test('pacote completo constroi banco vazio e preserva CNH opcional', async () => {
    assert.equal((await first('SELECT count(*)::int AS n FROM public.people')).n, 8);
    assert.equal((await first('SELECT count(*)::int AS n FROM public.vehicles')).n, 6);
    assert.equal((await first("SELECT driver_cnh_valid_until FROM public.operational_movements LIMIT 1")).driver_cnh_valid_until, null);
    assert.equal((await first("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity")).n, 10);
  });
  test('anonimo recebe somente marcador nao secreto e nao acessa operacoes', async () => {
    await asRole('anon', null, async () => {
      const marker = await first('SELECT public.get_dev_environment() AS value');
      assert.deepEqual(marker.value, { project_ref: projectRef, environment: 'devcloud', schema_version: 1 });
    });
    for (const table of ['vehicles','people','personal_vehicles','vehicle_records','access_records','operational_movements','operational_photos','operational_checklist_items','vehicle_inspection_requests','drivers']) {
      await assert.rejects(() => asRole('anon', null, () => db.exec(`SELECT * FROM public.${table}`).then(() => undefined)), /permission denied/);
    }
  });
  test('inativo e autenticado sem perfil nao leem nem inserem dados', async () => {
    for (const user of [inactive, unassigned]) {
      await asRole('authenticated', user, async () => {
        assert.deepEqual((await db.query('SELECT id FROM public.vehicles')).rows, []);
        assert.deepEqual((await db.query('SELECT id FROM public.people')).rows, []);
      });
      await assert.rejects(() => asRole('authenticated', user, () => db.exec("INSERT INTO public.people(name,person_type) VALUES('Teste','Visitante')").then(() => undefined)), /row-level security/);
    }
  });
  test('perfil e resolvido exclusivamente para auth.uid e nao pode ser autoatribuido', async () => {
    await asRole('authenticated', gate, async () => {
      const row = await first('SELECT public.get_my_profile() AS value');
      assert.equal((row.value as { role: string }).role, 'porteiro');
      assert.equal((row.value as { user_id: string }).user_id, gate);
    });
    await assert.rejects(() => asRole('authenticated', gate, () => db.exec("UPDATE private.app_profiles SET role='admin'").then(() => undefined)), /permission denied/);
  });
  test('porteiro cadastra visitante, mas nao frota ou funcionario', async () => {
    await asRole('authenticated', gate, async () => {
      await db.exec("INSERT INTO public.people(name,person_type) VALUES('Visitante adicional ficticio','Visitante')");
      assert.equal((await first("SELECT count(*)::int AS n FROM public.people WHERE name='Visitante adicional ficticio'")).n, 1);
    });
    await assert.rejects(() => asRole('authenticated', gate, () => db.exec("INSERT INTO public.people(name,person_type) VALUES('Funcionario ficticio','Funcionario')").then(() => undefined)), /row-level security/);
    await assert.rejects(() => asRole('authenticated', gate, () => db.exec("INSERT INTO public.vehicles(plate,name) VALUES('DEV-NEW','Teste')").then(() => undefined)), /row-level security/);
  });
  test('alteracao de cadastro e exclusao fisica nao sao liberadas ao porteiro', async () => {
    await assert.rejects(() => asRole('authenticated', gate, () => db.exec("UPDATE public.vehicles SET name='Alterado' WHERE plate='DEV-001'").then(() => undefined)), /administrador/);
    await asRole('authenticated', gate, async () => {
      await db.exec("DELETE FROM public.vehicles WHERE plate='DEV-001'");
      assert.equal((await first("SELECT count(*)::int AS n FROM public.vehicles WHERE plate='DEV-001'")).n, 1);
    });
  });
  test('retirada e devolucao atualizam patio e registram autor no servidor', async () => {
    await asRole('authenticated', gate, async () => {
      const inserted = await first(`INSERT INTO public.vehicle_records(vehicle_plate,reason,authorized_by,pickup_date,pickup_time,pickup_name,pickup_signature)
        VALUES('DEV-001','Teste','Teste','2026-10-01','08:00','Pessoa ficticia','data:image/png;base64,AAAA') RETURNING id,created_by`);
      assert.equal(inserted.created_by, gate);
      assert.equal((await first("SELECT in_patio FROM public.vehicles WHERE plate='DEV-001'")).in_patio, false);
      await db.query("UPDATE public.vehicle_records SET return_date='2026-10-01',return_time='09:00',return_name='Pessoa ficticia',return_signature='data:image/png;base64,AAAA',status='Devolvido' WHERE id=$1", [inserted.id]);
      assert.equal((await first("SELECT in_patio FROM public.vehicles WHERE plate='DEV-001'")).in_patio, true);
    });
  });
  test('retirada duplicada entre os dois fluxos e rejeitada', async () => {
    await assert.rejects(() => asRole('authenticated', gate, () => db.exec(`INSERT INTO public.operational_movements(vehicle_id,vehicle_plate,operation_type,driver_name,entry_date,entry_time,entry_odometer,entry_fuel_level)
      VALUES('20000000-0000-4000-8000-000000000002','DEV-002','Obras','Teste','2026-10-01','10:00',0,'Cheio')`).then(() => undefined)), /retirada em aberto/);
  });
  test('movimento, checklist normalizado e disponibilidade sao gravados atomicamente', async () => {
    await asRole('authenticated', gate, async () => {
      const row = await first(`INSERT INTO public.operational_movements(vehicle_id,vehicle_plate,operation_type,driver_name,entry_date,entry_time,entry_odometer,entry_fuel_level,checklist)
        VALUES('20000000-0000-4000-8000-000000000001','DEV-001','Obras','Teste','2026-10-01','10:00',0,'Cheio','{"exit":{"pneus":{"ok":true}}}') RETURNING id`);
      assert.equal((await first('SELECT count(*)::int AS n FROM public.operational_checklist_items WHERE movement_id=$1',[row.id])).n,6);
      assert.equal((await first("SELECT in_patio FROM public.vehicles WHERE plate='DEV-001'")).in_patio,false);
    });
  });
  test('porteiro nao pode falsificar disponibilidade manualmente', async () => {
    await assert.rejects(() => asRole('authenticated', gate, () => db.exec("UPDATE public.vehicles SET in_patio=false WHERE plate='DEV-001'").then(() => undefined)), /Disponibilidade/);
  });
  test('porteiro nao modifica a retirada original durante a devolucao', async () => {
    await assert.rejects(() => asRole('authenticated', gate, () => db.exec("UPDATE public.vehicle_records SET pickup_name='Outra pessoa',return_date='2026-10-02',return_time='10:00',return_name='Teste',return_signature='x',status='Devolvido' WHERE id='40000000-0000-4000-8000-000000000001'").then(() => undefined)), /permissao do porteiro/);
  });
  test('autoria fornecida por cliente diferente e rejeitada', async () => {
    await assert.rejects(() => asRole('authenticated', gate, () => db.query(`INSERT INTO public.vehicle_records(vehicle_plate,reason,authorized_by,pickup_date,pickup_time,pickup_name,pickup_signature,created_by)
      VALUES('DEV-001','Teste','Teste','2026-10-01','08:00','Teste','x',$1)`, [admin]).then(() => undefined)), /Autoria invalida/);
  });
  test('inspecao usa autoria real e porteiro apenas conclui', async () => {
    await asRole('authenticated', admin, async () => {
      const row = await first("INSERT INTO public.vehicle_inspection_requests(vehicle_id,vehicle_plate,requested_by) VALUES('20000000-0000-4000-8000-000000000001','DEV-001','Pessoa forjada') RETURNING requested_by,requested_by_user_id");
      assert.equal(row.requested_by, 'Administrador DEV'); assert.equal(row.requested_by_user_id, admin);
    });
    await asRole('authenticated', gate, async () => {
      const row = await first("UPDATE public.vehicle_inspection_requests SET status='Concluida',checklist='{}',completed_by='Forjado' WHERE id='70000000-0000-4000-8000-000000000001' RETURNING completed_by,completed_by_user_id");
      assert.equal(row.completed_by, 'Porteiro DEV'); assert.equal(row.completed_by_user_id, gate);
    });
    await assert.rejects(() => asRole('authenticated', gate, () => db.exec("INSERT INTO public.vehicle_inspection_requests(vehicle_id,vehicle_plate) VALUES('20000000-0000-4000-8000-000000000001','DEV-001')").then(() => undefined)), /row-level security/);
  });
  test('buckets sao privados e Storage exige perfil e entidade existente', async () => {
    assert.equal((await first('SELECT count(*)::int AS n FROM storage.buckets WHERE public')).n, 0);
    await asRole('authenticated', gate, async () => {
      await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('access-documents','10000000-0000-4000-8000-000000000006/teste.pdf',$1)", [gate]);
      assert.equal((await first('SELECT count(*)::int AS n FROM storage.objects')).n, 1);
    });
    await assert.rejects(() => asRole('authenticated', gate, () => db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('person-documents','10000000-0000-4000-8000-000000000002/teste.pdf')").then(() => undefined)), /row-level security/);
    await assert.rejects(() => asRole('authenticated', gate, () => db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('access-documents','10000000-0000-4000-8000-999999999999/teste.pdf')").then(() => undefined)), /row-level security/);
    await assert.rejects(() => asRole('authenticated', inactive, () => db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('access-documents','10000000-0000-4000-8000-000000000006/teste.pdf')").then(() => undefined)), /row-level security/);
  });
  test('reaplicar schema ou seed nao sobrescreve um banco preenchido', async () => {
    await assert.rejects(() => db.exec(sqlFile('01_schema.sql')), /Banco nao vazio/);
    await db.exec('ROLLBACK');
    await assert.rejects(() => db.exec(sqlFile('05_fixtures.sql')), /tabelas vazias/);
    await db.exec('ROLLBACK');
    assert.equal((await first('SELECT count(*)::int AS n FROM public.people')).n, 8);
  });
  test('SQL Realtime publica apenas inspecoes e e reaplicavel', async () => {
    await db.exec('CREATE PUBLICATION supabase_realtime');
    await db.exec(sqlFile('07_realtime.sql'));
    await db.exec(sqlFile('07_realtime.sql'));
    const tables = (await db.query<{ tablename: string }>("SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime'")).rows;
    assert.deepEqual(tables.map(row => row.tablename), ['vehicle_inspection_requests']);
  });
});
