/**
 * Constantes globais do sistema SalesScore CRM
 * Centraliza identificadores, papéis administrativos e configurações padrão.
 */

export const DEFAULT_TENANT_ID = '11111111-1111-1111-1111-111111111111';
export const DEFAULT_TENANT_NAME = 'SalesScore';

export const PLATFORM_ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'ggsalles@gmail.com'
).trim().toLowerCase();

export const PLATFORM_ADMIN_NAME = 'GG Salles';
export const PLATFORM_ADMIN_ROLE = 'Master / Administrador Geral';
export const PLATFORM_ADMIN_PHONE = '(11) 98765-4321';
export const PLATFORM_ADMIN_WHATSAPP = '5511987654321';

/** Limite padrão de usuários (licenças/vagas) por imobiliária caso não configurado */
export const DEFAULT_USER_LIMIT_PER_TENANT = 5;

/**
 * Verifica se um determinado e-mail possui privilégios de Administrador da Plataforma (Super Admin).
 */
export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PLATFORM_ADMIN_EMAIL;
}
