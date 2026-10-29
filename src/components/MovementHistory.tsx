import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, Filter, Printer, Search } from 'lucide-react';
import { operationalService } from '../services/operationalService';
import type { OperationalMovement } from '../types/database';
import { formatDateBR } from '../utils/date';
import { exportToCSV, generatePrintReport } from '../utils/export';
import { reportingRecords } from '../domain/reporting';
import { DepartureSummary } from './DepartureSummary';
import { PrivatePhotos } from './PrivatePhotos';
import { Modal } from './Modal';

export function MovementHistory({ onError, refreshTrigger = 0 }: { onError: (message: string) => void; refreshTrigger?: number }) {
  const [rows, setRows] = useState<OperationalMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Todos');
  const [operation, setOperation] = useState('Todas');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [selected, setSelected] = useState<OperationalMovement | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setRows(await operationalService.listMovements()); } catch { onError('Não foi possível carregar as movimentações.'); } finally { setLoading(false); } }, [onError]);
  useEffect(() => { void load(); }, [load, refreshTrigger]);
  const filtered = useMemo(() => rows.filter(row => (!search.trim() || [row.short_code, row.vehicle_plate, row.driver_name, row.operation_type].some(value => value?.toLowerCase().includes(search.trim().toLowerCase()))) && (status === 'Todos' || row.status === status) && (operation === 'Todas' || row.operation_type === operation) && (!start || row.entry_date >= start) && (!end || row.entry_date <= end)), [rows, search, status, operation, start, end]);
  return <section className="space-y-5" aria-label="Histórico de movimentações">
    <div className="section-card space-y-5"><h3 className="flex items-center gap-2 text-lg font-bold"><Filter className="h-5 w-5 text-red-600" />Histórico de movimentações</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-semibold"><span className="flex items-center gap-2"><Search className="h-4 w-4" />Buscar movimentações</span><input className="form-select mt-1" value={search} onChange={e => setSearch(e.target.value)} placeholder="Placa, código ou motorista" /></label>
        <label className="text-sm font-semibold">Status da movimentação<select className="form-select mt-1" value={status} onChange={e => setStatus(e.target.value)}>{['Todos', 'Em aberto', 'Concluida'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="text-sm font-semibold">Tipo de operação<select className="form-select mt-1" value={operation} onChange={e => setOperation(e.target.value)}>{['Todas', 'Obras', 'Trajeto curto', 'Viagem'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="text-sm font-semibold">Movimentações desde<input className="form-select mt-1" type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label className="text-sm font-semibold">Movimentações até<input className="form-select mt-1" type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
        <button className="action-secondary self-end" onClick={() => { setSearch(''); setStatus('Todos'); setOperation('Todas'); setStart(''); setEnd(''); }}>Limpar filtros</button>
      </div><div className="flex flex-wrap gap-3"><button className="action-secondary" onClick={() => exportToCSV(reportingRecords([], filtered))}><Download className="h-4 w-4 text-green-600" />Exportar movimentações CSV</button><button className="action-primary" onClick={() => generatePrintReport(reportingRecords([], filtered), { startDate: start, endDate: end, status })}><Printer className="h-4 w-4" />Imprimir movimentações</button><span className="self-center text-sm text-gray-500">{filtered.length} movimentações</span></div>
    </div>
    {loading ? <p role="status">Carregando movimentações…</p> : !filtered.length ? <div className="section-card text-center text-gray-500">Nenhuma movimentação para os filtros selecionados.</div> : <div className="grid gap-4 lg:grid-cols-2">{filtered.map(row => <article key={row.id} className="section-card space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold text-gray-900">{row.vehicle_plate}</p><p className="text-sm text-gray-500">#{row.short_code || '—'} · {row.operation_type}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === 'Em aberto' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{row.status}</span></div><p className="text-sm">{row.driver_name}</p><p className="text-sm text-gray-600">Saída: {formatDateBR(row.entry_date)} às {row.entry_time}</p><div className="flex flex-wrap gap-2"><button className="action-secondary" onClick={() => setSelected(row)}><Eye className="h-4 w-4" />Detalhes da movimentação</button><PrivatePhotos movementId={row.id} /></div></article>)}</div>}
    <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title="Detalhes da movimentação">{selected && <div className="space-y-5"><div className="rounded-xl border bg-gray-50 p-4"><h3 className="text-xl font-bold">{selected.vehicle_plate}</h3><p>{selected.driver_name} · {selected.operation_type}</p><p className="text-sm text-gray-500">Código {selected.short_code || '—'} · {selected.status}</p></div><div className="grid gap-4 sm:grid-cols-2"><div><h4 className="font-semibold">Saída do pátio</h4><p>{formatDateBR(selected.entry_date)} · {selected.entry_time}</p><p>{selected.entry_odometer} km · {selected.entry_fuel_level}</p><p className="whitespace-pre-wrap break-words text-sm text-gray-600">{selected.entry_observations || 'Sem observações de saída.'}</p></div><div><h4 className="font-semibold">Retorno ao pátio</h4><p>{formatDateBR(selected.exit_date)} · {selected.exit_time || '—'}</p><p>{selected.exit_odometer ?? '—'} km · {selected.exit_fuel_level || '—'}</p><p className="whitespace-pre-wrap break-words text-sm text-gray-600">{selected.exit_observations || 'Sem observações de retorno.'}</p></div></div><DepartureSummary checklist={selected.checklist} /><PrivatePhotos movementId={selected.id} /></div>}</Modal>
  </section>;
}
