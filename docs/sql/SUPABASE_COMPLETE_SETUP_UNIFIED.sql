-- =========================================================================
-- SCRIPT DE INICIALIZAÇÃO COMPLETO E UNIFICADO - SALESCORE CRM (SUPABASE)
-- Execute no Supabase do cliente: SQL Editor > New query > Colar tudo > Run
-- Idempotente: pode ser executado múltiplas vezes com segurança total.
-- =========================================================================

-- HABILITAR EXTENSÕES ESSENCIAIS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. TABELA TENANTS (Imobiliárias / Empresas Inquilinas)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  user_limit INTEGER DEFAULT 10,
  is_blocked BOOLEAN DEFAULT FALSE,
  due_day INTEGER DEFAULT 10,
  plan TEXT DEFAULT 'profissional',
  cnpj TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  contact_email TEXT,
  base_price NUMERIC DEFAULT 499.00,
  broker_limit INTEGER DEFAULT 2,
  admin_limit INTEGER DEFAULT 1,
  extra_broker_price NUMERIC DEFAULT 29.90,
  extra_admin_price NUMERIC DEFAULT 49.90,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inquilino padrão inicial (garante integridade referencial)
INSERT INTO public.tenants (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'SalesScore Default', 'default')
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- 2. TABELA PROFILES (Perfis de Corretores e Gestores)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  display_name TEXT,
  email TEXT UNIQUE NOT NULL,
  photo_url TEXT,
  phone TEXT,
  role TEXT DEFAULT 'Membro',
  user_type TEXT DEFAULT 'funcionário',
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  inactive_reason TEXT,
  security_keyword TEXT,
  user_id UUID,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- =========================================================================
-- 3. TABELA PROFILE_TENANTS (Associação Muitos-para-Muitos: Usuário x Imobiliária)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.profile_tenants (
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('Membro', 'Admin')) DEFAULT 'Membro',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (profile_id, tenant_id)
);

-- =========================================================================
-- 4. TABELA COMPANIES (Empresas / Construtoras Parceiras)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON public.companies(tenant_id);

-- =========================================================================
-- 5. TABELA CONTACTS (Clientes e Equipe)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  type TEXT CHECK (type IN ('cliente', 'equipe')),
  department TEXT,
  source TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON public.contacts(tenant_id);

-- =========================================================================
-- 6. TABELA PROPERTIES (Imóveis e Vitrine)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_code TEXT,
  title TEXT NOT NULL,
  type TEXT,
  status TEXT DEFAULT 'disponível',
  price NUMERIC NOT NULL,
  condo_fee NUMERIC DEFAULT 0,
  iptu NUMERIC DEFAULT 0,
  suites INTEGER DEFAULT 0,
  building_name TEXT,
  tags TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT FALSE,
  location TEXT,
  cep TEXT,
  street TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  number TEXT,
  complement TEXT,
  area NUMERIC,
  bedrooms INTEGER,
  bathrooms INTEGER,
  parking_spots INTEGER,
  accepts_financing BOOLEAN DEFAULT TRUE,
  notes TEXT,
  description TEXT,
  image_url TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_properties_tenant_id ON public.properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_reference_code ON public.properties(reference_code);
CREATE INDEX IF NOT EXISTS idx_properties_is_featured ON public.properties(is_featured);
CREATE INDEX IF NOT EXISTS idx_properties_building_name ON public.properties(building_name);

-- =========================================================================
-- 7. TABELA PROPERTY_IMAGES (Galeria de Fotos dos Imóveis)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.property_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON public.property_images(property_id);

-- =========================================================================
-- 8. TABELA DEALS (Funil de Vendas / Negócios)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'prospeccao',
  probability NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'aberto',
  priority TEXT DEFAULT 'media',
  expected_close_date TIMESTAMPTZ,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deals_tenant_id ON public.deals(tenant_id);

-- =========================================================================
-- 9. TABELA GOALS (Metas de Vendas)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL,
  stage_goals JSONB,
  revenue NUMERIC DEFAULT 0,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_tenant_id ON public.goals(tenant_id);

-- =========================================================================
-- 10. TABELA ACTIVITIES (Atividades, Tarefas e Visitas)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  type TEXT,
  status TEXT CHECK (status IN ('pendente', 'concluida', 'cancelada', 'completed', 'pending', 'cancelled')) DEFAULT 'pendente',
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_tenant_id ON public.activities(tenant_id);

-- =========================================================================
-- 11. TABELA TIMELINE & AUDITORIA (Logs, Histórico e Auditoria de Acessos)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT,
  category TEXT,
  related_id UUID,
  content TEXT,
  title TEXT,
  author_name TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timeline_tenant_id ON public.timeline(tenant_id);
CREATE INDEX IF NOT EXISTS idx_timeline_category ON public.timeline(category);
CREATE INDEX IF NOT EXISTS idx_timeline_created_at ON public.timeline(created_at DESC);

