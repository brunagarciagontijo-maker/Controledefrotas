import{isDemo}from'../demo/mode';
import{demoStore}from'../domain/demoStore';
import{logisticsStore}from'../domain/logisticsStore';
import{businessTime}from'../domain/yard';
import{timelineEvents,type TimelineSources}from'../domain/timeline';
import{supabase}from'../lib/supabase';
export const timelineService={async list(){
  if(isDemo()){const data:TimelineSources={movements:demoStore.movements.map(m=>({...m,actor_name:demoStore.eventActors.get(`movement:${m.id}:out`),return_actor_name:demoStore.eventActors.get(`movement:${m.id}:in`)})),records:demoStore.records.map(r=>({...r,actor_name:demoStore.eventActors.get(`legacy:${r.id}:out`),return_actor_name:demoStore.eventActors.get(`legacy:${r.id}:in`)})),accesses:demoStore.accesses.map(a=>({...a,actor_name:demoStore.eventActors.get(`access:${a.id}:in`),return_actor_name:demoStore.eventActors.get(`access:${a.id}:out`)})),parcels:logisticsStore.parcels,inspections:demoStore.inspections,yards:[...logisticsStore.sessions.flatMap(s=>s.items.filter(i=>i.result).map(i=>({...i,reference_local:s.reference_local}))),...demoStore.conferences.map(c=>({id:c.id,plate:demoStore.vehicles.find(v=>v.id===c.vehicle_id)?.plate||'Cadastro indisponível',expected:c.expected?'present' as const:'absent' as const,observed:c.observed,result:null,checked_at:c.created_at,checked_by_name:null,notes:c.notes,reference_local:businessTime(new Date(c.created_at)),source:'legacy_yard' as const}))]};return timelineEvents(data);}
  const{data,error}=await supabase.rpc('portaria_timeline_sources');if(error||!data)throw new Error('Não foi possível carregar a Timeline.');return timelineEvents(data as unknown as TimelineSources);
}};
