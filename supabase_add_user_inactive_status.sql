-- =========================================================================
-- SCRIPT DE ATUALIZAÇÃO SUPABASE: RECURSO DE INATIVAÇÃO DE USUÁRIOS
-- =========================================================================
-- Execute este script no SQL Editor do seu Dashboard Supabase:
-- https://supabase.com/dashboard/project/_/sql

-- 1. Adiciona a coluna is_active na tabela profiles (caso ainda não exista)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Adiciona a coluna inactive_reason na tabela profiles (caso ainda não exista)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS inactive_reason TEXT;

-- 3. Cria índice para otimizar filtros rápidos por status ativo/inativo
CREATE INDEX IF NOT EXISTS idx_profiles_is_active 
ON public.profiles(is_active);

-- 4. Garante que todos os usuários já existentes permaneçam marcados como ativos
UPDATE public.profiles 
SET is_active = TRUE 
WHERE is_active IS NULL;

-- 5. Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