-- =========================================================================
-- 12. TABELAS CONVERSATIONS & MESSAGES (Chat Interno)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participants UUID[],
  participant_details JSONB,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  type TEXT DEFAULT 'direct',
  category TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  unread_count JSONB DEFAULT '{}'::jsonb,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111'
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  file_name TEXT,
  file_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) DEFAULT '11111111-1111-1111-1111-111111111111',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON public.conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

-- =========================================================================
-- 13. FUNÇÕES DE SEGURANÇA E AUXILIARES (SECURITY DEFINER / STABLE)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'Admin' OR is_admin = TRUE)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_associated_tenants()
RETURNS UUID[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tenants_arr UUID[];
BEGIN
  SELECT array_agg(tenant_id) INTO tenants_arr
  FROM public.profile_tenants
  WHERE profile_id = auth.uid();
  RETURN coalesce(tenants_arr, ARRAY[]::UUID[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_user_tenant_admin(t_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profile_tenants
    WHERE profile_id = auth.uid()
    AND tenant_id = t_id
    AND role = 'Admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t_id UUID;
BEGIN
  SELECT tenant_id INTO t_id FROM public.profiles
  WHERE id = auth.uid();
  RETURN coalesce(t_id, '11111111-1111-1111-1111-111111111111'::UUID);
END;
$$;

-- =========================================================================
-- 14. TRIGGER DE CADASTRO DE USUÁRIOS (AUTH.USERS -> PROFILES & PROFILE_TENANTS)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing_profile_id UUID;
  existing_tenant_id UUID;
  existing_role TEXT;
  default_tenant_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  SELECT id, tenant_id, role INTO existing_profile_id, existing_tenant_id, existing_role 
  FROM public.profiles 
  WHERE email = new.email;

  IF existing_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET id = new.id,
        display_name = coalesce(display_name, new.raw_user_meta_data->>'display_name'),
        updated_at = now()
    WHERE email = new.email;

    INSERT INTO public.profile_tenants (profile_id, tenant_id, role)
    VALUES (new.id, coalesce(existing_tenant_id, default_tenant_id), coalesce(existing_role, 'Membro'))
    ON CONFLICT (profile_id, tenant_id) DO NOTHING;
  ELSE
    INSERT INTO public.profiles (id, display_name, email, role, user_type, is_admin, tenant_id)
    VALUES (
      new.id,
      new.raw_user_meta_data->>'display_name',
      new.email,
      CASE WHEN new.email = 'ggsalles@gmail.com' THEN 'Admin' ELSE 'Membro' END,
      'funcionário',
      CASE WHEN new.email = 'ggsalles@gmail.com' THEN TRUE ELSE FALSE END,
      default_tenant_id
    );

    INSERT INTO public.profile_tenants (profile_id, tenant_id, role)
    VALUES (
      new.id,
      default_tenant_id,
      CASE WHEN new.email = 'ggsalles@gmail.com' THEN 'Admin' ELSE 'Membro' END
    )
    ON CONFLICT (profile_id, tenant_id) DO NOTHING;
  END IF;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================================================================
-- 15. HABILITAR ROW LEVEL SECURITY (RLS) & POLÍTICAS
-- =========================================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Políticas de Tenants
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.tenants;
CREATE POLICY "Allow select for authenticated users" ON public.tenants
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Platform admin can manage tenants" ON public.tenants;
CREATE POLICY "Platform admin can manage tenants" ON public.tenants
  FOR ALL USING ( (auth.jwt() ->> 'email') = 'ggsalles@gmail.com' )
  WITH CHECK ( (auth.jwt() ->> 'email') = 'ggsalles@gmail.com' );

-- Políticas de Profiles (Loop-free / Sem recursão)
DROP POLICY IF EXISTS "Users can see profiles of their own tenants" ON public.profiles;
CREATE POLICY "Users can see profiles of their own tenants" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR
    tenant_id = ANY(public.get_user_associated_tenants()) OR
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid() OR
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
  );

DROP POLICY IF EXISTS "Admins can manage profiles of their own tenants" ON public.profiles;
CREATE POLICY "Admins can manage profiles of their own tenants" ON public.profiles
  FOR ALL USING (
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com' OR
    (
      tenant_id = ANY(public.get_user_associated_tenants()) AND
      public.is_user_tenant_admin(tenant_id)
    )
  );

-- Políticas de Profile Tenants
DROP POLICY IF EXISTS "Users can select their own associations" ON public.profile_tenants;
CREATE POLICY "Users can select their own associations" ON public.profile_tenants
  FOR SELECT USING (
    profile_id = auth.uid() OR 
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
  );

DROP POLICY IF EXISTS "Admins can manage associations of their own tenants" ON public.profile_tenants;
CREATE POLICY "Admins can manage associations of their own tenants" ON public.profile_tenants
  FOR ALL USING (
    profile_id = auth.uid() OR 
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
  );

-- Políticas de Properties (Leitura pública na vitrine + Gestão por corretores/admins)
DROP POLICY IF EXISTS "Public can view properties" ON public.properties;
CREATE POLICY "Public can view properties" ON public.properties
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Owners and Admins can manage properties" ON public.properties;
CREATE POLICY "Owners and Admins can manage properties" ON public.properties
  FOR ALL USING (
    auth.uid() = owner_id OR 
    public.is_admin() OR 
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
  );

-- Políticas de Imagens de Imóveis (Leitura pública + Gestão)
DROP POLICY IF EXISTS "Public can view property images" ON public.property_images;
CREATE POLICY "Public can view property images" ON public.property_images
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can manage images of their properties" ON public.property_images;
CREATE POLICY "Users can manage images of their properties" ON public.property_images
  FOR ALL USING (
    auth.role() = 'authenticated'
  );

-- Políticas de Timeline e Auditoria
DROP POLICY IF EXISTS "Master and Tenant Admins can view audit logs" ON public.timeline;
CREATE POLICY "Master and Tenant Admins can view audit logs" ON public.timeline
  FOR SELECT USING (
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com' OR
    auth.uid() = owner_id OR
    auth.uid() = created_by OR
    (
      tenant_id = ANY(public.get_user_associated_tenants()) AND
      public.is_user_tenant_admin(tenant_id)
    )
  );

DROP POLICY IF EXISTS "Users and system can insert timeline events" ON public.timeline;
CREATE POLICY "Users and system can insert timeline events" ON public.timeline
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id OR
    auth.uid() = created_by OR
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com' OR
    tenant_id = ANY(public.get_user_associated_tenants()) OR
    tenant_id IS NULL OR
    auth.role() = 'authenticated' OR
    auth.role() = 'anon'
  );

-- Políticas Genéricas para Companies, Contacts, Deals, Goals, Activities
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['companies', 'contacts', 'deals', 'goals', 'activities'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Owners and Admins can manage everything" ON %I', t);
    EXECUTE format('CREATE POLICY "Owners and Admins can manage everything" ON %I FOR ALL USING (
      auth.uid() = owner_id OR public.is_admin() OR (auth.jwt() ->> ''email'') = ''ggsalles@gmail.com''
    )', t);
  END LOOP;
END $$;

-- Políticas de Chat (Conversations & Messages)
DROP POLICY IF EXISTS "Participants can see their conversations" ON public.conversations;
CREATE POLICY "Participants can see their conversations" ON public.conversations
  FOR ALL USING ( 
    (participants @> ARRAY[auth.uid()]::UUID[]) OR 
    public.is_admin() OR 
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com' 
  );

DROP POLICY IF EXISTS "Participants can see messages" ON public.messages;
CREATE POLICY "Participants can see messages" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id 
      AND ( (c.participants @> ARRAY[auth.uid()]::UUID[]) OR public.is_admin() )
    ) OR
    owner_id = auth.uid() OR
    public.is_admin() OR
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
  );

-- =========================================================================
-- 16. STORAGE BUCKETS (Fotos de Imóveis e Anexos)
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas do Storage
DROP POLICY IF EXISTS "Manage property-images for all" ON storage.objects;
CREATE POLICY "Manage property-images for all" ON storage.objects
  FOR ALL USING ( bucket_id = 'property-images' )
  WITH CHECK ( bucket_id = 'property-images' );

DROP POLICY IF EXISTS "Public view for property-images" ON storage.objects;
CREATE POLICY "Public view for property-images" ON storage.objects
  FOR SELECT USING ( bucket_id = 'property-images' );

DROP POLICY IF EXISTS "Manage chat-attachments for authenticated" ON storage.objects;
CREATE POLICY "Manage chat-attachments for authenticated" ON storage.objects
  FOR ALL USING ( bucket_id = 'chat-attachments' AND auth.role() = 'authenticated' )
  WITH CHECK ( bucket_id = 'chat-attachments' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Public view for chat-attachments" ON storage.objects;
CREATE POLICY "Public view for chat-attachments" ON storage.objects
  FOR SELECT USING ( bucket_id = 'chat-attachments' );

-- =========================================================================
-- 17. ATIVAR REALTIME NAS TABELAS
-- =========================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  ALTER PUBLICATION supabase_realtime ADD TABLE companies;
  ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
  ALTER PUBLICATION supabase_realtime ADD TABLE properties;
  ALTER PUBLICATION supabase_realtime ADD TABLE deals;
  ALTER PUBLICATION supabase_realtime ADD TABLE goals;
  ALTER PUBLICATION supabase_realtime ADD TABLE activities;
  ALTER PUBLICATION supabase_realtime ADD TABLE timeline;
  ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Recarregar cache de schema da API REST do Supabase
NOTIFY pgrst, 'reload schema';
