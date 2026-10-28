import { reportError } from '../utils/diagnostics';
import { safeSignatureSource } from '../utils/signature';
import { useState, useEffect, useMemo } from 'react';
import { Truck, LogOut, LogIn, FileText, Save, RotateCcw, Search } from 'lucide-react';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { ChipSelect } from './ChipSelect';
import { SignaturePad } from './SignaturePad';
import { vehicleService } from '../services/vehicleService';
import { vehicleCatalogService } from '../services/vehicleCatalogService';
import type { VehicleRecordInput, FleetVehicle } from '../types/database';

interface VehicleFormProps {
  onSuccess: () => void;
  onError: (message: string) => void;
  editData?: VehicleRecordInput & { id?: string };
}
const REASON_SUGGESTIONS = ['Visita tecnica', 'Entrega', 'Reuniao', 'Manutencao', 'Outro'];
const AUTHORIZATION_SUGGESTIONS = ['Gestor', 'Diretoria', 'RH', 'Coordenacao', 'Outro'];
const USAGE_OPTIONS: Array<VehicleRecordInput['usage_type']> = ['Comum', 'Rota'];

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function VehicleForm({ onSuccess, onError, editData }: VehicleFormProps) {
  const isReturnMode = !!(editData?.id && editData?.status === 'Em uso' && editData?.pickup_signature);
  const isNewPickup = !editData?.id;

  const [formData, setFormData] = useState<VehicleRecordInput>({
    vehicle_plate: editData?.vehicle_plate || '',
    reason: editData?.reason || '',
    authorized_by: editData?.authorized_by || '',
    usage_type: editData?.usage_type || 'Comum',
    pickup_date: editData?.pickup_date || '',
    pickup_time: editData?.pickup_time || '',
    pickup_name: editData?.pickup_name || '',
    pickup_signature: editData?.pickup_signature || '',
    return_date: editData?.return_date || '',
    return_time: editData?.return_time || '',
    return_name: editData?.return_name || '',
    return_signature: editData?.return_signature || '',
    observations: editData?.observations || '',
    status: editData?.status || 'Em uso',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [unavailableVehiclePlates, setUnavailableVehiclePlates] = useState<Set<string>>(new Set());
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehicleSearch, setVehicleSearch] = useState('');

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const [activeVehicles, unavailablePlates] = await Promise.all([
          vehicleCatalogService.listVehicles({ status: 'Ativo' }),
          vehicleService.listUnavailableVehiclePlates(),
        ]);
        setVehicles(activeVehicles);
        setUnavailableVehiclePlates(new Set(unavailablePlates));
      } catch (error) {
        reportError('Erro ao carregar veiculos:', error);
        setVehicles([]);
      } finally {
        setLoadingVehicles(false);
      }
    };

    loadVehicles();
  }, []);

  const filteredVehicles = useMemo(() => {
    const availableVehicles = vehicles.filter(
      (vehicle) =>
        !vehicle.fixed_driver_name?.trim() &&
        !unavailableVehiclePlates.has(vehicle.plate.trim().toUpperCase())
    );
    const normalizedSearch = normalizeSearchValue(vehicleSearch);

    if (!normalizedSearch) {
      return availableVehicles;
    }

    return availableVehicles.filter((vehicle) => {
      const searchableText = normalizeSearchValue(
        `${vehicle.plate} ${vehicle.name} ${vehicle.responsible_name || ''}`
      );

      return searchableText.includes(normalizedSearch);
    });
  }, [unavailableVehiclePlates, vehicleSearch, vehicles]);

  const displayedVehicles = useMemo(() => {
    if (!formData.vehicle_plate) {
      return filteredVehicles;
    }

    const selectedVehicle = vehicles.find((vehicle) => vehicle.plate === formData.vehicle_plate);
    const selectedAlreadyVisible = filteredVehicles.some((vehicle) => vehicle.plate === formData.vehicle_plate);

    if (!selectedVehicle || selectedAlreadyVisible) {
      return filteredVehicles;
    }

    return [selectedVehicle, ...filteredVehicles];
  }, [filteredVehicles, formData.vehicle_plate, vehicles]);

  const availableVehicleCount = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          !vehicle.fixed_driver_name?.trim() &&
          !unavailableVehiclePlates.has(vehicle.plate.trim().toUpperCase())
      ).length,
    [unavailableVehiclePlates, vehicles]
  );

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (isNewPickup) {
      if (!formData.vehicle_plate.trim()) newErrors.vehicle_plate = 'Veiculo e obrigatorio';
      if (!formData.reason.trim()) newErrors.reason = 'Motivo e obrigatorio';
      if (!formData.authorized_by.trim()) newErrors.authorized_by = 'Autorizacao e obrigatoria';
      if (!formData.usage_type) newErrors.usage_type = 'Selecione o tipo de uso';
      if (!formData.pickup_date) newErrors.pickup_date = 'Data de retirada e obrigatoria';
      if (!formData.pickup_time) newErrors.pickup_time = 'Hora de retirada e obrigatoria';
      if (!formData.pickup_name.trim()) newErrors.pickup_name = 'Nome de retirada e obrigatorio';
      if (!formData.pickup_signature) newErrors.pickup_signature = 'Assinatura de retirada e obrigatoria';
    } else if (isReturnMode) {
      if (!formData.return_date) newErrors.return_date = 'Data de devolucao e obrigatoria';
      if (!formData.return_time) newErrors.return_time = 'Hora de devolucao e obrigatoria';
      if (!formData.return_name?.trim()) newErrors.return_name = 'Nome de quem devolveu e obrigatorio';
      if (!formData.return_signature) newErrors.return_signature = 'Assinatura de devolucao e obrigatoria';
    } else {
      if (!formData.vehicle_plate.trim()) newErrors.vehicle_plate = 'Veiculo e obrigatorio';
      if (!formData.reason.trim()) newErrors.reason = 'Motivo e obrigatorio';
      if (!formData.authorized_by.trim()) newErrors.authorized_by = 'Autorizacao e obrigatoria';
      if (!formData.usage_type) newErrors.usage_type = 'Selecione o tipo de uso';
      if (!formData.pickup_date) newErrors.pickup_date = 'Data de retirada e obrigatoria';
      if (!formData.pickup_time) newErrors.pickup_time = 'Hora de retirada e obrigatoria';
      if (!formData.pickup_name.trim()) newErrors.pickup_name = 'Nome de retirada e obrigatorio';
      if (!formData.pickup_signature) newErrors.pickup_signature = 'Assinatura de retirada e obrigatoria';

      const hasAnyReturnField = !!(
        formData.return_date ||
        formData.return_time ||
        formData.return_name?.trim() ||
        formData.return_signature
      );

      if (hasAnyReturnField) {
        if (!formData.return_date) newErrors.return_date = 'Data de devolucao e obrigatoria';
        if (!formData.return_time) newErrors.return_time = 'Hora de devolucao e obrigatoria';
        if (!formData.return_name?.trim()) newErrors.return_name = 'Nome de quem devolveu e obrigatorio';
        if (!formData.return_signature) newErrors.return_signature = 'Assinatura de devolucao e obrigatoria';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      onError(isReturnMode ? 'Por favor, preencha todos os dados da devolucao' : 'Por favor, preencha todos os campos obrigatorios');
      return;
    }

    setIsSubmitting(true);

    try {
      const hasCompleteReturn = !!(
        formData.return_date &&
        formData.return_time &&
        formData.return_name &&
        formData.return_signature
      );

      const status: VehicleRecordInput['status'] = isReturnMode
        ? 'Devolvido'
        : isNewPickup
          ? 'Em uso'
          : hasCompleteReturn
            ? 'Devolvido'
            : 'Em uso';

      const usageType = formData.usage_type || 'Comum';
      if (editData?.id) {
        const updatePayload: Partial<VehicleRecordInput> = isReturnMode
          ? {
              usage_type: usageType,
              return_date: formData.return_date || undefined,
              return_time: formData.return_time || undefined,
              return_name: formData.return_name || undefined,
              return_signature: formData.return_signature || undefined,
              observations: formData.observations,
              status,
            }
          : {
              vehicle_plate: formData.vehicle_plate,
              reason: formData.reason,
              authorized_by: formData.authorized_by,
              usage_type: usageType,
              pickup_date: formData.pickup_date,
              pickup_time: formData.pickup_time,
              pickup_name: formData.pickup_name,
              pickup_signature: formData.pickup_signature,
              return_date: formData.return_date || undefined,
              return_time: formData.return_time || undefined,
              return_name: formData.return_name || undefined,
              return_signature: formData.return_signature || undefined,
              observations: formData.observations,
              status,
            };

        await vehicleService.updateRecord(editData.id, updatePayload);
      } else {
        const createPayload: VehicleRecordInput = {
          vehicle_plate: formData.vehicle_plate,
          reason: formData.reason,
          authorized_by: formData.authorized_by,
          usage_type: usageType,
          pickup_date: formData.pickup_date,
          pickup_time: formData.pickup_time,
          pickup_name: formData.pickup_name,
          pickup_signature: formData.pickup_signature,
          observations: formData.observations,
          status,
        };

        await vehicleService.createRecord(createPayload);
      }


      onSuccess();

      if (isNewPickup) {
        handleClear();
      }
    } catch (error) {
      reportError('Error saving record:', error);
      onError('Erro ao salvar registro. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setFormData({
      vehicle_plate: '',
      reason: '',
      authorized_by: '',
      usage_type: 'Comum',
      pickup_date: '',
      pickup_time: '',
      pickup_name: '',
      pickup_signature: '',
      return_date: '',
      return_time: '',
      return_name: '',
      return_signature: '',
      observations: '',
      status: 'Em uso',
    });
    setErrors({});
    setVehicleSearch('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
      {isReturnMode && (
        <div className="glass card-shine rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <LogIn className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">Registrar Devolucao</h2>
              <p className="text-sm text-gray-600 mt-1 break-words">
                Veiculo: <span className="font-semibold text-purple-700">{formData.vehicle_plate}</span> -
                Retirado por: <span className="font-semibold text-purple-700">{formData.pickup_name}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {isNewPickup && (
        <div className="glass card-shine rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <LogOut className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Registrar Retirada de Veiculo</h2>
              <p className="text-sm text-gray-600 mt-1">Preencha os dados da retirada e assine</p>
            </div>
          </div>
        </div>
      )}

      {!isReturnMode && !isNewPickup && (
        <div className="glass card-shine rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Editar Registro</h2>
              <p className="text-sm text-gray-600 mt-1">Atualize os dados conforme necessario</p>
            </div>
          </div>
        </div>
      )}

      {!isReturnMode && (
        <div className="glass card-shine rounded-2xl p-6 sm:p-8 space-y-6 shadow-premium animate-fade-in">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200/50">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Informacoes do Veiculo</h3>
              <p className="text-sm text-gray-500">Dados basicos do veiculo</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-3">
              <label className="block text-sm font-semibold text-gray-700">
                Veiculo <span className="text-red-500">*</span>
              </label>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 border border-green-300">
                <span className="flex w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-xs font-semibold text-green-700">Apenas disponiveis</span>
              </span>
            </div>
            {loadingVehicles ? (
              <div className="flex items-center justify-center h-12 bg-gray-100 rounded-xl">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="h-12 px-4 py-3 rounded-xl bg-red-50 border-2 border-red-200 flex items-center">
                <span className="text-red-600 text-sm font-medium">Nenhum veiculo ativo disponivel</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    placeholder="Pesquisar por placa, nome ou responsavel"
                    disabled={isReturnMode}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors bg-white text-gray-900 ${
                      isReturnMode ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                <select
                  value={formData.vehicle_plate}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      vehicle_plate: e.target.value,
                      usage_type: 'Comum',
                    }));
                    if (errors.vehicle_plate) setErrors((prev) => ({ ...prev, vehicle_plate: '' }));
                  }}
                  disabled={isReturnMode}
                  className={`w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors bg-white text-gray-900 font-medium ${
                    isReturnMode ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">Selecione um veiculo...</option>
                  {displayedVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.plate}>
                      {vehicle.plate} - {vehicle.name}
                      {vehicle.responsible_name ? ` (${vehicle.responsible_name})` : ''}
                    </option>
                  ))}
                </select>

                <p className="text-xs text-gray-500">
                  {filteredVehicles.length === availableVehicleCount && !vehicleSearch.trim()
                    ? `${availableVehicleCount} veiculo(s) disponivel(is)`
                    : `${filteredVehicles.length} resultado(s) para "${vehicleSearch.trim()}"`}
                </p>

                <div className="space-y-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-gray-700">Tipo de uso</span>
                    <span className="text-xs text-gray-500">
                      Sugestão automática, mas você pode ajustar.
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {USAGE_OPTIONS.map((usageType) => (
                      <button
                        key={usageType}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, usage_type: usageType }));
                          if (errors.usage_type) setErrors((prev) => ({ ...prev, usage_type: '' }));
                        }}
                        className={`rounded-xl px-4 py-3 text-sm font-semibold border transition-all ${
                          formData.usage_type === usageType
                            ? 'bg-purple-600 text-white border-transparent shadow-premium-colored'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        {usageType}
                      </button>
                    ))}
                  </div>
                  {errors.usage_type && <p className="text-sm text-red-600 font-medium">{errors.usage_type}</p>}
                </div>
              </div>
            )}
            {errors.vehicle_plate && <p className="mt-2 text-sm text-red-600 font-medium">{errors.vehicle_plate}</p>}
          </div>

          <ChipSelect
            label="Motivo"
            value={formData.reason}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, reason: value }));
              if (errors.reason) setErrors((prev) => ({ ...prev, reason: '' }));
            }}
            suggestions={REASON_SUGGESTIONS}
            placeholder="Digite ou selecione o motivo"
            required
            error={errors.reason}
            disabled={isReturnMode}
          />

          <ChipSelect
            label="Autorizacao"
            value={formData.authorized_by}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, authorized_by: value }));
              if (errors.authorized_by) setErrors((prev) => ({ ...prev, authorized_by: '' }));
            }}
            suggestions={AUTHORIZATION_SUGGESTIONS}
            placeholder="Digite ou selecione quem autorizou"
            required
            error={errors.authorized_by}
            disabled={isReturnMode}
          />
        </div>
      )}

      <div className={`glass card-shine rounded-2xl p-6 sm:p-8 space-y-6 shadow-premium animate-fade-in ${
        isReturnMode ? 'opacity-60 bg-gray-50' : ''
      }`} style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200/50 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">Retirada</h3>
            <p className="text-sm text-gray-500">Informacoes de quem retirou</p>
          </div>
          {isReturnMode && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-200 border border-gray-300">
              <span className="text-xs font-semibold text-gray-600">Somente leitura</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Data"
            type="date"
            value={formData.pickup_date}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, pickup_date: e.target.value }));
              if (errors.pickup_date) setErrors((prev) => ({ ...prev, pickup_date: '' }));
            }}
            disabled={isReturnMode}
            required
            error={errors.pickup_date}
          />

          <Input
            label="Hora"
            type="time"
            value={formData.pickup_time}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, pickup_time: e.target.value }));
              if (errors.pickup_time) setErrors((prev) => ({ ...prev, pickup_time: '' }));
            }}
            disabled={isReturnMode}
            required
            error={errors.pickup_time}
          />
        </div>

        <Input
          label="Nome"
          value={formData.pickup_name}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, pickup_name: e.target.value }));
            if (errors.pickup_name) setErrors((prev) => ({ ...prev, pickup_name: '' }));
          }}
          disabled={isReturnMode}
          placeholder="Nome completo de quem retirou"
          required
          error={errors.pickup_name}
        />

        {isReturnMode ? (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Assinatura</label>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <img
                src={safeSignatureSource(formData.pickup_signature)}
                alt="Assinatura de retirada"
                className="w-full max-h-32 sm:max-h-40 object-contain"
              />
            </div>
          </div>
        ) : (
          <SignaturePad
            label="Assinatura"
            value={formData.pickup_signature}
            onChange={(signature) => {
              setFormData((prev) => ({ ...prev, pickup_signature: signature }));
              if (errors.pickup_signature) setErrors((prev) => ({ ...prev, pickup_signature: '' }));
            }}
            disabled={isReturnMode}
            required
            error={errors.pickup_signature}
          />
        )}
      </div>

      {isReturnMode && (
        <div className="glass rounded-2xl p-6 bg-gray-50 border border-gray-200 shadow-sm -mt-3">
          <p className="text-sm text-gray-600">
            Os dados da retirada estao travados para manter o historico. Preencha abaixo apenas a devolucao.
          </p>
        </div>
      )}

      {!isNewPickup && (
        <div className="glass card-shine rounded-2xl p-6 sm:p-8 space-y-6 shadow-premium animate-fade-in" style={{ animationDelay: isReturnMode ? '0.1s' : '0.2s' }}>
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200/50">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <LogIn className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">Devolucao</h3>
              <p className="text-sm text-gray-500">
                {isReturnMode ? 'Registre os dados de devolucao' : 'Atualize os dados de devolucao, se necessario'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Data"
              type="date"
              value={formData.return_date || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, return_date: e.target.value }));
                if (errors.return_date) setErrors((prev) => ({ ...prev, return_date: '' }));
              }}
              required={isReturnMode}
              error={errors.return_date}
            />

            <Input
              label="Hora"
              type="time"
              value={formData.return_time || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, return_time: e.target.value }));
                if (errors.return_time) setErrors((prev) => ({ ...prev, return_time: '' }));
              }}
              required={isReturnMode}
              error={errors.return_time}
            />
          </div>

          <Input
            label="Nome"
            value={formData.return_name || ''}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, return_name: e.target.value }));
              if (errors.return_name) setErrors((prev) => ({ ...prev, return_name: '' }));
            }}
            placeholder="Nome completo de quem devolveu"
            required={isReturnMode}
            error={errors.return_name}
          />

          <SignaturePad
            label="Assinatura"
            value={formData.return_signature || ''}
            onChange={(signature) => {
              setFormData((prev) => ({ ...prev, return_signature: signature }));
              if (errors.return_signature) setErrors((prev) => ({ ...prev, return_signature: '' }));
            }}
            required={isReturnMode}
            error={errors.return_signature}
          />
        </div>
      )}

      {!isReturnMode && (
        <div className="glass card-shine rounded-2xl p-6 sm:p-8 shadow-premium animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Textarea
            label="Observacoes"
            value={formData.observations || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, observations: e.target.value }))}
            placeholder="Informacoes adicionais (opcional)"
            rows={4}
            maxLength={500}
          />
        </div>
      )}

      <div
        className={`flex flex-col-reverse sm:flex-row gap-4 sm:justify-end animate-fade-in ${
          isReturnMode
            ? 'sticky bottom-0 z-20 -mx-6 sm:-mx-8 px-6 sm:px-8 py-4 bg-white/95 backdrop-blur border-t border-gray-200'
            : ''
        }`}
        style={{ animationDelay: isReturnMode ? '0.2s' : '0.4s' }}
      >
        {isNewPickup && (
          <button
            type="button"
            onClick={handleClear}
            className="group relative w-full sm:w-auto px-8 py-3.5 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
            disabled={isSubmitting}
          >
            <RotateCcw className="w-5 h-5" />
            <span>Limpar Formulario</span>
          </button>
        )}
        <button
          type="submit"
          className="group relative w-full sm:w-auto px-8 py-3.5 gradient-primary text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>{isReturnMode ? 'Registrando devolucao...' : 'Salvando...'}</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>
                {isReturnMode
                  ? 'Confirmar Devolucao'
                  : editData?.id
                    ? 'Atualizar Registro'
                    : 'Salvar Retirada'}
              </span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

