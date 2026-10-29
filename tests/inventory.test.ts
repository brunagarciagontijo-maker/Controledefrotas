import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql=readFileSync(new URL('../supabase/original/00_inventory_readonly.sql',import.meta.url),'utf8');
test('inventario e SQL sem formatacao e sem operacoes de escrita',()=>{
  assert.ok(!sql.includes('```')&&!sql.includes('**'));
  assert.match(sql,/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(sql,/ROLLBACK;\s*$/);
  const code=sql.replace(/--[^\n]*/g,'');
  assert.doesNotMatch(code,/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|COPY|CALL|DO|GRANT|REVOKE)\b/i);
});
for(const ledger of [false,true])test(`inventario executa em PostgreSQL local; ledger ${ledger?'presente':'ausente'}`,async()=>{
  const db=new PGlite();try{
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE public.sample(id integer,description text DEFAULT 'fictional-default-canary');
      INSERT INTO public.sample VALUES(1,'fictional-record-canary');
      ALTER TABLE public.sample ENABLE ROW LEVEL SECURITY;
      CREATE POLICY sample_policy ON public.sample FOR SELECT USING(description='fictional-policy-canary');
      CREATE FUNCTION public.fixture_function() RETURNS text LANGUAGE sql AS $$ SELECT 'fictional-body-canary' $$;`);
    if(ledger)await db.exec(`CREATE SCHEMA supabase_migrations;CREATE TABLE supabase_migrations.schema_migrations(version text,statements text[]);INSERT INTO supabase_migrations.schema_migrations VALUES('20260101000000',ARRAY['fictional-migration-body-canary']);`);
    const results=await db.exec(sql);
    const inventory=results.find(result=>result.rows?.[0]&&'inventory' in result.rows[0])?.rows[0].inventory as Record<string,unknown>;
    assert.ok(inventory);assert.equal(inventory.migration_history_present,ledger);
    assert.deepEqual(inventory.migration_versions,ledger?['20260101000000']:[]);
    assert.ok(!JSON.stringify(inventory).includes('canary'));
    const managed=await db.exec(readFileSync(new URL('../supabase/original/00b_managed_contract_readonly.sql',import.meta.url),'utf8'));
    assert.ok(!JSON.stringify(managed).includes('canary'));
    assert.equal((await db.query<{n:number}>('SELECT count(*)::int AS n FROM public.sample')).rows[0].n,1);
    assert.equal((await db.query<{transaction_read_only:string}>('SHOW transaction_read_only')).rows[0].transaction_read_only,'off');
  }finally{await db.close();}
});
