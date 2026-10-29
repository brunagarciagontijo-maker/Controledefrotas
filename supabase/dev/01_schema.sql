-- SISTEMA PORTARIA DEV / FASE 1. SOMENTE PROJETO NOVO, VAZIO E INDEPENDENTE.
-- Substitua REPLACE_WITH_DEV_PROJECT_REF pelo identificador DEV conferido no painel.
-- Nao executar as 21 migrations historicas neste projeto.
BEGIN;

DO $$
BEGIN
  IF 'REPLACE_WITH_DEV_PROJECT_REF' !~ '^[a-z0-9]{20}$' THEN
    RAISE EXCEPTION 'Informe o identificador do projeto DEV antes de executar.';
  END IF;
  IF to_regclass('public.vehicles') IS NOT NULL
     OR to_regclass('public.vehicle_records') IS NOT NULL
     OR to_regclass('public.people') IS NOT NULL
     OR to_regclass('private.portaria_dev_environment') IS NOT NULL THEN
    RAISE EXCEPTION 'Banco nao vazio. Preparacao interrompida; nao sobrescrever dados.';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'Este pacote exige um projeto Supabase, incluindo Auth e Storage.';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TABLE private.portaria_dev_environment (
  project_ref text PRIMARY KEY CHECK (project_ref ~ '^[a-z0-9]{20}$'),
  environment text NOT NULL CHECK (environment = 'devcloud'),
  schema_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.portaria_dev_environment(project_ref, environment)
VALUES ('REPLACE_WITH_DEV_PROJECT_REF', 'devcloud');

CREATE FUNCTION private.assert_dev_environment(expected_ref text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF expected_ref !~ '^[a-z0-9]{20}$' OR NOT EXISTS (
    SELECT 1 FROM private.portaria_dev_environment
    WHERE project_ref = expected_ref AND environment = 'devcloud' AND schema_version = 1
  ) THEN RAISE EXCEPTION 'Alvo DEV nao corresponde ao pacote SQL.'; END IF;
END $$;

CREATE TABLE private.app_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  role text NOT NULL CHECK (role IN ('admin', 'porteiro')),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.app_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.app_profiles, private.portaria_dev_environment FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE SEQUENCE private.vehicles_mobile_code_seq MINVALUE 101 MAXVALUE 999 START 101 NO CYCLE;
CREATE SEQUENCE private.people_code_seq MINVALUE 10000 MAXVALUE 99999 START 10000 NO CYCLE;
CREATE SEQUENCE private.personal_vehicles_code_seq MINVALUE 10000 MAXVALUE 99999 START 10000 NO CYCLE;
CREATE SEQUENCE private.access_records_code_seq MINVALUE 10000 MAXVALUE 99999 START 10000 NO CYCLE;
CREATE SEQUENCE private.movements_code_seq MINVALUE 10000 MAXVALUE 99999 START 10000 NO CYCLE;

CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code text NOT NULL UNIQUE DEFAULT nextval('private.vehicles_mobile_code_seq')::text,
  legacy_short_code text UNIQUE,
  plate text NOT NULL CHECK (btrim(plate) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  responsible_name text NOT NULL DEFAULT '',
  fixed_driver_name text NOT NULL DEFAULT '',
  usage_type text NOT NULL DEFAULT 'Comum' CHECK (usage_type IN ('Comum','Rota')),
  status text NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Inativo','Em Manut.')),
  in_patio boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (short_code ~ '^[0-9]{3}$' AND short_code::integer BETWEEN 101 AND 999)
);
CREATE UNIQUE INDEX vehicles_plate_unique ON public.vehicles(upper(btrim(plate)));

CREATE TABLE public.vehicle_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_plate text NOT NULL CHECK (btrim(vehicle_plate) <> ''),
  reason text NOT NULL, authorized_by text NOT NULL,
  usage_type text NOT NULL DEFAULT 'Comum' CHECK (usage_type IN ('Comum','Rota')),
  pickup_date date NOT NULL, pickup_time time NOT NULL,
  pickup_name text NOT NULL, pickup_signature text NOT NULL,
  return_date date, return_time time, return_name text, return_signature text,
  observations text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Em uso' CHECK (status IN ('Em uso','Devolvido')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (return_date IS NULL OR return_time IS NULL OR return_date + return_time >= pickup_date + pickup_time),
  CHECK (status <> 'Devolvido' OR (return_date IS NOT NULL AND return_time IS NOT NULL AND nullif(btrim(return_name),'') IS NOT NULL AND nullif(btrim(return_signature),'') IS NOT NULL))
);

CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code text NOT NULL UNIQUE DEFAULT nextval('private.people_code_seq')::text,
  person_type text NOT NULL DEFAULT 'Funcionario' CHECK (person_type IN ('Funcionario','Terceirizado','Visitante')),
  name text NOT NULL CHECK (btrim(name) <> ''), document_number text,
  phone text NOT NULL DEFAULT '', company text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
  cnh_number text, cnh_valid_until date,
  cnh_file_path text, cnh_file_url text, cnh_file_name text, cnh_file_type text,
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','historico','drivers')),
  is_active boolean NOT NULL DEFAULT true, is_driver boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cnh_file_url IS NULL OR cnh_file_url = ''),
  CHECK (cnh_file_path IS NULL OR cnh_file_path NOT LIKE '%..%' AND cnh_file_path NOT LIKE '%://%')
);
CREATE UNIQUE INDEX people_document_unique ON public.people(document_number) WHERE nullif(btrim(document_number),'') IS NOT NULL;
CREATE UNIQUE INDEX people_cnh_unique ON public.people(cnh_number) WHERE nullif(btrim(cnh_number),'') IS NOT NULL;

