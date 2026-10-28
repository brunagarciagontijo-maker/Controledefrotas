import { useCallback, useEffect, useMemo, useState } from 'react';
import { Car, ClipboardCheck, History, RefreshCw, Search, Package, Users, UserCheck, UserRound, Timer, ArrowLeft } from 'lucide-react';
import { availability, REQUIRED_PHOTO_ITEMS } from '../domain/portaria';
import { vehicleCatalogService } from '../services/vehicleCatalogService';
import { operationalService } from '../services/operationalService';
import { vehicleService } from '../services/vehicleService';
import { accessControlService } from '../services/accessControlService';
import type { FleetVehicle, OperationalMovement, PersonRecord, VehicleRecord, FuelLevel } from '../types/database';
import { CompanyDepartureForm } from './CompanyDepartureForm';
import { AccessControlView } from './AccessControlView';
import { DatabaseView } from './DatabaseView';
import { OperationalView } from './OperationalView';
import { MovementHistory } from './MovementHistory';
import {entryTarget}from'../domain/vehicleOperations';
import{PatioVehicles}from'./PatioVehicles';
import{VehicleForm}from'./VehicleForm';
import{TimelineView}from'./TimelineView';
import { DailyYard } from './DailyYard';
import { ParcelsView } from './ParcelsView';
import { Modal } from './Modal';
import { Input } from './Input';
import { toDateInputValue } from '../utils/date';
import { useAuth } from '../auth/context';
import { extractDevLookup } from '../lib/environment';
import { requireDevEnvironment } from '../lib/runtime';

