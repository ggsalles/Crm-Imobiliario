-- =========================================================================
-- SCRIPT DE ATUALIZAÇÃO SUPABASE: PALAVRA-CHAVE SECRETA DE RECUPERAÇÃO DE CONTA
-- =========================================================================
-- Execute este script no SQL Editor do seu Dashboard Supabase:
-- https://supabase.com/dashboard/project/_/sql

-- 1. Adiciona a coluna security_keyword na tabela profiles (caso ainda não exista)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS security_keyword TEXT;

-- 2. Notifica o PostgREST para recarregar o schema cache do Supabase imediatamente
NOTIFY pgrst, 'reload schema';
