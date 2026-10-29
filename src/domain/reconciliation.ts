type Legacy={id:string;vehicle_plate:string;pickup_name:string;pickup_date:string;pickup_time:string;return_date:string|null;return_time:string|null};
type Movement={id:string;vehicle_plate:string;driver_name:string;entry_date:string;entry_time:string;exit_date:string|null;exit_time:string|null};
const norm=(value:string|null|undefined)=>(value||'').trim().toUpperCase().replace(/\s+/g,' ');
const stamp=(date:string|null,time:string|null)=>date&&time?`${date.slice(0,10)}T${time.length===5?time+':00':time.slice(0,8)}`:null;
// Pareamento conservador 1:1. Empates permanecem visiveis; nunca apaga registros.
export function linkVehicleFlows(records:Legacy[],movements:Movement[]):Map<string,string>{
  const endComplete=(date:string|null,time:string|null)=>Boolean(date)===Boolean(time);
  const matches=(r:Legacy,m:Movement)=>norm(r.vehicle_plate)!==''&&norm(r.vehicle_plate)===norm(m.vehicle_plate)&&norm(r.pickup_name)!==''&&norm(r.pickup_name)===norm(m.driver_name)&&endComplete(r.return_date,r.return_time)&&endComplete(m.exit_date,m.exit_time)&&stamp(r.pickup_date,r.pickup_time)!==null&&stamp(r.pickup_date,r.pickup_time)===stamp(m.entry_date,m.entry_time)&&stamp(r.return_date,r.return_time)===stamp(m.exit_date,m.exit_time);
  const linked=new Map<string,string>();for(const r of records){const ms=movements.filter(m=>matches(r,m));if(ms.length===1&&records.filter(other=>matches(other,ms[0])).length===1)linked.set(r.id,ms[0].id);}return linked;
}
