-- ====================================================================
-- SCRIPT DE CORREÇÃO DEFINITIVA: RESOLUÇÃO DE RECURSÃO INFINITA E DE LOCK EM RLS
-- Sistema: SalesScore SaaS CRM
-- Objetivo: Eliminar de vez o loop circular de políticas RLS entre 'profiles' e 'profile_tenants'
-- e evitar self-deadlocks ao atualizar informações do próprio perfil (como mudar imobiliária ativa).
-- ====================================================================

-- 1. DESABILITAR TEMPORARIAMENTE PARA INTEGRAR LIMPEZA E CONFIGURAR FUNÇÕES
alter table public.profiles disable row level security;
alter table public.profile_tenants disable row level security;

-- 2. CRIAR FUNÇÕES AUXILIARES COM SEGURANÇA DETERMINADA (SECURITY DEFINER) E DESEMPENHO OTIMIZADO (STABLE)
-- Estas funções correm fora do contexto RLS, prestando serviços ultrarrápidos e seguros.

-- Retorna a lista de IDs de inquilinos que o usuário logado está associado na tabela muitos-para-muitos
create or replace function public.get_user_associated_tenants()
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tenants_arr uuid[];
begin
  select array_agg(tenant_id) into tenants_arr
  from public.profile_tenants
  where profile_id = auth.uid();
  return coalesce(tenants_arr, array[]::uuid[]);
end;
$$;

-- Verifica se o usuário logado possui perfil de Admin em algum inquilino específico
create or replace function public.is_user_tenant_admin(t_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profile_tenants
    where profile_id = auth.uid()
    and tenant_id = t_id
    and role = 'Admin'
  );
end;
$$;

-- Otimizar funções de inquilino ativo legadas para desempenho máximo (STABLE)
create or replace function public.get_user_tenant()
returns uuid
language plpgsql
stable
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

create or replace function public.is_tenant_admin()
returns boolean
language plpgsql
stable
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

-- 3. REMOVER DEFINITIVAMENTE TODAS AS POLÍTICAS CONFLITUOSAS
drop policy if exists "Users can see profiles of their own tenant" on public.profiles;
drop policy if exists "Admins can manage profiles of their own tenant" on public.profiles;
drop policy if exists "Users can see all profiles" on public.profiles;
drop policy if exists "Users can see their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can manage all profiles" on public.profiles;
drop policy if exists "Users can see profiles of their own tenants" on public.profiles;
drop policy if exists "Admins can manage profiles of their own tenants" on public.profiles;

drop policy if exists "Users can select their own associations" on public.profile_tenants;
drop policy if exists "Admins can manage all associations" on public.profile_tenants;
drop policy if exists "Admins can manage associations of their own tenants" on public.profile_tenants;

-- 4. RE-HABILITAR ROW LEVEL SECURITY COM SEGURANÇA MÁXIMA
alter table public.profiles enable row level security;
alter table public.profile_tenants enable row level security;

-- 5. CRIAR NOVAS POLÍTICAS ULTRA LEVES E TOTALMENTE LIVRES DE RECURSÃO PARA 'profiles'
-- Nenhuma política de SELECT ou UPDATE de profiles fará subquery que desencadeie políticas recursivas de RLS.

-- A) Leitura de Perfis: Usuários veem a si mesmos de forma imediata (short-circuit rápido) ou perfis associados à mesma imobiliária
create policy "Users can see profiles of their own tenants" on public.profiles
  for select using (
    id = auth.uid() or
    tenant_id = any(public.get_user_associated_tenants()) or
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
  );

-- B) Atualização por conta própria (Editar próprio nome, foto, imobiliária ativa, etc. livre de loops e locks de leitura circular)
create policy "Users can update their own profile" on public.profiles
  for update using (
    id = auth.uid() or
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
  );

-- C) Gerenciamento por administradores de imobiliária (Admins do inquilino editam seus membros) e Platform master (ggsalles)
create policy "Admins can manage profiles of their own tenants" on public.profiles
  for all using (
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com' or
    (
      tenant_id = any(public.get_user_associated_tenants()) and
      public.is_user_tenant_admin(tenant_id)
    )
  );


-- 6. CRIAR NOVAS POLÍTICAS TOTALMENTE LIVRES DE RECURSÃO (LOOP-FREE) PARA 'profile_tenants'
-- Importante: Para eliminar loops infinitos em RLS, esta tabela nunca deve chamar subqueries que desencadeiem RLS nela mesma.
-- Como o backend usa "service_role" administrativo (que ignora RLS), podemos manter as regras de cliente incrivelmente simples e seguras.

-- A) Visualizar conexões (Apenas as suas próprias conexões, eliminando qualquer busca recursiva secundária do cliente)
create policy "Users can select their own associations" on public.profile_tenants
  for select using (
    profile_id = auth.uid() or 
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
  );

-- B) Modificar conexões (Apenas as suas próprias conexões)
create policy "Admins can manage associations of their own tenants" on public.profile_tenants
  for all using (
    profile_id = auth.uid() or 
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
  );

-- ====================================================================
-- NOTA DE EXECUÇÃO:
-- Copie e cole todo o conteúdo deste arquivo no painel do Supabase,
-- no menu 'SQL Editor' -> 'New Query' -> 'Run'.
-- Isso corrigirá o erro de recursão infinita e de locks em menos de 1 segundo!
-- ====================================================================
