import{businessTime,formatBusinessDate,type Parcel}from'../domain/yard';
import{ResponsiveTable}from'./ResponsiveTable';
export function ParcelTable({rows,busy,onDetails,onCollect}:{rows:Parcel[];busy:boolean;onDetails:(row:Parcel)=>void;onCollect:(row:Parcel)=>void}){
  return <ResponsiveTable label="Lista de encomendas" rows={rows} rowKey={r=>r.id} rowLabel={r=>`Encomenda de ${r.recipient_name}`} columns={[
    {key:'recipient',label:'Destinatário',render:r=><strong>{r.recipient_name}</strong>},
    {key:'received',label:'Recebimento',render:r=><span>{formatBusinessDate(businessTime(new Date(r.received_at)))}<small className="block text-gray-500">{r.received_by_name}</small></span>},
    {key:'status',label:'Status',render:r=><span className={`text-xs font-semibold ${r.status==='Aguardando retirada'?'text-amber-900':'text-green-800'}`}>{r.status}</span>},
    {key:'collected',label:'Retirada',render:r=>r.collected_at?formatBusinessDate(businessTime(new Date(r.collected_at))):'—'},
    {key:'collector',label:'Quem retirou',render:r=><span>{r.collector_name||'—'}{r.collected_by_name&&<small className="block text-gray-500">Atualizada por {r.collected_by_name}</small>}</span>},
    {key:'actions',label:'Ações',render:r=><div className="flex flex-wrap gap-2"><button className="action-secondary" onClick={()=>onDetails(r)}>Foto e detalhes da encomenda</button>{r.status==='Aguardando retirada'&&<button className="action-primary" disabled={busy} onClick={()=>onCollect(r)}>Registrar retirada</button>}</div>},
  ]}/>;
}
