import{useState}from'react';
import{availability}from'../domain/portaria';
import{entryTarget,lastVehicleEvent}from'../domain/vehicleOperations';
import{formatBusinessDate}from'../domain/yard';
import type{FleetVehicle,OperationalMovement,VehicleRecord}from'../types/database';
import{ResponsiveTable}from'./ResponsiveTable';

export function PatioVehicles({vehicles,movements,records,search,blocked,onDeparture,onEntry}:{vehicles:FleetVehicle[];movements:OperationalMovement[];records:VehicleRecord[];search:string;blocked:boolean;onDeparture:(id:string)=>void;onEntry:(id:string,plate:string)=>void}){
  const[filter,setFilter]=useState('Todos');
  const rows=availability(vehicles,movements,records).map(state=>{const target=entryTarget(state.vehicle.id,state.vehicle.plate,vehicles,movements,records);return{...state,target,situation:state.available?'No pátio':state.requiresConference||state.inconsistent?'Revisão necessária':state.hasOpenMovement?'Fora do pátio':`Indisponível · ${state.vehicle.status}`,last:lastVehicleEvent(state.vehicle.plate,movements,records)};}).filter(row=>(!search.trim()||[row.vehicle.plate,row.vehicle.name,row.vehicle.short_code,row.vehicle.responsible_name,row.vehicle.fixed_driver_name].some(value=>value?.toLowerCase().includes(search.trim().toLowerCase())))&&(filter==='Todos'||filter==='Disponíveis'&&row.available||filter==='Fora do pátio'&&row.hasOpenMovement||filter==='Revisão necessária'&&(row.requiresConference||row.inconsistent)));
  return <div className="space-y-4"><label className="block max-w-sm text-sm font-semibold">Situação dos veículos<select className="form-select mt-2" value={filter} onChange={e=>setFilter(e.target.value)}>{['Todos','Disponíveis','Fora do pátio','Revisão necessária'].map(s=><option key={s}>{s}</option>)}</select></label>
    <ResponsiveTable label="Veículos do pátio" rows={rows} rowKey={r=>r.vehicle.id} rowLabel={r=>`Veículo ${r.vehicle.plate}`} columns={[
      {key:'code',label:'Código',render:r=>r.vehicle.short_code||'—'},
      {key:'plate',label:'Placa',render:r=><strong>{r.vehicle.plate}</strong>},
      {key:'name',label:'Veículo',render:r=>r.vehicle.name},
      {key:'responsible',label:'Responsável',render:r=><span>{r.vehicle.responsible_name||'Não informado'}{r.vehicle.fixed_driver_name&&<small className="block text-amber-800">Condutor fixo: {r.vehicle.fixed_driver_name}</small>}</span>},
      {key:'status',label:'Situação atual',render:r=><span className={`text-xs font-semibold ${r.available?'text-green-800':r.requiresConference||r.inconsistent?'text-amber-900':'text-red-800'}`}>{r.situation}</span>},
      {key:'last',label:'Última movimentação',render:r=>r.last?<span className="text-xs">{r.last.label}<br/>{formatBusinessDate(r.last.at)}</span>:<span className="text-xs text-gray-500">Sem data/hora confiável</span>},
      {key:'action',label:'Ação',render:r=>r.available?<button className="action-primary" disabled={blocked} onClick={()=>onDeparture(r.vehicle.id)}>Registrar saída</button>:r.target.kind!=='unavailable'?<button className="action-secondary" disabled={blocked} onClick={()=>onEntry(r.vehicle.id,r.vehicle.plate)}>Registrar entrada</button>:<span className="text-xs text-gray-500">Revisar histórico</span>},
    ]}/>{!rows.length&&<p className="section-card text-gray-500">Nenhum veículo para os filtros selecionados.</p>}
  </div>;
}
