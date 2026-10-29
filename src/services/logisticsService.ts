import {isDemo}from'../demo/mode';
import {demoStore}from'../domain/demoStore';
import {logisticsStore}from'../domain/logisticsStore';
import {businessTime,validateParcel,type Parcel,type YardSession}from'../domain/yard';
import {supabase}from'../lib/supabase';
import {signedFileUrl}from'../lib/privateFiles';
import type {Json}from'../types/database';
import type{OilInput,OilHistoryPage}from'../domain/oil';

export const logisticsService={
  async parcels():Promise<Parcel[]>{if(isDemo())return structuredClone(logisticsStore.parcels);const{data,error}=await supabase.rpc('portaria_list_parcels');if(error)throw new Error('Não foi possível consultar encomendas.');return data as unknown as Parcel[];},
  async receive(request:string,recipient:string,received:string,file:File,actor:string):Promise<Parcel>{
    validateParcel(recipient,received,file);if(isDemo())return logisticsStore.receive(request,recipient,received,file,actor);
    const{data:session,error:authError}=await supabase.auth.getSession();if(authError||!session.session)throw new Error('Acesso não confirmado.');
    const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    // A mesma tentativa sempre usa o mesmo objeto. Nunca sobrescrever nem apagar
    // após timeout: a confirmação no banco pode já ter sido concluída.
    const path=`${session.session.user.id}/${request}/${request}.${extension}`;
    await supabase.storage.from('portaria-parcels').upload(path,file,{contentType:file.type,upsert:false});
    // Mesmo se o upload retornar conflito/timeout, o RPC só aceita um objeto
    // privado existente, pertencente ao ator e à tentativa, com MIME/tamanho válidos.
    const{data,error}=await supabase.rpc('portaria_receive_parcel',{payload:{request_id:request,recipient_name:recipient,received_local:received,photo_path:path}as Json});if(error)throw new Error('Recebimento não confirmado. Consulte a listagem antes de repetir; a foto foi preservada.');return data as unknown as Parcel;
  },
  async collect(id:string,name:string,request:string,actor:string):Promise<Parcel>{if(isDemo())return logisticsStore.collect(id,name,request,actor);const{data,error}=await supabase.rpc('portaria_collect_parcel',{payload:{parcel_id:id,collector_name:name,request_id:request}});if(error)throw new Error('Retirada não confirmada ou já realizada. Atualize a listagem antes de repetir.');return data as unknown as Parcel;},
  async photo(path:string):Promise<string>{if(isDemo()){const file=logisticsStore.files.get(path);if(!file)throw new Error('Foto indisponível nesta sessão.');return URL.createObjectURL(file);}return signedFileUrl('portaria-parcels',path);},
  async sessions(day:string):Promise<Array<Omit<YardSession,'items'>>>{if(isDemo())return structuredClone(logisticsStore.sessions.filter(s=>s.day===day));const{data,error}=await supabase.rpc('portaria_list_yard_sessions',{check_day:day});if(error)throw new Error('Não foi possível consultar as conferências.');return data as unknown as YardSession[];},
  async session(id:string):Promise<YardSession>{if(isDemo())return logisticsStore.session(id);const{data,error}=await supabase.rpc('portaria_get_yard_session',{session_id:id});if(error||!data)throw new Error('Conferência indisponível.');return data as unknown as YardSession;},
  async start(request:string,day:string,reference:string,actor:string):Promise<YardSession>{if(isDemo())return logisticsStore.start(request,day,reference,actor,demoStore.vehicles,demoStore.movements,demoStore.records);const{data,error}=await supabase.rpc('portaria_start_yard_session',{payload:{request_id:request,day,reference_local:reference}});if(error)throw new Error('Não foi possível fixar a referência. Atualize o histórico antes de repetir.');return data as unknown as YardSession;},
  async check(session:string,item:string,result:'OK'|'NOK',notes:string,observed:boolean,actor:string,oil?:OilInput,request:string=crypto.randomUUID()):Promise<YardSession>{if(isDemo())return logisticsStore.check(session,item,result,notes,observed,actor,oil,request);const{data,error}=await supabase.rpc('portaria_check_yard_with_oil',{payload:{session_id:session,item_id:item,result,notes,observed,request_id:request,...(oil?{oil:oil as unknown as Json}:{})}});if(error)throw new Error('Conferência e óleo não confirmados. Confira identificação, nível e histórico antes de repetir.');return data as unknown as YardSession;},
  async found(session:string,plate:string,name:string,notes:string,actor:string,request:string=crypto.randomUUID()):Promise<YardSession>{if(isDemo())return logisticsStore.found(session,plate,name,notes,actor,request);const{data,error}=await supabase.rpc('portaria_report_unidentified_yard_vehicle',{payload:{session_id:session,plate,name,notes,request_id:request}});if(error)throw new Error('Veículo já listado ou registro não confirmado. Atualize a conferência.');return data as unknown as YardSession;},
  async oilHistory(vehicle:string,cursor:OilHistoryPage['next_cursor']=null):Promise<OilHistoryPage>{if(isDemo())return logisticsStore.oilHistory(vehicle,cursor);const{data,error}=await supabase.rpc('portaria_vehicle_oil_history',{vehicle_id:vehicle,before_at:cursor?.checked_at||null,before_request:cursor?.request_id||null});if(error)throw new Error('Histórico de óleo indisponível.');return data as unknown as OilHistoryPage;},
  async legacy(day:string):Promise<Array<{id:string;created_at:string;plate:string;expected:boolean;observed:boolean;notes:string}>>{if(isDemo())return demoStore.conferences.filter(c=>businessTime(new Date(c.created_at)).slice(0,10)===day).map(c=>({...c,plate:demoStore.vehicles.find(v=>v.id===c.vehicle_id)?.plate||'Veículo legado'}));const{data,error}=await supabase.rpc('portaria_legacy_yard_day',{check_day:day});if(error)throw new Error('Histórico anterior indisponível.');return data as unknown as Array<{id:string;created_at:string;plate:string;expected:boolean;observed:boolean;notes:string}>;},
};
