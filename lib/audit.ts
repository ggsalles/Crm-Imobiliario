import { isPlatformAdmin } from './constants';

export type AuditAction = 
  | 'EXPORT_LEADS'
  | 'EXPORT_PROPERTIES'
  | 'VIEW_SENSITIVE_DATA'
  | 'DELETE_CONTACT'
  | 'DELETE_PROPERTY'
  | 'DELETE_DEAL'
  | 'DELETE_USER'
  | 'LOGIN_SUCCESS'
  | 'LOGOUT'
  | 'TENANT_SWITCH'
  | 'UPDATE_USER_ROLE'
  | 'UPDATE_DEAL_STAGE'
  | 'CREATE_CONTACT'
  | 'UPDATE_CONTACT'
  | 'CREATE_PROPERTY'
  | 'UPDATE_PROPERTY'
  | 'SHARE_PROPERTY_LINK'
  | 'VIEW_PROPERTY_DETAILS'
  | 'CREATE_DEAL'
  | 'UPDATE_DEAL'
  | 'CREATE_USER'
  | 'SEARCH_PROPERTIES';

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AuditEventPayload {
  action: AuditAction | string;
  title: string;
  content: string;
  severity?: AuditSeverity;
  category?: 'export' | 'deletion' | 'sensitive_view' | 'auth' | 'modification' | 'system';
  relatedId?: string;
  entityType?: 'contact' | 'property' | 'deal' | 'user' | 'tenant' | 'auth' | 'system';
  metadata?: Record<string, any>;
  tenantId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  token?: string;
}

/**
 * Dispatch an audit event to the secure /api/audit endpoint.
 * Fire-and-forget or awaitable. Uses keepalive to survive page transitions.
 */
export async function recordAuditEvent(event: AuditEventPayload): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // Collect client metadata
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

    // 1. Resolve token: explicit prop first, then sessionStorage, then localStorage
    let token = event.token || null;
    let sessionUserEmail: string | undefined = undefined;
    let sessionUserId: string | undefined = undefined;

    if (!token) {
      try {
        const rawSession = window.sessionStorage.getItem('crm-imob-session-v5') || 
                            window.sessionStorage.getItem('crm-imob-session-v4') ||
                            window.localStorage.getItem('crm-imob-session-v4');
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (parsed?.access_token) {
            token = parsed.access_token;
          }
          if (parsed?.user) {
            sessionUserEmail = parsed.user.email;
            sessionUserId = parsed.user.id;
          }
        }
      } catch {}
    }

    const authHeader = token ? `Bearer ${token}` : null;

    const resolvedTenantId = event.tenantId || 
      (typeof window !== 'undefined' ? (window.sessionStorage.getItem('active-tenant-id') || window.localStorage.getItem('active-tenant-id') || undefined) : undefined);

    const clientPayload = {
      ...event,
      token: token || undefined,
      tenantId: resolvedTenantId,
      userId: event.userId || sessionUserId,
      userEmail: event.userEmail || sessionUserEmail,
      metadata: {
        ...(event.metadata || {}),
        userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.pathname + window.location.search,
      }
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const res = await fetch('/api/audit', {
      method: 'POST',
      headers,
      body: JSON.stringify(clientPayload),
      keepalive: true,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Audit] Resposta HTTP ${res.status} ao registrar auditoria:`, errText);
    }
  } catch (err) {
    console.warn('[Audit] Falha ao despachar auditoria:', err);
  }
}

/**
 * Maps actions to user-friendly titles and severity levels
 */
export function getActionMeta(action: string): { label: string; severity: AuditSeverity; color: string; bg: string } {
  switch (action) {
    case 'EXPORT_LEADS':
      return { label: 'Exportação de Base de Leads (CSV)', severity: 'critical', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20' };
    case 'EXPORT_PROPERTIES':
      return { label: 'Exportação de Imóveis (CSV)', severity: 'high', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20' };
    case 'VIEW_SENSITIVE_DATA':
      return { label: 'Acesso a Dados Sensíveis / CPF', severity: 'high', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' };
    case 'DELETE_CONTACT':
      return { label: 'Exclusão de Contato / Lead', severity: 'critical', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' };
    case 'DELETE_PROPERTY':
      return { label: 'Exclusão de Imóvel', severity: 'high', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' };
    case 'DELETE_DEAL':
      return { label: 'Exclusão de Oportunidade / Negócio', severity: 'high', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' };
    case 'DELETE_USER':
      return { label: 'Remoção de Membro da Equipe', severity: 'critical', color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20' };
    case 'UPDATE_USER_ROLE':
      return { label: 'Alteração de Permissões de Acesso', severity: 'high', color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20' };
    case 'LOGIN_SUCCESS':
      return { label: 'Login Efetuado com Sucesso', severity: 'info', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'LOGOUT':
      return { label: 'Encerramento de Sessão (Logout)', severity: 'info', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' };
    case 'TENANT_SWITCH':
      return { label: 'Alternância de Imobiliária Ativa', severity: 'medium', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' };
    case 'UPDATE_DEAL_STAGE':
      return { label: 'Movimentação no Funil de Vendas', severity: 'low', color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' };
    case 'CREATE_CONTACT':
      return { label: 'Cadastro de Novo Contato', severity: 'info', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'UPDATE_CONTACT':
      return { label: 'Edição de Dados de Contato', severity: 'medium', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' };
    case 'CREATE_PROPERTY':
      return { label: 'Cadastro de Novo Imóvel', severity: 'info', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'UPDATE_PROPERTY':
      return { label: 'Edição / Atualização de Imóvel', severity: 'medium', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' };
    case 'SHARE_PROPERTY_LINK':
      return { label: 'Geração / Compartilhamento de Link', severity: 'low', color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' };
    case 'VIEW_PROPERTY_DETAILS':
      return { label: 'Consulta a Detalhes do Imóvel', severity: 'low', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' };
    case 'CREATE_DEAL':
      return { label: 'Abertura de Nova Oportunidade', severity: 'info', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'UPDATE_DEAL':
      return { label: 'Edição de Oportunidade / Negócio', severity: 'medium', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' };
    case 'CREATE_USER':
      return { label: 'Cadastro de Novo Usuário', severity: 'high', color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20' };
    case 'SEARCH_PROPERTIES':
      return { label: 'Pesquisa / Filtro de Imóveis', severity: 'low', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' };
    default:
      return { label: action, severity: 'info', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' };
  }
}
