import { signedFileUrl, validateUpload } from '../lib/privateFiles';
import { supabase } from '../lib/supabase';
import { isDemo } from '../demo/mode';
import { demoStore } from '../domain/demoStore';
import { validatePersonEntry } from '../domain/portaria';
import { requireDevEnvironment } from '../lib/runtime';
import type {
  AccessRecord,
  AccessRecordInput,
  AccessStatus,
  PersonalVehicle,
  PersonalVehicleInput,
  PersonInput,
  PersonRecord,
  PersonType,
} from '../types/database';

const PERSON_DOCUMENTS_BUCKET = 'person-documents';
const ACCESS_DOCUMENTS_BUCKET = 'access-documents';

export interface PeopleFilters {
  search?: string;
  personType?: PersonType | 'Todos';
  status?: 'Todos' | 'Ativos' | 'Inativos';
}

export interface AccessFilters {
  search?: string;
  personType?: PersonType | 'Todos';
  status?: AccessStatus | 'Todos';
  startDate?: string;
  endDate?: string;
}

function normalizeText(value: string) {
  return value.trim().toUpperCase();
}

function clean(value?: string | null) {
  return value?.trim() || '';
}

function normalizeNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function uploadPrivateFile(bucket: string, folder: string, file: File) {
  validateUpload(file, 'document');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return filePath;
}

