-- =========================================================================
-- SCRIPT DE ATUALIZAÇÃO SUPABASE: CÓDIGO DE REFERÊNCIA SEQUENCIAL (reference_code)
-- =========================================================================
-- Execute este script no SQL Editor do seu Dashboard Supabase:
-- https://supabase.com/dashboard/project/_/sql
-- =========================================================================

-- 1. Adiciona a coluna reference_code na tabela properties (caso não exista)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS reference_code VARCHAR(32);

-- 2. Cria índice para buscas instantâneas por código de referência
CREATE INDEX IF NOT EXISTS idx_properties_reference_code 
ON public.properties(reference_code);

-- 3. Cria índice composto por tenant e reference_code
CREATE INDEX IF NOT EXISTS idx_properties_tenant_reference_code 
ON public.properties(tenant_id, reference_code);

-- 4. Função auxiliar para gerar prefixo baseado no tipo do imóvel
CREATE OR REPLACE FUNCTION public.get_property_type_prefix(prop_type TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE LOWER(TRIM(COALESCE(prop_type, 'outros')))
    WHEN 'apartamento' THEN 'AP'
    WHEN 'casa'        THEN 'CA'
    WHEN 'condomínio'  THEN 'CD'
    WHEN 'condominio'  THEN 'CD'
    WHEN 'sobrado'     THEN 'SO'
    WHEN 'cobertura'   THEN 'CO'
    WHEN 'studio'      THEN 'ST'
    WHEN 'sala'        THEN 'SL'
    WHEN 'comercial'   THEN 'CM'
    WHEN 'galpão'      THEN 'GP'
    WHEN 'galpao'      THEN 'GP'
    WHEN 'prédio'      THEN 'PR'
    WHEN 'predio'      THEN 'PR'
    WHEN 'terreno'     THEN 'TR'
    WHEN 'sítio'       THEN 'SI'
    WHEN 'sitio'       THEN 'SI'
    WHEN 'chácara'     THEN 'CH'
    WHEN 'chacara'     THEN 'CH'
    WHEN 'fazenda'     THEN 'FZ'
    ELSE 'IM'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Atualiza todos os imóveis existentes que ainda não têm reference_code
-- Gera sequencial ordenado por data de criação: AP0001, AP0002, CA0001, etc.
WITH ranked_properties AS (
  SELECT 
    id,
    tenant_id,
    public.get_property_type_prefix(type) AS prefix,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, public.get_property_type_prefix(type) 
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS seq_num
  FROM public.properties
  WHERE reference_code IS NULL OR TRIM(reference_code) = ''
)
UPDATE public.properties p
SET reference_code = r.prefix || LPAD(r.seq_num::TEXT, 4, '0')
FROM ranked_properties r
WHERE p.id = r.id;

-- 6. Trigger para auto-gerar reference_code em novos inserts (caso não fornecido)
CREATE OR REPLACE FUNCTION public.trg_auto_reference_code()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_next_num INT;
BEGIN
  -- Se o reference_code já foi informado (ex: vindo da integração Tokko), mantém
  IF NEW.reference_code IS NOT NULL AND TRIM(NEW.reference_code) <> '' THEN
    RETURN NEW;
  END IF;

  v_prefix := public.get_property_type_prefix(NEW.type);

  -- Busca o maior número já utilizado para esse tenant e prefixo
  SELECT COALESCE(
    MAX(
      NULLIF(regexp_replace(reference_code, '^[A-Za-z]+', ''), '')::INT
    ), 0
  ) + 1
  INTO v_next_num
  FROM public.properties
  WHERE tenant_id = NEW.tenant_id
    AND reference_code LIKE (v_prefix || '%');

  NEW.reference_code := v_prefix || LPAD(v_next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_properties_auto_reference_code ON public.properties;

CREATE TRIGGER trg_properties_auto_reference_code
BEFORE INSERT ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_reference_code();

-- 7. Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
