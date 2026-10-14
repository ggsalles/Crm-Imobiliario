-- =========================================================================
-- SCRIPT SUPABASE: ÍNDICE ÚNICO DO CÓDIGO DE REFERÊNCIA (reference_code)
-- =========================================================================
-- Execute este script no SQL Editor do Supabase para blindar a integridade
-- no nível de banco de dados, impedindo qualquer colisão de referência.

-- 1. Normaliza eventuais espaços residuais em códigos de referência existentes
UPDATE public.properties
SET reference_code = UPPER(REGEXP_REPLACE(reference_code, '\s+', '', 'g'))
WHERE reference_code IS NOT NULL AND reference_code ~ '\s+';

-- 2. Cria índice de unicidade por tenant e código de referência
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_unique_tenant_reference_code
ON public.properties(tenant_id, reference_code)
WHERE reference_code IS NOT NULL AND TRIM(reference_code) <> '';

-- 3. Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
