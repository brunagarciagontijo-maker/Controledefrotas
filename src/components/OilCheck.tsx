import { useState } from 'react';
import { oilLevels, type OilContext, type OilLevel, type OilReading, type OilHistoryPage } from '../domain/oil';
import { businessTime, formatBusinessDate } from '../domain/yard';
import { logisticsService } from '../services/logisticsService';
import { downloadRows } from '../utils/downloadRows';

const date = (value: string) => formatBusinessDate(businessTime(new Date(value)));
const tone = (level?: OilLevel) => level === 'critical' ? 'border-red-300 bg-red-50 text-red-900' : level === 'low' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-gray-200 bg-gray-50 text-gray-700';
export function OilSummary({ context }: { context?: OilContext }) {
  const valid = context?.latest_valid, attempt = context?.latest_attempt;
  return <div className={`space-y-2 rounded-xl border p-3 text-sm ${tone(valid?.level)}`} aria-label="Última verificação de óleo">
    {valid ? <><p className="font-semibold">Última medição válida: {oilLevels[valid.level]}</p><p>{date(valid.checked_at)} · {valid.checked_by_name}</p><p>Dias desde a última medição válida: <strong>{context?.days_since_valid}</strong></p></> : <p>Sem verificação anterior</p>}
    {attempt && attempt.request_id !== valid?.request_id && <p>Última tentativa: {oilLevels[attempt.level]} · {date(attempt.checked_at)} · {attempt.checked_by_name}</p>}
    {context?.current?.notes && <p>Observações do óleo: {context.current.notes}</p>}
  </div>;
}
export function OilFields({ plate, value, onChange, disabled }: { plate: string; value: { level: OilLevel | ''; notes: string }; onChange: (value: { level: OilLevel | ''; notes: string }) => void; disabled: boolean }) {
  return <div className="space-y-3"><label className="block text-sm font-semibold">Nível atual do óleo — {plate}<select required aria-label={`Nível atual do óleo de ${plate}`} className="form-select mt-1" disabled={disabled} value={value.level} onChange={e => onChange({ ...value, level: e.target.value as OilLevel | '' })}><option value="">Selecione o nível</option>{Object.entries(oilLevels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="block text-sm font-semibold">Observações do óleo (opcional)<textarea aria-label={`Observações do óleo de ${plate}`} className="form-select mt-1" rows={2} maxLength={2000} disabled={disabled} value={value.notes} onChange={e => onChange({ ...value, notes: e.target.value })} /></label>
    {(value.level === 'low' || value.level === 'critical') && <p className={`rounded-xl border p-3 text-sm font-semibold ${tone(value.level)}`}>Óleo {oilLevels[value.level].toLowerCase()}. A disponibilidade do veículo permanece inalterada.</p>}</div>;
}
export function OilHistory({ vehicle, plate }: { vehicle: string; plate: string }) {
  const [events, setEvents] = useState<OilReading[]>([]), [cursor, setCursor] = useState<OilHistoryPage['next_cursor']>(null);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = async (more = false) => { if (busy) return; setBusy(true); setError(''); try { const page = await logisticsService.oilHistory(vehicle, more ? cursor : null); setEvents(previous => more ? [...previous, ...page.events] : page.events); setCursor(page.next_cursor); setLoaded(true); } catch { setError('Não foi possível consultar o histórico de óleo.'); } finally { setBusy(false); } };
  return <details className="rounded-xl border border-gray-200 p-3" onToggle={e => { if (e.currentTarget.open && !loaded) void load(); }}><summary className="cursor-pointer text-sm font-semibold">Histórico de óleo — {plate}</summary><div className="mt-3 space-y-3">
    {error && <p role="alert" className="text-sm text-red-700">{error}<button className="action-secondary ml-2" onClick={() => void load()}>Tentar novamente</button></p>}
    {busy && <p role="status" className="text-sm">Consultando histórico...</p>}{loaded && !events.length && <p className="text-sm text-gray-600">Sem verificação anterior</p>}
    {events.map(event => <div key={event.request_id} className={`rounded-xl border p-3 text-sm ${tone(event.level)}`}><p className="font-semibold">{oilLevels[event.level]} · {date(event.checked_at)}</p><p>{event.checked_by_name}</p>{event.notes && <p className="break-words">{event.notes}</p>}</div>)}
    {cursor && <button className="action-secondary" disabled={busy} onClick={() => void load(true)}>Carregar verificações anteriores</button>}
    {events.length > 0 && <button className="action-secondary" onClick={() => downloadRows(`oleo-${plate}.csv`, ['Veículo', 'Data/hora', 'Nível', 'Responsável', 'Observações'], events.map(row => [plate, date(row.checked_at), oilLevels[row.level], row.checked_by_name, row.notes]))}>Exportar histórico carregado</button>}
  </div></details>;
}
export type OilFormValue = { level: OilLevel | ''; notes: string };
