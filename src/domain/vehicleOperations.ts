import type{FleetVehicle,OperationalMovement,VehicleRecord}from'../types/database.ts';
export const plateKey=(plate:string)=>plate.trim().toUpperCase();
export function entryTarget(vehicleId:string,plate:string,vehicles:FleetVehicle[],movements:OperationalMovement[],records:VehicleRecord[]):{kind:'movement';row:OperationalMovement}|{kind:'legacy';row:VehicleRecord}|{kind:'unavailable';message:string}{
  const vehicle=vehicles.find(v=>v.id===vehicleId&&plateKey(v.plate)===plateKey(plate));
  if(!vehicle)return{kind:'unavailable',message:'Cadastro ou placa mudou. Atualize os dados; nenhuma entrada foi criada.'};
  const ms=movements.filter(m=>m.status==='Em aberto'&&(m.vehicle_id===vehicleId||plateKey(m.vehicle_plate)===plateKey(plate)));
  const rs=records.filter(r=>r.status==='Em uso'&&plateKey(r.vehicle_plate)===plateKey(plate));
  if(ms.length===1&&rs.length===0&&ms[0].vehicle_id===vehicleId&&plateKey(ms[0].vehicle_plate)===plateKey(plate))return{kind:'movement',row:ms[0]};
  if(rs.length===1&&ms.length===0)return{kind:'legacy',row:rs[0]};
  return{kind:'unavailable',message:ms.length+rs.length===0?'Não há saída aberta identificada com segurança para este veículo. Nenhuma entrada foi criada.':'Há saídas conflitantes ou identidade divergente. Revise o histórico antes de registrar entrada.'};
}
export function lastVehicleEvent(plate:string,movements:OperationalMovement[],records:VehicleRecord[]){
  const events=[...movements.filter(m=>plateKey(m.vehicle_plate)===plateKey(plate)).flatMap(m=>[{date:m.entry_date,time:m.entry_time,label:'Saída'},...(m.exit_date&&m.exit_time?[{date:m.exit_date,time:m.exit_time,label:'Entrada'}]:[])]),...records.filter(r=>plateKey(r.vehicle_plate)===plateKey(plate)).flatMap(r=>[{date:r.pickup_date,time:r.pickup_time,label:'Saída'},...(r.return_date&&r.return_time?[{date:r.return_date,time:r.return_time,label:'Entrada'}]:[])])].filter(e=>e.date&&e.time).sort((a,b)=>`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  if(!events[0])return null;
  const at=(e:typeof events[number])=>`${e.date}T${e.time.length===5?e.time+':00':e.time}`;
  const last=at(events[0]);const tied=new Set(events.filter(e=>at(e)===last).map(e=>e.label));
  return{at:last,label:tied.size>1?'Entrada/saída no mesmo horário':events[0].label};
}
