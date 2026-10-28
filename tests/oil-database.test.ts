import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { inventoryFingerprint, parseInventory } from '../scripts/inventory-model.ts';

type Row = Record<string, unknown>;
const admin='90000000-0000-4000-8000-000000000001',gate='90000000-0000-4000-8000-000000000002',inactive='90000000-0000-4000-8000-000000000003';
const vehicle='20000000-0000-4000-8000-000000000001';
let db:PGlite, baseline:string, preserved:unknown;
const source=(name:string)=>readFileSync(new URL('../supabase/original/'+name,import.meta.url),'utf8');
const fingerprint=source('structure_fingerprint.sql').replace(/--[^\n]*/g,'').trim();
const sql=(name:string)=>source('incremental/'+name).replaceAll('REPLACE_PROJECT_REF','a'.repeat(20)).replaceAll('REPLACE_RECOVERY_STRATEGY','no-backup-risk-accepted').replaceAll('REPLACE_RECOVERY_EVIDENCE_SHA256','b'.repeat(64)).replaceAll('REPLACE_BASELINE_HASH',baseline).replaceAll('REPLACE_SQL_APPROVAL','APROVADO_EXPLICITAMENTE').replaceAll('REPLACE_STRUCTURE_FINGERPRINT_QUERY',fingerprint);
const one=async(query:string,args:unknown[]=[])=> (await db.query<Row>(query,args)).rows[0];
const rpc=async(name:string,payload:unknown)=> (await one('SELECT public.'+name+'($1::jsonb) AS value',[JSON.stringify(payload)])).value as Row;
const rows=(value:unknown)=>value as Row[];
const preservation=async()=> (await db.exec(source('04_preservation_readonly.sql'))).find(r=>r.rows[0]&&'table_name'in r.rows[0])?.rows;
async function asUser(user:string|null,action:()=>Promise<void>,commit=false){await db.exec('BEGIN;SET LOCAL ROLE '+(user?'authenticated':'anon'));await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user||'']);try{await action();if(commit)await db.exec('COMMIT');}finally{await db.exec('ROLLBACK');}}
const start=()=>rpc('portaria_start_yard_session',{request_id:crypto.randomUUID(),day:'2026-01-01',reference_local:'2026-01-01T10:00:00'});
const payload=(s:Row,result='OK',level='normal')=>({request_id:crypto.randomUUID(),session_id:s.id,item_id:rows(s.items).find(i=>i.vehicle_id===vehicle)!.id,result,observed:result==='OK',notes:'',...(result==='OK'?{oil:{level,notes:''}}:{})});

