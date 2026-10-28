-- REFERENCIA LEGADA. NAO EXECUTAR NO PROJETO DEV.
-- Preparacao atual: supabase/dev e DEV_SETUP.md. Este arquivo nao e um schema completo.

-- ============================================================================
-- Sistema de Controle de Frotas - Banco de Dados Supabase
-- Arquivo único com todas as tabelas e configurações necessárias
-- ============================================================================

-- ============================================================================
-- 1. CRIAR EXTENSÃO PARA GERAR UUIDs (se não existir)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. TABELA: vehicle_records (Registros de Veículos)
-- ============================================================================
-- Armazena informações sobre retirada e devolução de veículos
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vehicle_records (
  -- Identificadores e Controle
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Informações do Veículo
  vehicle_plate text NOT NULL,
  reason text NOT NULL,
  authorized_by text NOT NULL,
  usage_type text NOT NULL DEFAULT 'Comum'
    CHECK (usage_type IN ('Comum', 'Rota')),
  
  -- Informações de Retirada
  pickup_date date NOT NULL,
  pickup_time time NOT NULL,
  pickup_name text NOT NULL,
  pickup_signature text NOT NULL, -- Base64 encoded signature
  
  -- Informações de Devolução
  return_date date,
  return_time time,
  return_name text,
  return_signature text, -- Base64 encoded signature
  
  -- Observações e Status
  observations text DEFAULT '',
  status text NOT NULL DEFAULT 'Em uso' 
    CHECK (status IN ('Em uso', 'Devolvido')),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 3. ÍNDICES - Para melhorar performance das queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vehicle_records_status 
  ON public.vehicle_records(status);

CREATE INDEX IF NOT EXISTS idx_vehicle_records_vehicle_plate 
  ON public.vehicle_records(vehicle_plate);

CREATE INDEX IF NOT EXISTS idx_vehicle_records_pickup_date 
  ON public.vehicle_records(pickup_date);

CREATE INDEX IF NOT EXISTS idx_vehicle_records_created_at 
  ON public.vehicle_records(created_at DESC);

-- ============================================================================
-- 4. FUNÇÃO - Atualizar updated_at automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. TRIGGER - Atualizar updated_at quando registros forem modificados
-- ============================================================================

DROP TRIGGER IF EXISTS update_vehicle_records_updated_at ON public.vehicle_records;
CREATE TRIGGER update_vehicle_records_updated_at
  BEFORE UPDATE ON public.vehicle_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Habilitar RLS na tabela

ALTER TABLE public.vehicle_records ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. POLÍTICAS RLS
-- ============================================================================
-- Permitir acesso público (aplicação interna)
-- Se precisar de autenticação, modifique estas políticas

-- Política para SELECT (Ler dados)
DROP POLICY IF EXISTS "Allow public read on vehicle_records" ON public.vehicle_records;
CREATE POLICY "Allow public read on vehicle_records"
  ON public.vehicle_records
  FOR SELECT
  USING (true);

-- Política para INSERT (Criar registros)
DROP POLICY IF EXISTS "Allow public insert on vehicle_records" ON public.vehicle_records;
CREATE POLICY "Allow public insert on vehicle_records"
  ON public.vehicle_records
  FOR INSERT
  WITH CHECK (true);

-- Política para UPDATE (Atualizar registros)
DROP POLICY IF EXISTS "Allow public update on vehicle_records" ON public.vehicle_records;
CREATE POLICY "Allow public update on vehicle_records"
  ON public.vehicle_records
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Política para DELETE (Deletar registros)
DROP POLICY IF EXISTS "Allow public delete on vehicle_records" ON public.vehicle_records;
CREATE POLICY "Allow public delete on vehicle_records"
  ON public.vehicle_records
  FOR DELETE
  USING (true);

-- ============================================================================
-- 8. COMENTÁRIOS - Documentação das tabelas
-- ============================================================================

COMMENT ON TABLE public.vehicle_records IS 
'Registra todas as operações de retirada e devolução de veículos. 
Cada registro contém informações sobre o veículo, as assinaturas digitais 
de retirada e devolução, e o status atual do veículo.';

COMMENT ON COLUMN public.vehicle_records.vehicle_plate IS 
'Placa do veículo ou identificação única';

COMMENT ON COLUMN public.vehicle_records.reason IS 
'Motivo da utilização do veículo';

COMMENT ON COLUMN public.vehicle_records.authorized_by IS 
'Fonte de autorização para utilizar o veículo';

COMMENT ON COLUMN public.vehicle_records.pickup_signature IS 
'Assinatura digital em formato Base64 do responsável pela retirada';

COMMENT ON COLUMN public.vehicle_records.return_signature IS 
'Assinatura digital em formato Base64 do responsável pela devolução';

COMMENT ON COLUMN public.vehicle_records.status IS 
'Status do veículo: "Em uso" (retirado) ou "Devolvido"';

-- ============================================================================
-- Fim do arquivo de banco de dados
-- ============================================================================
