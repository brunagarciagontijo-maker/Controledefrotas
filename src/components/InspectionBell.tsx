import { reportError } from '../utils/diagnostics';
import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { Modal } from './Modal';
import { Textarea } from './Textarea';
import { inspectionService } from '../services/inspectionService';
import { formatDateBR } from '../utils/date';
import type { VehicleInspectionRequest } from '../types/database';

const INSPECTION_CHECKLIST_ITEMS = [
  { key: 'pneus', label: 'Pneus e estepe' },
  { key: 'luzes', label: 'Luzes e sinalização' },
  { key: 'vidros', label: 'Vidros e espelhos' },
  { key: 'limpeza', label: 'Limpeza geral' },
  { key: 'avarias', label: 'Sem avarias aparentes' },
  { key: 'documentos', label: 'Documentos do veículo em dia' },
] as const;

type ChecklistState = Record<string, boolean>;

function createChecklistState(): ChecklistState {
  return INSPECTION_CHECKLIST_ITEMS.reduce<ChecklistState>((acc, item) => {
    acc[item.key] = false;
    return acc;
  }, {});
}

export function InspectionBell() {
  const [requests, setRequests] = useState<VehicleInspectionRequest[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [requestToComplete, setRequestToComplete] = useState<VehicleInspectionRequest | null>(null);
  const [checklist, setChecklist] = useState<ChecklistState>(createChecklistState());
  const [completedNotes, setCompletedNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRequests = async () => {
    try {
      const data = await inspectionService.listRequests();
      setRequests(data);
    } catch (error) {
      reportError('Erro ao carregar solicitações de inspeção:', error);
    }
  };

  useEffect(() => {
    loadRequests();
    const unsubscribe = inspectionService.subscribeToRequests(loadRequests);
    return unsubscribe;
  }, []);

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === 'Pendente'),
    [requests]
  );

  const checklistDone = Object.values(checklist).every(Boolean);

  const openCompleteModal = (request: VehicleInspectionRequest) => {
    setRequestToComplete(request);
    setChecklist(createChecklistState());
    setCompletedNotes('');
  };

  const handleComplete = async () => {
    if (!requestToComplete || !checklistDone) return;

    try {
      setSaving(true);
      await inspectionService.completeRequest(requestToComplete.id, checklist, completedNotes);
      setRequestToComplete(null);
      await loadRequests();
    } catch (error) {
      reportError('Erro ao concluir inspeção:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        title="Inspeções de veículo"
        aria-label="Inspeções de veículo"
      >
        <Bell className="h-5 w-5" />
        {pendingRequests.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {pendingRequests.length}
          </span>
        )}
      </button>

      <Modal isOpen={panelOpen} onClose={() => setPanelOpen(false)} title="Inspeções de veículo" size="lg">
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              Nenhuma inspeção pendente.
            </div>
          ) : (
            pendingRequests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{request.vehicle_plate}</p>
                    <p className="text-sm text-gray-600">{request.vehicle_name}</p>
                    <p className="text-xs text-gray-500">
                      Solicitado por {request.requested_by} em {formatDateBR(request.created_at)}
                    </p>
                    {request.notes && <p className="mt-1 text-sm text-gray-700">{request.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => openCompleteModal(request)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    Iniciar inspeção
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!requestToComplete}
        onClose={() => setRequestToComplete(null)}
        title="Concluir inspeção"
        size="lg"
      >
        {requestToComplete && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-bold text-gray-900">{requestToComplete.vehicle_plate}</p>
              <p className="text-sm text-gray-600">{requestToComplete.vehicle_name}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INSPECTION_CHECKLIST_ITEMS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-2 cursor-pointer rounded-2xl border border-gray-200 bg-gray-50 p-3"
                >
                  <input
                    type="checkbox"
                    checked={checklist[item.key] || false}
                    onChange={(event) =>
                      setChecklist((current) => ({ ...current, [item.key]: event.target.checked }))
                    }
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-gray-800">{item.label}</span>
                </label>
              ))}
            </div>

            <Textarea
              label="Observações da inspeção"
              value={completedNotes}
              onChange={(event) => setCompletedNotes(event.target.value)}
              rows={3}
              placeholder="Opcional"
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setRequestToComplete(null)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving || !checklistDone}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Concluir inspeção'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
