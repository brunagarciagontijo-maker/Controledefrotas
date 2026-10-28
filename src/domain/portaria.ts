import type { FleetVehicle, OperationalMovement, PersonType, VehicleRecord } from '../types/database.ts';
import { safeSignatureSource } from '../utils/signature.ts';
export function validateDepartureSignature(signature: string): string[] {
    return safeSignatureSource(signature) && signature.startsWith('data:image/png;base64,iVBORw0KGgo') ? [] : ['Confirme a assinatura do responsável pela saída.'];
}
// Os seis itens ja existentes no sistema, agora com evidencia individual quando exigida.
export const REQUIRED_PHOTO_ITEMS = [
    { key: 'pneus', label: 'Pneus e estepe' },
    { key: 'luzes', label: 'Luzes e sinalização' },
    { key: 'vidros', label: 'Vidros e espelhos' },
    { key: 'limpeza', label: 'Limpeza geral' },
    { key: 'odometro', label: 'Odômetro conferido' },
    { key: 'avarias', label: 'Avarias e estado geral' },
] as const;
export type PhotoItem = typeof REQUIRED_PHOTO_ITEMS[number]['key'];
export interface DepartureDecision {
    cobliAssociated: boolean | null;
    driverReason: string;
}
export interface PhotoEvidence {
    item: PhotoItem;
    path: string;
    mime: string;
}
export type EvidenceFiles = Partial<Record<PhotoItem, File>>;
export function validateDeparture(decision: DepartureDecision, items: readonly string[]): string[] {
    const errors: string[] = [];
    if (typeof decision.cobliAssociated !== 'boolean')
        errors.push('Selecione a associação do motorista no Cobli.');
    if (decision.cobliAssociated === false) {
        if (!decision.driverReason.trim())
            errors.push('Informe o motivo declarado pelo motorista para a ausência de associação.');
        if (REQUIRED_PHOTO_ITEMS.some(item => !items.includes(item.key)))
            errors.push('Fotografe todos os seis itens obrigatórios do checklist.');
        if (new Set(items).size !== items.length || items.some(key => !REQUIRED_PHOTO_ITEMS.some(item => item.key === key)))
            errors.push('Os itens de evidência são inválidos.');
    }
    return errors;
}
export function validateEvidenceFiles(decision: DepartureDecision, files: EvidenceFiles): string[] {
    const errors = validateDeparture(decision, Object.keys(files));
    if (decision.cobliAssociated === false) {
        const selected = Object.values(files);
        const identifiers = selected.map(file => `${file.name}:${file.size}:${file.lastModified}`);
        if (new Set(identifiers).size !== identifiers.length)
            errors.push('Use uma fotografia distinta para cada item.');
        if (selected.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024))
            errors.push('Use fotos JPEG, PNG ou WebP de até 10 MB.');
    }
    return errors;
}
export function validatePersonEntry(personType: PersonType, reason: string, document: {
    type: string;
    size: number;
} | null, captured: boolean): string[] {
    if (personType === 'Funcionario')
        return [];
    const errors: string[] = [];
    if (!reason.trim())
        errors.push('Informe o motivo da visita.');
    const types = personType === 'Visitante' ? ['image/jpeg', 'image/png', 'image/webp'] : ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!document || !types.includes(document.type) || document.size <= 0 || document.size > 10 * 1024 * 1024)
        errors.push(personType === 'Visitante' ? 'Capture uma foto válida do documento, de até 10 MB.' : 'Anexe um documento permitido de até 10 MB.');
    if (personType === 'Visitante' && !captured)
        errors.push('Capture o documento pela câmera.');
    return errors;
}
export function availability(vehicles: FleetVehicle[], movements: OperationalMovement[], records: VehicleRecord[]) {
    const busy = new Set([
        ...movements.filter(row => row.status === 'Em aberto').map(row => row.vehicle_plate.trim().toUpperCase()),
        ...records.filter(row => row.status === 'Em uso').map(row => row.vehicle_plate.trim().toUpperCase()),
    ]);
    return vehicles.map(vehicle => {
        const hasOpenMovement = busy.has(vehicle.plate.trim().toUpperCase()) || movements.some(row => row.status === 'Em aberto' && row.vehicle_id === vehicle.id);
        return { vehicle, hasOpenMovement, available: vehicle.status === 'Ativo' && !hasOpenMovement && vehicle.in_patio,
            expectedPresent: vehicle.in_patio && !hasOpenMovement,
            requiresConference: !vehicle.in_patio && !hasOpenMovement,
            inconsistent: vehicle.in_patio && hasOpenMovement };
    });
}
