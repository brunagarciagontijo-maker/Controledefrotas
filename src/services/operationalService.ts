import { signedFileUrl, validateUpload } from '../lib/privateFiles';
import { supabase } from '../lib/supabase';
import { isDemo } from '../demo/mode';
import { demoStore } from '../domain/demoStore';
import { requireDevEnvironment } from '../lib/runtime';
import type {
  DriverInput,
  DriverRecord,
  FuelLevel,
  Json,
  OperationalMovement,
  OperationType,
} from '../types/database';

const PHOTO_BUCKET = 'vehicle-operation-photos';
const DRIVER_CNH_BUCKET = 'person-documents';

export interface MovementInput {
  vehicle_id: string;
  vehicle_plate: string;
  operation_type: OperationType;
  driver_id: string | null;
  driver_name: string;
  driver_cnh_number: string | null;
  driver_cnh_valid_until: string | null;
  qr_identifier?: string | null;
  entry_date: string;
  entry_time: string;
  entry_odometer: number;
  entry_fuel_level: FuelLevel;
  entry_observations?: string;
  checklist: Json;
}

export interface MovementCloseInput {
  driver_id?: string | null;
  driver_name?: string;
  driver_cnh_number?: string | null;
  driver_cnh_valid_until?: string | null;
  exit_date: string;
  exit_time: string;
  exit_odometer: number;
  exit_fuel_level: FuelLevel;
  exit_observations?: string;
  checklist: Json;
}

