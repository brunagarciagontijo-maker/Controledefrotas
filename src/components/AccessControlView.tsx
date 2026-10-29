import { reportError } from '../utils/diagnostics';
import { extractDevLookup } from '../lib/environment';
import { requireDevEnvironment } from '../lib/runtime';
import { FormEvent, useEffect, useMemo, useState, useCallback } from 'react';
import {
  Building2,
  CalendarDays,
  DoorOpen,
  FileText,
  ListFilter,
  LogOut,
  Plus,
  QrCode,
  Search,
  Truck,
  UserRoundPlus,
} from 'lucide-react';
import { Input } from './Input';
import { Modal } from './Modal';
import { Textarea } from './Textarea';
import { BarcodeScanner } from './BarcodeScanner';
import { CameraCapture } from './CameraCapture';
import { validatePersonEntry } from '../domain/portaria';
import { accessControlService } from '../services/accessControlService';
import { vehicleCatalogService } from '../services/vehicleCatalogService';
import { formatDateBR, toDateInputValue } from '../utils/date';
import type { AccessRecord, AccessStatus, FleetVehicle, PersonalVehicle, PersonRecord, PersonType } from '../types/database';

interface AccessControlViewProps {
  initialLookup?: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

type AccessTab = 'entrada' | 'historico';
type EntryKind = 'Funcionario' | 'Visitante' | 'Terceirizado';

const PERSON_TYPES: PersonType[] = ['Funcionario', 'Terceirizado', 'Visitante'];
const TRANSVELENTIM_ALIASES = ['transvelentim', 'transvalentim'];

function getCurrentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function normalizeLookup(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function isTransvelentimText(value?: string | null) {
  const normalized = normalizeLookup(value || '');
  return TRANSVELENTIM_ALIASES.some((alias) => normalized.includes(alias));
}

function extractLookupValue(value: string) {
  return extractDevLookup(value, ["pessoa","person","veiculo_pessoal","personal_vehicle","codigo","code"], requireDevEnvironment().appUrl);
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  const tones = {
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    success: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    danger: 'bg-red-100 text-red-700 border-red-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
  } as const;

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-max items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
        active ? 'bg-red-600 text-white shadow-md' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function AccessControlView({ initialLookup = '', onSuccess, onError }: AccessControlViewProps) {
  const [activeTab, setActiveTab] = useState<AccessTab>('entrada');
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [vehicles, setVehicles] = useState<PersonalVehicle[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [entryKind, setEntryKind] = useState<EntryKind>('Funcionario');
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [selectedHostId, setSelectedHostId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [manualPlate, setManualPlate] = useState('');
  const [reason, setReason] = useState('');
  const [externalName, setExternalName] = useState('');
  const [externalDocument, setExternalDocument] = useState('');
  const [externalCompany, setExternalCompany] = useState('');
  const [transvelentimMode, setTransvelentimMode] = useState(false);
  const [entryDate, setEntryDate] = useState(toDateInputValue(new Date()));
  const [entryTime, setEntryTime] = useState(getCurrentTimeValue());
  const [observations, setObservations] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentCaptured,setDocumentCaptured]=useState(false);
  useEffect(()=>{setDocumentFile(null);setDocumentCaptured(false);setReason('');},[entryKind]);
  const [savingEntry, setSavingEntry] = useState(false);

  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<PersonType | 'Todos'>('Todos');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<AccessStatus | 'Todos'>('Todos');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [peopleData, vehicleData, fleetVehicleData, recordData] = await Promise.all([
        accessControlService.listPeople(),
        accessControlService.listPersonalVehicles(),
        vehicleCatalogService.listVehicles(),
        accessControlService.listAccessRecords(),
      ]);
      setPeople(peopleData);
      setVehicles(vehicleData);
      setFleetVehicles(fleetVehicleData);
      setRecords(recordData);
    } catch (error) {
      reportError('Erro ao carregar portaria:', error);
      onError('Erro ao carregar dados da portaria');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadData();
  }, [loadData]);



  const activePeople = useMemo(() => people.filter((person) => person.is_active), [people]);
  const internalPeople = useMemo(
    () => activePeople.filter((person) => person.person_type === 'Funcionario'),
    [activePeople]
  );
  const selectedPerson = useMemo(() => people.find((person) => person.id === selectedPersonId) || null, [people, selectedPersonId]);
  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || null, [vehicles, selectedVehicleId]);
  const openRecords = useMemo(() => records.filter((record) => record.status === 'Em aberto'), [records]);
  const transvelentimVehicles = useMemo(
    () =>
      fleetVehicles.filter(
        (vehicle) =>
          vehicle.status === 'Ativo' &&
          [vehicle.responsible_name, vehicle.fixed_driver_name, vehicle.name, vehicle.plate].some(isTransvelentimText)
      ),
    [fleetVehicles]
  );

  const personVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.is_active && vehicle.person_id === selectedPersonId),
    [selectedPersonId, vehicles]
  );

  const entryPeople = useMemo(() => {
    const search = normalizeLookup(personSearch);
    return activePeople.filter((person) => {
      if (person.person_type !== 'Funcionario') return false;
      if (!search) return true;
      return [person.short_code, person.name, person.document_number || '', person.phone || ''].some((value) =>
        normalizeLookup(value).includes(search)
      );
    });
  }, [activePeople, personSearch]);

  const filteredHistory = useMemo(() => {
    const search = normalizeLookup(historySearch);
    return records.filter((record) => {
      const matchesSearch =
        !search ||
        [record.short_code, record.person_name, record.host_person_name, record.vehicle_plate || '', record.reason || ''].some((value) =>
          normalizeLookup(value).includes(search)
        );
      const matchesType = historyTypeFilter === 'Todos' || record.person_type === historyTypeFilter;
      const matchesStatus = historyStatusFilter === 'Todos' || record.status === historyStatusFilter;
      const matchesStart = !historyStartDate || record.entry_date >= historyStartDate;
      const matchesEnd = !historyEndDate || record.entry_date <= historyEndDate;
      return matchesSearch && matchesType && matchesStatus && matchesStart && matchesEnd;
    });
  }, [historyEndDate, historySearch, historyStartDate, historyStatusFilter, historyTypeFilter, records]);

  const handleLookup = useCallback((rawValue: string) => {
    let lookup: string;
    try { lookup = normalizeLookup(extractLookupValue(rawValue)); } catch { onError('QR Code fora do ambiente DEV.'); return; }
    if (!lookup) return;

    const vehicle = vehicles.find((item) =>
      [item.short_code, item.plate].some((value) => normalizeLookup(value).includes(lookup) || lookup.includes(normalizeLookup(value)))
    );

    if (vehicle) {
      setEntryKind('Funcionario');
      setSelectedVehicleId(vehicle.id);
      setSelectedPersonId(vehicle.person_id);
      setManualPlate(vehicle.plate);
      setPersonSearch(vehicle.person?.name || vehicle.plate);
      setActiveTab('entrada');
      return;
    }

    const person = people.find((item) =>
      [item.short_code, item.name, item.document_number || ''].some((value) =>
        normalizeLookup(value).includes(lookup) || lookup.includes(normalizeLookup(value))
      )
    );

    if (person?.is_active) {
      setEntryKind(person.person_type === 'Funcionario' ? 'Funcionario' : person.person_type);
      setSelectedPersonId(person.id);
      setPersonSearch(person.name);
      setActiveTab('entrada');
    }
  }, [vehicles, people, onError]);

  useEffect(() => {
    if (initialLookup && people.length > 0) {
      handleLookup(initialLookup);
    }
  }, [initialLookup, people.length, handleLookup]);

  const resetEntryForm = () => {
    setEntryKind('Funcionario');
    setPersonSearch('');
    setSelectedPersonId('');
    setSelectedHostId('');
    setSelectedVehicleId('');
    setManualPlate('');
    setReason('');
    setExternalName('');
    setExternalDocument('');
    setExternalCompany('');
    setTransvelentimMode(false);
    setEntryDate(toDateInputValue(new Date()));
    setEntryTime(getCurrentTimeValue());
    setObservations('');
    setDocumentFile(null);
    setDocumentCaptured(false);
  };

  const handleEntrySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const host = selectedHostId ? people.find((person) => person.id === selectedHostId) : null;

    const validation=validatePersonEntry(entryKind,reason,documentFile,documentCaptured);
    if(validation.length){onError(validation[0]);return;}

    try {
      setSavingEntry(true);
      let accessPerson = selectedPerson;
      let accessVehicle = selectedVehicle;

      if (entryKind === 'Funcionario') {
        if (!accessPerson) {
          onError('Selecione o funcionario que esta entrando');
          return;
        }

        if (!accessPerson.is_active) {
          onError('Funcionario inativo nao pode registrar nova entrada');
          return;
        }
      } else {
        if (!externalName.trim()) {
          onError(`Informe o nome do ${entryKind.toLowerCase()}`);
          return;
        }

        if (!host) {
          onError('Selecione o funcionario responsavel');
          return;
        }

        if (!documentFile) {
          onError(`Anexe ou tire foto do documento do ${entryKind.toLowerCase()}`);
          return;
        }

        const normalizedDocument = normalizeLookup(externalDocument);
        const normalizedName = normalizeLookup(externalName);
        const existingPerson = people.find((person) => {
          if (person.person_type !== entryKind) return false;
          if (normalizedDocument && normalizeLookup(person.document_number || '') === normalizedDocument) return true;
          return normalizeLookup(person.name) === normalizedName;
        });

        accessPerson =
          existingPerson ||
          (await accessControlService.createPerson({
            person_type: entryKind,
            name: externalName,
            document_number: externalDocument,
            company: externalCompany,
            notes: 'Cadastro criado pela portaria no registro de entrada',
            origin: 'manual',
            is_active: true,
          }));
        accessVehicle = null;
      }

      await accessControlService.createAccessRecord(
        {
          person_id: accessPerson.id,
          person_name: accessPerson.name,
          person_type: accessPerson.person_type,
          host_person_id: host?.id || null,
          host_person_name: host?.name || '',
          personal_vehicle_id: accessVehicle?.id || null,
          vehicle_plate: accessVehicle?.plate || manualPlate,
          reason: entryKind === 'Funcionario' ? '' : reason,
          entry_date: entryDate,
          entry_time: entryTime,
          observations,
        },
        documentFile,
        documentCaptured
      );
      onSuccess('Entrada registrada com sucesso');
      resetEntryForm();
      await loadData();
    } catch (error) {
      reportError('Erro ao registrar entrada:', error);
      onError('Erro ao registrar entrada');
    } finally {
      setSavingEntry(false);
    }
  };

  const handleCloseRecord = async (record: AccessRecord) => {
    try {
      await accessControlService.closeAccessRecord(record.id, toDateInputValue(new Date()), getCurrentTimeValue());
      onSuccess('Saida registrada com sucesso');
      await loadData();
    } catch (error) {
      reportError('Erro ao registrar saida:', error);
      onError('Erro ao registrar saida');
    }
  };

  const openDocument = async (record: AccessRecord) => {
    if (!record.document_file_path) return;
    const newTab = window.open('', '_blank', 'noopener,noreferrer');
    try {
      const url = await accessControlService.getAccessDocumentUrl(record.document_file_path);
      if (newTab) {
        newTab.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      newTab?.close();
      reportError('Erro ao abrir documento:', error);
      onError('Documento indisponivel');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-premium-colored">
          <DoorOpen className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Portaria</h2>
          <p className="text-gray-600">Controle de entrada, saida, visitantes e terceirizados</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <TabButton active={activeTab === 'entrada'} onClick={() => setActiveTab('entrada')} icon={<DoorOpen className="w-4 h-4" />} label="Entrada" />
        <TabButton active={activeTab === 'historico'} onClick={() => setActiveTab('historico')} icon={<CalendarDays className="w-4 h-4" />} label="Historico" />
      </div>

      {activeTab === 'entrada' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <section className="xl:col-span-2 glass rounded-2xl p-6 shadow-premium">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-gray-900">Registrar entrada</h3>
              </div>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <QrCode className="w-4 h-4" />
                QR
              </button>
            </div>

            <form onSubmit={handleEntrySubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Tipo de entrada *</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { kind: 'Visitante' as EntryKind, label: 'Visitante', icon: <UserRoundPlus className="w-4 h-4" /> },
                    { kind: 'Terceirizado' as EntryKind, label: 'Terceiro', icon: <Building2 className="w-4 h-4" /> },
                    { kind: 'Funcionario' as EntryKind, label: 'Funcionario', icon: <DoorOpen className="w-4 h-4" /> },
                  ]).map(({ kind, label, icon }) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        setEntryKind(kind);
                        setPersonSearch('');
                        setSelectedPersonId('');
                        setSelectedVehicleId('');
                        setManualPlate('');
                        setDocumentFile(null);
                        setTransvelentimMode(false);
                      }}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition-all ${
                        entryKind === kind ? 'bg-red-600 text-white border-transparent shadow-md' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
                {entryKind === 'Visitante' && (
                  <p className="text-xs text-gray-500">
                    Serve para visitante de carro (informe a placa) ou a pe (deixe a placa em branco).
                  </p>
                )}
              </div>

              {entryKind === 'Funcionario' ? (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Funcionario que esta entrando *</label>
                <input
                  value={personSearch}
                  onChange={(event) => {
                    setPersonSearch(event.target.value);
                    setSelectedPersonId('');
                  }}
                  placeholder="Buscar por nome, documento ou codigo"
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
                <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                  {!personSearch.trim() ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      Digite parte do nome, documento, CNH ou codigo para buscar.
                    </div>
                  ) : entryPeople.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      Nenhuma pessoa encontrada para essa busca.
                    </div>
                  ) : (
                    entryPeople.slice(0, 12).map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => {
                          setSelectedPersonId(person.id);
                          setPersonSearch(person.name);
                        }}
                        className={`block w-full px-4 py-3 text-left hover:bg-red-50 ${selectedPersonId === person.id ? 'bg-red-50' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-gray-900">{person.name}</span>
                          <Badge tone={person.person_type === 'Visitante' ? 'warning' : person.person_type === 'Terceirizado' ? 'info' : 'success'}>
                            {person.person_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500">Codigo {person.short_code}{person.document_number ? ` | Doc ${person.document_number}` : ''}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                  {entryKind === 'Terceirizado' && (
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="grid gap-4 bg-slate-950 p-4 text-white sm:grid-cols-[1fr_auto] sm:items-center">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-white/10 p-2">
                            <Building2 className="h-5 w-5 text-cyan-200" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">Terceirizado frequente</p>
                            <h4 className="text-lg font-bold leading-tight">Transvalentim</h4>
                            <p className="mt-1 text-sm text-slate-300">Motorista variável, munck selecionado na entrada.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextMode = !transvelentimMode;
                            setTransvelentimMode(nextMode);
                            if (nextMode) {
                              setExternalCompany('Transvalentim');
                              setReason((current) => current || 'Serviço com munck');
                            } else {
                              setManualPlate('');
                            }
                          }}
                          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                            transvelentimMode
                              ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
                              : 'bg-white text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          <Truck className="h-4 w-4" />
                          {transvelentimMode ? 'Modo ativo' : 'Usar Transvalentim'}
                        </button>
                      </div>

                      {transvelentimMode && (
                        <div className="space-y-4 p-4">
                          <div className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900">Muncks cadastrados</p>
                                <p className="text-xs text-gray-500">{transvelentimVehicles.length} placa(s) encontrada(s)</p>
                              </div>
                              <span className="self-start sm:self-auto">
                                <Badge tone={manualPlate ? 'success' : 'info'}>{manualPlate || 'Selecione'}</Badge>
                              </span>
                            </div>

                            {transvelentimVehicles.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-cyan-300 bg-cyan-50 p-4 text-sm text-cyan-900">
                                Cadastre as placas com nome ou responsável contendo Transvalentim para aparecerem aqui.
                              </div>
                            ) : (
                              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                {transvelentimVehicles.map((vehicle) => (
                                  <button
                                    key={vehicle.id}
                                    type="button"
                                    onClick={() => setManualPlate(vehicle.plate)}
                                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all ${
                                      manualPlate === vehicle.plate
                                        ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100'
                                        : 'border-gray-200 bg-gray-50 hover:border-cyan-300 hover:bg-white'
                                    }`}
                                  >
                                    <span className="min-w-0">
                                      <span className="block text-base font-black text-gray-900">{vehicle.plate}</span>
                                      <span className="block truncate text-xs text-gray-600">{vehicle.name}</span>
                                    </span>
                                    <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-gray-500">
                                      {vehicle.short_code || '-----'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <UserRoundPlus className="h-4 w-4 text-cyan-700" />
                              <p className="text-sm font-bold text-gray-900">Motorista do dia</p>
                            </div>
                            <Input
                              label="Nome do motorista"
                              value={externalName}
                              onChange={(event) => setExternalName(event.target.value)}
                              placeholder="Ex: João da Silva"
                              required
                            />
                            <p className="mt-3 text-xs text-gray-500">O nome fica registrado na entrada sem vincular motorista fixo à placa.</p>
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  <div>
                    <h4 className="font-bold text-gray-900">
                      Dados do {entryKind === 'Visitante' ? 'visitante' : 'terceirizado'}
                    </h4>
                    <p className="text-xs text-gray-500">
                      Preencha no momento da entrada, como em portaria de empresa.
                    </p>
                  </div>

                  {!(entryKind === 'Terceirizado' && transvelentimMode) && (
                    <Input
                      label="Nome da pessoa"
                      value={externalName}
                      onChange={(event) => setExternalName(event.target.value)}
                      placeholder={entryKind === 'Visitante' ? 'Ex: Maria Silva' : 'Ex: Tecnico da empresa terceira'}
                      required
                    />
                  )}

                  <Input
                    label="CPF/RG"
                    value={externalDocument}
                    onChange={(event) => setExternalDocument(event.target.value)}
                    placeholder="Documento apresentado"
                  />

                  {entryKind === 'Terceirizado' && (
                    <Input
                      label="Empresa"
                      value={externalCompany}
                      onChange={(event) => setExternalCompany(event.target.value)}
                      placeholder="Empresa terceirizada"
                    />
                  )}
                </div>
              )}

              {entryKind !== 'Funcionario' && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Funcionario responsavel *</label>
                  <select
                    value={selectedHostId}
                    onChange={(event) => setSelectedHostId(event.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  >
                    <option value="">Selecione</option>
                    {internalPeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.short_code} - {person.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Data de entrada" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required />
                <Input label="Hora de entrada" type="time" value={entryTime} onChange={(event) => setEntryTime(event.target.value)} required />
              </div>

              {entryKind === 'Funcionario' && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Veiculo pessoal cadastrado</label>
                  <select
                    value={selectedVehicleId}
                    onChange={(event) => {
                      const vehicle = vehicles.find((item) => item.id === event.target.value);
                      setSelectedVehicleId(event.target.value);
                      setManualPlate(vehicle?.plate || manualPlate);
                    }}
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  >
                    <option value="">Sem veiculo cadastrado</option>
                    {personVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.short_code} - {vehicle.plate}{vehicle.name ? ` - ${vehicle.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Input
                label={entryKind === 'Funcionario' ? 'Placa manual' : 'Placa do veiculo'}
                value={manualPlate}
                onChange={(event) => setManualPlate(event.target.value.toUpperCase())}
                placeholder={entryKind === 'Funcionario' ? 'Opcional' : 'Opcional se entrar com veiculo'}
              />

              {entryKind !== 'Funcionario' && <Input
                label="Motivo da visita"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ex: visita, manutencao, entrega"
                required
              />}

              {entryKind !== 'Funcionario' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <FileText className="w-4 h-4" />
                    Documento do {entryKind === 'Visitante' ? 'visitante' : 'terceirizado'} *
                  </div>
                  <CameraCapture key={entryKind} label="Foto do documento" captured={documentCaptured} onCapture={file=>{setDocumentFile(file);setDocumentCaptured(true);}} />
                  {entryKind==='Terceirizado'&&<label className="block text-sm">Ou anexar documento (PDF/imagem)<input className="mt-2 block w-full" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={event=>{setDocumentFile(event.target.files?.[0]||null);setDocumentCaptured(false);}}/></label>}
                </div>
              )}

              <Textarea label="Observacoes" value={observations} onChange={(event) => setObservations(event.target.value)} rows={3} />

              <button
                type="submit"
                disabled={savingEntry}
                className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {savingEntry ? 'Registrando...' : 'Registrar entrada'}
              </button>
            </form>
          </section>

          <section className="xl:col-span-3 glass rounded-2xl p-6 shadow-premium">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Presentes no patio</h3>
              <Badge tone="danger">{openRecords.length} em aberto</Badge>
            </div>
            {loading ? (
              <div className="py-16 text-center text-gray-500">Carregando...</div>
            ) : openRecords.length === 0 ? (
              <div className="py-16 text-center text-gray-500">Nenhuma entrada em aberto.</div>
            ) : (
              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {openRecords.map((record) => (
                  <div key={record.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-gray-900">{record.person_name}</p>
                          <Badge tone={record.person_type === 'Visitante' ? 'warning' : record.person_type === 'Terceirizado' ? 'info' : 'success'}>
                            {record.person_type}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">
                          Entrada {formatDateBR(record.entry_date)} as {record.entry_time}
                        </p>
                        <p className="text-xs text-gray-500">
                          Resp.: {record.host_person_name || 'Nao informado'}{record.vehicle_plate ? ` | Placa ${record.vehicle_plate}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">Motivo: {record.reason || 'Nao informado'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCloseRecord(record)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black"
                      >
                        <LogOut className="w-4 h-4" />
                        Registrar saida
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'historico' && (
        <section className="glass rounded-2xl p-6 shadow-premium">
          <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
              <input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Buscar historico" className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 focus:border-red-500 focus:ring-4 focus:ring-red-100" />
            </div>
            <select value={historyTypeFilter} onChange={(event) => setHistoryTypeFilter(event.target.value as PersonType | 'Todos')} className="rounded-xl border border-gray-300 px-3 py-2.5">
              <option value="Todos">Todos tipos</option>
              {PERSON_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select value={historyStatusFilter} onChange={(event) => setHistoryStatusFilter(event.target.value as AccessStatus | 'Todos')} className="rounded-xl border border-gray-300 px-3 py-2.5">
              <option value="Todos">Todos status</option>
              <option value="Em aberto">Em aberto</option>
              <option value="Concluido">Concluido</option>
            </select>
            <input type="date" value={historyStartDate} onChange={(event) => setHistoryStartDate(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2.5" />
            <input type="date" value={historyEndDate} onChange={(event) => setHistoryEndDate(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2.5" />
          </div>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <ListFilter className="w-4 h-4 text-red-600" />
            {filteredHistory.length} registros
          </div>
          <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
            {filteredHistory.map((record) => (
              <div key={record.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-gray-900">{record.person_name}</p>
                      <Badge tone={record.status === 'Em aberto' ? 'danger' : 'success'}>{record.status}</Badge>
                      <Badge tone="info">{record.person_type}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      Entrada {formatDateBR(record.entry_date)} {record.entry_time}
                      {record.exit_date ? ` | Saida ${formatDateBR(record.exit_date)} ${record.exit_time}` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      Codigo {record.short_code} | Resp.: {record.host_person_name || 'Nao informado'}{record.vehicle_plate ? ` | Placa ${record.vehicle_plate}` : ''}
                    </p>
                  </div>
                  {record.document_file_path && (
                    <button type="button" onClick={() => openDocument(record)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      <FileText className="w-4 h-4" />
                      Documento
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal isOpen={scannerOpen} onClose={() => setScannerOpen(false)} title="Ler QR da portaria" size="lg">
        <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleLookup} />
      </Modal>

    </div>
  );
}
