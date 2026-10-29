import { isDemo } from '../demo/mode';
import { demoStore } from '../domain/demoStore';
import { validateEvidenceFiles, validateDepartureSignature, type DepartureDecision, type EvidenceFiles, type PhotoEvidence, type PhotoItem } from '../domain/portaria';
import { supabase } from '../lib/supabase';
import { validateUpload } from '../lib/privateFiles';
import type { MovementInput } from './operationalService';
import type { Json, OperationalMovement } from '../types/database';
export const portariaService = {
    async depart(input: MovementInput, decision: DepartureDecision, files: EvidenceFiles, requestId: string, signature: string): Promise<OperationalMovement> {
        const errors = [...validateEvidenceFiles(decision, files),...validateDepartureSignature(signature)];
        if (errors.length)
            throw new Error(errors[0]);
        if (isDemo()) {
            const movement=demoStore.depart({...input,checklist:{...input.checklist as object,pickup_signature:signature}}, decision, Object.entries(files).map(([item, file]) => ({ item: item as PhotoItem, path: `ficticio/${item}`, mime: file.type })), requestId);
            demoStore.photoFiles.set(movement.id,Object.entries(files).map(([item,file])=>({item:item as PhotoItem,file})));
            return movement;
        }
        // RPC verifica perfil, disponibilidade, autoria e evidencias no servidor.
        const { data: session } = await supabase.auth.getSession();
        if (!session.session)
            throw new Error('Entre novamente para registrar a saida.');
        const uploaded: PhotoEvidence[] = [];
        for (const [item, file] of Object.entries(decision.cobliAssociated ? {} : files)) {
            validateUpload(file, 'photo');
            const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
            const path = `${session.session.user.id}/${requestId}/${item}/${crypto.randomUUID()}.${extension}`;
            const { error } = await supabase.storage.from('portaria-evidence').upload(path, file, { contentType: file.type, upsert: false });
            if (error)
                throw new Error('Upload incompleto. Nenhuma saida foi confirmada; confira as evidencias pendentes.');
            uploaded.push({ item: item as PhotoItem, path, mime: file.type });
        }
        const { data, error } = await supabase.rpc('portaria_register_departure', { payload: { ...input, pickup_signature: signature, request_id: requestId, cobli_associated: decision.cobliAssociated, driver_reason: decision.driverReason, photos: uploaded } as unknown as Json });
        // Falha de rede pode ocorrer depois do commit. Nunca apagar fotos/registro automaticamente.
        if (error)
            throw new Error('Confirmacao indisponivel. Atualize o historico antes de repetir; a chave da tentativa foi preservada.');
        return data as unknown as OperationalMovement;
    },
    async conference(vehicleId: string, observed: boolean, notes: string) {
        if (isDemo())
            return demoStore.conference(vehicleId, observed, notes);
        const { data, error } = await supabase.rpc('portaria_register_conference', { vehicle_id: vehicleId, observed_present: observed, notes });
        if (error)
            throw new Error('Nao foi possivel registrar a conferencia.');
        return data;
    },
    async conferences() {
        if (isDemo())
            return demoStore.snapshot().conferences;
        const { data, error } = await supabase.rpc('portaria_list_conferences');
        if (error)
            throw new Error('Conferencias indisponiveis.');
        return data as unknown as Array<{
            id: string;
            vehicle_id: string;
            expected: boolean;
            observed: boolean;
            notes: string;
            created_at: string;
        }>;
    },
};
