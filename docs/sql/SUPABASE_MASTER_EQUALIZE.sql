-- =========================================================================
-- SCRIPT MESTRE DE EQUALIZAÇÃO TOTAL - SALESCORE CRM (SUPABASE)
-- Execução: Painel Supabase > SQL Editor > New query > Colar e clicar em 'Run'
-- Segurança: 100% Idempotente (Não apaga dados, apenas completa colunas que faltarem)
-- =========================================================================

-- 1. TABELA PROPERTIES (Imóveis, Suítes, Despesas e Destaques)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS suites INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS condo_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS iptu NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS building_name TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_properties_is_featured ON public.properties(is_featured);
CREATE INDEX IF NOT EXISTS idx_properties_building_name ON public.properties(building_name);

-- 2. TABELA DEALS (Negócios, Probabilidade, Fechamento e Prioridade)
ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS probability NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aberto',
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'media',
ADD COLUMN IF NOT EXISTS expected_close_date TIMESTAMPTZ;

-- 3. TABELA PROFILES (Usuários, Corretores e Inativação)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS inactive_reason TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- 4. TABELA TENANTS (Imobiliárias, Dados Cadastrais e Precificação SaaS)
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS base_price NUMERIC DEFAULT 499.00,
ADD COLUMN IF NOT EXISTS broker_limit INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS admin_limit INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS extra_broker_price NUMERIC DEFAULT 29.90,
ADD COLUMN IF NOT EXISTS extra_admin_price NUMERIC DEFAULT 49.90;

-- 5. TABELA CONTACTS (Clientes e Equipe)
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS source TEXT;

-- 6. RECARREGAR O SCHEMA CACHE DA API SUPABASE (POSTGREST)
NOTIFY pgrst, 'reload schema';
