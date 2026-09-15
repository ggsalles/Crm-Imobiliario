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
  | 'CREATE_PROPERTY'
  | 'CREATE_DEAL';

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AuditEventPayload {
  action: AuditAction | string;
  title: string;
  content: string;
  severity?: AuditSeverity;
  category?: 'export' | 'deletion' | 'sensitive_view' | 'auth' | 'modification';
  relatedId?: string;
  entityType?: 'contact' | 'property' | 'deal' | 'user' | 'tenant' | 'auth' | 'system';
  metadata?: Record<string, any>;
  tenantId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
}

/**
 * Dispatch an audit event to the secure /api/audit endpoint.
 * Fire-and-forget: doesn't block the UI thread.
 */
export async function recordAuditEvent(event: AuditEventPayload): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // Collect client metadata
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
    const clientPayload = {
      ...event,
      metadata: {
        ...(event.metadata || {}),
        userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.pathname + window.location.search,
      }
    };

    // Use session storage auth token if present
    let authHeader: string | null = null;
    try {
      const rawSession = window.sessionStorage.getItem('crm-imob-session-v5') || 
                          window.sessionStorage.getItem('crm-imob-session-v4') ||
                          window.localStorage.getItem('crm-imob-session-v4');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed?.access_token) {
          authHeader = `Bearer ${parsed.access_token}`;
        }
      }
    } catch {}

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Fire and forget
    fetch('/api/audit', {
      method: 'POST',
      headers,
      body: JSON.stringify(clientPayload),
    }).catch(err => {
      console.warn('[Audit] Erro ao registrar evento de auditoria:', err);
    });
  } catch (err) {
    console.warn('[Audit] Falha silenciosa ao despachar auditoria:', err);
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
    case 'CREATE_PROPERTY':
      return { label: 'Cadastro de Novo Imóvel', severity: 'info', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    default:
      return { label: action, severity: 'info', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' };
  }
}
