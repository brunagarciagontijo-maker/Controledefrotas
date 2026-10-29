import { availability, validateDeparture, type DepartureDecision, type PhotoEvidence, type PhotoItem } from './portaria.ts';
import type { AccessRecord, AccessRecordInput, FleetVehicle, FleetVehicleInput, OperationalMovement, PersonInput, PersonRecord, PersonalVehicle, PersonalVehicleInput, VehicleInspectionRequest, VehicleInspectionRequestInput, VehicleRecord, VehicleRecordInput, Json } from '../types/database.ts';
import type { MovementInput, MovementCloseInput } from '../services/operationalService.ts';
const timestamp = new Date().toISOString();
const today = timestamp.slice(0, 10);
const fakeSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const person = (n: number, person_type: PersonRecord['person_type'], is_driver = false): PersonRecord => ({ id: id(n), short_code: String(10000 + n), name: `Pessoa fictícia ${n}`, person_type, is_driver, is_active: true, document_number: null, cnh_number: null, cnh_valid_until: null, cnh_file_path: null, cnh_file_url: null, cnh_file_name: null, cnh_file_type: null, origin: 'manual', company: 'Empresa fictícia', phone: '', notes: 'Demonstração', created_at: timestamp, updated_at: timestamp });
export class DemoStore {
    actorName='Simula\u00e7\u00e3o porteiro';
    eventActors=new Map<string,string>();
    people: PersonRecord[] = [person(1, 'Funcionario', true), person(2, 'Funcionario'), person(3, 'Visitante'), person(4, 'Terceirizado')];
    vehicles: FleetVehicle[] = [1, 2, 3].map(n => ({ id: id(100 + n), short_code: String(100 + n), legacy_short_code: null, plate: `TESTE-${n}`, name: `Veículo fictício ${n}`, responsible_name: 'Responsável fictício', fixed_driver_name: '', usage_type: 'Comum', status: 'Ativo', in_patio: true, created_at: timestamp, updated_at: timestamp }));
    movements: OperationalMovement[] = [];
    records: VehicleRecord[] = [];
    personalVehicles: PersonalVehicle[] = [];
    inspections: VehicleInspectionRequest[] = [];
    inspectionListeners = new Set<() => void>();
    documents = new Map<string,File>();
    returnPhotoFiles = new Map<string,File[]>();
    constructor() {
        this.vehicles.push({ ...this.vehicles[0], id:id(104), short_code:'104', plate:'HIST-4', name:'Veículo legado fictício', in_patio:false });
        this.records = [true,false].map((open,n) => ({ id:id(300+n),vehicle_plate:open?'HIST-4':'TESTE-2',reason:open?'Serviço fictício':'Visita fictícia',authorized_by:'Responsável fictício',usage_type:'Comum',pickup_date:today,pickup_time:'07:00',pickup_name:'Pessoa fictícia 1',pickup_signature:fakeSignature,return_date:open?null:today,return_time:open?null:'08:00',return_name:open?null:'Pessoa fictícia 1',return_signature:open?null:fakeSignature,status:open?'Em uso':'Devolvido',observations:'Registro demonstrativo, sem validade.',created_by:null,created_at:timestamp,updated_at:timestamp }));
        this.movements=[{id:id(600),short_code:'10600',vehicle_id:this.vehicles[2].id,vehicle_plate:this.vehicles[2].plate,operation_type:'Trajeto curto',driver_id:this.people[0].id,driver_name:this.people[0].name,driver_cnh_number:null,driver_cnh_valid_until:null,qr_identifier:'',entry_date:today,entry_time:'06:00',entry_odometer:30,entry_fuel_level:'Cheio',entry_observations:'Movimentação histórica fictícia para revisão.',exit_date:today,exit_time:'06:30',exit_odometer:40,exit_fuel_level:'Cheio',exit_observations:'Retorno fictício.',checklist:{},status:'Concluida',created_by:null,created_at:timestamp,updated_at:timestamp}];
        this.personalVehicles=[{id:id(400),short_code:'10400',person_id:this.people[2].id,plate:'FICT-1',name:'Veículo pessoal fictício',notes:'Demonstração',is_active:true,created_at:timestamp,updated_at:timestamp,person:this.people[2]}];
        this.inspections=[{id:id(500),vehicle_id:this.vehicles[1].id,vehicle_plate:this.vehicles[1].plate,vehicle_name:this.vehicles[1].name,requested_by:'Administrador fictício',requested_by_user_id:null,completed_by_user_id:null,notes:'Inspeção demonstrativa',status:'Pendente',checklist:null,completed_by:null,completed_notes:null,created_at:timestamp,updated_at:timestamp,completed_at:null}];
    }
    accesses: AccessRecord[] = [];
    conferences: Array<{
        id: string;
        vehicle_id: string;
        expected: boolean;
        observed: boolean;
        notes: string;
        created_at: string;
    }> = [];
    evidence = new Map<string, PhotoEvidence[]>();
    photoFiles = new Map<string,Array<{item:PhotoItem;file:File}>>();
    requestFingerprints = new Map<string,string>();
    requests = new Map<string, OperationalMovement>();
    snapshot() { return structuredClone({ vehicles: this.vehicles, people: this.people, movements: this.movements, records: this.records, accesses: this.accesses, conferences: this.conferences }); }
    updatePerson(personId:string,input:Partial<PersonInput>) { const row=this.people.find(p=>p.id===personId);if(!row)throw new Error('Pessoa fictícia não encontrada.');Object.assign(row,input,{updated_at:new Date().toISOString()});return structuredClone(row); }
    createVehicle(input:FleetVehicleInput) { if(this.vehicles.some(v=>v.plate===input.plate.trim().toUpperCase()))throw new Error('Placa já cadastrada.');const row:FleetVehicle={...this.vehicles[0],...input,id:crypto.randomUUID(),short_code:String(101+this.vehicles.length),plate:input.plate.trim().toUpperCase(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};this.vehicles.push(row);return structuredClone(row); }
    updateVehicle(vehicleId:string,input:Partial<FleetVehicleInput>&{in_patio?:boolean}) {const row=this.vehicles.find(v=>v.id===vehicleId);if(!row)throw new Error('Veículo fictício não encontrado.');Object.assign(row,input,{updated_at:new Date().toISOString()});return structuredClone(row);}
    createPersonalVehicle(input:PersonalVehicleInput) {const row:PersonalVehicle={...input,id:crypto.randomUUID(),short_code:String(10000+this.personalVehicles.length),plate:input.plate.trim().toUpperCase(),name:input.name||'',notes:input.notes||'',is_active:input.is_active??true,created_at:timestamp,updated_at:timestamp,person:this.people.find(p=>p.id===input.person_id)};this.personalVehicles.push(row);return structuredClone(row);}
    updatePersonalVehicle(vehicleId:string,input:Partial<PersonalVehicleInput>) {const row=this.personalVehicles.find(v=>v.id===vehicleId);if(!row)throw new Error('Veículo pessoal fictício não encontrado.');Object.assign(row,input);row.person=this.people.find(p=>p.id===row.person_id);return structuredClone(row);}
    updateRecord(recordId:string,input:Partial<VehicleRecordInput>) {const row=this.records.find(r=>r.id===recordId);if(!row)throw new Error('Registro fictício não encontrado.');if(row.status==='Em uso'&&input.status==='Devolvido')this.eventActors.set(`legacy:${row.id}:in`,this.actorName);Object.assign(row,input);if(row.status==='Devolvido'){const vehicle=this.vehicles.find(v=>v.plate===row.vehicle_plate);if(vehicle)vehicle.in_patio=true;}return structuredClone(row);}
    createInspection(input:VehicleInspectionRequestInput) {const row:VehicleInspectionRequest={...this.inspections[0],...input,requested_by:this.actorName,id:crypto.randomUUID(),status:'Pendente',checklist:null,completed_at:null,completed_by:null,created_at:new Date().toISOString(),notes:input.notes||''};this.inspections.unshift(row);this.inspectionListeners.forEach(listener=>listener());return structuredClone(row);}
    completeInspection(requestId:string,checklist:Json,notes='') {const row=this.inspections.find(r=>r.id===requestId);if(!row||row.status!=='Pendente')throw new Error('Inspeção fictícia não encontrada.');Object.assign(row,{status:'Concluida',checklist,completed_notes:notes,completed_by:this.actorName,completed_at:new Date().toISOString()});this.inspectionListeners.forEach(listener=>listener());return structuredClone(row);}
    createPerson(input: PersonInput) { const row = { ...person(this.people.length + 1, input.person_type), ...input, id: crypto.randomUUID() }; this.people.push(row); return structuredClone(row); }
    depart(input: MovementInput, decision: DepartureDecision, photos: PhotoEvidence[], requestId: string) {
        const old = this.requests.get(requestId);
        const fingerprint=JSON.stringify({input,decision,photos});
        if(old&&this.requestFingerprints.get(requestId)!==fingerprint)throw new Error('Tentativa ja utilizada com outro conteudo.');
        if (old)
            return structuredClone(old);
        const errors = validateDeparture(decision, photos.map(row => row.item));
        if (errors.length)
            throw new Error(errors[0]);
        const available = availability(this.vehicles, this.movements, this.records).find(row => row.vehicle.id === input.vehicle_id);
        if (!available?.available)
            throw new Error('Veículo indisponível. Atualize a lista.');
        const row: OperationalMovement = { ...input, id: crypto.randomUUID(), short_code: String(10000 + this.movements.length), vehicle_plate: available.vehicle.plate, qr_identifier: '', status: 'Em aberto', created_by: id(1), created_at: timestamp, updated_at: timestamp, exit_date: null, exit_time: null, exit_odometer: null, exit_fuel_level: null };
        row.checklist={...input.checklist as object,cobli_associated:decision.cobliAssociated,evidence_required:!decision.cobliAssociated,photo_count:photos.length,driver_reason:decision.driverReason};
        this.requestFingerprints.set(requestId,fingerprint);
        this.eventActors.set(`movement:${row.id}:out`,this.actorName);this.movements.unshift(row);
        available.vehicle.in_patio = false;
        this.evidence.set(row.id, structuredClone(photos));
        this.requests.set(requestId, row);
        return structuredClone(row);
    }
    close(idValue: string, input: MovementCloseInput) { const row = this.movements.find(m => m.id === idValue); if (!row || row.status !== 'Em aberto')
        throw new Error('Movimento não está aberto.'); if (input.exit_odometer < row.entry_odometer)
        throw new Error('Odômetro de retorno inválido.'); this.eventActors.set(`movement:${row.id}:in`,this.actorName);Object.assign(row, input, { status: 'Concluida' }); const vehicle = this.vehicles.find(v => v.id === row.vehicle_id); if (vehicle)
        vehicle.in_patio = true; return structuredClone(row); }
    enter(input: AccessRecordInput, path: string | null) { const row: AccessRecord = { ...input, id: crypto.randomUUID(), short_code: String(10000 + this.accesses.length), host_person_id: input.host_person_id || null, host_person_name: input.host_person_name, personal_vehicle_id: input.personal_vehicle_id || null, vehicle_plate: input.vehicle_plate || '', reason: input.person_type === 'Funcionario' ? '' : input.reason || '', entry_date: input.entry_date, entry_time: input.entry_time, exit_date: null, exit_time: null, document_file_path: path, document_file_name: path ? 'foto-ficticia.jpg' : null, document_file_type: path ? 'image/jpeg' : null, observations: input.observations || '', status: 'Em aberto', created_by: id(1), created_at: timestamp, updated_at: timestamp }; this.eventActors.set(`access:${row.id}:in`,this.actorName);this.accesses.unshift(row); return structuredClone(row); }
    leave(idValue: string, date: string, time: string) { const row = this.accesses.find(a => a.id === idValue); if (!row || row.status !== 'Em aberto')
        throw new Error('Acesso não está aberto.'); this.eventActors.set(`access:${row.id}:out`,this.actorName);Object.assign(row, { status: 'Concluido', exit_date: date, exit_time: time }); return structuredClone(row); }
    conference(vehicleId: string, observed: boolean, notes: string) { const state = availability(this.vehicles, this.movements, this.records).find(v => v.vehicle.id === vehicleId); if (!state)
        throw new Error('Veículo não encontrado.'); const expected = state.expectedPresent; if (observed !== expected && !notes.trim())
        throw new Error('Descreva a divergência.'); const row = { id: crypto.randomUUID(), vehicle_id: vehicleId, expected, observed, notes: notes.trim(), created_at: new Date().toISOString() }; this.conferences.unshift(row); return structuredClone(row); }
}
export const demoStore = new DemoStore();
