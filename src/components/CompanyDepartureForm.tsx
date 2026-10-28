import { useMemo, useState, type FormEvent } from 'react';
import { Car, ClipboardCheck, Save, ShieldCheck } from 'lucide-react';
import type { FleetVehicle, FuelLevel, PersonRecord } from '../types/database';
import { validateEvidenceFiles, validateDepartureSignature, type EvidenceFiles, type DepartureDecision } from '../domain/portaria';
import { portariaService } from '../services/portariaService';
import { Input } from './Input';
import { PhotoChecklistCapture } from './PhotoChecklistCapture';
import { SignaturePad } from './SignaturePad';
import { toDateInputValue } from '../utils/date';

export function CompanyDepartureForm({ vehicles, drivers, initialVehicleId = '', onSuccess, onError }: {
  vehicles: FleetVehicle[]; drivers: PersonRecord[]; initialVehicleId?: string;
  onSuccess: () => void; onError: (message: string) => void;
}) {
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [driverId, setDriverId] = useState('');
  const [odometer, setOdometer] = useState('');
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [observations, setObservations] = useState('');
  const [operationReason, setOperationReason] = useState('');
  const [authorizationNote, setAuthorizationNote] = useState('');
  const [signature, setSignature] = useState('');
  const [fuel, setFuel] = useState<FuelLevel>('1/2');
  const [operation, setOperation] = useState<'Obras' | 'Trajeto curto' | 'Viagem'>('Obras');
  const [decision, setDecision] = useState<DepartureDecision>({ cobliAssociated: null, driverReason: '' });
  const [files, setFiles] = useState<EvidenceFiles>({});
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const issues = useMemo(() => [...validateEvidenceFiles(decision, files), ...validateDepartureSignature(signature)], [decision, files, signature]);
  const vehicle = vehicles.find(row => row.id === vehicleId);
  const eligibleDrivers = drivers.filter(row => row.is_active && row.is_driver && (!vehicle?.fixed_driver_name?.trim() || row.name.trim().toLowerCase() === vehicle.fixed_driver_name.trim().toLowerCase()));
  const driver = eligibleDrivers.find(row => row.id === driverId);
  const resetEvidence = () => { setDecision({ cobliAssociated: null, driverReason: '' }); setFiles({}); setSignature(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!vehicle || !driver || issues.length || !date || !time || !odometer.trim() || !Number.isFinite(Number(odometer)) || Number(odometer) < 0) { onError(issues[0] || 'Selecione veículo, motorista, data, hora e odômetro válido.'); return; }
    setBusy(true); setAttempted(true);
    try {
      await portariaService.depart({ vehicle_id: vehicle.id, vehicle_plate: vehicle.plate, operation_type: operation, driver_id: driver.id, driver_name: driver.name, driver_cnh_number: driver.cnh_number, driver_cnh_valid_until: driver.cnh_valid_until, entry_date: date, entry_time: time, entry_odometer: Number(odometer), entry_fuel_level: fuel, entry_observations: observations, checklist: {operation_reason:operationReason,authorization_note:authorizationNote} }, decision, files, requestId, signature);
      onSuccess();
    } catch { onError('Saída não confirmada. Confira o histórico antes de iniciar outra tentativa.'); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="section-card space-y-6">
    <div className="flex items-center gap-3 border-b border-gray-100 pb-5"><span className="rounded-xl bg-red-100 p-3"><Car className="h-6 w-6 text-red-600" /></span><div><h2 className="text-xl font-bold text-gray-900">Saída de veículo da empresa</h2><p className="mt-1 text-sm text-gray-500">Identificação, conferência Cobli e assinatura do responsável.</p></div></div>
    <fieldset disabled={busy || attempted} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-gray-700">Veículo<select aria-label="Veículo da saída" required value={vehicleId} onChange={e => { setVehicleId(e.target.value); setDriverId(''); resetEvidence(); }} className="form-select mt-2"><option value="">Selecione um disponível</option>{vehicles.map(row => <option key={row.id} value={row.id}>{row.short_code} · {row.plate} · {row.name}</option>)}</select></label><label className="text-sm font-semibold text-gray-700">Motorista<select aria-label="Motorista da saída" required value={driverId} onChange={e => { setDriverId(e.target.value); resetEvidence(); }} className="form-select mt-2"><option value="">Selecione o motorista</option>{eligibleDrivers.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label></div>
      {vehicle && <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><span>Código <strong>{vehicle.short_code}</strong></span><span>Responsável: <strong>{vehicle.responsible_name || 'Não informado'}</strong></span><span>Uso: <strong>{vehicle.usage_type}</strong></span>{vehicle.fixed_driver_name && <span>Condutor fixo: <strong>{vehicle.fixed_driver_name}</strong></span>}</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Input label="Data de saída" type="date" required value={date} onChange={e => setDate(e.target.value)} /><Input label="Hora de saída" type="time" required value={time} onChange={e => setTime(e.target.value)} /><Input label="Odômetro de saída" type="number" min="0" required value={odometer} onChange={e => setOdometer(e.target.value)} /><label className="text-sm font-semibold text-gray-700">Combustível<select className="form-select mt-2" value={fuel} onChange={e => setFuel(e.target.value as FuelLevel)}>{['Reserva', '1/4', '1/2', '3/4', 'Cheio'].map(v => <option key={v}>{v}</option>)}</select></label><label className="text-sm font-semibold text-gray-700">Operação<select className="form-select mt-2" value={operation} onChange={e => setOperation(e.target.value as typeof operation)}>{['Obras', 'Trajeto curto', 'Viagem'].map(v => <option key={v}>{v}</option>)}</select></label></div>
      <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5"><h3 className="flex items-center gap-2 font-bold text-amber-950"><ShieldCheck className="h-5 w-5" />Associação no Cobli</h3><p className="text-sm text-amber-950">Confira o motorista e este veículo no Cobli. A confirmação é manual; não há consulta automática.</p><div className="grid gap-3 sm:grid-cols-2">{[true, false].map(value => <label key={String(value)} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm font-semibold ${decision.cobliAssociated === value ? 'border-red-400 bg-white text-red-800 shadow-sm' : 'border-amber-200 bg-white/70 text-gray-700'}`}><input type="radio" name="cobli" checked={decision.cobliAssociated === value} onChange={() => { setDecision({ ...decision, cobliAssociated: value }); setFiles({}); }} />{value ? 'Motorista associado' : 'Motorista não associado'}</label>)}</div></section>
      {decision.cobliAssociated === false && <section className="space-y-4"><h3 className="flex items-center gap-2 font-bold"><ClipboardCheck className="h-5 w-5 text-red-600" />Checklist fotográfico obrigatório</h3><Input label="Motivo informado pelo motorista" required value={decision.driverReason} onChange={e => setDecision({ ...decision, driverReason: e.target.value })} /><p className="text-sm text-gray-600">Fotografe cada um dos seis itens. A saída só é concluída com todas as fotos.</p><PhotoChecklistCapture key={driverId + vehicleId} files={files} onChange={setFiles} /></section>}
      <details className="rounded-xl border border-gray-200 bg-gray-50 p-4"><summary className="cursor-pointer text-sm font-semibold text-gray-700">Motivo e autorização (informações complementares)</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><Input label="Motivo da utilização" maxLength={2000} value={operationReason} onChange={e=>setOperationReason(e.target.value)} /><Input label="Autorização informada" maxLength={2000} value={authorizationNote} onChange={e=>setAuthorizationNote(e.target.value)} /></div><p className="mt-3 text-xs text-gray-500">Essas informações não substituem a conferência Cobli, a assinatura ou a permissão do operador.</p></details>
      <label className="block text-sm font-semibold text-gray-700">Observações de saída<textarea className="form-select mt-2" rows={3} value={observations} onChange={e => setObservations(e.target.value)} placeholder="Destino ou informações adicionais da operação" /></label>
      <SignaturePad label="Assinatura do responsável pela saída" format="image/png" required value={signature} onChange={setSignature} disabled={busy || attempted} />
    </fieldset>
    {attempted && !busy && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">Confira o histórico e atualize a lista antes de iniciar outra tentativa. O formulário foi bloqueado para evitar duplicidade.</p>}
    {!attempted && issues.length > 0 && <p className="text-sm text-gray-600">{issues[0]}</p>}
    <button disabled={busy || attempted || issues.length > 0 || !vehicle || !driver || !odometer || !date || !time} className="action-primary w-full py-4"><Save className="h-5 w-5" />{busy ? 'Confirmando saída…' : 'Confirmar saída'}</button>
  </form>;
}
