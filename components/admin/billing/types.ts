export interface TenantItem {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  isBlocked: boolean;
  isManuallyUnlocked?: boolean;
  userLimit?: number;
  billingStatus?: 'regular' | 'aviso_sutil' | 'aviso_critico' | 'bloqueado';
  billingSuspensionDate?: string;
  dueDay?: number;
  diffDays?: number;
  overdueCount?: number;
  oldestOverdueMonthKey?: string;
}

export interface MonthColumn {
  key: string;
  label: string;
  isCurrent: boolean;
}

export type BillingFilterStatus = "all" | "overdue" | "regular" | "blocked";