async function uploadPhotos(movementId: string, phase: 'Entrada' | 'Saida', files: File[]) {
  const rows: Array<{ movement_id: string; phase: 'Entrada' | 'Saida'; file_path: string; file_url: string; caption: string }> = [];
  try {
    for (const [index, file] of files.entries()) {
      validateUpload(file, 'photo');
      const name = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = movementId + '/' + phase.toLowerCase() + '/' + Date.now() + '-' + index + '-' + name;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(filePath, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      rows.push({ movement_id: movementId, phase, file_path: filePath, file_url: '', caption: file.name });
    }
    const { error } = rows.length ? await supabase.from('operational_photos').insert(rows) : { error: null };
    if (error) throw error;
    return rows;
  } catch {
    if (rows.length) await supabase.storage.from(PHOTO_BUCKET).remove(rows.map(row => row.file_path));
    throw new Error('Movimentacao salva. As fotos nao foram concluidas; confira o registro antes de tentar novamente.');
  }
}

function normalizeText(value: string) {
  return value.trim().toUpperCase();
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const operationalService = {
  async listDrivers(): Promise<DriverRecord[]> {
    if(isDemo())return demoStore.snapshot().people.filter(row=>row.is_driver);
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('is_driver', true)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  },

  async createDriver(input: DriverInput): Promise<DriverRecord> {
    if(isDemo())return demoStore.createPerson({...input,person_type:input.person_type||'Funcionario',is_driver:true});
    const payload = {
      ...input,
      person_type: input.person_type || 'Funcionario',
      name: input.name.trim(),
      document_number: input.document_number?.trim() || null,
      cnh_number: input.cnh_number?.trim() ? normalizeText(input.cnh_number) : null,
      cnh_valid_until: input.cnh_valid_until?.trim() || null,
      origin: input.origin || 'manual',
      is_active: input.is_active ?? true,
      is_driver: true,
      phone: input.phone?.trim() || '',
      company: input.company?.trim() || '',
      notes: input.notes?.trim() || '',
    };

    const { data, error } = await supabase.from('people').insert(payload).select().single();

    if (error) {
      throw error;
    }

    return data;
  },

  async updateDriver(id: string, input: Partial<DriverInput>): Promise<DriverRecord> {
    if(isDemo())return demoStore.updatePerson(id,{...input,is_driver:true});
    const payload = {
      ...input,
      ...(input.person_type ? { person_type: input.person_type } : {}),
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.document_number !== undefined ? { document_number: input.document_number?.trim() || null } : {}),
      ...(input.cnh_number !== undefined
        ? { cnh_number: input.cnh_number?.trim() ? normalizeText(input.cnh_number) : null }
        : {}),
      ...(input.cnh_valid_until !== undefined
        ? { cnh_valid_until: input.cnh_valid_until?.trim() || null }
        : {}),
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      is_driver: true,
      ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
      ...(input.company !== undefined ? { company: input.company.trim() } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('people').update(payload).eq('id', id).select().single();

    if (error) {
      throw error;
    }

    return data;
  },

  async uploadDriverCnh(driver: DriverRecord, file: File): Promise<DriverRecord> {
    validateUpload(file, 'document');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${driver.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(DRIVER_CNH_BUCKET)
      .upload(filePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    try {
      const updatedDriver = await this.updateDriver(driver.id, {
        cnh_file_path: filePath,
        cnh_file_url: null,
        cnh_file_name: file.name,
        cnh_file_type: file.type || null,
      });

      if (driver.cnh_file_path && requireDevEnvironment().mode !== 'original') {
        await supabase.storage.from(DRIVER_CNH_BUCKET).remove([driver.cnh_file_path]);
      }

      return updatedDriver;
    } catch (error) {
      // Nao apagar evidencias no original quando o resultado da atualizacao for incerto.
      if(requireDevEnvironment().mode !== 'original')await supabase.storage.from(DRIVER_CNH_BUCKET).remove([filePath]);
      throw error;
    }
  },

  async deleteDriver(id: string): Promise<void> {
    if(isDemo()){demoStore.updatePerson(id,{is_active:false});return;}
    const { error } = await supabase
      .from('people')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw error;
    }
  },

  async getDriverCnhUrl(driver: DriverRecord): Promise<string | null> {
    if(isDemo()){const file=demoStore.documents.get(driver.cnh_file_path||'');return file?URL.createObjectURL(file):null;}
    if(!driver.cnh_file_path)return null;
    if(requireDevEnvironment().mode==='original'){
      const {data:bucket,error}=await supabase.rpc('portaria_document_bucket',{file_path:driver.cnh_file_path});
      if(error||!bucket)throw new Error('Documento privado ausente ou ambiguo. Revise o Storage.');
      return signedFileUrl(bucket,driver.cnh_file_path);
    }
    return signedFileUrl(DRIVER_CNH_BUCKET,driver.cnh_file_path);
  },

  async listPhotos(movementId: string) {
    if(isDemo())return [...(demoStore.photoFiles.get(movementId)||[]).map(photo=>({id:photo.item,movement_id:movementId,phase:'Saida' as const,file_path:'memoria/'+photo.item,file_url:URL.createObjectURL(photo.file),caption:photo.item,created_by:null,created_at:null})),...(demoStore.returnPhotoFiles.get(movementId)||[]).map((file,index)=>({id:'retorno-'+index,movement_id:movementId,phase:'Entrada' as const,file_path:'memoria/retorno/'+index,file_url:URL.createObjectURL(file),caption:'Foto de retorno '+(index+1),created_by:null,created_at:null}))];
    const { data, error } = await supabase.from('operational_photos').select('*').eq('movement_id', movementId).order('created_at');
    if (error) throw error;
    const old=await Promise.all((data || []).map(async photo => ({ ...photo, file_url: await signedFileUrl(PHOTO_BUCKET, photo.file_path) })));
    if(requireDevEnvironment().mode!=='original')return old;
    const {data:next,error:nextError}=await supabase.rpc('portaria_movement_evidence',{movement_id:movementId});
    if(nextError)throw new Error('Evidencias privadas indisponiveis.');
    const photos=(next||[]) as unknown as Array<{item:string;path:string}>;
    return [...old,...await Promise.all(photos.map(async photo=>({id:photo.path,movement_id:movementId,phase:'Saida' as const,file_path:photo.path,file_url:await signedFileUrl('portaria-evidence',photo.path),caption:photo.item,created_by:null,created_at:''})))];
  },

  async listMovements(): Promise<OperationalMovement[]> {
    if(isDemo())return demoStore.snapshot().movements;
    const { data, error } = await supabase.from('operational_movements').select('*').order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  },

  async createMovement(_input: MovementInput, _photos: File[] = []): Promise<OperationalMovement> {
    void _input; void _photos;
    throw new Error('Use a Portaria para confirmar Cobli e evidencias antes da saida.');
  },

  async closeMovement(
    id: string,
    input: MovementCloseInput,
    exitPhotos: File[] = []
  ): Promise<OperationalMovement> {
    if(isDemo()){exitPhotos.forEach(file=>validateUpload(file,'photo'));const row=demoStore.close(id,input);if(exitPhotos.length)demoStore.returnPhotoFiles.set(id,exitPhotos);return row;}
    const {data:current,error:readError}=await supabase.from('operational_movements').select('checklist').eq('id',id).single();
    if(readError)throw readError;
    if(!current.checklist||typeof current.checklist!=='object'||Array.isArray(current.checklist)||!input.checklist||typeof input.checklist!=='object'||Array.isArray(input.checklist))throw new Error('Checklist inconsistente. Revise o registro sem substituir dados anteriores.');
    const checklist:Json={...current.checklist,entry:input.checklist.entry};
    const { data: movementData, error } = await supabase.from('operational_movements').update({
        ...(input.driver_id !== undefined ? { driver_id: input.driver_id } : {}),
        ...(input.driver_name !== undefined ? { driver_name: input.driver_name.trim() } : {}),
        ...(input.driver_cnh_number !== undefined
          ? { driver_cnh_number: input.driver_cnh_number?.trim() ? normalizeText(input.driver_cnh_number) : null }
          : {}),
        ...(input.driver_cnh_valid_until !== undefined
          ? { driver_cnh_valid_until: input.driver_cnh_valid_until?.trim() || null }
          : {}),
        exit_date: input.exit_date,
        exit_time: input.exit_time,
        exit_odometer: input.exit_odometer,
        exit_fuel_level: input.exit_fuel_level,
        exit_observations: input.exit_observations?.trim() || '',
        checklist,
        status: 'Concluida',
        updated_at: new Date().toISOString(),
      }).eq('id', id).select().single();

    if (error) {
      throw error;
    }

    const movement = movementData;



if (exitPhotos.length > 0) {
      await uploadPhotos(movement.id, 'Entrada', exitPhotos);
    }

    return movement;
  },

  async deleteMovement(id: string): Promise<void> {
    const { error } = await supabase.from('operational_movements').delete().eq('id', id);
    if (error) throw error;
  },

  normalizeName,
};
