import {businessInstant,businessTime,reconstructYard,validateParcel,validateYardCheck,type Parcel,type YardSession}from'./yard.ts';
import type {FleetVehicle,OperationalMovement,VehicleRecord}from'../types/database.ts';
import {oilContext,validateOil,type OilInput,type OilReading,type OilHistoryPage}from'./oil.ts';

export class LogisticsStore {
  parcels:Parcel[]=[];files=new Map<string,File>();sessions:YardSession[]=[];
  private receipts=new Map<string,string>();
  oilReadings:OilReading[]=[];
  private yardRequests=new Map<string,string>();
  session(id:string):YardSession {
    const row=this.sessions.find(s=>s.id===id);if(!row)throw new Error('Conferência não encontrada.');
    return structuredClone({...row,items:row.items.map(item=>({...item,oil:item.result?item.oil:oilContext(this.oilReadings,item.vehicle_id)}))});
  }
  oilHistory(vehicle:string,cursor:OilHistoryPage['next_cursor']=null):OilHistoryPage {
    const rows=this.oilReadings.filter(r=>r.vehicle_id===vehicle&&(!cursor||r.checked_at<cursor.checked_at||r.checked_at===cursor.checked_at&&r.request_id<cursor.request_id));
    const events=rows.slice(0,25),last=events[events.length-1];
    return structuredClone({events,next_cursor:rows.length>25&&last?{checked_at:last.checked_at,request_id:last.request_id}:null});
  }
  receive(request:string,recipient:string,received:string,file:File,actor:string):Parcel {
    validateParcel(recipient,received,file);const hash=JSON.stringify([recipient,received,file.name,file.size,file.lastModified,file.type]);
    const old=this.parcels.find(p=>p.id===request);if(old){if(this.receipts.get(request)!==hash)throw new Error('Tentativa já usada com outro conteúdo.');return structuredClone(old);}
    const path=`ficticio/${request}/foto`;this.files.set(path,file);this.receipts.set(request,hash);
    const parcel:Parcel={id:request,recipient_name:recipient.trim(),received_at:businessInstant(received),received_by_name:actor,photo_path:path,status:'Aguardando retirada',collector_name:null,collected_at:null,collected_by_name:null};this.parcels.unshift(parcel);return structuredClone(parcel);
  }
  collect(id:string,name:string,request:string,actor:string):Parcel {
    const parcel=this.parcels.find(p=>p.id===id);if(!parcel||!name.trim()||name.trim().length>160)throw new Error('Informe quem retirou.');
    const fingerprint=JSON.stringify([id,name.trim(),actor]);
    if(this.receipts.has(request)){if(this.receipts.get(request)!==fingerprint)throw new Error('Tentativa já utilizada.');return structuredClone(parcel);}
    if(parcel.status!=='Aguardando retirada')throw new Error('Encomenda já retirada.');
    Object.assign(parcel,{status:'Encomenda retirada',collector_name:name.trim(),collected_at:new Date().toISOString(),collected_by_name:actor});this.receipts.set(request,fingerprint);return structuredClone(parcel);
  }
  start(request:string,day:string,reference:string,actor:string,vehicles:FleetVehicle[],movements:OperationalMovement[],records:VehicleRecord[]):YardSession {
    if(!reference.startsWith(day+'T')||reference>businessTime())throw new Error('Referência inválida ou futura.');
    const old=this.sessions.find(s=>s.id===request);if(old){if(old.day!==day||old.reference_local!==reference||old.created_by_name!==actor)throw new Error('Tentativa já utilizada.');return structuredClone(old);}
    const session:YardSession={id:request,day,reference_local:reference,created_at:new Date().toISOString(),created_by_name:actor,items:reconstructYard(vehicles,movements,records,reference)};this.sessions.unshift(session);return this.session(session.id);
  }
  check(sessionId:string,itemId:string,result:'OK'|'NOK',notes:string,observed:boolean,actor:string,oil?:OilInput|null,request:string=crypto.randomUUID()):YardSession {
    const session=this.sessions.find(s=>s.id===sessionId),item=session?.items.find(i=>i.id===itemId);if(!session||!item)throw new Error('Conferência não encontrada.');
    const fingerprint=JSON.stringify(['check',sessionId,itemId,result,notes.trim(),observed,actor,oil||null]);
    if(this.yardRequests.has(request)){if(this.yardRequests.get(request)!==fingerprint)throw new Error('Tentativa já utilizada.');return this.session(sessionId);}
    validateYardCheck(item,result,notes,observed);
    if(result==='OK')validateOil(item.vehicle_id,oil);else if(oil)throw new Error('NOK não registra óleo.');
    const checkedAt=new Date(Math.max(Date.now(),this.oilReadings[0]?Date.parse(this.oilReadings[0].checked_at)+1:0)).toISOString();
    if(result==='OK')this.oilReadings.unshift({request_id:request,vehicle_id:item.vehicle_id!,level:oil!.level,notes:oil!.notes.trim(),checked_at:checkedAt,checked_by_name:actor});
    const context=oilContext(this.oilReadings,item.vehicle_id,checkedAt);context.current=result==='OK'?this.oilReadings[0]:null;
    Object.assign(item,{result,observed,meaning:'physical_v2',notes:notes.trim(),checked_at:checkedAt,checked_by_name:actor,oil:context});this.yardRequests.set(request,fingerprint);return this.session(sessionId);
  }
  found(sessionId:string,plate:string,name:string,notes:string,actor:string,request:string=crypto.randomUUID()):YardSession {
    const session=this.sessions.find(s=>s.id===sessionId);const normalized=plate.trim().toUpperCase();
    if(!session||!normalized||normalized.length>16||!notes.trim())throw new Error('Informe placa e divergência.');
    const fingerprint=JSON.stringify(['found',sessionId,normalized,name.trim(),notes.trim(),actor]);
    if(this.yardRequests.has(request)){if(this.yardRequests.get(request)!==fingerprint)throw new Error('Tentativa já utilizada.');return this.session(sessionId);}
    if(session.items.some(i=>i.plate.trim().toUpperCase()===normalized))throw new Error('Veículo já listado. Utilize os controles da linha existente.');
    session.items.push({id:crypto.randomUUID(),vehicle_id:null,plate:normalized,name:name.trim(),expected:'unknown',reasons:['encontrado_nao_listado','identificacao_pendente'],result:null,meaning:null,observed:null,notes:'',checked_at:null,checked_by_name:null,last_departure:null,found_report:{notes:notes.trim(),reported_at:new Date().toISOString(),reported_by_name:actor,request_id:request}});this.yardRequests.set(request,fingerprint);return this.session(sessionId);
  }
}
export const logisticsStore=new LogisticsStore();
