import { supabase } from '../lib/supabase';
import { isDemo } from '../demo/mode';
import { demoStore } from '../domain/demoStore';
import type { VehicleInspectionRequest, VehicleInspectionRequestInput, Json } from '../types/database';

export const inspectionService = {
  async listRequests(): Promise<VehicleInspectionRequest[]> {
    if(isDemo())return structuredClone(demoStore.inspections);
    const { data, error } = await supabase
      .from('vehicle_inspection_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createRequest(input: VehicleInspectionRequestInput): Promise<VehicleInspectionRequest> {
    if(isDemo())return demoStore.createInspection(input);
    const { data, error } = await supabase
      .from('vehicle_inspection_requests')
      .insert({
        vehicle_id: input.vehicle_id,
        vehicle_plate: input.vehicle_plate,
        vehicle_name: input.vehicle_name,
        notes: input.notes?.trim() || '',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async completeRequest(
    id: string,
    checklist: Json,
    completedNotes?: string
  ): Promise<VehicleInspectionRequest> {
    if(isDemo())return demoStore.completeInspection(id,checklist,completedNotes);
    const { data, error } = await supabase
      .from('vehicle_inspection_requests')
      .update({
        status: 'Concluida',
        checklist,
        completed_notes: completedNotes?.trim() || '',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteRequest(id: string): Promise<void> {
    if(isDemo())throw new Error('O histórico de inspeções é preservado.');
    const { error } = await supabase.from('vehicle_inspection_requests').delete().eq('id', id);
    if (error) throw error;
  },

  subscribeToRequests(onChange: () => void) {
    if(isDemo()){demoStore.inspectionListeners.add(onChange);return()=>{demoStore.inspectionListeners.delete(onChange);};}
    const channel = supabase
      .channel('vehicle_inspection_requests_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_inspection_requests' },
        onChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
