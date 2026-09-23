-- ====================================================================
-- SCRIPT DE SEGURANÇA E AUDITORIA MULTI-TENANT (SUPABASE RLS)
-- Sistema: SalesScore SaaS CRM
-- Objetivo: Garantir que o usuário Master (ggsalles@gmail.com) e os
-- administradores de imobiliária possam ler e auditar eventos da tabela 'timeline'
-- sem bloqueios indevidos por RLS.
-- ====================================================================

-- 1. Garante que RLS esteja habilitada na tabela timeline
alter table public.timeline enable row level security;

-- 2. Remove políticas legadas restritivas sobre a categoria audit
drop policy if exists "Master and Tenant Admins can view audit logs" on public.timeline;
drop policy if exists "Enable read access for authenticated users on timeline" on public.timeline;

-- 3. Nova política de leitura na tabela timeline:
-- - Usuário Master (ggsalles@gmail.com): Acesso total para auditoria global em todos os tenants
-- - Administrador do inquilino: Acesso a todos os registros de auditoria do seu inquilino
-- - Usuário comum: Acesso aos seus próprios registros (owner_id / created_by)
create policy "Master and Tenant Admins can view audit logs" on public.timeline
  for select using (
    (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
    or auth.uid() = owner_id
    or auth.uid() = created_by
    or (
      tenant_id = any(public.get_user_associated_tenants())
      and public.is_user_tenant_admin(tenant_id)
    )
  );

-- 4. Política para inserção de eventos de timeline / auditoria
drop policy if exists "Users and system can insert timeline events" on public.timeline;
create policy "Users and system can insert timeline events" on public.timeline
  for insert with check (
    auth.uid() = owner_id
    or auth.uid() = created_by
    or (auth.jwt() ->> 'email') = 'ggsalles@gmail.com'
    or tenant_id = any(public.get_user_associated_tenants())
    or tenant_id is null
  );

-- ====================================================================
-- INSTRUÇÕES DE APLICAÇÃO:
-- 1. Acesse o painel do Supabase (https://supabase.com/dashboard)
-- 2. Abra o seu projeto e clique em 'SQL Editor' no menu lateral
-- 3. Clique em 'New Query', cole este código e clique em 'Run'
-- ====================================================================
