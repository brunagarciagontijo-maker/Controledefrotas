-- Dados exclusivamente artificiais. Data-base fixa: 01/10/2026.
-- Execute uma vez. Falhas geram rollback do lote; nao altera dados preexistentes.
BEGIN;
SELECT private.assert_dev_environment('REPLACE_WITH_DEV_PROJECT_REF');
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.people) OR EXISTS(SELECT 1 FROM public.vehicles) THEN
    RAISE EXCEPTION 'Fixtures exigem tabelas vazias. Nao mesclar conjuntos de dados.';
  END IF;
END $$;

INSERT INTO public.people(id,person_type,name,document_number,is_driver,is_active,cnh_number,cnh_valid_until) VALUES
('10000000-0000-4000-8000-000000000001','Funcionario','Funcionario Teste 01','DEV-DOC-01',false,true,NULL,NULL),
('10000000-0000-4000-8000-000000000002','Funcionario','Motorista Teste 02','DEV-DOC-02',true,true,'DEV-CNH-02','2028-01-01'),
('10000000-0000-4000-8000-000000000003','Funcionario','Motorista CNH vencida 03','DEV-DOC-03',true,true,'DEV-CNH-03','2020-01-01'),
('10000000-0000-4000-8000-000000000004','Funcionario','Motorista sem CNH 04','DEV-DOC-04',true,true,NULL,NULL),
('10000000-0000-4000-8000-000000000005','Funcionario','Funcionario inativo 05','DEV-DOC-05',false,false,NULL,NULL),
('10000000-0000-4000-8000-000000000006','Visitante','Visitante Teste 06','DEV-DOC-06',false,true,NULL,NULL),
('10000000-0000-4000-8000-000000000007','Terceirizado','Terceirizado Teste 07','DEV-DOC-07',false,true,NULL,NULL),
('10000000-0000-4000-8000-000000000008','Funcionario','Funcionario Teste Acentuacao 08','DEV-DOC-08',false,true,NULL,NULL);

INSERT INTO public.vehicles(id,plate,name,status,fixed_driver_name) VALUES
('20000000-0000-4000-8000-000000000001','DEV-001','Frota ficticia disponivel','Ativo',''),
('20000000-0000-4000-8000-000000000002','DEV-002','Frota ficticia retirada assinada','Ativo',''),
('20000000-0000-4000-8000-000000000003','DEV-003','Frota ficticia retirada operacional','Ativo',''),
('20000000-0000-4000-8000-000000000004','DEV-004','Frota ficticia manutencao','Em Manut.',''),
('20000000-0000-4000-8000-000000000005','DEV-005','Frota ficticia inativa','Inativo',''),
('20000000-0000-4000-8000-000000000006','DEV-006','Frota ficticia motorista fixo','Ativo','Motorista Teste 02');
INSERT INTO public.personal_vehicles(id,person_id,plate,name) VALUES
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','PES-001','Veiculo pessoal ficticio');

-- Imagem geometrica de 1 pixel, sem assinatura humana ou identificacao pessoal.
INSERT INTO public.vehicle_records(id,vehicle_plate,reason,authorized_by,usage_type,pickup_date,pickup_time,pickup_name,pickup_signature,status) VALUES
('40000000-0000-4000-8000-000000000001','DEV-002','Teste de retirada','Administrador DEV','Comum','2026-10-01','08:00','Funcionario Teste 01','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXkAAAAASUVORK5CYII=','Em uso');
INSERT INTO public.vehicle_records(id,vehicle_plate,reason,authorized_by,usage_type,pickup_date,pickup_time,pickup_name,pickup_signature,return_date,return_time,return_name,return_signature,status) VALUES
('40000000-0000-4000-8000-000000000002','DEV-001','Teste de historico','Administrador DEV','Rota','2026-09-28','08:00','Funcionario Teste 01','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXkAAAAASUVORK5CYII=','2026-09-28','17:00','Funcionario Teste 01','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXkAAAAASUVORK5CYII=','Devolvido');

INSERT INTO public.operational_movements(id,vehicle_id,vehicle_plate,operation_type,driver_id,driver_name,entry_date,entry_time,entry_odometer,entry_fuel_level,checklist) VALUES
('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','DEV-003','Obras','10000000-0000-4000-8000-000000000004','Motorista sem CNH 04','2026-10-01','09:00',1000,'Cheio','{"exit":{"pneus":{"ok":true,"note":"TESTE"},"luzes":{"ok":true},"vidros":{"ok":true},"limpeza":{"ok":true},"odometro":{"ok":true},"avarias":{"ok":true}}}');
INSERT INTO public.operational_movements(id,vehicle_id,vehicle_plate,operation_type,driver_id,driver_name,entry_date,entry_time,entry_odometer,entry_fuel_level,exit_date,exit_time,exit_odometer,exit_fuel_level,status,checklist) VALUES
('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','DEV-001','Trajeto curto','10000000-0000-4000-8000-000000000002','Motorista Teste 02','2026-09-29','08:00',100,'Cheio','2026-09-29','17:00',180,'1/2','Concluida','{"exit":{"pneus":{"ok":true}},"entry":{"pneus":{"ok":true}}}');
INSERT INTO public.access_records(id,person_id,person_name,person_type,host_person_id,host_person_name,reason,entry_date,entry_time,document_file_path,document_file_name,document_file_type) VALUES
('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','Visitante Teste 06','Visitante','10000000-0000-4000-8000-000000000001','Funcionario Teste 01','Teste de visita','2026-10-01','10:00','10000000-0000-4000-8000-000000000006/documento-teste.pdf','documento-teste.pdf','application/pdf');
INSERT INTO public.access_records(id,person_id,person_name,person_type,host_person_name,reason,entry_date,entry_time,exit_date,exit_time,status) VALUES
('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000007','Terceirizado Teste 07','Terceirizado','Funcionario Teste 01','Teste concluido','2026-09-29','10:00','2026-09-29','11:00','Concluido');
INSERT INTO public.access_records(id,person_id,person_name,person_type,host_person_name,personal_vehicle_id,vehicle_plate,reason,entry_date,entry_time,exit_date,exit_time,status) VALUES
('60000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Funcionario Teste 01','Funcionario','','30000000-0000-4000-8000-000000000001','PES-001','Teste de funcionario','2026-09-30','08:00','2026-09-30','17:00','Concluido');
INSERT INTO public.vehicle_inspection_requests(id,vehicle_id,vehicle_plate,vehicle_name,requested_by,notes) VALUES
('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','DEV-001','Frota ficticia disponivel','Administrador DEV','Inspecao ficticia para teste Realtime');
INSERT INTO public.vehicle_inspection_requests(id,vehicle_id,vehicle_plate,vehicle_name,requested_by,status,checklist,completed_by,completed_at) VALUES
('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000006','DEV-006','Frota ficticia motorista fixo','Administrador DEV','Concluida','{"pneus":true,"luzes":true,"vidros":true,"limpeza":true,"avarias":true,"documentos":true}','Porteiro DEV','2026-09-30 15:00:00+00');
INSERT INTO public.operational_photos(movement_id,phase,file_path,caption) VALUES
('50000000-0000-4000-8000-000000000001','Saida','50000000-0000-4000-8000-000000000001/saida/foto-teste.png','IMAGEM GEOMETRICA DE TESTE');
UPDATE public.people SET cnh_file_path = '10000000-0000-4000-8000-000000000002/documento-teste.pdf',cnh_file_name = 'documento-teste.pdf',cnh_file_type = 'application/pdf'
WHERE id = '10000000-0000-4000-8000-000000000002';
COMMIT;
