import type { FleetVehicle, OperationalMovement, VehicleRecord } from '../types/database';
import type { OilContext } from './oil';

export type ExpectedPresence = 'present' | 'absent' | 'unknown';
export const yardLabels={present:'Esperado no pátio',absent:'Não esperado no pátio',unknown:'Revisão histórica necessária'};
export interface YardItem {
  id: string; vehicle_id: string | null; plate: string; name: string; expected: ExpectedPresence;
  reasons: string[]; result: 'OK' | 'NOK' | null; observed: boolean | null;
  notes: string; checked_at: string | null; checked_by_name: string | null;
  meaning?: 'compatibility_v1' | 'physical_v2' | null;
  last_departure?: { at:string;source:'movement'|'legacy';record_id:string } | null;
  oil?: OilContext;
  found_report?: { notes:string;reported_at:string;reported_by_name:string;request_id:string } | null;
}
export interface YardSession { id: string; day: string; reference_local: string; created_at: string; created_by_name: string; items: YardItem[] }
export interface Parcel {
  id: string; recipient_name: string; received_at: string; received_by_name: string;
  photo_path: string; status: 'Aguardando retirada' | 'Encomenda retirada';
  collector_name: string | null; collected_at: string | null; collected_by_name: string | null;
}
export function businessTime(value = new Date()): string {
  const parts = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(value);
  return parts.replace(' ','T');
}
const stamp=(date:string|null|undefined,time:string|null|undefined)=>date&&time?`${date.slice(0,10)}T${time.length===5?time+':00':time.slice(0,8)}`:null;
export function businessInstant(local:string):string {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local))throw new Error('Data e hora inválidas.');
  const desired=Date.parse(local+'Z');let instant=desired;
  for(let i=0;i<3;i++)instant+=desired-Date.parse(businessTime(new Date(instant))+'Z');
  if(businessTime(new Date(instant)).slice(0,16)!==local.slice(0,16))throw new Error('Horário inexistente no fuso de São Paulo.');
  return new Date(instant).toISOString();
}
const normalize=(plate:string)=>plate.trim().toUpperCase();

