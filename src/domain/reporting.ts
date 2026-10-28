import type { OperationalMovement, VehicleRecord } from '../types/database';
import{linkVehicleFlows}from'./reconciliation.ts';
// Projecao somente para indicadores; nao converte nem grava registros no banco.
export function reportingRecords(legacy: VehicleRecord[], movements: OperationalMovement[]): VehicleRecord[] {
  const linked=linkVehicleFlows(legacy,movements);
  return [...legacy.filter(row=>!linked.has(row.id)), ...movements.map(row => {
    const details=row.checklist&&typeof row.checklist==='object'&&!Array.isArray(row.checklist)?row.checklist:{};
    return ({
    id: `operacao:${row.id}`, vehicle_plate: row.vehicle_plate, reason: typeof details.operation_reason==='string'&&details.operation_reason.trim()?details.operation_reason:row.operation_type,
    authorized_by: typeof details.authorization_note==='string'&&details.authorization_note.trim()?details.authorization_note:'Fluxo Portaria', usage_type: 'Comum' as const,
    pickup_date: row.entry_date, pickup_time: row.entry_time, pickup_name: row.driver_name,
    pickup_signature: '', return_date: row.exit_date, return_time: row.exit_time,
    return_name: row.status === 'Concluida' ? row.driver_name : null, return_signature: null,
    observations: row.entry_observations || '', status: row.status === 'Em aberto' ? 'Em uso' as const : 'Devolvido' as const,
    created_at: row.created_at, updated_at: row.updated_at, created_by: row.created_by,
  });})];
}
