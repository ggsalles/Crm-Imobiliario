-- =========================================================================
-- SCRIPT SUPABASE: BACKUP DA TABELA PROPERTIES
-- =========================================================================
-- Execute este script no SQL Editor do Supabase antes ou após qualquer
-- sincronização em lote para manter uma cópia física idêntica dos dados.
-- https://supabase.com/dashboard/project/_/sql
-- =========================================================================

-- 1. Cria a tabela de backup com todos os dados e estrutura atuais
DROP TABLE IF EXISTS public.properties_backup_20261014;

CREATE TABLE public.properties_backup_20261014 AS 
SELECT * FROM public.properties;

-- 2. Confirma a quantidade de imóveis salvos no backup
SELECT count(*) AS total_imoveis_salvos_no_backup 
FROM public.properties_backup_20261014;

-- =========================================================================
-- CASO PRECISE RESTAURAR (ROLLBACK) NO FUTURO:
-- =========================================================================
-- TRUNCATE TABLE public.properties;
-- INSERT INTO public.properties SELECT * FROM public.properties_backup_20261014;
-- =========================================================================
