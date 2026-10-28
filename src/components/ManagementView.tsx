import{useCallback,useEffect,useState}from'react';
import{FileText}from'lucide-react';
import{DatabaseView}from'./DatabaseView';
import{MovementHistory}from'./MovementHistory';
import{Dashboard}from'./Dashboard';
import{vehicleService}from'../services/vehicleService';
import{operationalService}from'../services/operationalService';
import{reportingRecords}from'../domain/reporting';
import type{OperationalMovement,VehicleRecord}from'../types/database';
export type ManagementSection='anteriores'|'operacoes'|'indicadores';
export function ManagementView({initialSection='anteriores',onSuccess,onError,onNew,refresh}:{initialSection?:ManagementSection;onSuccess:(message:string)=>void;onError:(message:string)=>void;onNew:()=>void;refresh:number}){
  const[section,setSection]=useState<ManagementSection>(initialSection),[origin,setOrigin]=useState('todos');
  const[records,setRecords]=useState<VehicleRecord[]>([]),[movements,setMovements]=useState<OperationalMovement[]>([]),[loading,setLoading]=useState(false);
  const load=useCallback(async()=>{setLoading(true);try{const[r,m]=await Promise.all([vehicleService.listRecords(),operationalService.listMovements()]);setRecords(r);setMovements(m);}catch{onError('Não foi possível carregar os indicadores.');}finally{setLoading(false);}},[onError]);
  useEffect(()=>{if(section==='indicadores')void load();},[section,refresh,load]);
  return <section className="space-y-6 animate-fade-in"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold sm:text-3xl">Gestão</h2><p className="mt-2 text-sm text-gray-600">Consultas, indicadores e exportações dos registros anteriores e da Portaria.</p></div><button className="action-primary" onClick={onNew}><FileText className="h-4 w-4"/>Novo registro</button></div>
    <nav aria-label="Seções da gestão" className="flex flex-wrap gap-2">{([['anteriores','Registros anteriores'],['operacoes','Movimentações da Portaria'],['indicadores','Indicadores']]as const).map(([key,label])=><button key={key} aria-pressed={section===key} className={section===key?'section-tab-active':'section-tab'} onClick={()=>setSection(key)}>{label}</button>)}</nav>
    <div hidden={section!=='anteriores'}><DatabaseView onSuccess={onSuccess} onError={onError} refreshTrigger={refresh}/></div>
    <div hidden={section!=='operacoes'}><MovementHistory onError={onError} refreshTrigger={refresh}/></div>
    <div hidden={section!=='indicadores'} className="space-y-5"><label className="block max-w-sm text-sm font-semibold">Origem dos indicadores<select aria-label="Origem dos indicadores" className="form-select mt-2" value={origin} onChange={e=>setOrigin(e.target.value)}><option value="todos">Todos os fluxos</option><option value="anteriores">Registros anteriores</option><option value="operacoes">Portaria</option></select></label>{loading?<p role="status">Atualizando indicadores…</p>:<Dashboard records={reportingRecords(origin==='operacoes'?[]:records,origin==='anteriores'?[]:movements)}/>}</div>
  </section>;
}
