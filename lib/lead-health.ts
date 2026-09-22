import { Deal, Contact } from './db';

export interface StaleLeadInfo {
  isStale: boolean;
  daysInactive: number;
  severity: 'none' | 'warning' | 'critical';
  label: string;
  badgeClass: string;
  cardBorderClass: string;
}

export const LOST_REASONS = [
  { id: 'preco', label: 'Preço / Condições fora do orçamento' },
  { id: 'imovel', label: 'Não gostou do imóvel / Características incompatíveis' },
  { id: 'concorrente', label: 'Comprou ou alugou com outra imobiliária' },
  { id: 'sem_retorno', label: 'Cliente parou de responder aos contatos (Lead Frio)' },
  { id: 'credito_reprovado', label: 'Financiamento ou crédito reprovado' },
  { id: 'desistiu_momento', label: 'Desistiu do plano de compra/locação no momento' },
  { id: 'localizacao', label: 'Bairro / Localização não atende' },
  { id: 'outro', label: 'Outro motivo' }
] as const;

/**
 * Calculates inactivity health for a deal.
 * Deals in 'closed' or 'lost' stages are finalized and never considered stale.
 */
export function getDealStaleInfo(deal: Deal): StaleLeadInfo {
  if (deal.stage === 'closed' || deal.stage === 'lost') {
    return {
      isStale: false,
      daysInactive: 0,
      severity: 'none',
      label: deal.stage === 'closed' ? 'Fechado' : 'Perdido',
      badgeClass: '',
      cardBorderClass: ''
    };
  }

  const dateStr = deal.updatedAt || deal.createdAt;
  if (!dateStr) {
    return {
      isStale: false,
      daysInactive: 0,
      severity: 'none',
      label: 'Ativo',
      badgeClass: '',
      cardBorderClass: ''
    };
  }

  const dealDate = new Date(dateStr).getTime();
  if (isNaN(dealDate)) {
    return {
      isStale: false,
      daysInactive: 0,
      severity: 'none',
      label: 'Ativo',
      badgeClass: '',
      cardBorderClass: ''
    };
  }

  const diffMs = Date.now() - dealDate;
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (days >= 10) {
    return {
      isStale: true,
      daysInactive: days,
      severity: 'critical',
      label: `Crítico: ${days}d parado`,
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30',
      cardBorderClass: 'border-rose-500/40 shadow-xs shadow-rose-500/10'
    };
  }

  if (days >= 5) {
    return {
      isStale: true,
      daysInactive: days,
      severity: 'warning',
      label: `Atenção: ${days}d parado`,
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30',
      cardBorderClass: 'border-amber-500/35 shadow-xs shadow-amber-500/5'
    };
  }

  return {
    isStale: false,
    daysInactive: days,
    severity: 'none',
    label: days === 0 ? 'Hoje' : `${days}d atrás`,
    badgeClass: 'bg-muted/80 text-muted-foreground border border-border/50',
    cardBorderClass: ''
  };
}

/**
 * Generates an instant WhatsApp contact URL with pre-crafted rescue message.
 */
export function getWhatsAppRescueUrl(phone?: string, contactName?: string, dealTitle?: string): string | null {
  if (!phone) return null;
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return null;
  const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
  const firstName = contactName ? contactName.trim().split(' ')[0] : 'Olá';
  
  const text = `Olá ${firstName}, tudo bem? Aqui é da Nando Imobiliária. Passando para retomar nosso contato sobre "${dealTitle || 'seu interesse em imóveis'}". Surgiu alguma novidade ou dúvida que possamos te ajudar a avançar?`;
  
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
}
