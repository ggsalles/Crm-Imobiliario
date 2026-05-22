-- ====================================================================
-- SCRIPT DE MIGRAÇÃO: MULTI-INQUILINATO (MULTI-TENANCY) LÓGICO COM RLS
-- Sistema: SalesScore SaaS CRM
-- Data: 21/05/2026
-- Objetivo: Converter a arquitetura monousuário/monocompanhia em um SaaS
-- multilojas/multitenant de alta segurança usando PostgreSQL e RLS.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. CRIAÇÃO DA TABELA DE INQUILINOS (TENANTS / EMPRESAS CLIENTES)
-- --------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique, -- Para identificar a empresa na URL futuramente (ex: imobiliariaprime)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS para garantir que nem todos os dados dos inquilinos fiquem abertos
alter table public.tenants enable row level security;

-- Políticas de RLS para Tenants (Inquilinos)
drop policy if exists "Allow select for authenticated users" on public.tenants;
drop policy if exists "Platform admin can manage tenants" on public.tenants;

-- Qualquer usuário autenticado pode listar os inquilinos (ex: carregar dropdowns ou ver empresas)
create policy "Allow select for authenticated users" on public.tenants
  for select
  using (auth.role() = 'authenticated');

-- Apenas o administrador da plataforma da SalesScore (ggsalles@gmail.com) pode criar, editar ou excluir inquilinos
create policy "Platform admin can manage tenants" on public.tenants
  for all
  using ( (auth.jwt() ->> 'email') = 'ggsalles@gmail.com' )
  with check ( (auth.jwt() ->> 'email') = 'ggsalles@gmail.com' );

-- --------------------------------------------------------------------
-- 2. CRIAÇÃO DO INQUILINO PADRÃO (Para migrar dados existentes sem quebrar o CRM)
-- --------------------------------------------------------------------
insert into public.tenants (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'SalesScore Default', 'default')
on conflict (id) do nothing;

-- --------------------------------------------------------------------
-- 3. CRIAÇÃO DE CONFIGURAÇÕES DE ISOLAMENTO DE TENANTS NO PROFILE DO USUÁRIO
-- --------------------------------------------------------------------
-- Adicionar a coluna tenant_id referenciando a tabela de inquilinos.
-- Todas as contas e dados legados serão mapeados inicialmente para o tenant padrão.
alter table public.profiles 
add column if not exists tenant_id uuid references public.tenants(id) default '11111111-1111-1111-1111-111111111111';

-- Criar índice para performance de leitura rápida de perfis por empresa
create index if not exists idx_profiles_tenant_id on public.profiles(tenant_id);

-- --------------------------------------------------------------------
-- 4. ADICIONAL DE FUNÇÕES AUXILIARES COM SEGURANÇA DETERMINADA (SECURITY DEFINER)
-- Estreitam o contexto do banco de dados ao tenant_id do usuário logado
-- para evitar chamadas lentas e recursivas de políticas (RLS loops)
-- --------------------------------------------------------------------

-- Função segura que retorna o tenant_id do usuário logado baseado no JWT do Supabase
create or replace function public.get_user_tenant()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id uuid;
begin
  select tenant_id into t_id from public.profiles
  where id = auth.uid();
  return coalesce(t_id, '11111111-1111-1111-1111-111111111111');
end;
$$;

-- Função rápida que verifica se o usuário logado é Administrador da sua própria empresa
create or replace function public.is_tenant_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'Admin'
  );
end;
$$;

-- --------------------------------------------------------------------
-- 5. UPGRADE DAS TABELAS COM tenant_id E ALIMENTAÇÃO AUTOMÁTICA (DEFAULT DINÂMICO)
-- --------------------------------------------------------------------
-- Adicionar coluna tenant_id a todas as tabelas do CRM.
-- O "default dinâmico" utilizando a função 'public.get_user_tenant()' garante
-- que, se o código JS/TS não passar o id do tenant no INSERT, o próprio banco
-- calcula e preenche de forma 100% segura baseando-se em quem está inserindo!

do $$
declare
  t text;
begin
  -- Loop em todas as tabelas do CRM que contêm dados específicos de transações
  for t in select table_name from information_schema.tables 
           where table_schema = 'public' 
           and table_name not in ('profiles', 'tenants')
  loop
    -- Adicionar a coluna tenant_id caso ela não exista
    execute format('alter table public.%I add column if not exists tenant_id uuid references public.tenants(id) default ''11111111-1111-1111-1111-111111111111''', t);
    
    -- Definir o default dinâmico para novas inserções futuras
    execute format('alter table public.%I alter column tenant_id set default public.get_user_tenant()', t);
    
    -- Criar os índices de busca por tenant_id para performance espetacular de escalabilidade
    execute format('create index if not exists %I on public.%I(tenant_id)', 'idx_' || t || '_tenant_id', t);
  end loop;
end $$;


