-- ==============================================================================
-- ATUALIZAÇÃO SUPABASE: CARACTERÍSTICAS, COMODIDADES E TAGS DE IMÓVEIS
-- Tabela: properties
-- ==============================================================================

-- 1. Adicionar a coluna de tags como array de texto (caso ainda não exista)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Documentação e Comentário na Coluna
COMMENT ON COLUMN properties.tags IS 'Lista de comodidades, diferenciais e tags do imóvel (ex: piscina, varanda gourmet, elevador, academia, churrasqueira, etc)';

-- 3. Índice GIN para buscas ultra-rápidas por características
CREATE INDEX IF NOT EXISTS idx_properties_tags ON properties USING GIN(tags);
