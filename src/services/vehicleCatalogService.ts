import { supabase } from '../lib/supabase';
import { isDemo } from '../demo/mode';
import { demoStore } from '../domain/demoStore';
import type { FleetVehicle, FleetVehicleInput, VehicleStatus } from '../types/database';

interface VehicleFilters {
  search?: string;
  status?: VehicleStatus | 'Todos';
  inPatio?: boolean;
}

export const vehicleCatalogService = {
  async listVehicles(filters?: VehicleFilters): Promise<FleetVehicle[]> {
    if(isDemo())return demoStore.snapshot().vehicles.filter(row=>(!filters?.status||filters.status==='Todos'||row.status===filters.status)&&(typeof filters?.inPatio!=='boolean'||row.in_patio===filters.inPatio)&&(!filters?.search||[row.plate,row.name,row.responsible_name,row.fixed_driver_name,row.short_code].some(v=>v?.toLowerCase().includes(filters.search!.trim().toLowerCase()))));
    let query = supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.search) {
      const sanitizedSearch = filters.search.trim();
      if (sanitizedSearch) {
        query = query.or(`plate.ilike.%${sanitizedSearch}%,name.ilike.%${sanitizedSearch}%,responsible_name.ilike.%${sanitizedSearch}%,fixed_driver_name.ilike.%${sanitizedSearch}%,short_code.ilike.%${sanitizedSearch}%,legacy_short_code.ilike.%${sanitizedSearch}%`);
      }
    }

    if (filters?.status && filters.status !== 'Todos') {
      query = query.eq('status', filters.status);
    }

    if (typeof filters?.inPatio === 'boolean') {
      query = query.eq('in_patio', filters.inPatio);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  },

  async createVehicle(input: FleetVehicleInput): Promise<FleetVehicle> {
    if(isDemo())return demoStore.createVehicle(input);
    const payload: FleetVehicleInput = {
      ...input,
      plate: input.plate.trim().toUpperCase(),
      name: input.name.trim(),
      fixed_driver_name: input.fixed_driver_name.trim(),
    };

    const { data, error } = await supabase
      .from('vehicles')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  async updateVehicle(id: string, input: Partial<FleetVehicleInput>): Promise<FleetVehicle> {
    if(isDemo())return demoStore.updateVehicle(id,input);
    const normalizedInput: Partial<FleetVehicleInput> = {
      ...input,
      ...(input.plate ? { plate: input.plate.trim().toUpperCase() } : {}),
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.fixed_driver_name !== undefined ? { fixed_driver_name: input.fixed_driver_name.trim() } : {}),
    };

    const { data, error } = await supabase
      .from('vehicles')
      .update({ ...normalizedInput, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  async updatePatioStatus(id: string, inPatio: boolean): Promise<FleetVehicle> {
    if(isDemo())return demoStore.updateVehicle(id,{in_patio:inPatio});
    const { data, error } = await supabase
      .from('vehicles')
      .update({ in_patio: inPatio, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  async deleteVehicle(id: string): Promise<void> {
    if(isDemo()){if(demoStore.records.some(r=>r.vehicle_plate===demoStore.vehicles.find(v=>v.id===id)?.plate)||demoStore.movements.some(m=>m.vehicle_id===id))throw new Error('Veículo com histórico deve ser desativado.');demoStore.vehicles=demoStore.vehicles.filter(v=>v.id!==id);return;}
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  },
};
