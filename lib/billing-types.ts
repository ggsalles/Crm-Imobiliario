export interface PaymentLedger {
  [tenantId: string]: {
    [month: string]: 'pago' | 'pendente' | 'atrasado';
  };
}

export interface SaaSAdminConfig {
  blockedTenantIds: string[];
  unlockedTenantIds?: string[];
  payments: PaymentLedger;
  dueDays?: { [tenantId: string]: number };
  userLimits?: { [tenantId: string]: number };
  suttleStart?: number;
  criticalStart?: number;
  blockStart?: number;
}

export interface BillingStatusResult {
  status: 'regular' | 'aviso_sutil' | 'aviso_critico' | 'bloqueado';
  diffDays: number;
  dueDay: number;
  currentMonthKey: string;
  dueDate: Date;
  suspendedUntilStr: string;
  overdueCount?: number;
  oldestOverdueMonthKey?: string;
  isManuallyUnlocked?: boolean;
}

export function getTenantBillingStatus(
  config: SaaSAdminConfig,
  tenantId: string,
  currentDate = new Date(),
  tenantCreatedAt?: string,
  tenantDueDay?: number
): BillingStatusResult {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  const suttleStart = config.suttleStart !== undefined ? config.suttleStart : 1;
  const criticalStart = config.criticalStart !== undefined ? config.criticalStart : 5;
  const blockStart = config.blockStart !== undefined ? config.blockStart : 7;
  const dueDay = config.dueDays?.[tenantId] ?? tenantDueDay ?? 10;

  // 1. Verificação prioritária de bloqueio manual (imediato)
  if (config.blockedTenantIds && config.blockedTenantIds.includes(tenantId)) {
    return {
      status: 'bloqueado',
      diffDays: 99,
      dueDay,
      currentMonthKey,
      dueDate: new Date(),
      suspendedUntilStr: 'Imediatamente (Manual)',
      overdueCount: 1,
      oldestOverdueMonthKey: currentMonthKey
    };
  }

  const record = config.payments?.[tenantId] || {};
  const todayMidnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  // Determinar o mês inicial a ser considerado (não cobrar meses anteriores ao cadastro ou ao histórico existente)
  const registeredMonthKeys = Object.keys(record).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
  let earliestAllowedMonthKey = currentMonthKey;
  if (tenantCreatedAt && typeof tenantCreatedAt === 'string' && tenantCreatedAt.length >= 7) {
    earliestAllowedMonthKey = tenantCreatedAt.slice(0, 7);
  }
  if (registeredMonthKeys.length > 0 && registeredMonthKeys[0] < earliestAllowedMonthKey) {
    earliestAllowedMonthKey = registeredMonthKeys[0];
  }

  // 2. Analisar histórico de faturas em aberto até o mês atual
  // Qualquer mês a partir da data inicial que não estiver "pago" e cuja data de vencimento já venceu é considerado inadimplente.
  let worstStatus: 'regular' | 'aviso_sutil' | 'aviso_critico' | 'bloqueado' = 'regular';
  let maxOverdueDays = 0;
  let oldestDueDate: Date | null = null;
  let oldestMonthKey: string | null = null;
  let overdueInvoicesCount = 0;

  for (let i = 24; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    const mYear = d.getFullYear();
    const mMonth = d.getMonth() + 1;
    const mKey = `${mYear}-${String(mMonth).padStart(2, '0')}`;
    
    // Não avaliar meses anteriores ao cadastro ou início do histórico
    if (mKey < earliestAllowedMonthKey) {
      continue;
    }

    // Status do mês no ledger (se não preenchido, nasce automaticamente como 'pendente')
    const monthStatus = record[mKey] || 'pendente';
    
    if (monthStatus === 'pago') {
      continue;
    }

    // Data de vencimento deste mês específico
    const dueMidnight = new Date(mYear, mMonth - 1, dueDay);
    const diffTime = todayMidnight.getTime() - dueMidnight.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // Se já passou da data de vencimento ou se foi marcado explicitamente como 'atrasado'
    const isPastDue = diffDays >= 0;
    const isMarkedOverdue = monthStatus === 'atrasado';

    if (isPastDue || isMarkedOverdue) {
      // O atraso em dias considera a diferença real de calendário em relação ao vencimento
      const effectiveOverdueDays = isMarkedOverdue ? Math.max(diffDays, suttleStart) : diffDays;
      
      if (effectiveOverdueDays >= suttleStart || isMarkedOverdue) {
        overdueInvoicesCount++;
        if (oldestDueDate === null) {
          oldestDueDate = dueMidnight;
          oldestMonthKey = mKey;
        }

        if (effectiveOverdueDays > maxOverdueDays) {
          maxOverdueDays = effectiveOverdueDays;
        }

        // Determina severidade para este mês
        let itemStatus: 'regular' | 'aviso_sutil' | 'aviso_critico' | 'bloqueado' = 'regular';
        if (effectiveOverdueDays >= blockStart) {
          itemStatus = 'bloqueado';
        } else if (effectiveOverdueDays >= criticalStart) {
          itemStatus = 'aviso_critico';
        } else if (effectiveOverdueDays >= suttleStart) {
          itemStatus = 'aviso_sutil';
        }

        // Atualiza pior status
        const severityRank = { regular: 0, aviso_sutil: 1, aviso_critico: 2, bloqueado: 3 };
        if (severityRank[itemStatus] > severityRank[worstStatus]) {
          worstStatus = itemStatus;
        }
      }
    }
  }

  // Se a empresa possui liberação manual/carência concedida pelo Master, seu acesso não é bloqueado
  const isManuallyUnlocked = Boolean(config.unlockedTenantIds && config.unlockedTenantIds.includes(tenantId));
  let calculatedStatus = worstStatus;
  if (isManuallyUnlocked && worstStatus === 'bloqueado') {
    calculatedStatus = 'aviso_sutil';
  }

  // Se o status final for regular, não há data de suspensão pendente nem meses em atraso
  if (calculatedStatus === 'regular') {
    return {
      status: 'regular',
      diffDays: 0,
      dueDay,
      currentMonthKey,
      dueDate: new Date(currentYear, currentMonth - 1, dueDay),
      suspendedUntilStr: '',
      overdueCount: 0,
      oldestOverdueMonthKey: undefined,
      isManuallyUnlocked
    };
  }

  // Data de referência para cálculo da string de suspensão somente quando há inadimplência
  const targetDueDate = oldestDueDate || new Date(currentYear, currentMonth - 1, dueDay);
  const suspenseDate = new Date(targetDueDate.getFullYear(), targetDueDate.getMonth(), targetDueDate.getDate() + blockStart, 0, 0, 0);

  const formattedSuspendedStr = suspenseDate.toLocaleDateString('pt-BR') + ' às ' + 
    String(suspenseDate.getHours()).padStart(2, '0') + ':' + 
    String(suspenseDate.getMinutes()).padStart(2, '0');

  return {
    status: calculatedStatus,
    diffDays: maxOverdueDays,
    dueDay,
    currentMonthKey,
    dueDate: targetDueDate,
    suspendedUntilStr: formattedSuspendedStr,
    overdueCount: overdueInvoicesCount,
    oldestOverdueMonthKey: oldestMonthKey || undefined,
    isManuallyUnlocked
  };
}