export function UnifiedPortaria({ onSuccess, onError, initialVehicleLookup = '', initialAccessLookup = '', startWithForm = false }: {
  onSuccess: (message: string) => void; onError: (message: string) => void;
  initialVehicleLookup?: string; initialAccessLookup?: string; startWithForm?: boolean;
}) {
  const [tab, setTab] = useState(initialAccessLookup ? 'pessoas' : startWithForm ? 'saida' : 'veiculos');
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [drivers, setDrivers] = useState<PersonRecord[]>([]);
  const [movements, setMovements] = useState<OperationalMovement[]>([]);
  const [records, setRecords] = useState<VehicleRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const[legacyReturn,setLegacyReturn]=useState<VehicleRecord|null>(null);
  const [returning, setReturning] = useState<OperationalMovement | null>(null);
  const [returnKm, setReturnKm] = useState('');
  const [returnFuel, setReturnFuel] = useState<FuelLevel>('1/2');
  const [returnDate, setReturnDate] = useState(toDateInputValue(new Date()));
  const [returnTime, setReturnTime] = useState(new Date().toTimeString().slice(0, 5));
  const [returnNotes, setReturnNotes] = useState('');
  const [returnDriverId, setReturnDriverId] = useState('');
  const [returnPhotos, setReturnPhotos] = useState<File[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [checkNotes, setCheckNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { profile } = useAuth();
  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const [v, d, m, r] = await Promise.all([vehicleCatalogService.listVehicles(), accessControlService.listPeople(), operationalService.listMovements(), vehicleService.listRecords()]);
      setVehicles(v); setDrivers(d); setMovements(m); setRecords(r);
    } catch { setLoadError('Não foi possível verificar a disponibilidade. A saída está bloqueada; atualize a lista.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const states = useMemo(() => availability(vehicles, movements, records), [vehicles, movements, records]);
  const available = states.filter(row => row.available).map(row => row.vehicle);
  const selectLookup = useCallback((raw: string) => {
    try { setSearch(extractDevLookup(raw, ['veiculo', 'vehicle', 'codigo', 'code', 'qr'], requireDevEnvironment().appUrl)); setTab('veiculos'); }
    catch { onError('Código ou QR de outro ambiente recusado.'); }
  }, [onError]);
  useEffect(() => { if (initialVehicleLookup) selectLookup(initialVehicleLookup); }, [initialVehicleLookup, selectLookup]);
  const open = movements.filter(row => row.status === 'Em aberto');
  const refreshed = async (message: string) => { onSuccess(message); setSelected(null); setReturning(null); await load(); };
  const beginReturn = (row: OperationalMovement) => { setReturning(row); setReturnKm(String(row.entry_odometer)); setChecks({}); setCheckNotes({}); setReturnNotes(''); setReturnDriverId(row.driver_id || ''); setReturnPhotos([]); setReturnDate(toDateInputValue(new Date())); setReturnTime(new Date().toTimeString().slice(0, 5)); };
  const returnVehicle = async () => {
    if (!returning || REQUIRED_PHOTO_ITEMS.some(item => !checks[item.key]) || !returnKm || !returnDate || !returnTime) return;
    setBusy(true);
    try {
      const returnDriver=drivers.find(driver=>driver.id===returnDriverId);
      const observations=[returnDriver?`Motorista na entrada: ${returnDriver.name}.`:'',returnNotes].filter(Boolean).join('\n');
      await operationalService.closeMovement(returning.id, { exit_date: returnDate, exit_time: returnTime, exit_odometer: Number(returnKm), exit_fuel_level: returnFuel, exit_observations: observations, checklist: { ...(returning.checklist as object), entry: Object.fromEntries(REQUIRED_PHOTO_ITEMS.map(item => [item.key, { ok: true, note: checkNotes[item.key] || '' }])) } }, returnPhotos);
      await refreshed('Entrada do veículo registrada.');
    } catch { onError('Não foi possível confirmar o retorno. Confira os dados e o histórico antes de repetir.'); }
    finally { setBusy(false); }
  };
  const registerEntry=async(id:string,plate:string)=>{if(busy)return;setBusy(true);try{const[v,m,r,d]=await Promise.all([vehicleCatalogService.listVehicles(),operationalService.listMovements(),vehicleService.listRecords(),accessControlService.listPeople()]);setVehicles(v);setMovements(m);setRecords(r);setDrivers(d);const target=entryTarget(id,plate,v,m,r);if(target.kind==='movement')beginReturn(target.row);else if(target.kind==='legacy')setLegacyReturn(target.row);else onError(target.message);}catch{onError('Falha ao conferir a saida atual. Nenhuma entrada foi criada.');}finally{setBusy(false);}};
  const tabs = [
    { key: 'veiculos', label: 'Veículos', Icon: Car }, { key: 'pessoas', label: 'Pessoas', Icon: Users },
    { key: 'disponiveis', label: 'Conferência diária', Icon: ClipboardCheck }, {key:'encomendas',label:'Encomendas',Icon:Package}, { key: 'historico', label: 'Histórico', Icon: History },
    ...(profile?.role === 'admin' ? [{ key: 'funcionarios', label: 'Funcionários', Icon: UserCheck }, { key: 'motoristas', label: 'Motoristas', Icon: UserRound }] : []),
    { key: 'timeline', label: 'Timeline', Icon: Timer },
  ];
  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl"><ClipboardCheck className="h-7 w-7 text-red-600" />Portaria</h2><p className="mt-2 text-sm text-gray-600 sm:text-base">Retirada e devolução, acesso de pessoas e conferência do pátio.</p></div><button className="action-secondary" onClick={() => void load()}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar lista</button></div>
    <><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ['Em aberto', open.length + records.filter(row => row.status === 'Em uso').length, 'text-red-600'], ['No pátio', available.length, 'text-green-600'],
      ['Em obra', open.filter(row => row.operation_type === 'Obras').length, 'text-amber-600'], ['Motoristas ativos', drivers.filter(row => row.is_driver && row.is_active).length, 'text-blue-600'],
    ].map(([label, value, color]) => <div key={label} className="glass rounded-2xl p-4 shadow-premium sm:p-5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p></div>)}</div>
    <nav aria-label="Fluxos da portaria" className="flex flex-wrap gap-2">{tabs.map(({ key, label, Icon }) => <button key={key} onClick={() => { setTab(key); setSelected(null); }} aria-pressed={tab === key || tab === 'saida' && key === 'veiculos'} className={tab === key || tab === 'saida' && key === 'veiculos' ? 'section-tab-active' : 'section-tab'}><Icon className="h-4 w-4 shrink-0" />{label}</button>)}</nav></>
    {loading && <p role="status" className="rounded-xl bg-white/80 p-3 text-sm">Conferindo disponibilidade…</p>}
    {loadError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{loadError}</p>}
    {tab === 'veiculos' && <div className="section-card flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-semibold"><span className="flex items-center gap-2"><Search className="h-4 w-4 text-red-600" />Buscar veículo no pátio</span><input className="form-select mt-1" placeholder="Código, placa, veículo ou responsável" value={search} onChange={e => setSearch(e.target.value)} /></label>{search && <button className="action-secondary" onClick={() => setSearch('')}>Limpar busca</button>}</div>}
    {tab === 'pessoas' && <AccessControlView initialLookup={initialAccessLookup} onSuccess={onSuccess} onError={onError} />}
    {(tab === 'saida' || (tab === 'veiculos' && selected)) && <><button className="action-secondary" onClick={() => { setSelected(null); setTab('veiculos'); }}><ArrowLeft className="h-4 w-4" />Voltar aos veículos</button>{!loading && !loadError && <CompanyDepartureForm key={selected || 'nova'} vehicles={available} drivers={drivers} initialVehicleId={selected || ''} onError={onError} onSuccess={() => { setTab('veiculos'); void refreshed('Saída registrada com sucesso.'); }} />}</>}
    {tab === 'veiculos' && !selected && <PatioVehicles vehicles={vehicles} movements={movements} records={records} search={search} blocked={loading||Boolean(loadError)||busy} onDeparture={setSelected} onEntry={(id,plate)=>void registerEntry(id,plate)}/>}
    {tab === 'disponiveis' && <DailyYard onError={onError} onSuccess={onSuccess} onRegisterEntry={(id,plate)=>void registerEntry(id,plate)}/>}
    {tab === 'encomendas' && <ParcelsView onError={onError} onSuccess={onSuccess} />}
    {tab === 'historico' && <div className="space-y-6"><MovementHistory onError={onError} refreshTrigger={movements.length} /><h3 className="text-xl font-bold">Registros anteriores — preservados</h3><DatabaseView onSuccess={onSuccess} onError={onError} refreshTrigger={movements.length} /></div>}
    {['funcionarios', 'motoristas'].includes(tab) && <OperationalView key={tab} embedded initialTab={tab as 'funcionarios' | 'motoristas' | 'timeline'} onSuccess={onSuccess} onError={onError} />}
    {tab==='timeline'&&<TimelineView onError={onError}/>}
    <Modal isOpen={Boolean(legacyReturn)} onClose={()=>setLegacyReturn(null)} title="Registrar Devolucao" size="xl">{legacyReturn&&<VehicleForm editData={{...legacyReturn,return_date:legacyReturn.return_date||undefined,return_time:legacyReturn.return_time||undefined,return_name:legacyReturn.return_name||undefined,return_signature:legacyReturn.return_signature||undefined,observations:legacyReturn.observations||undefined}} onSuccess={()=>{setLegacyReturn(null);void refreshed('Entrada registrada.');}} onError={onError}/>}</Modal>
    <Modal isOpen={Boolean(returning)} onClose={() => !busy && setReturning(null)} title="Entrada do veículo"><div className="space-y-5"><div className="rounded-xl bg-gray-50 p-4"><p className="font-bold">{returning?.vehicle_plate}</p><p className="text-sm text-gray-600">Motorista da saída: {returning?.driver_name}</p></div><label className="block text-sm font-semibold">Motorista na entrada<select className="form-select mt-1" value={returnDriverId} onChange={e => setReturnDriverId(e.target.value)}><option value="">Não informado</option>{drivers.filter(driver => driver.is_driver && (driver.is_active || driver.id === returning?.driver_id)).map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-gray-500">Registrado nas observações da entrada, preservando o motorista da saída.</span></label><div className="grid gap-4 sm:grid-cols-2"><Input label="Data de entrada" type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} /><Input label="Hora de entrada" type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} /><Input label="Odômetro de entrada" type="number" min={returning?.entry_odometer || 0} value={returnKm} onChange={e => setReturnKm(e.target.value)} /><label className="text-sm font-semibold">Combustível<select className="form-select mt-1" value={returnFuel} onChange={e => setReturnFuel(e.target.value as FuelLevel)}>{['Reserva', '1/4', '1/2', '3/4', 'Cheio'].map(v => <option key={v}>{v}</option>)}</select></label></div><h3 className="font-bold">Checklist de entrada</h3>{REQUIRED_PHOTO_ITEMS.map(item => <div key={item.key} className="rounded-xl border bg-gray-50 p-3"><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={Boolean(checks[item.key])} onChange={e => setChecks({ ...checks, [item.key]: e.target.checked })} />{item.label}</label><input aria-label={`Observação: ${item.label}`} className="form-select mt-2" placeholder="Observação do item (opcional)" value={checkNotes[item.key] || ''} onChange={e => setCheckNotes({ ...checkNotes, [item.key]: e.target.value })} /></div>)}<label className="block text-sm font-semibold">Observações de entrada<textarea className="form-select mt-1" value={returnNotes} onChange={e => setReturnNotes(e.target.value)} rows={3} /></label><label className="block text-sm font-semibold">Fotos de entrada (opcionais)<input className="mt-2 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" multiple onChange={e => setReturnPhotos(Array.from(e.target.files || []))} /></label><div className="flex flex-wrap gap-3"><button disabled={busy} className="action-secondary flex-1" onClick={() => setReturning(null)}>Cancelar</button><button disabled={busy || !returnKm || !returnDate || !returnTime || Number(returnKm) < (returning?.entry_odometer || 0) || REQUIRED_PHOTO_ITEMS.some(item => !checks[item.key])} className="action-primary flex-1" onClick={() => void returnVehicle()}>Confirmar entrada</button></div></div></Modal>
  </section>;
}