// Ausencia de movimentos nunca e usada como prova de presenca historica.
export function reconstructYard(vehicles:FleetVehicle[],movements:OperationalMovement[],records:VehicleRecord[],reference:string):YardItem[] {
  const ref=reference.length===16?reference+':00':reference;
  return vehicles.map(v=>{
    const rows=[...movements.filter(m=>m.vehicle_id===v.id||normalize(m.vehicle_plate)===normalize(v.plate)).map(m=>({departure:stamp(m.entry_date,m.entry_time),returned:stamp(m.exit_date,m.exit_time),open:m.status==='Em aberto'})),...records.filter(r=>normalize(r.vehicle_plate)===normalize(v.plate)).map(r=>({departure:stamp(r.pickup_date,r.pickup_time),returned:stamp(r.return_date,r.return_time),open:r.status==='Em uso'}))];
    const unique=Array.from(new Map(rows.map(r=>[JSON.stringify(r),r])).values());
    const relevant=unique.filter(r=>r.departure&&r.departure<=ref);
    const returns=relevant.filter(r=>r.returned&&r.returned>=r.departure!&&r.returned<=ref).map(r=>r.returned!).sort();
    const latest=returns[returns.length-1]||'';
    const incomplete=relevant.some(r=>(!r.returned&&!r.open||!!r.returned&&r.returned<r.departure!)&&r.departure!>=latest);
    const active=relevant.filter(r=>r.returned?r.returned>ref:r.open);
    const overlap=active.some(r=>latest>r.departure!)||relevant.some(r=>r.open&&r.returned);
    const identity=movements.some(m=>{const when=stamp(m.entry_date,m.entry_time);return when!==null&&when<=ref&&(m.vehicle_id===v.id&&normalize(m.vehicle_plate)!==normalize(v.plate)||m.vehicle_id!==v.id&&normalize(m.vehicle_plate)===normalize(v.plate));});
    let expected:ExpectedPresence='unknown';
    const reasons:string[]=[];
    if(incomplete||overlap||identity)reasons.push(identity?'identidade_placa_alterada':incomplete?'historico_incompleto':'fluxos_sobrepostos');
    else if(active.length)expected='absent';else if(latest)expected='present';
    else reasons.push('sem_evidencia_historica');
    const openNow=rows.some(r=>r.open&&!r.returned);
    if(!v.in_patio&&!openNow)reasons.push('fora_sem_saida_aberta_revisar');
    return{id:v.id,vehicle_id:v.id,plate:v.plate,name:v.name,expected,reasons,result:null,observed:null,notes:'',checked_at:null,checked_by_name:null,last_departure:lastDeparture(v,movements,records,ref)};
  });
}
export function yardDivergence(item:YardItem):boolean|null {return item.observed===null||item.expected==='unknown'?null:item.observed!==(item.expected==='present');}
export function physicalResult(item:YardItem){return item.observed===null?null:item.observed?'OK':'NOK';}
export function formatBusinessDate(local:string){const[date,time]=local.split('T');return `${date.split('-').reverse().join('/')} ${(time||'').slice(0,8)}`;}
export function confirmationMessage(found:boolean,instant:string){return `Carro ${found?'disponível no pátio':'não localizado no pátio'} - ${formatBusinessDate(businessTime(new Date(instant)))}`;}
export function yardTotals(items:YardItem[]) {return{expected:items.filter(i=>i.expected==='present').length,checked:items.filter(i=>i.result).length,pending:items.filter(i=>!i.result).length,divergent:items.filter(i=>yardDivergence(i)===true).length,review:items.filter(i=>i.reasons.length||i.expected==='unknown').length};}
export function yardExport(items:YardItem[],reference:string){return{columns:['Referência','Placa','Veículo','Esperado','Resultado físico','Resultado original','Critério original','Comparação','Observado','Observações','Conferido em','Responsável','Última saída'],rows:items.map(i=>[reference,i.plate,i.name,yardLabels[i.expected],physicalResult(i)||'Pendente',i.result||'Pendente',i.meaning||'',yardDivergence(i)===null?'Revisão pendente':yardDivergence(i)?'Divergente':'Conforme',i.observed===null?'':i.observed?'Encontrado':'Não encontrado',i.notes,i.checked_at,i.checked_by_name,i.last_departure?.at||'Não identificada'])};}
export function validateYardCheck(item:YardItem,result:'OK'|'NOK',notes:string,observed:boolean|null):void {
  if(item.result)throw new Error('Este resultado já foi registrado. Inicie outra referência para uma nova conferência.');
  if(notes.length>2000)throw new Error('Observação limitada a 2000 caracteres.');
  if(typeof observed!=='boolean'||observed!==(result==='OK'))throw new Error('OK significa encontrado; NOK significa não encontrado.');
}

// A última saída é fixada na referência. Empates ou identidade ambígua não são adivinhados.
export function lastDeparture(v:FleetVehicle,movements:OperationalMovement[],records:VehicleRecord[],ref:string):YardItem['last_departure']{
  const candidates=[...movements.filter(m=>m.vehicle_id===v.id&&normalize(m.vehicle_plate)===normalize(v.plate)).map(m=>({at:stamp(m.entry_date,m.entry_time),returned:stamp(m.exit_date,m.exit_time),driver:normalize(m.driver_name),source:'movement' as const,record_id:m.id})),...records.filter(r=>normalize(r.vehicle_plate)===normalize(v.plate)).map(r=>({at:stamp(r.pickup_date,r.pickup_time),returned:stamp(r.return_date,r.return_time),driver:normalize(r.pickup_name),source:'legacy' as const,record_id:r.id}))].filter(r=>r.at&&r.at<=ref).sort((a,b)=>b.at!.localeCompare(a.at!));
  if(!candidates[0])return null;
  const tied=candidates.filter(r=>r.at===candidates[0].at);
  if(tied.length>1&&!(tied.length===2&&tied[0].source!==tied[1].source&&tied[0].returned===tied[1].returned&&tied[0].driver&&tied[0].driver===tied[1].driver))return null;
  const row=tied.find(r=>r.source==='movement')||tied[0];return{at:row.at!,source:row.source,record_id:row.record_id};
}
export function validateParcel(recipient:string,received:string,file:File|null):void {
  if(!recipient.trim()||recipient.trim().length>160||!received)throw new Error('Informe destinatário, data e hora válidos.');
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<=0||file.size>10485760)throw new Error('Fotografia JPEG, PNG ou WebP obrigatória, de até 10 MB.');
  if(Date.parse(businessInstant(received))>Date.now()+60000)throw new Error('O recebimento não pode estar no futuro.');
}
