-- EXEMPLO PRIVADO DE ATRIBUICAO A CONTAS EXISTENTES. EXIGE APROVACAO ESPECIFICA.
-- Preencher somente em copia local ignorada; nao enviar UUIDs pessoais ao chat/Git.
BEGIN;
DO $$ DECLARE administrator uuid;gatekeeper uuid;BEGIN
 IF 'REPLACE_PROFILE_APPROVAL'<>'PERFIS_APROVADOS_EXPLICITAMENTE' OR NOT EXISTS(SELECT 1 FROM portaria.release_state WHERE project_ref='REPLACE_PROJECT_REF' AND recovery_strategy='REPLACE_RECOVERY_STRATEGY' AND recovery_evidence_sha256='REPLACE_RECOVERY_EVIDENCE_SHA256' AND schema_version=5)THEN RAISE EXCEPTION 'Atribuicao nao aprovada ou ambiente nao conferido.';END IF;
 administrator:='REPLACE_EXISTING_ADMIN_UUID'::uuid;gatekeeper:='REPLACE_EXISTING_GATE_UUID'::uuid;
 IF administrator=gatekeeper OR(SELECT count(*)FROM auth.users WHERE id IN(administrator,gatekeeper))<>2 THEN RAISE EXCEPTION 'Conferir duas contas Auth existentes e distintas.';END IF;
 IF EXISTS(SELECT 1 FROM portaria.profiles WHERE user_id IN(administrator,gatekeeper))THEN RAISE EXCEPTION 'Ja existe perfil: revisar diferencas sem sobrescrever permissoes.';END IF;
 INSERT INTO portaria.profiles(user_id,display_name,role,is_active)VALUES(administrator,'Administrador','admin',true),(gatekeeper,'Porteiro','porteiro',true);
END $$;
COMMIT;
