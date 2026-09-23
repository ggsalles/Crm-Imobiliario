-- =========================================================================
-- SCRIPT DE ATUALIZAÇÃO SUPABASE: RECURSO IMÓVEIS EM DESTAQUE (is_featured)
-- =========================================================================
-- Execute este script no SQL Editor do seu Dashboard Supabase:
-- https://supabase.com/dashboard/project/_/sql

-- 1. Adiciona a coluna is_featured na tabela properties (caso ainda não exista)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- 2. Cria um índice para otimizar filtros rápidos e ordenação por destaques
CREATE INDEX IF NOT EXISTS idx_properties_is_featured 
ON public.properties(is_featured);

-- 3. Atualiza os registros existentes nulos para false
UPDATE public.properties 
SET is_featured = FALSE 
WHERE is_featured IS NULL;

-- 4. Notifica o PostgREST para recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
