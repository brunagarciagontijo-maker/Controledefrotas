import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DemoStore } from '../src/domain/demoStore.ts';
import { LogisticsStore } from '../src/domain/logisticsStore.ts';
import { oilContext, validateOil, type OilReading } from '../src/domain/oil.ts';
const valid:OilReading={request_id:'first',vehicle_id:'vehicle',level:'low',notes:'FICTICIO',checked_at:'2026-10-25T23:00:00Z',checked_by_name:'FICTICIO'};
test('oleo exige veiculo e nivel valido; notas sao opcionais e limitadas',()=>{
 assert.throws(()=>validateOil(null,{level:'normal',notes:''}),/Identifique/);assert.throws(()=>validateOil('v'),/Selecione/);
 for(const level of ['normal','low','critical','unable']as const)assert.doesNotThrow(()=>validateOil('v',{level,notes:''}));
 assert.throws(()=>validateOil('v',{level:'normal',notes:'x'.repeat(2001)}),/2000/);
});
test('tentativa frustrada nao zera contador e fuso usa dias de Sao Paulo',()=>{
 const unable={...valid,request_id:'second',level:'unable' as const,checked_at:'2026-10-28T01:00:00Z'};
 const context=oilContext([unable,valid],'vehicle','2026-10-28T01:30:00Z');assert.equal(context.days_since_valid,2);assert.equal(context.latest_valid?.request_id,'first');assert.equal(context.latest_attempt?.request_id,'second');
 assert.equal(oilContext([unable],'vehicle','2026-10-28T02:00:00Z').days_since_valid,null);assert.equal(oilContext([],'vehicle').latest_valid,null);
});
test('modo ficticio exige oleo, mantem atomicidade, idempotencia e historico congelado',()=>{
 const fleet=new DemoStore(),store=new LogisticsStore(),ref='2026-01-01T10:00:00';
 const s=store.start('s1','2026-01-01',ref,'FICTICIO',fleet.vehicles,[],[]),item=s.items[0];
 assert.throws(()=>store.check(s.id,item.id,'OK','',true,'FICTICIO'),/Selecione/);assert.equal(store.sessions[0].items[0].result,null);assert.equal(store.oilReadings.length,0);
 const saved=store.check(s.id,item.id,'OK','',true,'FICTICIO',{level:'low',notes:''},'check1');
 const repeated=store.check(s.id,item.id,'OK','',true,'FICTICIO',{level:'low',notes:''},'check1');assert.deepEqual(repeated.items.find(i=>i.id===item.id),saved.items.find(i=>i.id===item.id));
 assert.throws(()=>store.check(s.id,item.id,'OK','',true,'FICTICIO',{level:'normal',notes:''},'check1'),/Tentativa/);
 const next=store.start('s2','2026-01-01',ref,'FICTICIO',fleet.vehicles,[],[]);
 store.check(next.id,next.items[0].id,'OK','',true,'FICTICIO',{level:'unable',notes:''},'check2');
 assert.deepEqual(store.session(s.id).items[0].oil,saved.items[0].oil);assert.equal(store.oilReadings.length,2);
 assert.equal(store.session(next.id).items[0].oil?.latest_valid?.level,'low');
});
test('achado nao cadastrado permanece pendente sem oleo e tentativa nao duplica',()=>{
 const fleet=new DemoStore(),store=new LogisticsStore(),s=store.start('s','2026-01-01','2026-01-01T10:00:00','FICTICIO',fleet.vehicles,[],[]);
 const saved=store.found(s.id,'EXTRA','FICTICIO','Revisar','FICTICIO','found1');store.found(s.id,'EXTRA','FICTICIO','Revisar','FICTICIO','found1');
 const item=saved.items.find(i=>i.plate==='EXTRA')!;assert.equal(item.vehicle_id,null);assert.equal(item.result,null);assert.equal(store.sessions[0].items.length,fleet.vehicles.length+1);
 assert.throws(()=>store.check(s.id,item.id,'OK','',true,'FICTICIO',{level:'normal',notes:''}),/Identifique/);assert.equal(store.oilReadings.length,0);
});
