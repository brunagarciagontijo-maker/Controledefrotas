import { reportError } from '../utils/diagnostics';
import { useAuth } from '../auth/context';
import { can } from '../auth/authorization';
import { requireDevEnvironment } from '../lib/runtime';
import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, Printer, Eye, Edit2, Trash2, BarChart3, TrendingUp, CheckCircle2, Plus, FileSpreadsheet, LogIn } from 'lucide-react';
import { vehicleService } from '../services/vehicleService';
import { vehicleCatalogService } from '../services/vehicleCatalogService';
import { RecordDetails } from './RecordDetails';
import { Modal } from './Modal';
import { VehicleForm } from './VehicleForm';
import { exportToCSV, exportDailyUtilizationExcel, generatePrintReport } from '../utils/export';
import { formatDateBR, getDateKey, toDateInputValue } from '../utils/date';
import type { VehicleRecord, FleetVehicle, VehicleRecordInput } from '../types/database';

interface DatabaseViewProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  refreshTrigger?: number;
}

export function DatabaseView({ onSuccess, onError, refreshTrigger }: DatabaseViewProps) {
  const { profile } = useAuth();
  const canDelete = can(profile, 'delete_records') && requireDevEnvironment().mode !== 'original' && requireDevEnvironment().projectRef !== 'offline';
  const canEdit = can(profile, 'manage_catalog');
  const canEditRecord = (record: VehicleRecord) => record.status === 'Em uso' || canEdit;
  const [filteredRecords, setFilteredRecords] = useState<VehicleRecord[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<FleetVehicle[]>([]);
  const [allVehicles, setAllVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [recordFilterStart, setRecordFilterStart] = useState('');
  const [recordFilterEnd, setRecordFilterEnd] = useState('');
  const [vehicleFilterStart, setVehicleFilterStart] = useState('');
  const [vehicleFilterEnd, setVehicleFilterEnd] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<VehicleRecord | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<VehicleRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const data = await vehicleService.listRecords({
        search: searchTerm,
        status: statusFilter,
        startDate: recordFilterStart,
        endDate: recordFilterEnd,
      });
      setFilteredRecords(data);
    } catch (error) {
      reportError('Error loading records:', error);
      onError('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, recordFilterStart, recordFilterEnd, onError]);

  const loadVehiclesByDate = useCallback(async () => {
    try {
      const allVehicles = await vehicleCatalogService.listVehicles();
      setAllVehicles(allVehicles);
      if (vehicleFilterStart) {
        const selectedEnd = vehicleFilterEnd || vehicleFilterStart;
        const filterStart = vehicleFilterStart <= selectedEnd ? vehicleFilterStart : selectedEnd;
        const filterEnd = vehicleFilterStart <= selectedEnd ? selectedEnd : vehicleFilterStart;
        
        const filtered = allVehicles.filter(v => {
          const createdDateStr = getDateKey(v.created_at);
          if (!createdDateStr) return false;
          return createdDateStr >= filterStart && createdDateStr <= filterEnd;
        });
        
        setFilteredVehicles(filtered);
      } else {
        setFilteredVehicles(allVehicles);
      }
    } catch (error) {
      reportError('Erro ao carregar veículos:', error);
    }
  }, [vehicleFilterStart, vehicleFilterEnd]);

  useEffect(() => {
    // Pré-popular com a data de hoje ao montar o componente
    const todayStr = toDateInputValue(new Date());
    setVehicleFilterStart(todayStr);
    setVehicleFilterEnd(todayStr);
  }, []);

  useEffect(() => {
    loadRecords();
  }, [refreshTrigger, loadRecords]);

  useEffect(() => {
    loadVehiclesByDate();
  }, [loadVehiclesByDate]);

  const handleDelete = async (id: string) => {
    if (!canDelete) { onError('Exclusao restrita ao administrador.'); return; }
    try {
      await vehicleService.deleteRecord(id);
      onSuccess('Registro excluído com sucesso');
      loadRecords();
    } catch (error) {
      reportError('Error deleting record:', error);
      onError('Erro ao excluir registro');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleEdit = (record: VehicleRecord) => {
    if (record.status !== 'Em uso' && !canEdit) { onError('Edicao restrita ao administrador.'); return; }
    setRecordToEdit(record);
    setIsEditOpen(true);
  };

  const handleExport = () => {
    exportToCSV(filteredRecords);
    onSuccess('Relatório exportado com sucesso');
  };

  const handleDailyUtilizationExport = () => {
    exportDailyUtilizationExcel(filteredRecords, allVehicles);
    onSuccess('Utilização diária exportada com sucesso');
  };

  const handlePrint = () => {
    generatePrintReport(filteredRecords, {
      startDate: recordFilterStart,
      endDate: recordFilterEnd,
      status: statusFilter,
    });
  };

  const getRecordUsageType = (record: VehicleRecord) => record.usage_type || 'Comum';

  const stats = {
    total: filteredRecords.length,
    inUse: filteredRecords.filter((r) => r.status === 'Em uso').length,
    returned: filteredRecords.filter((r) => r.status === 'Devolvido').length,
  };

  const toVehicleFormData = (record: VehicleRecord): VehicleRecordInput & { id: string } => ({
    id: record.id,
    vehicle_plate: record.vehicle_plate,
    reason: record.reason,
    authorized_by: record.authorized_by,
    usage_type: record.usage_type || 'Comum',
    pickup_date: record.pickup_date,
    pickup_time: record.pickup_time,
    pickup_name: record.pickup_name,
    pickup_signature: record.pickup_signature,
    return_date: record.return_date || undefined,
    return_time: record.return_time || undefined,
    return_name: record.return_name || undefined,
    return_signature: record.return_signature || undefined,
    observations: record.observations || undefined,
    status: record.status,
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Card de Filtros Premium */}
      <div className="glass card-shine rounded-2xl p-6 shadow-premium animate-fade-in">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-hover:text-red-500 transition-colors" />
              <input
                type="text"
                placeholder="Buscar por placa/veículo ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-red-100 focus:border-red-500 transition-all bg-white text-gray-900 font-medium placeholder:text-gray-400 hover:border-gray-300"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            <select
              aria-label="Status dos registros anteriores"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 sm:flex-none min-w-[140px] px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-red-100 focus:border-red-500 transition-all bg-white text-gray-900 font-medium hover:border-gray-300 cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value="Em uso">Em uso</option>
              <option value="Devolvido">Devolvido</option>
            </select>

            <input
              type="date"
              aria-label="Registros desde"
              value={recordFilterStart}
              onChange={(e) => setRecordFilterStart(e.target.value)}
              placeholder="Data inicial"
              className="flex-1 sm:flex-none px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-red-100 focus:border-red-500 transition-all bg-white text-gray-900 font-medium hover:border-gray-300"
            />

            <input
              type="date"
              aria-label="Registros até"
              value={recordFilterEnd}
              onChange={(e) => setRecordFilterEnd(e.target.value)}
              placeholder="Data final"
              className="flex-1 sm:flex-none px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-red-100 focus:border-red-500 transition-all bg-white text-gray-900 font-medium hover:border-gray-300"
            />
          </div>
        </div>

        {/* Cards de Estatísticas Premium */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative group">
            <div className="relative glass rounded-2xl p-6 interactive-lift cursor-pointer overflow-hidden">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-red-600" />
                </div>
                <div className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full">Total</div>
              </div>
              <div className="text-4xl font-extrabold text-red-600 mb-1">
                {stats.total}
              </div>
              <div className="text-sm font-semibold text-gray-600">Registros</div>
            </div>
          </div>

          <div className="relative group">
            <div className="relative glass rounded-2xl p-6 interactive-lift cursor-pointer overflow-hidden">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="text-xs font-semibold text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full">Ativos</div>
              </div>
              <div className="text-4xl font-extrabold text-yellow-600 mb-1">
                {stats.inUse}
              </div>
              <div className="text-sm font-semibold text-gray-600">Em Uso</div>
            </div>
          </div>

          <div className="relative group">
            <div className="relative glass rounded-2xl p-6 interactive-lift cursor-pointer overflow-hidden">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">Completo</div>
              </div>
              <div className="text-4xl font-extrabold text-green-600 mb-1">
                {stats.returned}
              </div>
              <div className="text-sm font-semibold text-gray-600">Devolvidos</div>
            </div>
          </div>
        </div>

        {/* Botões de Ação Premium */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleExport}
            className="group relative w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <Download className="w-5 h-5" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={handleDailyUtilizationExport}
            className="group relative w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>Utilização Diária Excel</span>
          </button>
          <button
            onClick={handlePrint}
            className="group relative w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3.5 gradient-primary text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <Printer className="w-5 h-5" />
            <span>Imprimir Relatório</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-16 text-center shadow-premium animate-pulse">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-red-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-lg font-semibold text-gray-700">Carregando registros...</p>
          <p className="text-sm text-gray-500 mt-2">Aguarde um momento</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center shadow-premium animate-fade-in">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <Filter className="w-12 h-12 text-gray-400" />
          </div>
          <p className="text-xl font-bold text-gray-700 mb-2">Nenhum registro encontrado</p>
          <p className="text-gray-500 max-w-md mx-auto">
            Tente ajustar os filtros ou adicionar um novo registro
          </p>
        </div>
      ) : (
        <>
          {/* Tabela Desktop Premium */}
          <div className="hidden 2xl:block glass rounded-2xl shadow-premium overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Placa/Veículo
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Data/Hora Retirada
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nome Retirada
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tipo de Uso
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Data/Hora Devolução
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 backdrop-blur-sm divide-y divide-gray-200">
                  {filteredRecords.map((record, index) => (
                    <tr 
                      key={record.id} 
                      className="group hover:bg-white/80 transition-all duration-200 animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm">
                            {record.vehicle_plate.substring(0, 2)}
                          </div>
                          <span className="font-semibold text-gray-900">{record.vehicle_plate}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatDateBR(record.pickup_date)}
                        </div>
                        <div className="text-xs text-gray-500 font-medium">{record.pickup_time}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                        {record.pickup_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${
                            record.status === 'Em uso'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${
                            getRecordUsageType(record) === 'Rota'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {getRecordUsageType(record)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.return_date ? (
                          <>
                            <div className="text-sm font-semibold text-gray-900">
                              {formatDateBR(record.return_date)}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">{record.return_time}</div>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 font-medium">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedRecord(record);
                              setIsDetailsOpen(true);
                            }}
                            className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="Ver detalhes"
                            aria-label="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {record.status === 'Em uso' ? (
                            <button
                              disabled={!canEditRecord(record)} onClick={() => handleEdit(record)}
                              className="group px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 hover:shadow-md"
                              title="Registrar devolução"
                            >
                              <LogIn className="w-4 h-4" />
                              <span>Devolução</span>
                            </button>
                          ) : (
                            <button
                              disabled={!canEditRecord(record)} onClick={() => handleEdit(record)}
                              className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            disabled={!canDelete} onClick={() => setDeleteConfirm(record.id)}
                            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards Mobile */}
          <div className="2xl:hidden space-y-4">
            {filteredRecords.map((record, index) => (
              <div 
                key={record.id} 
                className="glass rounded-2xl p-5 shadow-md animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-700 font-bold flex-shrink-0">
                      {record.vehicle_plate.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-lg truncate">{record.vehicle_plate}</p>
                      <p className="text-sm text-gray-600 truncate">{record.pickup_name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${
                        record.status === 'Em uso'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {record.status}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${
                        getRecordUsageType(record) === 'Rota'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {getRecordUsageType(record)}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-700 min-w-[80px]">Retirada:</span>
                    <span className="text-gray-900">
                      {formatDateBR(record.pickup_date)} às {record.pickup_time}
                    </span>
                  </div>
                  {record.return_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-700 min-w-[80px]">Devolução:</span>
                      <span className="text-gray-900">
                        {formatDateBR(record.return_date)} às {record.return_time}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setSelectedRecord(record);
                      setIsDetailsOpen(true);
                    }}
                    aria-label="Ver detalhes"
                    className="flex flex-col items-center gap-1.5 px-3 py-3 bg-blue-50 text-blue-600 rounded-xl font-semibold text-xs hover:bg-blue-100 transition-colors col-span-2 sm:col-span-1"
                  >
                    <Eye className="w-5 h-5" />
                    Ver
                  </button>
                  {record.status === 'Em uso' ? (
                    <button
                      disabled={!canEditRecord(record)} onClick={() => handleEdit(record)}
                      className="flex flex-col items-center gap-1.5 px-3 py-3 bg-purple-600 text-white rounded-xl font-semibold text-xs hover:bg-purple-700 transition-colors"
                    >
                      <LogIn className="w-5 h-5" />
                      <span aria-label="Registrar devolução">Devol.</span>
                    </button>
                  ) : (
                    <button
                      disabled={!canEditRecord(record)} onClick={() => handleEdit(record)}
                      className="flex flex-col items-center gap-1.5 px-3 py-3 bg-green-50 text-green-600 rounded-xl font-semibold text-xs hover:bg-green-100 transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                      Editar
                    </button>
                  )}
                  <button
                    disabled={!canDelete} onClick={() => setDeleteConfirm(record.id)}
                    className="flex flex-col items-center gap-1.5 px-3 py-3 bg-red-50 text-red-600 rounded-xl font-semibold text-xs hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Card de Filtro de Veículos Cadastrados */}
      <div className="glass card-shine rounded-2xl p-6 shadow-premium animate-fade-in">
        <div className="flex items-center gap-3 pb-4 mb-6 border-b border-gray-200/50">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Filter className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Filtrar Veículos Cadastrados</h3>
            <p className="text-sm text-gray-600">Selecione uma data para visualizar os veículos cadastrados</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Data Inicial</label>
            <input
              type="date"
              value={vehicleFilterStart}
              onChange={(e) => setVehicleFilterStart(e.target.value)}
              className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all bg-white text-gray-900 font-medium hover:border-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Data Final</label>
            <input
              type="date"
              value={vehicleFilterEnd}
              onChange={(e) => setVehicleFilterEnd(e.target.value)}
              className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all bg-white text-gray-900 font-medium hover:border-gray-300"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              setVehicleFilterStart('');
              setVehicleFilterEnd('');
            }}
            className="flex-1 px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 shadow-sm"
          >
            Limpar Filtro
          </button>
          <button
            onClick={() => loadVehiclesByDate()}
            className="flex-1 px-6 py-3.5 gradient-primary text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <Filter className="w-5 h-5" />
            <span>Confirmar Filtro</span>
          </button>
        </div>
      </div>

      {/* Seção de Veículos da Gestão Cadastrados naquela Data */}
      {(filteredVehicles.length > 0 || !!vehicleFilterStart) && (
        <div className="glass rounded-2xl shadow-premium overflow-hidden animate-fade-in">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Veículos Cadastrados</h3>
                <p className="text-sm text-gray-600">
                  {!vehicleFilterStart
                    ? 'Todos os veículos cadastrados'
                    : vehicleFilterStart === (vehicleFilterEnd || vehicleFilterStart)
                    ? `Cadastrados em ${formatDateBR(vehicleFilterStart)}`
                    : `Cadastrados entre ${formatDateBR(vehicleFilterStart)} e ${formatDateBR(vehicleFilterEnd)}`
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {filteredVehicles.length === 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                Nenhum veículo cadastrado no período selecionado.
              </div>
            )}
            {filteredVehicles.map((vehicle, index) => (
              <div
                key={vehicle.id}
                className="flex items-start justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 hover:border-blue-300 transition-all duration-200 animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {vehicle.plate.substring(0, 2)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-bold text-gray-900 text-lg">{vehicle.plate}</p>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        vehicle.status === 'Ativo'
                          ? 'bg-green-100 text-green-700'
                          : vehicle.status === 'Inativo'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {vehicle.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium mb-1">{vehicle.name}</p>
                    {vehicle.responsible_name && (
                      <p className="text-sm text-gray-600">📋 {vehicle.responsible_name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Cadastrado em {formatDateBR(vehicle.created_at)} às {vehicle.created_at ? new Date(vehicle.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RecordDetails
        record={selectedRecord}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedRecord(null);
        }}
      />

      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setRecordToEdit(null);
        }}
        title={recordToEdit?.status === 'Em uso' ? 'Registrar Devolucao' : 'Editar Registro'}
        size="xl"
      >
        <VehicleForm
          editData={recordToEdit ? toVehicleFormData(recordToEdit) : undefined}
          onSuccess={() => {
            onSuccess('Registro atualizado com sucesso');
            setIsEditOpen(false);
            setRecordToEdit(null);
            loadRecords();
          }}
          onError={onError}
        />
      </Modal>

      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmar Exclusão"
        size="sm"
      >
        <div className="space-y-6">
          <div className="text-center p-6 bg-red-50 rounded-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-lg font-bold text-gray-900 mb-2">Tem certeza?</p>
            <p className="text-gray-700">Esta ação não pode ser desfeita.</p>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 shadow-sm"
            >
              Cancelar
            </button>
            <button
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="flex-1 px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
