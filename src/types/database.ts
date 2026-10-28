export interface VehicleRecord {
  id: string;
  vehicle_plate: string;
  reason: string;
  authorized_by: string;
  usage_type?: VehicleUsageType;
  pickup_date: string;
  pickup_time: string;
  pickup_name: string;
  pickup_signature: string;
  return_date: string | null;
  return_time: string | null;
  return_name: string | null;
  return_signature: string | null;
  observations: string | null;
  status: 'Em uso' | 'Devolvido';
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VehicleStatus = 'Ativo' | 'Inativo' | 'Em Manut.';
export type VehicleUsageType = 'Comum' | 'Rota';
export type OperationType = 'Obras' | 'Trajeto curto' | 'Viagem';
export type MovementStatus = 'Em aberto' | 'Concluida';
export type FuelLevel = 'Reserva' | '1/4' | '1/2' | '3/4' | 'Cheio';
export type PersonType = 'Funcionario' | 'Terceirizado' | 'Visitante';
export type AccessStatus = 'Em aberto' | 'Concluido';

export interface FleetVehicle {
  id: string;
  short_code: string;
  legacy_short_code: string | null;
  in_patio: boolean;
  plate: string;
  name: string;
  responsible_name: string | null;
  fixed_driver_name: string;
  usage_type: VehicleUsageType;
  status: VehicleStatus;
  created_at: string | null;
  updated_at: string | null;
}

export interface FleetVehicleInput {
  plate: string;
  name: string;
  responsible_name: string;
  fixed_driver_name: string;
  status: VehicleStatus;
}

export interface PersonRecord {
  id: string;
  short_code: string;
  person_type: PersonType;
  name: string;
  document_number: string | null;
  cnh_number: string | null;
  cnh_valid_until: string | null;
  cnh_file_path: string | null;
  cnh_file_url: string | null;
  cnh_file_name: string | null;
  cnh_file_type: string | null;
  origin: 'manual' | 'historico' | 'drivers';
  is_active: boolean;
  is_driver: boolean;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PersonInput {
  person_type: PersonType;
  name: string;
  document_number?: string | null;
  cnh_number?: string | null;
  cnh_valid_until?: string | null;
  cnh_file_path?: string | null;
  cnh_file_url?: string | null;
  cnh_file_name?: string | null;
  cnh_file_type?: string | null;
  origin?: 'manual' | 'historico' | 'drivers';
  is_active?: boolean;
  is_driver?: boolean;
  phone?: string;
  company?: string;
  notes?: string;
}

export type DriverRecord = PersonRecord;
export type DriverInput = Omit<PersonInput, 'person_type'> & { person_type?: PersonType };

export interface PersonalVehicle {
  id: string;
  short_code: string;
  person_id: string;
  plate: string;
  name: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  person?: PersonRecord;
}

export interface PersonalVehicleInput {
  person_id: string;
  plate: string;
  name?: string;
  notes?: string;
  is_active?: boolean;
}

export interface AccessRecord {
  id: string;
  short_code: string;
  person_id: string;
  person_name: string;
  person_type: PersonType;
  host_person_id: string | null;
  host_person_name: string;
  personal_vehicle_id: string | null;
  vehicle_plate: string | null;
  reason: string | null;
  entry_date: string;
  entry_time: string;
  exit_date: string | null;
  exit_time: string | null;
  document_file_path: string | null;
  document_file_name: string | null;
  document_file_type: string | null;
  observations: string | null;
  status: AccessStatus;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AccessRecordInput {
  person_id: string;
  person_name: string;
  person_type: PersonType;
  host_person_id?: string | null;
  host_person_name: string;
  personal_vehicle_id?: string | null;
  vehicle_plate?: string;
  reason?: string;
  entry_date: string;
  entry_time: string;
  observations?: string;
}

export interface OperationalPhoto {
  id: string;
  movement_id: string;
  phase: 'Entrada' | 'Saida';
  file_path: string;
  file_url: string;
  caption?: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface OperationalChecklistItem {
  id: string;
  movement_id: string;
  phase: 'Entrada' | 'Saida';
  item_key: string;
  item_label: string;
  is_ok: boolean;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OperationalMovement {
  id: string;
  short_code: string;
  vehicle_id: string;
  vehicle_plate: string;
  operation_type: OperationType;
  driver_id: string | null;
  driver_name: string;
  driver_cnh_number: string | null;
  driver_cnh_valid_until: string | null;
  qr_identifier: string | null;
  entry_date: string;
  entry_time: string;
  entry_odometer: number;
  entry_fuel_level: FuelLevel;
  entry_observations?: string | null;
  exit_date: string | null;
  exit_time: string | null;
  exit_odometer: number | null;
  exit_fuel_level: FuelLevel | null;
  exit_observations?: string | null;
  checklist: Json;
  status: MovementStatus;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface VehicleRecordInput {
  vehicle_plate: string;
  reason: string;
  authorized_by: string;
  usage_type?: VehicleUsageType;
  pickup_date: string;
  pickup_time: string;
  pickup_name: string;
  pickup_signature: string;
  return_date?: string;
  return_time?: string;
  return_name?: string;
  return_signature?: string;
  observations?: string;
  status: 'Em uso' | 'Devolvido';
}

export type InspectionStatus = 'Pendente' | 'Concluida';

export interface VehicleInspectionRequest {
  id: string;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_name: string;
  requested_by: string;
  requested_by_user_id: string | null;
  completed_by_user_id: string | null;
  notes: string | null;
  status: InspectionStatus;
  checklist: Json | null;
  completed_by: string | null;
  completed_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
}

export interface VehicleInspectionRequestInput {
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_name: string;
  notes?: string;
}

// Contrato do schema DEV: campos com defaults sao opcionais no INSERT.
type Expand<T> = { [K in keyof T]: T[K] };
type InsertRow<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;
type UpdateRow<Row> = Partial<Omit<Row, 'id' | 'created_at' | 'created_by'>>;
type Table<Row, Required extends keyof Row, Relations = []> = {
  Row: Expand<Row>;
  Insert: Expand<InsertRow<Row, Required>>;
  Update: Expand<UpdateRow<Row>>;
  Relationships: Relations;
};
type LegacyDriver = Omit<PersonRecord, 'person_type' | 'document_number' | 'company' | 'is_driver' | 'short_code' | 'origin'> & { short_code: string | null; origin: 'manual' | 'historico' };
type PersonalVehicleRelation = [{ foreignKeyName: 'personal_vehicles_person_id_fkey'; columns: ['person_id']; isOneToOne: false; referencedRelation: 'people'; referencedColumns: ['id'] }];
export interface Database {
  public: {
    Tables: {
      vehicles: Table<FleetVehicle, 'plate' | 'name'>;
      vehicle_records: Table<VehicleRecord, 'vehicle_plate' | 'reason' | 'authorized_by' | 'pickup_date' | 'pickup_time' | 'pickup_name' | 'pickup_signature'>;
      people: Table<PersonRecord, 'name'>;
      drivers: Table<LegacyDriver, 'name'>;
      personal_vehicles: Table<Omit<PersonalVehicle, 'person'>, 'person_id' | 'plate', PersonalVehicleRelation>;
      access_records: Table<AccessRecord, 'person_id' | 'person_name' | 'person_type' | 'entry_date' | 'entry_time'>;
      operational_movements: Table<OperationalMovement, 'vehicle_id' | 'vehicle_plate' | 'operation_type' | 'driver_name' | 'entry_date' | 'entry_time' | 'entry_odometer' | 'entry_fuel_level'>;
      operational_photos: Table<OperationalPhoto, 'movement_id' | 'phase' | 'file_path'>;
      operational_checklist_items: Table<OperationalChecklistItem, 'movement_id' | 'phase' | 'item_key' | 'item_label'>;
      vehicle_inspection_requests: Table<VehicleInspectionRequest, 'vehicle_id' | 'vehicle_plate'>;
    };
    Views: Record<never, never>;
    Functions: {
      portaria_timeline_sources: { Args: Record<PropertyKey, never>; Returns: Json };
      portaria_list_parcels: {Args:Record<string,never>;Returns:Json};
      portaria_receive_parcel: {Args:{payload:Json};Returns:Json};
      portaria_collect_parcel: {Args:{payload:Json};Returns:Json};
      portaria_list_yard_sessions: {Args:{check_day:string};Returns:Json};
      portaria_get_yard_session: {Args:{session_id:string};Returns:Json};
      portaria_start_yard_session: {Args:{payload:Json};Returns:Json};
      portaria_check_yard_item: {Args:{payload:Json};Returns:Json};
      portaria_check_yard_with_oil: {Args:{payload:Json};Returns:Json};
      portaria_report_unidentified_yard_vehicle: {Args:{payload:Json};Returns:Json};
      portaria_vehicle_oil_history: {Args:{vehicle_id:string;before_at:string|null;before_request:string|null};Returns:Json};
      portaria_found_yard_vehicle: {Args:{payload:Json};Returns:Json};
      portaria_legacy_yard_day: {Args:{check_day:string};Returns:Json};
      get_my_profile: { Args: Record<string, never>; Returns: Json };
      get_dev_environment: { Args: Record<string, never>; Returns: Json };
      portaria_register_departure: { Args: { payload: Json }; Returns: Json };
      portaria_register_conference: { Args: { vehicle_id:string;observed_present:boolean;notes:string }; Returns: Json };
      portaria_list_conferences: { Args: Record<string, never>; Returns: Json };
      portaria_get_profile: { Args: Record<string, never>; Returns: Json };
      portaria_get_environment: { Args: Record<string, never>; Returns: Json };
      portaria_movement_evidence: { Args: {movement_id:string}; Returns: Json };
      portaria_document_bucket: { Args: {file_path:string}; Returns: string };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