-- --------------------------------------------------------------------
-- 6. RECONFIGURAÇÃO TOTAL DE POLITICAS DE SEGURANÇA (RLS) MULTI-TENANT
-- --------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- Configuração automática das regras de isolamento para as tabelas gerais de negócios
  for t in select table_name from information_schema.tables 
           where table_schema = 'public' 
           and table_name not in ('profiles', 'tenants', 'conversations', 'messages', 'property_images')
  loop
    -- Remover políticas legadas
    execute format('drop policy if exists "Owners and Admins can manage everything" on public.%I', t);
    execute format('drop policy if exists "Tenant isolation policy" on public.%I', t);
    
    -- Criar a nova regra mestre:
    -- 1) SELECT: Você só visualiza se pertence ao mesmo tenant AND (for Admin da empresa OU for o criador/dono do registro)
    -- 2) ALL/MODIFICATIONS: Isolado no mesmo tenant
    -- 3) WITH CHECK: Garante que novas inserções não falsifiquem o tenant_id de terceiros
    execute format('
      create policy "Tenant isolation policy" on public.%I for all using (
        tenant_id = public.get_user_tenant() and (
          public.is_tenant_admin() or auth.uid() = owner_id
        )
      ) with check (
        tenant_id = public.get_user_tenant()
      )
    ', t);
  end loop;
end $$;

-- --------------------------------------------------------------------
-- 7. REGRAS PARTICULARES: PROFILES, CONVERSATIONS, MESSAGES E STORAGE
-- --------------------------------------------------------------------

-- A: Perfis de Usuários (profiles)
drop policy if exists "Users can see all profiles" on public.profiles;
drop policy if exists "Admins can manage all profiles" on public.profiles;
drop policy if exists "Users can see profiles of their own tenant" on public.profiles;
drop policy if exists "Admins can manage profiles of their own tenant" on public.profiles;

-- Colaboradores apenas veem outros colaboradores da MESMA empresa
create policy "Users can see profiles of their own tenant" on public.profiles 
  for select using (tenant_id = public.get_user_tenant());

-- Admins gerenciam apenas colaboradores da MESMA empresa
create policy "Admins can manage profiles of their own tenant" on public.profiles 
  for all using (tenant_id = public.get_user_tenant() and public.is_tenant_admin());

-- B: Imagens de Propriedades (property_images - sub-tabela)
drop policy if exists "Users can manage images of their properties" on public.property_images;
drop policy if exists "Tenant isolation for property images" on public.property_images;

create policy "Tenant isolation for property images" on public.property_images
for all using (
  exists (
    select 1 from public.properties p
    where p.id = property_id
    and p.tenant_id = public.get_user_tenant()
    and (p.owner_id = auth.uid() OR public.is_tenant_admin())
  )
);

-- C: Conversas e Mensagens de Chat (conversations & messages)
drop policy if exists "Participants can see their conversations" on public.conversations;
drop policy if exists "Participants can see their conversations and tenant matching" on public.conversations;
drop policy if exists "Participants can see messages" on public.messages;
drop policy if exists "Participants can see messages with tenant isolation" on public.messages;

-- Conversas isoladas por Tenant do participante
create policy "Participants can see their conversations and tenant matching" on public.conversations
for all using (
  tenant_id = public.get_user_tenant() and (
    (participants @> array[auth.uid()]::uuid[]) or public.is_tenant_admin()
  )
) with check (
  tenant_id = public.get_user_tenant()
);

-- Mensagens isoladas por Tenant
create policy "Participants can see messages with tenant isolation" on public.messages
for all using (
  tenant_id = public.get_user_tenant() and (
    exists (
      select 1 from public.conversations c 
      where c.id = conversation_id 
      and c.tenant_id = public.get_user_tenant()
      and ( (c.participants @> array[auth.uid()]::uuid[]) or public.is_tenant_admin() )
    )
    or owner_id = auth.uid()
  )
) with check (
  tenant_id = public.get_user_tenant()
);

-- D: TRIGGER handle_new_user() ATUALIZADO
-- Vincula novos inscritos nativos no tenant padrão 'SalesScore Default'
-- de onde o administrador do sistema pode movê-los livremente
create or replace function public.handle_new_user()
returns trigger 
language plpgsql 
security definer 
set search_path = public
as $$
declare
  existing_profile_id uuid;
begin
  select id into existing_profile_id from public.profiles where email = new.email;

  if existing_profile_id is not null then
    update public.profiles
    set id = new.id,
        display_name = coalesce(profiles.display_name, new.raw_user_meta_data->>'display_name'),
        updated_at = now()
    where email = new.email;
  else
    insert into public.profiles (id, display_name, email, role, user_type, is_admin, tenant_id)
    values (
      new.id,
      new.raw_user_meta_data->>'display_name',
      new.email,
      case when new.email = 'ggsalles@gmail.com' then 'Admin' else 'Membro' end,
      'funcionário',
      case when new.email = 'ggsalles@gmail.com' then true else false end,
      '11111111-1111-1111-1111-111111111111'
    );
  end if;
  
  return new;
exception when others then
  return new;
end;
$$;

-- --------------------------------------------------------------------
-- FIM DO SCRIPT DE MIGRAÇÃO
-- Parabéns! Seu CRM agora é um SaaS oficialmente Multitenant!
-- --------------------------------------------------------------------
