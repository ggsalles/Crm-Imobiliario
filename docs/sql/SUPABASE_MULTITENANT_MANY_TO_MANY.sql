-- ====================================================================
-- SCRIPT DE AJUSTE: RELACIONAMENTO MUITOS-PARA-MUITOS ENTRE PERFIS E IMOBILIÁRIAS
-- Sistema: SalesScore CRM SaaS Multi-inquilino (Multi-tenant)
-- Objetivo: Permitir que um mesmo usuário (perfil) pertença a múltiplas imobiliárias (tenants).
-- ====================================================================

-- 1. Criação da tabela de associação (associa perfis a inquilinos/imobiliárias)
create table if not exists public.profile_tenants (
  profile_id uuid references public.profiles(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  role text check (role in ('Membro', 'Admin')) default 'Membro',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (profile_id, tenant_id)
);

-- 2. Habilitação de Segurança em Nível de Linha (RLS)
alter table public.profile_tenants enable row level security;

-- 3. Remoção de políticas legadas para recriá-las limpas
drop policy if exists "Users can select their own associations" on public.profile_tenants;
drop policy if exists "Admins can manage all associations" on public.profile_tenants;

-- 4. Criação das novas políticas RLS da tabela de associação
-- Usuários podem visualizar suas próprias associações, o e-mail master da SalesScore pode ver tudo
create policy "Users can select their own associations" on public.profile_tenants
  for select
  using (profile_id = auth.uid() or (auth.jwt() ->> 'email') = 'ggsalles@gmail.com');

-- Apenas administradores do sistema ou o e-mail master ggsalles@gmail.com podem gerenciar as amarrações
create policy "Admins can manage all associations" on public.profile_tenants
  for all
  using (
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com' or 
    public.is_admin()
  );

-- 5. Migração inteligente de dados existentes (alimenta tabela com dados atuais do CRM)
insert into public.profile_tenants (profile_id, tenant_id, role)
select id, tenant_id, role from public.profiles
where tenant_id is not null
on conflict (profile_id, tenant_id) do nothing;

-- 6. Trigger handle_new_user() atualizado
-- Faz a amarração inicial automática do novo inscrito nativo na tabela de associação
create or replace function public.handle_new_user()
returns trigger 
language plpgsql 
security definer 
set search_path = public
as $$
declare
  existing_profile_id uuid;
  existing_tenant_id uuid;
  existing_role text;
  default_tenant_id uuid := '11111111-1111-1111-1111-111111111111';
begin
  select id, tenant_id, role into existing_profile_id, existing_tenant_id, existing_role 
  from public.profiles 
  where email = new.email;

  if existing_profile_id is not null then
    update public.profiles
    set id = new.id,
        display_name = coalesce(display_name, new.raw_user_meta_data->>'display_name'),
        updated_at = now()
    where email = new.email;
    
    -- Vincula o usuário existente na tabela de associação muitos-para-muitos
    insert into public.profile_tenants (profile_id, tenant_id, role)
    values (new.id, coalesce(existing_tenant_id, default_tenant_id), coalesce(existing_role, 'Membro'))
    on conflict (profile_id, tenant_id) do nothing;
  else
    insert into public.profiles (id, display_name, email, role, user_type, is_admin, tenant_id)
    values (
      new.id,
      new.raw_user_meta_data->>'display_name',
      new.email,
      case when new.email = 'ggsalles@gmail.com' then 'Admin' else 'Membro' end,
      'funcionário',
      case when new.email = 'ggsalles@gmail.com' then true else false end,
      default_tenant_id
    );
    
    insert into public.profile_tenants (profile_id, tenant_id, role)
    values (
      new.id,
      default_tenant_id,
      case when new.email = 'ggsalles@gmail.com' then 'Admin' else 'Membro' end
    )
    on conflict (profile_id, tenant_id) do nothing;
  end if;
  
  return new;
exception when others then
  return new;
end;
$$;

-- FIM DO REAJUSTE DE SAAS MULTI-INQUILINATO
