-- CANDIDATO INCREMENTAL. Nao aplicado. Inventario, estrategia de recuperacao e SQL aprovado.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $install$
DECLARE live_fingerprint text; t text;
BEGIN
  IF 'REPLACE_SQL_APPROVAL'<>'APROVADO_EXPLICITAMENTE' OR 'REPLACE_RECOVERY_EVIDENCE_SHA256' !~ '^[a-f0-9]{64}$'
    OR 'REPLACE_RECOVERY_STRATEGY' NOT IN('verified-backup','no-backup-risk-accepted')
    OR 'REPLACE_PROJECT_REF' !~ '^[a-z0-9]{20}$' OR 'REPLACE_BASELINE_HASH' !~ '^[a-f0-9]{32}$' THEN
    RAISE EXCEPTION 'Bloqueado: recuperacao/dispensa registrada, inventario e aprovacao explicita pendentes.';
  END IF;
  IF to_regclass('portaria.release_state') IS NOT NULL THEN
    IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='portaria' AND table_name='release_state' AND column_name IN('recovery_strategy','recovery_evidence_sha256','backup_sha256'))<>3 THEN
      RAISE EXCEPTION 'Marcador de pacote anterior: inventariar e preparar adaptacao incremental; nao reaplicar estes candidatos.';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM portaria.release_state WHERE project_ref='REPLACE_PROJECT_REF' AND recovery_strategy='REPLACE_RECOVERY_STRATEGY' AND recovery_evidence_sha256='REPLACE_RECOVERY_EVIDENCE_SHA256' AND schema_version IN(1,2)) THEN RAISE EXCEPTION 'Marcador de outro projeto/revisao ou versao posterior.'; END IF;
    RETURN;
  END IF;
  live_fingerprint := (REPLACE_STRUCTURE_FINGERPRINT_QUERY);
  IF live_fingerprint IS DISTINCT FROM 'REPLACE_BASELINE_HASH' THEN RAISE EXCEPTION 'Estrutura mudou desde o inventario. Pare e compare novamente.'; END IF;
  FOREACH t IN ARRAY ARRAY['vehicles','vehicle_records','people','personal_vehicles','access_records','operational_movements','operational_photos','operational_checklist_items','vehicle_inspection_requests'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'Tabela necessaria ausente: %. Revisar adaptacao; nao criar banco vazio.',t; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='portaria') THEN RAISE EXCEPTION 'Schema portaria inesperado. Revisar antes de continuar.'; END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND p.prorettype<>'trigger'::regtype AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))) THEN RAISE EXCEPTION 'RPC SECURITY DEFINER preexistente exige revisao individual de corpo e permissoes antes da atualizacao.';END IF;
  CREATE SCHEMA portaria;
  REVOKE ALL ON SCHEMA portaria FROM PUBLIC,anon,authenticated;
  CREATE TABLE portaria.release_state(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),project_ref text NOT NULL,baseline_hash text NOT NULL,
    recovery_strategy text NOT NULL CHECK(recovery_strategy IN('verified-backup','no-backup-risk-accepted')),
    recovery_evidence_sha256 text NOT NULL CHECK(recovery_evidence_sha256 ~ '^[a-f0-9]{64}$'),
    backup_sha256 text GENERATED ALWAYS AS(CASE WHEN recovery_strategy='verified-backup' THEN recovery_evidence_sha256 ELSE NULL END)STORED,
    schema_version integer NOT NULL DEFAULT 1,applied_at timestamptz NOT NULL DEFAULT now());
  INSERT INTO portaria.release_state(project_ref,baseline_hash,recovery_strategy,recovery_evidence_sha256)VALUES('REPLACE_PROJECT_REF','REPLACE_BASELINE_HASH','REPLACE_RECOVERY_STRATEGY','REPLACE_RECOVERY_EVIDENCE_SHA256');
  CREATE TABLE portaria.profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,display_name text NOT NULL CHECK(btrim(display_name)<>''),role text NOT NULL CHECK(role IN ('admin','porteiro')),is_active boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE portaria.departures(request_id uuid PRIMARY KEY,movement_id uuid NOT NULL UNIQUE REFERENCES public.operational_movements(id) ON DELETE RESTRICT,input_hash text NOT NULL,cobli_associated boolean NOT NULL,driver_reason text NOT NULL DEFAULT '',photos jsonb NOT NULL DEFAULT '[]',confirmed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,confirmed_at timestamptz NOT NULL DEFAULT now(),CHECK(cobli_associated OR btrim(driver_reason)<>''),CHECK(jsonb_typeof(photos)='array'));
  CREATE TABLE portaria.conferences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,expected boolean NOT NULL,observed boolean NOT NULL,notes text NOT NULL DEFAULT '',reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT now(),CHECK(expected=observed OR btrim(notes)<>''));
  CREATE INDEX ON portaria.conferences(vehicle_id,created_at DESC);
  ALTER TABLE portaria.release_state ENABLE ROW LEVEL SECURITY;
  ALTER TABLE portaria.profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE portaria.departures ENABLE ROW LEVEL SECURITY;
  ALTER TABLE portaria.conferences ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON ALL TABLES IN SCHEMA portaria FROM PUBLIC,anon,authenticated;
END
$install$;
COMMIT;
