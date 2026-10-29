import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DemoStore } from '../src/domain/demoStore.ts';
import { reportingRecords } from '../src/domain/reporting.ts';
import { validateDepartureSignature } from '../src/domain/portaria.ts';

test('indicadores incluem os dois fluxos sem converter nem mutar historico',()=>{
  const store=new DemoStore();const before=structuredClone(store.records);
  const movement=store.depart({vehicle_id:store.vehicles[0].id,vehicle_plate:store.vehicles[0].plate,driver_id:store.people[0].id,driver_name:store.people[0].name,driver_cnh_number:null,driver_cnh_valid_until:null,operation_type:'Obras',entry_date:'2026-10-27',entry_time:'10:00',entry_odometer:1,entry_fuel_level:'Cheio',checklist:{}},{cobliAssociated:true,driverReason:''},[],crypto.randomUUID());
  const result=reportingRecords(store.records,[{...movement,checklist:{operation_reason:'Destino ficticio',authorization_note:'Autorizacao declarada'}}]);assert.equal(result.length,store.records.length+1);assert.equal(result.at(-1)?.status,'Em uso');assert.equal(result.at(-1)?.reason,'Destino ficticio');assert.equal(result.at(-1)?.authorized_by,'Autorizacao declarada');assert.equal(result.at(-1)?.id,'operacao:'+movement.id);assert.deepEqual(store.records,before);
});
test('assinatura nova recusa ausencia, SVG e URL externa',()=>{for(const input of ['', 'https://arquivo.invalid/foto.png','data:image/svg+xml;base64,PHN2Zz4='])assert.ok(validateDepartureSignature(input).length);assert.deepEqual(validateDepartureSignature('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg=='),[]);});
test('cadastros e inspecoes de demonstracao funcionam sem persistencia ou rede',()=>{const store=new DemoStore();const created=store.createVehicle({plate:'FICT-9',name:'Veiculo de teste',status:'Ativo',responsible_name:'Ficticio',fixed_driver_name:''});assert.equal(store.updateVehicle(created.id,{name:'Editado ficticio'}).name,'Editado ficticio');const request=store.createInspection({vehicle_id:created.id,vehicle_plate:created.plate,vehicle_name:created.name});assert.equal(store.completeInspection(request.id,{pneus:true}).status,'Concluida');assert.equal(new DemoStore().vehicles.some(v=>v.id===created.id),false);});
