/**
 * Utilitário centralizado para classificação de rotas do sistema.
 * Desacopla as páginas públicas e de clientes (Vitrine, Ficha Pública de Imóvel, Autenticação)
 * dos mecanismos internos do CRM (verificação de faturamento, bloqueios, notificações de leads e heartbeats).
 */

export function isPublicRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  
  const cleanPath = pathname.endsWith('/') && pathname.length > 1 
    ? pathname.slice(0, -1) 
    : pathname;

  return (
    cleanPath === '/login' ||
    cleanPath === '/register' ||
    cleanPath === '/reset-password' ||
    cleanPath === '/vitrine' ||
    cleanPath.startsWith('/vitrine/') ||
    cleanPath.startsWith('/p/')
  );
}

/**
 * Rotas voltadas estritamente para o cliente final/comprador (Vitrine e Ficha de Imóvel).
 * Nestas rotas, banners operacionais, alertas de faturamento e sons do CRM são estritamente suprimidos.
 */
export function isCustomerFacingRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const cleanPath = pathname.endsWith('/') && pathname.length > 1 
    ? pathname.slice(0, -1) 
    : pathname;

  return (
    cleanPath === '/vitrine' || 
    cleanPath.startsWith('/vitrine/') || 
    cleanPath.startsWith('/p/')
  );
}
