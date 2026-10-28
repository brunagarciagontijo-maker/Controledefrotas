-- Crie primeiro 4 usuarios ficticios no painel Auth (criacao direta, sem convites).
-- Substitua os 3 UUIDs abaixo pelos usuarios admin, porteiro e inativo.
-- O quarto usuario fica SEM perfil para o teste de acesso negado.
-- Nao incluir senhas, chaves ou emails reais neste arquivo.
BEGIN;
SELECT private.assert_dev_environment('REPLACE_WITH_DEV_PROJECT_REF');
INSERT INTO private.app_profiles(user_id,display_name,role,is_active) VALUES
('REPLACE_ADMIN_USER_UUID'::uuid,'Administrador DEV','admin',true),
('REPLACE_GATE_USER_UUID'::uuid,'Porteiro DEV','porteiro',true),
('REPLACE_INACTIVE_USER_UUID'::uuid,'Usuario inativo DEV','porteiro',false);
COMMIT;
