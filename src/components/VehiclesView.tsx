import { reportError } from '../utils/diagnostics';
import { escapeHtml } from '../utils/html';
import { requireDevEnvironment } from '../lib/runtime';
import { useEffect, useMemo, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { Car, Search, Wrench, CheckCircle2, PauseCircle, Plus, Edit2, Trash2, ListFilter, QrCode, Download, Printer, UserRound, ClipboardCheck } from 'lucide-react';
import { Input } from './Input';
import { Modal } from './Modal';
import { Textarea } from './Textarea';
import { vehicleCatalogService } from '../services/vehicleCatalogService';
import { operationalService } from '../services/operationalService';
import { accessControlService } from '../services/accessControlService';
import { inspectionService } from '../services/inspectionService';
import type { UserRole } from './Login';
import type { DriverRecord, FleetVehicle, FleetVehicleInput, PersonalVehicle, VehicleStatus } from '../types/database';

interface VehiclesViewProps {
  userRole: UserRole;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const STATUS_OPTIONS: VehicleStatus[] = ['Ativo', 'Inativo', 'Em Manut.'];
const INITIAL_FORM: FleetVehicleInput = {
  plate: '',
  name: '',
  responsible_name: '',
  fixed_driver_name: '',
  status: 'Ativo',
};

type VehiclesTab = 'fleet' | 'personal';

function getQrBaseUrl() {
  return requireDevEnvironment().appUrl;
}

function getVehicleQrUrl(vehicle: FleetVehicle) {
  const url = new URL(getQrBaseUrl());
  url.searchParams.set('tab', 'patio');
  url.searchParams.set('veiculo', vehicle.short_code || vehicle.plate);
  return url.toString();
}

function getPersonalVehicleQrUrl(vehicle: PersonalVehicle) {
  const url = new URL(getQrBaseUrl());
  url.searchParams.set('tab', 'portaria');
  url.searchParams.set('veiculo_pessoal', vehicle.short_code || vehicle.plate);
  return url.toString();
}

export function VehiclesView({ userRole, onSuccess, onError }: VehiclesViewProps) {
  const canManage = userRole === 'admin';
  const [activeVehiclesTab, setActiveVehiclesTab] = useState<VehiclesTab>('fleet');
  const [inspectionVehicle, setInspectionVehicle] = useState<FleetVehicle | null>(null);
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [inspectionSaving, setInspectionSaving] = useState(false);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [personalVehicles, setPersonalVehicles] = useState<PersonalVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'Todos'>('Todos');
  const [formData, setFormData] = useState<FleetVehicleInput>(INITIAL_FORM);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FleetVehicleInput, string>>>({});
  const [qrVehicle, setQrVehicle] = useState<FleetVehicle | null>(null);
  const [personalQrVehicle, setPersonalQrVehicle] = useState<PersonalVehicle | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrGenerating, setQrGenerating] = useState(false);
  const [personalVehicleForm, setPersonalVehicleForm] = useState({ person_id: '', plate: '', name: '', notes: '', is_active: true });
  const [editingPersonalVehicleId, setEditingPersonalVehicleId] = useState<string | null>(null);
  const [personalVehicleSaving, setPersonalVehicleSaving] = useState(false);
  const [personalVehicleSearch, setPersonalVehicleSearch] = useState('');

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await vehicleCatalogService.listVehicles({ search, status: statusFilter });
      setVehicles(data);
    } catch (error) {
      reportError('Erro ao carregar veículos:', error);
      onError('Erro ao carregar veículos');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, onError]);

  const loadPersonalVehicles = useCallback(async () => {
    try {
      setPersonalLoading(true);
      const data = await accessControlService.listPersonalVehicles();
      setPersonalVehicles(data);
    } catch (error) {
      reportError('Erro ao carregar veiculos pessoais:', error);
      onError('Erro ao carregar veiculos pessoais');
    } finally {
      setPersonalLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    loadPersonalVehicles();
  }, [loadPersonalVehicles]);

  useEffect(() => {
    operationalService
      .listDrivers()
      .then(setDrivers)
      .catch((error) => {
        reportError('Erro ao carregar motoristas para veículos:', error);
        onError('Erro ao carregar motoristas');
      });
  }, [onError]);

  const fixedDriverOptions = useMemo(() => {
    const activeNames = drivers.filter((driver) => driver.is_active).map((driver) => driver.name);
    if (formData.fixed_driver_name && !activeNames.includes(formData.fixed_driver_name)) {
      return [formData.fixed_driver_name, ...activeNames];
    }
    return activeNames;
  }, [drivers, formData.fixed_driver_name]);

  const activePeople = useMemo(
    () => drivers.filter((driver) => driver.is_active),
    [drivers]
  );

  const filteredPersonalVehicles = useMemo(() => {
    const searchValue = personalVehicleSearch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .trim()
      .toLowerCase();

    if (!searchValue) return personalVehicles;

    return personalVehicles.filter((vehicle) =>
      [vehicle.short_code, vehicle.plate, vehicle.name || '', vehicle.person?.name || ''].some((value) =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '')
          .trim()
          .toLowerCase()
          .includes(searchValue)
      )
    );
  }, [personalVehicleSearch, personalVehicles]);

  const stats = useMemo(() => {
    const active = vehicles.filter((vehicle) => vehicle.status === 'Ativo').length;
    const inactive = vehicles.filter((vehicle) => vehicle.status === 'Inativo').length;
    const maintenance = vehicles.filter((vehicle) => vehicle.status === 'Em Manut.').length;

    return {
      total: vehicles.length,
      active,
      inactive,
      maintenance,
    };
  }, [vehicles]);

  const validate = () => {
    const newErrors: Partial<Record<keyof FleetVehicleInput, string>> = {};

    if (!formData.plate.trim()) {
      newErrors.plate = 'Informe a placa do veículo';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Informe o nome do veículo';
    }

    if (!formData.status) {
      newErrors.status = 'Selecione um status';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setErrors({});
    setEditingVehicleId(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) { onError('Cadastro restrito ao administrador.'); return; }

    if (!validate()) {
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingVehicleId) {
        await vehicleCatalogService.updateVehicle(editingVehicleId, formData);
        onSuccess('Veículo atualizado com sucesso');
      } else {
        await vehicleCatalogService.createVehicle(formData);
        onSuccess('Veículo cadastrado com sucesso');
      }

      resetForm();
      await loadVehicles();
    } catch (error) {
      reportError('Erro ao salvar veículo:', error);
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : '';

      if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique') || message.includes('23505')) {
        onError('Erro ao salvar veículo. Verifique se a placa já existe.');
      } else {
        onError('Erro ao salvar veículo. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (vehicle: FleetVehicle) => {
    if (!canManage) { onError('Acao restrita ao administrador.'); return; }
    setEditingVehicleId(vehicle.id);
    setFormData({
      plate: vehicle.plate,
      name: vehicle.name,
      responsible_name: vehicle.responsible_name || '',
      fixed_driver_name: vehicle.fixed_driver_name || '',
      status: vehicle.status,
    });
    setErrors({});
  };

  const handleDelete = async (id: string) => {
    if (!canManage) { onError('Acao restrita ao administrador.'); return; }
    const confirmed = confirm('Deseja realmente excluir este veículo?');
    if (!confirmed) {
      return;
    }

    try {
      await vehicleCatalogService.deleteVehicle(id);
      onSuccess('Veículo excluído com sucesso');

      if (editingVehicleId === id) {
        resetForm();
      }

      await loadVehicles();
    } catch (error) {
      reportError('Erro ao excluir veículo:', error);
      onError('Erro ao excluir veículo');
    }
  };

  const openQrModal = async (vehicle: FleetVehicle) => {
    try {
      setQrVehicle(vehicle);
      setQrGenerating(true);
      setQrDataUrl('');

      const dataUrl = await QRCode.toDataURL(getVehicleQrUrl(vehicle), {
        width: 360,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      });

      setQrDataUrl(dataUrl);
    } catch (error) {
      reportError('Erro ao gerar QR Code:', error);
      onError('Erro ao gerar QR Code do veÃ­culo');
    } finally {
      setQrGenerating(false);
    }
  };

  const openPersonalQrModal = async (vehicle: PersonalVehicle) => {
    try {
      setPersonalQrVehicle(vehicle);
      setQrGenerating(true);
      setQrDataUrl('');

      const dataUrl = await QRCode.toDataURL(getPersonalVehicleQrUrl(vehicle), {
        width: 360,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      });

      setQrDataUrl(dataUrl);
    } catch (error) {
      reportError('Erro ao gerar QR Code do veiculo pessoal:', error);
      onError('Erro ao gerar QR Code do veiculo pessoal');
    } finally {
      setQrGenerating(false);
    }
  };

  const downloadQr = () => {
    if (!qrVehicle || !qrDataUrl) return;

    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qr-${escapeHtml(qrVehicle.plate)}-${qrVehicle.short_code || 'veiculo'}.png`;
    link.click();
  };

  const downloadPersonalQr = () => {
    if (!personalQrVehicle || !qrDataUrl) return;

    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qr-veiculo-pessoal-${escapeHtml(personalQrVehicle.plate)}-${personalQrVehicle.short_code || 'veiculo'}.png`;
    link.click();
  };

  const printQr = () => {
    if (!qrVehicle || !qrDataUrl) return;

    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) {
      onError('NÃ£o foi possÃ­vel abrir a janela de impressÃ£o');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>QR ${escapeHtml(qrVehicle.plate)}</title>
          <style>
            body { font-family: Arial, sans-serif; display: grid; min-height: 100vh; place-items: center; margin: 0; }
            .label { width: 320px; border: 2px solid #111827; border-radius: 18px; padding: 20px; text-align: center; }
            img { width: 240px; height: 240px; }
            h1 { margin: 10px 0 4px; font-size: 30px; }
            p { margin: 4px 0; color: #374151; }
            .code { font-size: 18px; font-weight: 700; color: #111827; }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${qrDataUrl}" alt="QR Code do veiculo" />
            <h1>${escapeHtml(qrVehicle.plate)}</h1>
            <p>${escapeHtml(qrVehicle.name)}</p>
            <p class="code">${escapeHtml(qrVehicle.short_code || qrVehicle.plate)}</p>
          </div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printPersonalQr = () => {
    if (!personalQrVehicle || !qrDataUrl) return;

    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) {
      onError('Nao foi possivel abrir a janela de impressao');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>QR ${escapeHtml(personalQrVehicle.plate)}</title>
          <style>
            body { font-family: Arial, sans-serif; display: grid; min-height: 100vh; place-items: center; margin: 0; }
            .label { width: 320px; border: 2px solid #111827; border-radius: 18px; padding: 20px; text-align: center; }
            img { width: 240px; height: 240px; }
            h1 { margin: 10px 0 4px; font-size: 30px; }
            p { margin: 4px 0; color: #374151; }
            .code { font-size: 18px; font-weight: 700; color: #111827; }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${qrDataUrl}" alt="QR Code do veiculo pessoal" />
            <h1>${escapeHtml(personalQrVehicle.plate)}</h1>
            <p>${escapeHtml(personalQrVehicle.person?.name || personalQrVehicle.name || 'Veiculo pessoal')}</p>
            <p class="code">${escapeHtml(personalQrVehicle.short_code || personalQrVehicle.plate)}</p>
          </div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const resetPersonalVehicleForm = () => {
    setPersonalVehicleForm({ person_id: '', plate: '', name: '', notes: '', is_active: true });
    setEditingPersonalVehicleId(null);
  };

  const handlePersonalVehicleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) { onError('Cadastro restrito ao administrador.'); return; }

    if (!personalVehicleForm.person_id || !personalVehicleForm.plate.trim()) {
      onError('Selecione a pessoa e informe a placa');
      return;
    }

    try {
      setPersonalVehicleSaving(true);
      if (editingPersonalVehicleId) {
        await accessControlService.updatePersonalVehicle(editingPersonalVehicleId, personalVehicleForm);
        onSuccess('Veiculo pessoal atualizado com sucesso');
      } else {
        await accessControlService.createPersonalVehicle(personalVehicleForm);
        onSuccess('Veiculo pessoal cadastrado com sucesso');
      }
      resetPersonalVehicleForm();
      await loadPersonalVehicles();
    } catch (error) {
      reportError('Erro ao salvar veiculo pessoal:', error);
      onError('Erro ao salvar veiculo pessoal. Verifique se a placa ja existe.');
    } finally {
      setPersonalVehicleSaving(false);
    }
  };

  const startPersonalVehicleEdit = (vehicle: PersonalVehicle) => {
    if (!canManage) { onError('Acao restrita ao administrador.'); return; }
    setEditingPersonalVehicleId(vehicle.id);
    setPersonalVehicleForm({
      person_id: vehicle.person_id,
      plate: vehicle.plate,
      name: vehicle.name || '',
      notes: vehicle.notes || '',
      is_active: vehicle.is_active,
    });
  };

  const openInspectionModal = (vehicle: FleetVehicle) => {
    setInspectionVehicle(vehicle);
    setInspectionNotes('');
  };

  const handleRequestInspection = async () => {
    if (!inspectionVehicle) return;

    try {
      setInspectionSaving(true);
      await inspectionService.createRequest({
        vehicle_id: inspectionVehicle.id,
        vehicle_plate: inspectionVehicle.plate,
        vehicle_name: inspectionVehicle.name,
        notes: inspectionNotes,
      });
      onSuccess('Inspeção solicitada. O porteiro foi notificado.');
      setInspectionVehicle(null);
    } catch (error) {
      reportError('Erro ao solicitar inspeção:', error);
      onError('Erro ao solicitar inspeção');
    } finally {
      setInspectionSaving(false);
    }
  };

  const statusStyle = (status: VehicleStatus) => {
    if (status === 'Ativo') {
      return 'bg-green-100 text-green-700';
    }

    if (status === 'Inativo') {
      return 'bg-gray-200 text-gray-700';
    }

    return 'bg-amber-100 text-amber-700';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-premium-colored">
          <Car className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestao de Veiculos</h2>
          <p className="text-gray-600">Cadastro e controle da frota da empresa</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveVehiclesTab('fleet')}
          className={`flex min-w-max items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
            activeVehiclesTab === 'fleet'
              ? 'bg-red-600 text-white shadow-md'
              : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Car className="w-4 h-4" />
          Frota
        </button>
        <button
          type="button"
          onClick={() => setActiveVehiclesTab('personal')}
          className={`flex min-w-max items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
            activeVehiclesTab === 'personal'
              ? 'bg-red-600 text-white shadow-md'
              : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <UserRound className="w-4 h-4" />
          Veiculos pessoais
        </button>
      </div>

      {activeVehiclesTab === 'fleet' && (
        <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5 shadow-premium">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Total</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
        </div>
        <div className="glass rounded-2xl p-5 shadow-premium">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Ativos</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.active}</p>
        </div>
        <div className="glass rounded-2xl p-5 shadow-premium">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Inativos</p>
          <p className="text-3xl font-bold text-gray-700 mt-2">{stats.inactive}</p>
        </div>
        <div className="glass rounded-2xl p-5 shadow-premium">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Em Manutencao</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{stats.maintenance}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <section className="xl:col-span-2 glass card-shine rounded-2xl p-6 shadow-premium">
          <div className="flex items-center gap-2 mb-5">
            <Plus className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-gray-900">
              {editingVehicleId ? 'Editar Veiculo' : 'Novo Veiculo'}
            </h3>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}><fieldset disabled={!canManage} className="contents">
            <Input
              label="Placa"
              placeholder="ABC-1234"
              value={formData.plate}
              onChange={(event) => setFormData((prev) => ({ ...prev, plate: event.target.value.toUpperCase() }))}
              error={errors.plate}
              required
            />

            <Input
              label="Nome"
              placeholder="Ex: Fiat Strada 2024"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              error={errors.name}
              required
            />

            <Input
              label="Responsável/Motorista"
              placeholder="Ex: João Silva"
              value={formData.responsible_name}
              onChange={(event) => setFormData((prev) => ({ ...prev, responsible_name: event.target.value }))}
            />

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Condutor fixo</label>
              <select
                value={formData.fixed_driver_name}
                onChange={(event) => setFormData((prev) => ({ ...prev, fixed_driver_name: event.target.value }))}
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              >
                <option value="">Sem condutor fixo</option>
                {fixedDriverOptions.map((driverName) => (
                  <option key={driverName} value={driverName}>{driverName}</option>
                ))}
              </select>
            </div>
            <p className="-mt-2 text-xs text-gray-500">
              Ao informar um condutor fixo, o veículo fica reservado e não aparece para retirada comum.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Status</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, status }))}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold border transition-all ${
                      formData.status === status
                        ? 'gradient-primary text-white border-transparent shadow-premium-colored'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-red-300'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              {errors.status && <p className="text-sm text-red-600">{errors.status}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 gradient-primary text-white rounded-xl py-3 font-semibold shadow-premium-colored hover:opacity-95 disabled:opacity-60"
              >
                {isSubmitting ? 'Salvando...' : editingVehicleId ? 'Salvar alteracoes' : 'Cadastrar veiculo'}
              </button>
              {editingVehicleId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100"
                >
                  Cancelar
                </button>
              )}
            </div>
          </fieldset></form>
        </section>

        <section className="xl:col-span-3 glass rounded-2xl p-6 shadow-premium">
          <div className="flex flex-col lg:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por placa ou nome"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-300 focus:ring-4 focus:ring-red-100 focus:border-red-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as VehicleStatus | 'Todos')}
                className="px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-4 focus:ring-red-100 focus:border-red-500"
              >
                <option value="Todos">Todos</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-500">Carregando veiculos...</div>
          ) : vehicles.length === 0 ? (
            <div className="py-16 text-center">
              <Wrench className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Nenhum veiculo encontrado</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-premium transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      {vehicle.responsible_name && (
                        <p className="text-sm text-gray-500 mt-1">📋 {vehicle.responsible_name}</p>
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-bold text-gray-900">{vehicle.plate}</h4>
                        <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold tracking-wider text-white">
                          Código {vehicle.short_code}
                        </span>
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusStyle(vehicle.status)}`}>
                          {vehicle.status}
                        </span>
                      </div>
                      <p className="text-gray-600 font-medium">{vehicle.name}</p>
                      {vehicle.fixed_driver_name?.trim() && (
                        <p className="mt-2 inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                          Condutor fixo: {vehicle.fixed_driver_name}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Cadastrado em {vehicle.created_at ? new Date(vehicle.created_at).toLocaleDateString('pt-BR') : '-'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {userRole === 'admin' && (
                        <button
                          type="button"
                          onClick={() => openInspectionModal(vehicle)}
                          className="p-2.5 rounded-xl border border-amber-200 text-amber-700 hover:bg-amber-50"
                          title="Solicitar inspeção"
                        >
                          <ClipboardCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openQrModal(vehicle)}
                        className="p-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                        title="Gerar QR"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={!canManage} onClick={() => startEdit(vehicle)}
                        className="p-2.5 rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={!canManage} onClick={() => handleDelete(vehicle.id)}
                        className="p-2.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-600" /> Ativo</span>
            <span className="inline-flex items-center gap-1"><PauseCircle className="w-4 h-4 text-gray-600" /> Inativo</span>
            <span className="inline-flex items-center gap-1"><Wrench className="w-4 h-4 text-amber-600" /> Em Manut.</span>
          </div>
        </section>
      </div>
        </>
      )}

      {activeVehiclesTab === 'personal' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <section className="xl:col-span-2 glass card-shine rounded-2xl p-6 shadow-premium">
            <div className="flex items-center gap-2 mb-5">
              <Plus className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-bold text-gray-900">
                {editingPersonalVehicleId ? 'Editar Veiculo Pessoal' : 'Novo Veiculo Pessoal'}
              </h3>
            </div>

            <form onSubmit={handlePersonalVehicleSubmit} className="space-y-4"><fieldset disabled={!canManage} className="contents">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Pessoa vinculada *</label>
                <select
                  value={personalVehicleForm.person_id}
                  onChange={(event) => setPersonalVehicleForm((prev) => ({ ...prev, person_id: event.target.value }))}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                >
                  <option value="">Selecione</option>
                  {activePeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.short_code} - {person.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Placa"
                value={personalVehicleForm.plate}
                onChange={(event) => setPersonalVehicleForm((prev) => ({ ...prev, plate: event.target.value.toUpperCase() }))}
                placeholder="ABC1234"
                required
              />

              <Input
                label="Modelo/Nome"
                value={personalVehicleForm.name}
                onChange={(event) => setPersonalVehicleForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ex: Honda Civic"
              />

              <Textarea
                label="Observacoes"
                value={personalVehicleForm.notes}
                onChange={(event) => setPersonalVehicleForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
              />

              <button
                type="button"
                onClick={() => setPersonalVehicleForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
                  personalVehicleForm.is_active
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
                }`}
              >
                {personalVehicleForm.is_active ? 'Veiculo ativo' : 'Veiculo inativo'}
              </button>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={personalVehicleSaving}
                  className="flex-1 gradient-primary text-white rounded-xl py-3 font-semibold shadow-premium-colored hover:opacity-95 disabled:opacity-60"
                >
                  {personalVehicleSaving ? 'Salvando...' : editingPersonalVehicleId ? 'Salvar alteracoes' : 'Cadastrar veiculo'}
                </button>
                {editingPersonalVehicleId && (
                  <button
                    type="button"
                    onClick={resetPersonalVehicleForm}
                    className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </fieldset></form>
          </section>

          <section className="xl:col-span-3 glass rounded-2xl p-6 shadow-premium">
            <div className="flex flex-col lg:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={personalVehicleSearch}
                  onChange={(event) => setPersonalVehicleSearch(event.target.value)}
                  placeholder="Buscar por placa, pessoa ou codigo"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-300 focus:ring-4 focus:ring-red-100 focus:border-red-500"
                />
              </div>
            </div>

            {personalLoading ? (
              <div className="py-16 text-center text-gray-500">Carregando veiculos pessoais...</div>
            ) : filteredPersonalVehicles.length === 0 ? (
              <div className="py-16 text-center">
                <Car className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Nenhum veiculo pessoal encontrado</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {filteredPersonalVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-premium transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="text-lg font-bold text-gray-900">{vehicle.plate}</h4>
                          <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold tracking-wider text-white">
                            Codigo {vehicle.short_code}
                          </span>
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                            vehicle.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {vehicle.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <p className="text-gray-600 font-medium">{vehicle.name || 'Veiculo pessoal'}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          Pessoa: {vehicle.person?.name || 'Nao encontrada'}
                        </p>
                        {vehicle.notes && <p className="mt-1 text-xs text-gray-500">{vehicle.notes}</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openPersonalQrModal(vehicle)}
                          className="p-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                          title="Gerar QR"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={!canManage} onClick={() => startPersonalVehicleEdit(vehicle)}
                          className="p-2.5 rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <Modal
        isOpen={!!inspectionVehicle}
        onClose={() => setInspectionVehicle(null)}
        title="Solicitar inspeção"
        size="md"
      >
        {inspectionVehicle && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">{inspectionVehicle.plate}</p>
              <p className="text-sm text-amber-800">{inspectionVehicle.name}</p>
              <p className="mt-2 text-xs text-amber-700">
                O porteiro vai receber uma notificação para fazer a inspeção deste veículo.
              </p>
            </div>

            <Textarea
              label="Observações (opcional)"
              value={inspectionNotes}
              onChange={(event) => setInspectionNotes(event.target.value)}
              placeholder="Ex: verificar pneus antes da viagem"
              rows={3}
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setInspectionVehicle(null)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRequestInspection}
                disabled={inspectionSaving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                <ClipboardCheck className="w-4 h-4" />
                {inspectionSaving ? 'Enviando...' : 'Solicitar inspeção'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!qrVehicle}
        onClose={() => setQrVehicle(null)}
        title="QR Code do veiculo"
        size="md"
      >
        {qrVehicle && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-sm font-semibold text-gray-500">Etiqueta fixa do veiculo</p>
              <h3 className="mt-1 text-2xl font-bold text-gray-900">{qrVehicle.plate}</h3>
              <p className="text-gray-600">{qrVehicle.name}</p>
              <p className="mt-1 text-sm font-semibold text-gray-700">Codigo: {qrVehicle.short_code || qrVehicle.plate}</p>
            </div>

            <div className="flex justify-center rounded-2xl border border-gray-200 bg-white p-5">
              {qrGenerating ? (
                <div className="py-24 text-sm text-gray-500">Gerando QR Code...</div>
              ) : qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR Code do veiculo ${escapeHtml(qrVehicle.plate)}`} className="h-64 w-64" />
              ) : (
                <div className="py-24 text-sm text-gray-500">QR indisponivel.</div>
              )}
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">Link permanente</p>
              <p className="mt-2 break-all text-sm text-blue-800">{getVehicleQrUrl(qrVehicle)}</p>
              <p className="mt-2 text-xs text-blue-700">
                  Este QR usa o código curto do veículo e o endereço autorizado deste ambiente. Confira o destino antes de compartilhar.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={downloadQr}
                disabled={!qrDataUrl}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                Baixar PNG
              </button>
              <button
                type="button"
                onClick={printQr}
                disabled={!qrDataUrl}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Printer className="w-4 h-4" />
                Imprimir etiqueta
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!personalQrVehicle}
        onClose={() => setPersonalQrVehicle(null)}
        title="QR Code do veiculo pessoal"
        size="md"
      >
        {personalQrVehicle && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-sm font-semibold text-gray-500">Etiqueta do veiculo pessoal</p>
              <h3 className="mt-1 text-2xl font-bold text-gray-900">{personalQrVehicle.plate}</h3>
              <p className="text-gray-600">{personalQrVehicle.person?.name || personalQrVehicle.name || 'Veiculo pessoal'}</p>
              <p className="mt-1 text-sm font-semibold text-gray-700">Codigo: {personalQrVehicle.short_code || personalQrVehicle.plate}</p>
            </div>

            <div className="flex justify-center rounded-2xl border border-gray-200 bg-white p-5">
              {qrGenerating ? (
                <div className="py-24 text-sm text-gray-500">Gerando QR Code...</div>
              ) : qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR Code do veiculo pessoal ${escapeHtml(personalQrVehicle.plate)}`} className="h-64 w-64" />
              ) : (
                <div className="py-24 text-sm text-gray-500">QR indisponivel.</div>
              )}
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">Link permanente</p>
              <p className="mt-2 break-all text-sm text-blue-800">{getPersonalVehicleQrUrl(personalQrVehicle)}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={downloadPersonalQr}
                disabled={!qrDataUrl}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                Baixar PNG
              </button>
              <button
                type="button"
                onClick={printPersonalQr}
                disabled={!qrDataUrl}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Printer className="w-4 h-4" />
                Imprimir etiqueta
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
