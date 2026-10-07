-- ==============================================================================
-- Script para Atualização da Constraint de Tipos de Imóveis no Supabase
-- Executar no SQL Editor do painel Supabase
-- ==============================================================================

-- 1. Remove a restrição antiga que aceitava apenas 4 tipos básicos
ALTER TABLE public.properties 
DROP CONSTRAINT IF EXISTS properties_type_check;

-- 2. Adiciona a nova restrição contemplando todos os tipos de imóveis suportados pelo CRM
ALTER TABLE public.properties 
ADD CONSTRAINT properties_type_check 
CHECK (type IN (
  'apartamento',
  'casa',
  'condomínio',
  'condominio',
  'cobertura',
  'sobrado',
  'studio',
  'loft',
  'flat',
  'kitnet',
  'sala',
  'comercial',
  'galpão',
  'galpao',
  'terreno',
  'lote',
  'chácara',
  'chacara',
  'sítio',
  'sitio',
  'fazenda',
  'outros',
  'outro'
));