before(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 INSERT INTO auth.users VALUES('${admin}'),('${gate}'),('${inactive}');
 CREATE FUNCTION auth.uid()RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO anon,authenticated;CREATE SCHEMA storage;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO anon,authenticated;`);
 await db.exec(readFileSync(new URL('../supabase/dev/01_schema.sql',import.meta.url),'utf8').replaceAll('REPLACE_WITH_DEV_PROJECT_REF','a'.repeat(20)));
 const contract=JSON.parse(source('schema-contract.json'))as{columns:Array<{table:string;name:string;nullable:boolean}>};
 const keys=new Set(contract.columns.map(c=>c.table+'.'+c.name));
 for(const c of (await db.query<{table_name:string;column_name:string}>("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'")).rows)if(!keys.has(c.table_name+'.'+c.column_name))await db.exec(`ALTER TABLE public."${c.table_name}" DROP COLUMN "${c.column_name}"`);
 for(const c of contract.columns)if(c.nullable)await db.exec(`ALTER TABLE public."${c.table}" ALTER COLUMN "${c.name}" DROP NOT NULL`);
 await db.exec(`INSERT INTO public.vehicles(id,plate,name,in_patio)VALUES('${vehicle}','OIL-1','Veiculo FICTICIO',true);
 INSERT INTO public.vehicles(plate,name,in_patio)SELECT 'OUT-'||n,'Ficticio para revisao',false FROM generate_series(1,17)n;
 INSERT INTO storage.buckets(id,public)VALUES('person-documents',false),('driver-cnh-documents',false),('access-documents',false),('vehicle-operation-photos',false);
 INSERT INTO storage.buckets(id,public,file_size_limit,allowed_mime_types)VALUES('portaria-evidence',false,10485760,ARRAY['image/jpeg','image/png','image/webp']),('portaria-parcels',false,10485760,ARRAY['image/jpeg','image/png','image/webp']);`);
 const inv=(await db.exec(source('00_inventory_readonly.sql'))).find(r=>r.rows[0]&&'inventory'in r.rows[0])?.rows[0].inventory;
 baseline=inventoryFingerprint(parseInventory(inv));
 for(const name of ['001_foundation.sql','002_authorization.sql','003_operations.sql','004_private_files.sql','005_daily_yard_parcels.sql','006_physical_checks_timeline.sql'])await db.exec(sql(name));
 await db.exec(`INSERT INTO portaria.profiles(user_id,display_name,role,is_active)VALUES('${admin}','Admin FICTICIO','admin',true),('${gate}','Porteiro FICTICIO','porteiro',true),('${inactive}','Inativo FICTICIO','porteiro',false)`);
 preserved=await preservation();await db.exec(sql('007_oil_checks.sql'));
});
after(async()=>{await db?.close();});

test('007 aplica/reaplica sem reescrever dez tabelas, IDs ou 17 flags; contrato final e 5',async()=>{
 assert.deepEqual(await preservation(),preserved);await db.exec(sql('007_oil_checks.sql'));assert.deepEqual(await preservation(),preserved);
 assert.equal((await one('SELECT schema_version FROM portaria.release_state')).schema_version,5);
 assert.equal((await one('SELECT count(*)::int AS n FROM public.vehicles WHERE NOT in_patio')).n,17);
});
for(const level of ['normal','low','critical','unable'])test('OK atomico com nivel '+level,async()=>{
 await asUser(gate,async()=>{const s=await start(),p=payload(s,'OK',level),result=await rpc('portaria_check_yard_with_oil',p);
 const item=rows(result.items).find(i=>i.id===p.item_id)!;assert.equal(item.result,'OK');
 assert.equal(((item.oil as Row).current as Row).level,level);assert.equal(item.checked_by_name,'Porteiro FICTICIO');
 assert.equal((await one('SELECT in_patio FROM public.vehicles WHERE id=$1',[vehicle])).in_patio,true);
 });
});
test('NOK nao exige oleo nem cria medicao',async()=>{await asUser(gate,async()=>{const s=await start(),p=payload(s,'NOK');const result=await rpc('portaria_check_yard_with_oil',p);assert.equal(rows(result.items).find(i=>i.id===p.item_id)?.result,'NOK');assert.equal((rows(result.items).find(i=>i.id===p.item_id)?.oil as Row).current,null);});});
test('falhas de nivel/conteudo nao gravam conferencia parcial',async()=>{
 for(const patch of [{oil:null},{oil:{level:'outro'}},{oil:{level:'normal',notes:'x'.repeat(2001)}},{checked_by:admin},{oil:{level:'normal',checked_at:'2020-01-01'}}]){
  await assert.rejects(()=>asUser(gate,async()=>{const s=await start();await rpc('portaria_check_yard_with_oil',{...payload(s),...patch});}));
 }
 assert.equal((await one('SELECT count(*)::int AS n FROM portaria.oil_checks')).n,0);
 assert.equal((await one('SELECT count(*)::int AS n FROM portaria.yard_checks')).n,0);
});
test('mesma tentativa e idempotente; conteudo e atores divergentes sao recusados',async()=>{
 await asUser(gate,async()=>{const s=await start(),p=payload(s);await rpc('portaria_check_yard_with_oil',p);await rpc('portaria_check_yard_with_oil',p);
  const saved=await rpc('portaria_check_yard_with_oil',p);assert.equal(rows(saved.items).filter(i=>i.result==='OK').length,1);
  const history=(await one('SELECT public.portaria_vehicle_oil_history($1)AS value',[vehicle])).value as Row;assert.equal(rows(history.events).length,1);
 });
 for(const level of ['low','unable'])await assert.rejects(()=>asUser(gate,async()=>{const s=await start(),p=payload(s);await rpc('portaria_check_yard_with_oil',p);await rpc('portaria_check_yard_with_oil',{...p,oil:{level,notes:''}});}),/outro conteudo/);
});
test('tentativas distintas no mesmo item nao duplicam conferencia ou oleo',async()=>{await assert.rejects(()=>asUser(gate,async()=>{const s=await start(),p=payload(s);await rpc('portaria_check_yard_with_oil',p);await rpc('portaria_check_yard_with_oil',{...p,request_id:crypto.randomUUID()});}),/ja registrado/);});
test('anonimo/inativo e CRUD direto sao negados, incluindo RPCs antigas',async()=>{
 for(const actor of [null,inactive])await assert.rejects(()=>asUser(actor,async()=>{await rpc('portaria_check_yard_with_oil',{});}),/permission denied|nao autorizado/);
 for(const name of ['portaria_check_yard_item','portaria_found_yard_vehicle'])await assert.rejects(()=>asUser(gate,async()=>{await rpc(name,{});}),/permission denied/);
 await assert.rejects(()=>asUser(gate,async()=>{await db.query('SELECT public.portaria_register_conference($1,true,\'\')',[vehicle]);}),/permission denied/);
 await assert.rejects(()=>asUser(admin,async()=>{await db.exec('SELECT * FROM portaria.oil_checks');}),/permission denied/);
});
test('guarda diferida impede caminho antigo mesmo chamado pelo owner',async()=>{
 const s=await (async()=>{let value:Row={};await asUser(gate,async()=>{value=await start();},true);return value;})();
 await db.exec('BEGIN');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[gate]);
 try{await rpc('portaria_check_yard_item',payload(s));await assert.rejects(()=>db.exec('COMMIT'),/mesma transacao/);}finally{await db.exec('ROLLBACK');}
 assert.equal((await one('SELECT count(*)::int AS n FROM portaria.yard_checks')).n,0);
});
test('achado sem cadastro fica pendente e nao permite oleo, preservando relato',async()=>{
 await asUser(gate,async()=>{const s=await start(),p={request_id:crypto.randomUUID(),session_id:s.id,plate:'UNKNOWN-1',name:'Achado FICTICIO',notes:'A identificar'};
 const found=await rpc('portaria_report_unidentified_yard_vehicle',p);await rpc('portaria_report_unidentified_yard_vehicle',p);
 const item=rows(found.items).find(i=>i.plate==='UNKNOWN-1')!;assert.equal(item.vehicle_id,null);assert.equal(item.result,null);assert.equal((item.found_report as Row).notes,'A identificar');
 });
 await assert.rejects(()=>asUser(gate,async()=>{const s=await start(),found=await rpc('portaria_report_unidentified_yard_vehicle',{request_id:crypto.randomUUID(),session_id:s.id,plate:'UNKNOWN-2',notes:'A identificar'});
  const item=rows(found.items).find(i=>i.plate==='UNKNOWN-2')!;await rpc('portaria_check_yard_with_oil',{...payload(s),item_id:item.id});}),/Identificacao valida/);
});
test('veiculo com placa alterada desde a referencia exige nova identificacao',async()=>{
 await assert.rejects(()=>asUser(admin,async()=>{const s=await start();await db.query("UPDATE public.vehicles SET plate='CHANGED-1'WHERE id=$1",[vehicle]);await rpc('portaria_check_yard_with_oil',payload(s));}),/Identificacao valida/);
});
test('historico usa responsavel do perfil e e inacessivel a anonimo/inativo',async()=>{
 await asUser(admin,async()=>{const s=await start();await rpc('portaria_check_yard_with_oil',payload(s));const page=(await one('SELECT public.portaria_vehicle_oil_history($1)AS value',[vehicle])).value as Row;assert.equal(rows(page.events)[0].checked_by_name,'Admin FICTICIO');assert.equal('checked_by'in rows(page.events)[0],false);});
 for(const actor of [null,inactive])await assert.rejects(()=>asUser(actor,async()=>{await db.query('SELECT public.portaria_vehicle_oil_history($1)',[vehicle]);}),/permission denied|nao autorizado/);
});
test('tentativa frustrada preserva medicao valida, contador e contexto historico',async()=>{
 // Medicao anterior somente FICTICIA: montagem pelo owner, sem alterar registros reais.
 const request=crypto.randomUUID(),session=crypto.randomUUID(),item=crypto.randomUUID();
 await db.exec('BEGIN');
 await db.query(`INSERT INTO portaria.yard_sessions(id,day,reference_local,created_by,created_by_name)VALUES($1,'2026-01-01','2026-01-01 10:00',$2,'Porteiro FICTICIO')`,[session,gate]);
 await db.query(`INSERT INTO portaria.yard_items(id,session_id,vehicle_id,plate,name,expected,reasons)VALUES($1,$2,$3,'OIL-1','FICTICIO','unknown','[]')`,[item,session,vehicle]);
 await db.query(`INSERT INTO portaria.yard_checks(request_id,item_id,result,observed,checked_at,checked_by,checked_by_name)VALUES($1,$2,'OK',true,clock_timestamp()-interval'4 days',$3,'Porteiro FICTICIO')`,[request,item,gate]);
 await db.query(`INSERT INTO portaria.oil_checks(request_id,vehicle_id,level,checked_at,checked_by,checked_by_name)SELECT request_id,$2,'low',checked_at,checked_by,checked_by_name FROM portaria.yard_checks WHERE request_id=$1`,[request,vehicle]);await db.exec('COMMIT');
 const oldContext=(await one('SELECT public.portaria_get_yard_session($1)AS value',[session])); // Sem JWT: null.
 assert.equal(oldContext.value,null);
 let frozen:unknown;
 await asUser(gate,async()=>{const old=(await one('SELECT public.portaria_get_yard_session($1)AS value',[session])).value as Row;frozen=rows(old.items)[0].oil;
  const s=await start(),result=await rpc('portaria_check_yard_with_oil',payload(s,'OK','unable')),context=rows(result.items).find(i=>i.vehicle_id===vehicle)!.oil as Row;
  assert.equal((context.latest_valid as Row).level,'low');assert.equal(context.days_since_valid,4);assert.equal((context.latest_attempt as Row).level,'unable');
  const after=(await one('SELECT public.portaria_get_yard_session($1)AS value',[session])).value as Row;assert.deepEqual(rows(after.items)[0].oil,frozen);
 },true);
});
test('historico e imutavel inclusive para alteracao direta pelo owner',async()=>{
 await assert.rejects(()=>db.exec("UPDATE portaria.oil_checks SET level='normal'"),/imutavel/);
 await assert.rejects(()=>db.exec('DELETE FROM portaria.oil_checks'),/imutavel/);
});
test('historico paginado nao perde nem repete eventos entre paginas',async()=>{
 await asUser(gate,async()=>{
  for(let n=0;n<27;n++){const s=await start();await rpc('portaria_check_yard_with_oil',payload(s,'OK',n%2?'normal':'unable'));}
  const first=(await one('SELECT public.portaria_vehicle_oil_history($1)AS value',[vehicle])).value as Row;
  assert.equal(rows(first.events).length,25);const cursor=first.next_cursor as Row;assert.ok(cursor);
  const second=(await one('SELECT public.portaria_vehicle_oil_history($1,$2,$3)AS value',[vehicle,cursor.checked_at,cursor.request_id])).value as Row;
  const all=[...rows(first.events),...rows(second.events)];assert.equal(all.length,29);assert.equal(new Set(all.map(r=>r.request_id)).size,29);assert.equal(second.next_cursor,null);
 });
});
test('item de outra sessao e repeticao por outro ator sao rejeitados',async()=>{
 await assert.rejects(()=>asUser(gate,async()=>{const s=await start(),other=await start();await rpc('portaria_check_yard_with_oil',{...payload(s),session_id:other.id});}),/Item inexistente/);
 await assert.rejects(()=>asUser(gate,async()=>{const s=await start(),p=payload(s);await rpc('portaria_check_yard_with_oil',p);await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[admin]);await rpc('portaria_check_yard_with_oil',p);}),/outro conteudo/);
});
test('postflight 09 confirma vinculos, RLS, buckets e fechamento das RPCs antigas',async()=>{
 const output=(await db.exec(source('09_oil_postflight_readonly.sql'))).find(r=>r.rows[0]&&'check_name'in r.rows[0])!.rows;
 const counts=new Map(output.map(r=>[r.check_name,Number(r.total)]));
 assert.equal(counts.get('schema_version_5'),1);assert.equal(counts.get('new_ok_without_oil'),0);assert.equal(counts.get('invalid_oil_link'),0);
 assert.equal(counts.get('old_rpc_app_execute'),0);assert.equal(counts.get('private_application_buckets'),6);assert.equal(counts.get('oil_direct_app_table_privileges'),0);
});
