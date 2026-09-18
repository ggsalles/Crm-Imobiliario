-- ====================================================================
-- SCRIPT DE CADASTRO CORPORATIVO E PRECIFICAÇÃO SAAS (IMOBILIÁRIAS)
-- Sistema: SalesScore CRM SaaS Multi-inquilino
-- Objetivo: Suportar edição cadastral completa (CNPJ, Cidade, Estado, Contato)
--           e regras de cobrança por vagas (Plano base + Vagas extras)
-- ====================================================================

-- 1. Adição das colunas de cadastro da empresa e precificação
alter table public.tenants 
  add column if not exists cnpj text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists phone text,
  add column if not exists contact_email text,
  add column if not exists base_price numeric default 499.00,
  add column if not exists broker_limit integer default 2,
  add column if not exists admin_limit integer default 1,
  add column if not exists extra_broker_price numeric default 29.90,
  add column if not exists extra_admin_price numeric default 49.90;

-- 2. Atualização dos registros existentes com valores iniciais seguros
update public.tenants 
set 
  base_price = coalesce(base_price, 499.00),
  broker_limit = coalesce(broker_limit, user_limit, 2),
  admin_limit = coalesce(admin_limit, 1),
  extra_broker_price = coalesce(extra_broker_price, 29.90),
  extra_admin_price = coalesce(extra_admin_price, 49.90)
where base_price is null or broker_limit is null;
