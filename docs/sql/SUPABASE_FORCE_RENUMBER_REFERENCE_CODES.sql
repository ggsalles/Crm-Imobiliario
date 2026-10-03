-- =========================================================================
-- SCRIPT SUPABASE: RENUMERAÇÃO SEQUENCIAL COMPLETA (reference_code)
-- =========================================================================
-- Finalidade:
--   Renumerar 100% dos imóveis de forma limpa e sequencial por imobiliária (tenant)
--   e por tipo de imóvel (AP0001, AP0002, CA0001, CD0001, etc.), ordenados por data
--   de cadastro.
--
-- Execute no SQL Editor do Supabase sempre que desejar reorganizar a numeração:
-- https://supabase.com/dashboard/project/_/sql
-- =========================================================================

-- 1. Garante que a coluna reference_code existe
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS reference_code VARCHAR(32);

-- 2. Garante que a função de prefixos está atualizada
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

-- 3. Executa a renumeração sequencial forçada para TODOS os imóveis
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
)
UPDATE public.properties p
SET reference_code = r.prefix || LPAD(r.seq_num::TEXT, 4, '0')
FROM ranked_properties r
WHERE p.id = r.id;

-- 4. Notifica o PostgREST para recarregar o cache de schema imediatamente
NOTIFY pgrst, 'reload schema';
