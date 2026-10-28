import{test}from'node:test';
import assert from'node:assert/strict';
import{DemoStore}from'../src/domain/demoStore.ts';
import{LogisticsStore}from'../src/domain/logisticsStore.ts';
import{timelineEvents,filterTimeline,EVENT_LABELS,type TimelineSources}from'../src/domain/timeline.ts';
import{entryTarget}from'../src/domain/vehicleOperations.ts';
import{confirmationMessage,physicalResult,yardDivergence,type YardItem}from'../src/domain/yard.ts';
import{linkVehicleFlows}from'../src/domain/reconciliation.ts';
import{reportingRecords}from'../src/domain/reporting.ts';

test('quatro combinacoes fisicas separam OK/NOK de divergencia e preservam criterio antigo',()=>{
 for(const[expected,observed,divergent]of[['present',true,false],['present',false,true],['absent',true,true],['absent',false,false]]as const){const item={expected,observed,result:observed?'OK':'NOK'}as YardItem;assert.equal(physicalResult(item),observed?'OK':'NOK');assert.equal(yardDivergence(item),divergent);}
 const old={expected:'absent',observed:false,result:'OK',meaning:'compatibility_v1'}as YardItem;assert.equal(physicalResult(old),'NOK');assert.equal(old.result,'OK');assert.equal(yardDivergence(old),false);
 assert.equal(confirmationMessage(false,'2026-10-27T13:02:03Z'),'Carro não localizado no pátio - 27/10/2026 10:02:03');
});
test('entrada revalida saida atual, recusa identidade trocada/conflitos e nao modifica fontes',()=>{
 const s=new DemoStore(),legacy=s.vehicles.find(v=>v.plate==='HIST-4')!,before=structuredClone(s.snapshot());
 assert.equal(entryTarget(legacy.id,legacy.plate,s.vehicles,s.movements,s.records).kind,'legacy');assert.deepEqual(s.snapshot(),before);
 assert.equal(entryTarget(legacy.id,'OUTRA',s.vehicles,s.movements,s.records).kind,'unavailable');
 s.records[0].status='Devolvido';assert.equal(entryTarget(legacy.id,legacy.plate,s.vehicles,s.movements,s.records).kind,'unavailable');
 s.records[0].status='Em uso';s.movements.push({...s.movements[0],id:'outro',vehicle_id:legacy.id,vehicle_plate:legacy.plate,status:'Em aberto'});assert.equal(entryTarget(legacy.id,legacy.plate,s.vehicles,s.movements,s.records).kind,'unavailable');
});
test('Timeline inclui todos os tipos, sem presumir operador a partir de motorista',()=>{
 const s=new DemoStore(),store=new LogisticsStore();const access=s.enter({person_id:s.people[0].id,person_name:'Pessoa fictícia',person_type:'Funcionario',host_person_name:'Ficticio',entry_date:'2026-01-01',entry_time:'08:00'},null);s.leave(access.id,'2026-01-01','09:00');s.completeInspection(s.inspections[0].id,{});
 const p=store.receive('p1','Destinatario ficticio','2026-01-01T10:00',new File(['fake'],'p.png',{type:'image/png'}),'Recebedor ficticio');store.collect(p.id,'Coletor ficticio','c1','Atualizador ficticio');
 const src:TimelineSources={movements:s.movements,records:s.records,accesses:s.accesses,parcels:store.parcels,inspections:s.inspections,yards:[{id:'y1',plate:'FICT-1',expected:'absent',observed:true,result:'OK',meaning:'physical_v2',checked_at:'2026-01-01T15:00Z',checked_by_name:'Conferente ficticio',notes:'',reference_local:'2026-01-01T12:00:00'},{id:'y2',plate:'FICT-2',expected:'present',observed:false,result:'NOK',meaning:'physical_v2',checked_at:'2026-01-01T16:00Z',checked_by_name:'Conferente ficticio',notes:'',reference_local:'2026-01-01T12:00:00'}]};
 const{events,unresolved}=timelineEvents(src);assert.equal(unresolved,0);assert.deepEqual(new Set(events.map(e=>e.kind)),new Set(Object.keys(EVENT_LABELS)));assert.ok(events.filter(e=>e.source==='movement').every(e=>e.actor===null));assert.equal(events.find(e=>e.kind==='parcel_collected')?.actor,'Atualizador ficticio');
 assert.deepEqual(events.map(e=>e.at),events.map(e=>e.at).sort().reverse());assert.equal(filterTimeline(events,{from:'2026-01-01',to:'2026-01-01',kind:'yard_divergence',search:'FICT-1'}).length,1);
});
test('pareamento entre fluxos deduplica apenas equivalencias 1:1 comprovadas e preserva origens',()=>{
 const s=new DemoStore(),m=s.movements[0],r={...s.records[1],id:'legacy-pair',vehicle_plate:m.vehicle_plate,pickup_name:m.driver_name,pickup_date:m.entry_date,pickup_time:m.entry_time,return_date:m.exit_date,return_time:m.exit_time};const baseline=structuredClone([r,m]);
 assert.equal(linkVehicleFlows([r],[m]).get(r.id),m.id);assert.equal(reportingRecords([r],[m]).length,1);
 const timeline=timelineEvents({movements:[m],records:[r],parcels:[],yards:[],inspections:[],accesses:[]});assert.equal(timeline.events.length,2);assert.deepEqual(timeline.events[0].related,['legacy:'+r.id]);assert.deepEqual([r,m],baseline);
 assert.equal(linkVehicleFlows([r,{...r,id:'ambiguous'}],[m]).size,0);assert.equal(reportingRecords([r,{...r,id:'ambiguous'}],[m]).length,3);
});
test('data/hora incompleta nao vira evento sintetico a meia-noite',()=>{const s=new DemoStore();const m={...s.movements[0],entry_time:'',exit_time:null};const data=timelineEvents({movements:[m],records:[],accesses:[],parcels:[],yards:[],inspections:[]});assert.equal(data.events.length,0);assert.equal(data.unresolved,2);});
