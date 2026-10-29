import { supabase } from '../lib/supabase';
import { isDemo } from '../demo/mode';
import { demoStore } from '../domain/demoStore';
import type { VehicleRecord, VehicleRecordInput } from '../types/database';

type VehiclePlateRow = { vehicle_plate: string | null };

export const vehicleService = {
  async listUnavailableVehiclePlates(): Promise<string[]> {
    if(isDemo())return [...demoStore.movements.filter(row=>row.status==='Em aberto').map(row=>row.vehicle_plate),...demoStore.records.filter(row=>row.status==='Em uso').map(row=>row.vehicle_plate)];
    const [{ data: pickupRecords, error: pickupError }, { data: operationalMovements, error: operationalError }] =
      await Promise.all([
        supabase
          .from('vehicle_records')
          .select('vehicle_plate')
          .eq('status', 'Em uso'),
        supabase
          .from('operational_movements')
          .select('vehicle_plate')
          .eq('status', 'Em aberto'),
      ]);

    if (pickupError) throw pickupError;
    if (operationalError) throw operationalError;

    return Array.from(
      new Set(
        ([...(pickupRecords || []), ...(operationalMovements || [])] as VehiclePlateRow[])
          .map((record) => record.vehicle_plate?.trim().toUpperCase())
          .filter((plate): plate is string => Boolean(plate))
      )
    );
  },

  async createRecord(_data: VehicleRecordInput): Promise<VehicleRecord> {
    void _data;
    throw new Error('Novas saidas devem ser registradas na Portaria, com confirmacao Cobli.');
  },

  async listRecords(filters?: {
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<VehicleRecord[]> {
    if(isDemo())return demoStore.snapshot().records.filter(row=>(!filters?.status||filters.status==='Todos'||row.status===filters.status)&&(!filters?.search||[row.vehicle_plate,row.pickup_name,row.return_name].some(v=>v?.toLowerCase().includes(filters.search!.trim().toLowerCase())))&&(!filters?.startDate||row.pickup_date>=filters.startDate)&&(!filters?.endDate||row.pickup_date<=filters.endDate));
    let query = supabase
      .from('vehicle_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.search) {
      query = query.or(
        `vehicle_plate.ilike.%${filters.search}%,pickup_name.ilike.%${filters.search}%,return_name.ilike.%${filters.search}%`
      );
    }

    if (filters?.status === 'Em uso' || filters?.status === 'Devolvido') {
      query = query.eq('status', filters.status);
    } else if (filters?.status && filters.status !== 'Todos') {
      throw new Error('Filtro de status invalido.');
    }

    const { data, error } = await query;

    if (error) throw error;

    let filtered = (data || []);

    if (filters?.startDate || filters?.endDate) {
      filtered = filtered.filter((record) => {
        const recordDate = record.pickup_date.split('T')[0];
        const passStart = filters?.startDate ? recordDate >= filters.startDate : true;
        const passEnd = filters?.endDate ? recordDate <= filters.endDate : true;
        return passStart && passEnd;
      });
    }

    return filtered;
  },

  async getRecord(id: string): Promise<VehicleRecord | null> {
    if(isDemo())return demoStore.snapshot().records.find(r=>r.id===id)||null;
    const { data, error } = await supabase
      .from('vehicle_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updateRecord(
    id: string,
    data: Partial<VehicleRecordInput>
  ): Promise<VehicleRecord> {
    if(isDemo())return demoStore.updateRecord(id,data);
    const { data: record, error } = await supabase
      .from('vehicle_records')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return record;
  },

  async deleteRecord(id: string): Promise<void> {
    if(isDemo())throw new Error('Histórico preservado. A exclusão não está disponível nesta revisão.');
    const { error } = await supabase.from('vehicle_records').delete().eq('id', id);
    if (error) throw error;
  },
};
