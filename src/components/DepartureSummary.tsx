import type { Json } from '../types/database';
import { safeSignatureSource } from '../utils/signature';

export function DepartureSummary({checklist}:{checklist:Json}) {
  if(!checklist||typeof checklist!=='object'||Array.isArray(checklist)||typeof checklist.cobli_associated!=='boolean')return <p className="mt-2 text-xs text-gray-500">Registro anterior: confirmação Cobli não presumida.</p>;
  const signature=safeSignatureSource(typeof checklist.pickup_signature==='string'?checklist.pickup_signature:'');
  const information=<>{typeof checklist.operation_reason==='string'&&checklist.operation_reason&&<p>Motivo da utilização: {checklist.operation_reason}</p>}{typeof checklist.authorization_note==='string'&&checklist.authorization_note&&<p>Autorização informada: {checklist.authorization_note}</p>}</>;
  return <div className="mt-2 space-y-2 text-sm"><p>{checklist.cobli_associated?'Associação Cobli confirmada manualmente · fotos dispensadas':'Sem associação Cobli · checklist fotográfico obrigatório'}</p>{information}{!checklist.cobli_associated&&typeof checklist.driver_reason==='string'&&<p>Motivo informado: {checklist.driver_reason}</p>}{!checklist.cobli_associated&&typeof checklist.photo_count==='number'&&<p>Fotografias registradas: {checklist.photo_count}/6</p>}{signature&&<details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">Assinatura do responsável pela saída</summary><img src={signature} alt="Assinatura do responsável pela saída" className="mt-3 max-h-36 w-full rounded-xl bg-white object-contain" /></details>}</div>;
}
