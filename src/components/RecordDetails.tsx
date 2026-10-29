import { safeSignatureSource } from '../utils/signature';
import { Modal } from './Modal';
import type { VehicleRecord } from '../types/database';
import { formatDateBR } from '../utils/date';

interface RecordDetailsProps {
  record: VehicleRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RecordDetails({ record, isOpen, onClose }: RecordDetailsProps) {
  if (!record) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Registro" size="xl">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Informações do Veículo</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-600">Placa/Veículo:</span>
                <p className="text-gray-800">{record.vehicle_plate}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Motivo:</span>
                <p className="text-gray-800">{record.reason}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Autorização:</span>
                <p className="text-gray-800">{record.authorized_by}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Tipo de uso:</span>
                <p className="text-gray-800">{record.usage_type || 'Comum'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Status:</span>
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    record.status === 'Em uso'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {record.status}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Retirada</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-600">Data:</span>
                <p className="text-gray-800">{formatDateBR(record.pickup_date)}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Hora:</span>
                <p className="text-gray-800">{record.pickup_time}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Nome:</span>
                <p className="text-gray-800">{record.pickup_name}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Assinatura:</span>
                <div className="mt-2 border rounded p-2 bg-gray-50">
                  <img
                    src={safeSignatureSource(record.pickup_signature)}
                    alt="Assinatura de retirada"
                    className="max-w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {record.return_date && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Devolução</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Data:</span>
                  <p className="text-gray-800">{formatDateBR(record.return_date)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Hora:</span>
                  <p className="text-gray-800">{record.return_time}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Nome:</span>
                  <p className="text-gray-800">{record.return_name}</p>
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Assinatura:</span>
                <div className="mt-2 border rounded p-2 bg-gray-50">
                  <img
                    src={safeSignatureSource(record.return_signature || '')}
                    alt="Assinatura de devolução"
                    className="max-w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {record.observations && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">Observações</h4>
            <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded">
              {record.observations}
            </p>
          </div>
        )}

        <div className="text-xs text-gray-500 border-t pt-3">
          <p>Criado em: {record.created_at ? new Date(record.created_at).toLocaleString('pt-BR') : '-'}</p>
          {record.updated_at !== record.created_at && (
            <p>Atualizado em: {record.updated_at ? new Date(record.updated_at).toLocaleString('pt-BR') : '-'}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