export const accessControlService = {
  async listPeople(filters?: PeopleFilters): Promise<PersonRecord[]> {
    if(isDemo())return demoStore.snapshot().people.filter(row=>(!filters?.personType||filters.personType==='Todos'||row.person_type===filters.personType)&&(!filters?.status||filters.status==='Todos'||row.is_active===(filters.status==='Ativos'))&&(!filters?.search||[row.name,row.short_code,row.company,row.phone].some(v=>v?.toLowerCase().includes(filters.search!.trim().toLowerCase()))));
    let query = supabase.from('people').select('*').order('name', { ascending: true });

    const search = clean(filters?.search);
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,document_number.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%,short_code.ilike.%${search}%,cnh_number.ilike.%${search}%`
      );
    }

    if (filters?.personType && filters.personType !== 'Todos') {
      query = query.eq('person_type', filters.personType);
    }

    if (filters?.status === 'Ativos') {
      query = query.eq('is_active', true);
    }

    if (filters?.status === 'Inativos') {
      query = query.eq('is_active', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createPerson(input: PersonInput): Promise<PersonRecord> {
    if(isDemo())return demoStore.createPerson(input);
    const payload = {
      person_type: input.person_type,
      name: input.name.trim(),
      document_number: normalizeNullable(input.document_number),
      phone: clean(input.phone),
      company: clean(input.company),
      notes: clean(input.notes),
      cnh_number: input.cnh_number?.trim() ? normalizeText(input.cnh_number) : null,
      cnh_valid_until: normalizeNullable(input.cnh_valid_until),
      origin: input.origin || 'manual',
      is_active: input.is_active ?? true,
      is_driver: input.is_driver ?? false,
    };

    const { data, error } = await supabase.from('people').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async updatePerson(id: string, input: Partial<PersonInput>): Promise<PersonRecord> {
    if(isDemo())return demoStore.updatePerson(id,input);
    const payload = {
      ...(input.person_type ? { person_type: input.person_type } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.document_number !== undefined ? { document_number: normalizeNullable(input.document_number) } : {}),
      ...(input.phone !== undefined ? { phone: clean(input.phone) } : {}),
      ...(input.company !== undefined ? { company: clean(input.company) } : {}),
      ...(input.notes !== undefined ? { notes: clean(input.notes) } : {}),
      ...(input.cnh_number !== undefined
        ? { cnh_number: input.cnh_number?.trim() ? normalizeText(input.cnh_number) : null }
        : {}),
      ...(input.cnh_valid_until !== undefined ? { cnh_valid_until: normalizeNullable(input.cnh_valid_until) } : {}),
      ...(input.cnh_file_path !== undefined ? { cnh_file_path: normalizeNullable(input.cnh_file_path) } : {}),
      ...(input.cnh_file_url !== undefined ? { cnh_file_url: normalizeNullable(input.cnh_file_url) } : {}),
      ...(input.cnh_file_name !== undefined ? { cnh_file_name: normalizeNullable(input.cnh_file_name) } : {}),
      ...(input.cnh_file_type !== undefined ? { cnh_file_type: normalizeNullable(input.cnh_file_type) } : {}),
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      ...(input.is_driver !== undefined ? { is_driver: input.is_driver } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('people').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deactivatePerson(id: string): Promise<PersonRecord> {
    return this.updatePerson(id, { is_active: false });
  },

  async reactivatePerson(id: string): Promise<PersonRecord> {
    return this.updatePerson(id, { is_active: true });
  },

  async uploadPersonCnh(person: PersonRecord, file: File): Promise<PersonRecord> {
    if(isDemo()){validateUpload(file,'document');const path=crypto.randomUUID();demoStore.documents.set(path,file);return demoStore.updatePerson(person.id,{cnh_file_path:path,cnh_file_name:file.name,cnh_file_type:file.type});}
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('O anexo da CNH deve ter no maximo 10 MB');
    }

    const filePath = await uploadPrivateFile(PERSON_DOCUMENTS_BUCKET, person.id, file);
    try {
      const updated = await this.updatePerson(person.id, {
        cnh_file_path: filePath,
        cnh_file_url: '',
        cnh_file_name: file.name,
        cnh_file_type: file.type || null,
      });

      if (person.cnh_file_path && requireDevEnvironment().mode !== 'original') {
        await supabase.storage.from(PERSON_DOCUMENTS_BUCKET).remove([person.cnh_file_path]);
      }

      return updated;
    } catch (error) {
      // Uma resposta perdida nao comprova falha da atualizacao. No original,
      // preservar os dois arquivos; limpeza exige operacao administrativa aprovada.
      if(requireDevEnvironment().mode !== 'original')await supabase.storage.from(PERSON_DOCUMENTS_BUCKET).remove([filePath]);
      throw error;
    }
  },

  async getPersonDocumentUrl(filePath: string): Promise<string> {
    if(isDemo()){const file=demoStore.documents.get(filePath);if(!file)throw new Error('Anexe um documento fictício para testar a visualização.');return URL.createObjectURL(file);}
    if(requireDevEnvironment().mode==='original'){
      const {data:bucket,error}=await supabase.rpc('portaria_document_bucket',{file_path:filePath});
      if(error||!bucket)throw new Error('Documento privado ausente ou ambiguo.');return signedFileUrl(bucket,filePath);
    }
    return signedFileUrl(PERSON_DOCUMENTS_BUCKET, filePath);
  },

  async listPersonalVehicles(): Promise<PersonalVehicle[]> {
    if(isDemo())return structuredClone(demoStore.personalVehicles).map(v=>({...v,person:demoStore.snapshot().people.find(p=>p.id===v.person_id)}));
    const { data, error } = await supabase
      .from('personal_vehicles')
      .select('*, person:people(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createPersonalVehicle(input: PersonalVehicleInput): Promise<PersonalVehicle> {
    if(isDemo())return demoStore.createPersonalVehicle(input);
    const payload = {
      person_id: input.person_id,
      plate: normalizeText(input.plate),
      name: clean(input.name),
      notes: clean(input.notes),
      is_active: input.is_active ?? true,
    };

    const { data, error } = await supabase.from('personal_vehicles').insert(payload).select('*, person:people(*)').single();
    if (error) throw error;
    return data;
  },

  async updatePersonalVehicle(id: string, input: Partial<PersonalVehicleInput>): Promise<PersonalVehicle> {
    if(isDemo())return demoStore.updatePersonalVehicle(id,input);
    const payload = {
      ...(input.person_id ? { person_id: input.person_id } : {}),
      ...(input.plate !== undefined ? { plate: normalizeText(input.plate) } : {}),
      ...(input.name !== undefined ? { name: clean(input.name) } : {}),
      ...(input.notes !== undefined ? { notes: clean(input.notes) } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('personal_vehicles')
      .update(payload)
      .eq('id', id)
      .select('*, person:people(*)')
      .single();
    if (error) throw error;
    return data;
  },

  async listAccessRecords(filters?: AccessFilters): Promise<AccessRecord[]> {
    if(isDemo())return demoStore.snapshot().accesses.filter(row=>(!filters?.status||filters.status==='Todos'||row.status===filters.status)&&(!filters?.personType||filters.personType==='Todos'||row.person_type===filters.personType)&&(!filters?.search||[row.person_name,row.vehicle_plate,row.short_code,row.host_person_name,row.reason].some(v=>v?.toLowerCase().includes(filters.search!.trim().toLowerCase())))&&(!filters?.startDate||row.entry_date>=filters.startDate)&&(!filters?.endDate||row.entry_date<=filters.endDate));
    let query = supabase.from('access_records').select('*').order('created_at', { ascending: false });

    const search = clean(filters?.search);
    if (search) {
      query = query.or(
        `person_name.ilike.%${search}%,host_person_name.ilike.%${search}%,vehicle_plate.ilike.%${search}%,short_code.ilike.%${search}%,reason.ilike.%${search}%`
      );
    }

    if (filters?.personType && filters.personType !== 'Todos') {
      query = query.eq('person_type', filters.personType);
    }

    if (filters?.status && filters.status !== 'Todos') {
      query = query.eq('status', filters.status);
    }

    if (filters?.startDate) {
      query = query.gte('entry_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('entry_date', filters.endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createAccessRecord(input: AccessRecordInput, documentFile?: File | null, captured = false): Promise<AccessRecord> {
    const issues=validatePersonEntry(input.person_type,input.reason||'',documentFile||null,captured);
    if(issues.length)throw new Error(issues[0]);
    input={...input,reason:input.person_type==='Funcionario'?'':input.reason};
    if(isDemo()){const path=documentFile?crypto.randomUUID():null;if(path&&documentFile)demoStore.documents.set(path,documentFile);return demoStore.enter(input,path);}
    let documentPath: string | null = null;
    if (documentFile) {
      documentPath = await uploadPrivateFile(ACCESS_DOCUMENTS_BUCKET, input.person_id, documentFile);
    }

    try {
      const payload = {
        ...input,
        host_person_id: input.host_person_id || null,
        personal_vehicle_id: input.personal_vehicle_id || null,
        vehicle_plate: clean(input.vehicle_plate),
        reason: clean(input.reason),
        observations: clean(input.observations),
        document_file_path: documentPath,
        document_file_name: documentFile?.name || null,
        document_file_type: documentFile?.type || null,
        status: 'Em aberto' as AccessStatus,
      };

      const { data, error } = await supabase.from('access_records').insert(payload).select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      if (documentPath) {
        await supabase.storage.from(ACCESS_DOCUMENTS_BUCKET).remove([documentPath]);
      }
      throw error;
    }
  },

  async closeAccessRecord(id: string, exitDate: string, exitTime: string): Promise<AccessRecord> {
    if(isDemo())return demoStore.leave(id,exitDate,exitTime);
    const { data, error } = await supabase
      .from('access_records')
      .update({
        exit_date: exitDate,
        exit_time: exitTime,
        status: 'Concluido',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getAccessDocumentUrl(filePath: string): Promise<string> {
    if(isDemo()){const file=demoStore.documents.get(filePath);if(!file)throw new Error('Documento fictício indisponível nesta sessão.');return URL.createObjectURL(file);}
    return signedFileUrl(ACCESS_DOCUMENTS_BUCKET, filePath);
  },
};