-- Tabela legada conservada estruturalmente; nao e utilizada pelo frontend DEV.
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), short_code text UNIQUE,
  name text NOT NULL, cnh_number text UNIQUE, cnh_valid_until date,
  phone text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','historico')),
  is_active boolean NOT NULL DEFAULT true,
  cnh_file_path text, cnh_file_url text, cnh_file_name text, cnh_file_type text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.personal_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code text NOT NULL UNIQUE DEFAULT nextval('private.personal_vehicles_code_seq')::text,
  person_id uuid NOT NULL REFERENCES public.people(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  plate text NOT NULL CHECK (btrim(plate) <> ''), name text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX personal_vehicles_plate_unique ON public.personal_vehicles(upper(btrim(plate)));

CREATE TABLE public.access_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code text NOT NULL UNIQUE DEFAULT nextval('private.access_records_code_seq')::text,
  person_id uuid NOT NULL REFERENCES public.people(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  person_name text NOT NULL, person_type text NOT NULL CHECK (person_type IN ('Funcionario','Terceirizado','Visitante')),
  host_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL, host_person_name text NOT NULL DEFAULT '',
  personal_vehicle_id uuid REFERENCES public.personal_vehicles(id) ON DELETE SET NULL,
  vehicle_plate text NOT NULL DEFAULT '', reason text NOT NULL DEFAULT '',
  entry_date date NOT NULL, entry_time time NOT NULL, exit_date date, exit_time time,
  document_file_path text, document_file_name text, document_file_type text,
  observations text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'Em aberto' CHECK (status IN ('Em aberto','Concluido')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (exit_date IS NULL OR exit_time IS NULL OR exit_date + exit_time >= entry_date + entry_time),
  CHECK (status <> 'Concluido' OR exit_date IS NOT NULL AND exit_time IS NOT NULL),
  CHECK (document_file_path IS NULL OR document_file_path NOT LIKE '%..%' AND document_file_path NOT LIKE '%://%')
);

CREATE TABLE public.operational_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code text NOT NULL UNIQUE DEFAULT nextval('private.movements_code_seq')::text,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  vehicle_plate text NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('Obras','Trajeto curto','Viagem')),
  driver_id uuid REFERENCES public.people(id) ON UPDATE CASCADE ON DELETE SET NULL,
  driver_name text NOT NULL, driver_cnh_number text, driver_cnh_valid_until date,
  qr_identifier text NOT NULL DEFAULT '',
  entry_date date NOT NULL, entry_time time NOT NULL, entry_odometer numeric NOT NULL CHECK(entry_odometer >= 0),
  entry_fuel_level text NOT NULL CHECK (entry_fuel_level IN ('Reserva','1/4','1/2','3/4','Cheio')),
  entry_observations text NOT NULL DEFAULT '',
  exit_date date, exit_time time, exit_odometer numeric,
  exit_fuel_level text CHECK(exit_fuel_level IN ('Reserva','1/4','1/2','3/4','Cheio')),
  exit_observations text NOT NULL DEFAULT '', checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'Em aberto' CHECK(status IN ('Em aberto','Concluida')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(exit_odometer IS NULL OR exit_odometer >= entry_odometer),
  CHECK(exit_date IS NULL OR exit_time IS NULL OR exit_date + exit_time >= entry_date + entry_time),
  CHECK(status <> 'Concluida' OR exit_date IS NOT NULL AND exit_time IS NOT NULL AND exit_odometer IS NOT NULL AND exit_fuel_level IS NOT NULL)
);

CREATE TABLE public.operational_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id uuid NOT NULL REFERENCES public.operational_movements(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK(phase IN ('Entrada','Saida')),
  file_path text NOT NULL CHECK(file_path NOT LIKE '%..%' AND file_path NOT LIKE '%://%'),
  file_url text NOT NULL DEFAULT '' CHECK(file_url = ''), caption text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.operational_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id uuid NOT NULL REFERENCES public.operational_movements(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK(phase IN ('Entrada','Saida')),
  item_key text NOT NULL, item_label text NOT NULL, is_ok boolean NOT NULL DEFAULT false, note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(movement_id, phase, item_key)
);

CREATE TABLE public.vehicle_inspection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  vehicle_plate text NOT NULL, vehicle_name text NOT NULL DEFAULT '', requested_by text NOT NULL DEFAULT '',
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'Pendente' CHECK(status IN ('Pendente','Concluida')),
  checklist jsonb, completed_by text, completed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_notes text NOT NULL DEFAULT '', completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status <> 'Concluida' OR completed_at IS NOT NULL AND checklist IS NOT NULL)
);

DO $$
DECLARE t text; c text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles','vehicle_records','people','drivers','personal_vehicles','access_records','operational_movements','operational_photos','operational_checklist_items','vehicle_inspection_requests'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    IF t <> 'operational_photos' THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 'update_' || t || '_updated_at', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['vehicles','vehicle_records','access_records','operational_movements','vehicle_inspection_requests'] LOOP
    EXECUTE format('CREATE INDEX ON public.%I(status)', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['people','drivers'] LOOP EXECUTE format('CREATE INDEX ON public.%I(name)',t); END LOOP;
  FOR t,c IN SELECT * FROM (VALUES ('vehicle_records','pickup_date'),('vehicle_records','vehicle_plate'),('people','is_driver'),('people','is_active'),('personal_vehicles','person_id'),('access_records','person_id'),('access_records','host_person_id'),('access_records','entry_date'),('operational_movements','vehicle_id'),('operational_movements','driver_id'),('operational_movements','entry_date'),('operational_photos','movement_id'),('operational_checklist_items','movement_id'),('vehicle_inspection_requests','vehicle_id')) x(t,c) LOOP
    EXECUTE format('CREATE INDEX ON public.%I(%I)',t,c);
  END LOOP;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
COMMIT;
