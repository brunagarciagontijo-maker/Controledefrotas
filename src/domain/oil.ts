import { businessTime } from './yard.ts';

export const oilLevels = { normal: 'Normal', low: 'Baixo', critical: 'Crítico', unable: 'Não foi possível verificar' } as const;
export type OilLevel = keyof typeof oilLevels;
export interface OilInput { level: OilLevel; notes: string }
export interface OilReading extends OilInput {
  request_id: string; vehicle_id: string; checked_at: string; checked_by_name: string;
}
export interface OilContext {
  current: OilReading | null; latest_valid: OilReading | null; latest_attempt: OilReading | null;
  days_since_valid: number | null; as_of: string;
}
export interface OilHistoryPage { events: OilReading[]; next_cursor: { checked_at: string; request_id: string } | null }
export function validateOil(vehicle: string | null, input?: OilInput | null): asserts input is OilInput {
  if (!vehicle) throw new Error('Identifique um veículo cadastrado antes de verificar o óleo.');
  if (!input || !Object.prototype.hasOwnProperty.call(oilLevels, input.level)) throw new Error('Selecione o nível atual do óleo.');
  if (typeof input.notes !== 'string' || input.notes.length > 2000) throw new Error('Observação do óleo limitada a 2000 caracteres.');
}
export function oilContext(history: OilReading[], vehicle: string | null, asOf = new Date().toISOString()): OilContext {
  const rows = vehicle ? history.filter(row => row.vehicle_id === vehicle && row.checked_at <= asOf) : [];
  const latest = rows[0] || null, valid = rows.find(row => row.level !== 'unable') || null;
  const dayNumber = (date: string) => Date.parse(businessTime(new Date(date)).slice(0, 10) + 'T00:00:00Z') / 86400000;
  return { current: null, latest_valid: valid, latest_attempt: latest,
    days_since_valid: valid ? Math.max(0, dayNumber(asOf) - dayNumber(valid.checked_at)) : null, as_of: asOf };
}
