-- =========================================================================
-- ATUALIZAÇÃO SUPABASE: PERMITIR STATUS 'inativo' NA TABELA properties
-- =========================================================================
-- Execute este script no SQL Editor do seu Dashboard Supabase:
-- https://supabase.com/dashboard/project/_/sql

-- 1. Remove a restrição antiga que não aceitava o status 'inativo'
ALTER TABLE public.properties 
DROP CONSTRAINT IF EXISTS properties_status_check;

-- 2. Adiciona a nova restrição contemplando o status 'inativo'
ALTER TABLE public.properties 
ADD CONSTRAINT properties_status_check 
CHECK (status IN ('disponível', 'reservado', 'vendido', 'alugado', 'inativo'));

-- 3. Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
