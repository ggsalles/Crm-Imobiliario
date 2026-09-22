-- ==============================================================================
-- ATUALIZAÇÃO SUPABASE: CAMPOS DE IPTU, CONDOMÍNIO E NOME DO EDIFÍCIO/CONDOMÍNIO
-- Tabela: properties
-- ==============================================================================

-- 1. Adicionar as novas colunas à tabela properties (caso ainda não existam)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS condo_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS iptu numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS building_name text;

-- 2. Documentação e Comentários nas Colunas
COMMENT ON COLUMN properties.condo_fee IS 'Valor mensal da taxa condominial em reais (R$)';
COMMENT ON COLUMN properties.iptu IS 'Valor anual ou cota única do IPTU em reais (R$)';
COMMENT ON COLUMN properties.building_name IS 'Nome do edifício, prédio, condomínio fechado ou empreendimento residencial/comercial';

-- 3. Índice opcional para buscas e filtros por condomínio/edifício
CREATE INDEX IF NOT EXISTS idx_properties_building_name ON properties(building_name);
