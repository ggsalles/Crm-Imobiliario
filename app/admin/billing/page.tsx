"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { 
  Building2, 
  CreditCard, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  AlertTriangle,
  Lock, 
  Unlock, 
  ArrowLeft, 
  DollarSign,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  RefreshCw,
  Info,
  X,
  ShieldAlert,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/db";
import Link from "next/link";
import { SaaSAdminConfig, getTenantBillingStatus } from "@/lib/billing-types";
import { isPlatformAdmin, PLATFORM_ADMIN_EMAIL } from "@/lib/constants";
import { Sidebar } from "@/components/sidebar";

interface TenantItem {
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

interface MonthColumn {
  key: string;
  label: string;
  isCurrent: boolean;
}

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", 
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const FULL_MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function AdminBillingPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [config, setConfig] = useState<SaaSAdminConfig | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue" | "regular" | "blocked">("all");
  const [, setSavePending] = useState(false);
  const [unlockModalTenant, setUnlockModalTenant] = useState<TenantItem | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Period management (default: 6-month block)
  // periodMode: 'current_6' | 's1_2026' | 's2_2026' | 's1_2025' | 's2_2025' | 'full_year_2026' | 'custom'
  const [periodMode, setPeriodMode] = useState<string>("current_6");
  const [monthOffset, setMonthOffset] = useState<number>(0); // In steps of 6 months for custom navigation

  // Dynamic Rule customization states
  const [suttleStart, setSuttleStart] = useState<number>(1);
  const [criticalStart, setCriticalStart] = useState<number>(5);
  const [blockStart, setBlockStart] = useState<number>(7);
  const [savingSettings, setSavingSettings] = useState(false);

  // Modal for alert preview/simulation
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewType, setPreviewType] = useState<"sutil" | "critico" | "bloqueado">("sutil");

  // Security Lock check
  useEffect(() => {
    if (!authLoading && (!profile || !isPlatformAdmin(profile.email))) {
      toast.error("Acesso restrito apenas ao Administrador do Sistema.");
      router.push("/");
    }
  }, [profile, authLoading, router]);

  // Load Tenants and Admin Config
  async function loadAllData() {
    setLoadingData(true);
    try {
      const allTenants = await apiFetch("/api/tenants");
      const filteredTenants = (allTenants || []).filter((t: any) => t.id !== "99999999-9999-9999-9999-999999999999");
      setTenants(filteredTenants);

      const resConfig = await apiFetch("/api/tenants/config");
      if (resConfig) {
        setConfig(resConfig);
        setSuttleStart(resConfig.suttleStart !== undefined ? resConfig.suttleStart : 1);
        setCriticalStart(resConfig.criticalStart !== undefined ? resConfig.criticalStart : 5);
        setBlockStart(resConfig.blockStart !== undefined ? resConfig.blockStart : 7);
      }
    } catch (err: any) {
      console.error("[Billing Admin] Error fetching data:", err);
      toast.error("Erro ao carregar dados do faturamento.");
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (profile && isPlatformAdmin(profile.email)) {
      loadAllData();
    }
  }, [profile]);

  // Generate the displayed months based on period selection
  const displayedMonths = useMemo((): MonthColumn[] => {
    const today = new Date();
    const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    if (periodMode === "s1_2026") {
      return [0, 1, 2, 3, 4, 5].map(m => {
        const key = `2026-${String(m + 1).padStart(2, '0')}`;
        return { key, label: `${MONTH_NAMES[m]}/26`, isCurrent: key === currentKey };
      });
    }

    if (periodMode === "s2_2026") {
      return [6, 7, 8, 9, 10, 11].map(m => {
        const key = `2026-${String(m + 1).padStart(2, '0')}`;
        return { key, label: `${MONTH_NAMES[m]}/26`, isCurrent: key === currentKey };
      });
    }

    if (periodMode === "s1_2025") {
      return [0, 1, 2, 3, 4, 5].map(m => {
        const key = `2025-${String(m + 1).padStart(2, '0')}`;
        return { key, label: `${MONTH_NAMES[m]}/25`, isCurrent: key === currentKey };
      });
    }

    if (periodMode === "s2_2025") {
      return [6, 7, 8, 9, 10, 11].map(m => {
        const key = `2025-${String(m + 1).padStart(2, '0')}`;
        return { key, label: `${MONTH_NAMES[m]}/25`, isCurrent: key === currentKey };
      });
    }

    if (periodMode === "full_year_2026") {
      return Array.from({ length: 12 }, (_, m) => {
        const key = `2026-${String(m + 1).padStart(2, '0')}`;
        return { key, label: `${MONTH_NAMES[m]}/26`, isCurrent: key === currentKey };
      });
    }

    // Default: 'current_6' or 'custom' with monthOffset (sliding window of 6 months)
    // Base is 4 months past + current month + 1 future month, shifted by monthOffset
    const baseOffset = monthOffset * 6;
    const list: MonthColumn[] = [];
    for (let i = 4 - baseOffset; i >= -1 - baseOffset; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
      list.push({ key, label, isCurrent: key === currentKey });
    }
    return list;
  }, [periodMode, monthOffset]);

  // Period label description
  const periodDescription = useMemo(() => {
    if (displayedMonths.length === 0) return "";
    const first = displayedMonths[0];
    const last = displayedMonths[displayedMonths.length - 1];
    return `${first.label} até ${last.label} (${displayedMonths.length} meses)`;
  }, [displayedMonths]);

  function notifyBillingChange() {
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('saas-billing-updated'));
        localStorage.setItem('saas-billing-timestamp', String(Date.now()));
        const bc = new BroadcastChannel('saas_billing_channel');
        bc.postMessage({ type: 'BILLING_UPDATED', timestamp: Date.now() });
        bc.close();
      } catch {}
    }
  }

  // Handle master Block/Unblock actions
  async function toggleTenantBlock(tenantId: string, currentStatus: boolean) {
    if (!config) return;
    
    const nextStatus = !currentStatus;
    setSavePending(true);
    
    try {
      const updatedBlocked = [...(config.blockedTenantIds || [])];
      const updatedUnlocked = [...(config.unlockedTenantIds || [])];
      const bIndex = updatedBlocked.indexOf(tenantId);
      const uIndex = updatedUnlocked.indexOf(tenantId);
      
      if (nextStatus) {
        // Bloquear
        if (bIndex === -1) updatedBlocked.push(tenantId);
        if (uIndex !== -1) updatedUnlocked.splice(uIndex, 1);
      } else {
        // Liberar
        if (bIndex !== -1) updatedBlocked.splice(bIndex, 1);
        if (uIndex === -1) updatedUnlocked.push(tenantId);
      }

      const updatedConfig: SaaSAdminConfig = {
        ...config,
        blockedTenantIds: updatedBlocked,
        unlockedTenantIds: updatedUnlocked
      };

      setConfig(updatedConfig);
      setTenants(prev => prev.map(t => t.id === tenantId ? { 
        ...t, 
        isBlocked: nextStatus,
        isManuallyUnlocked: !nextStatus 
      } : t));

      await apiFetch("/api/tenants/config", {
        method: "POST",
        body: JSON.stringify(updatedConfig)
      });

      await apiFetch(`/api/tenants?id=${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ isBlocked: nextStatus, isManuallyUnlocked: !nextStatus })
      });

      toast.success(
        nextStatus 
          ? "Acesso da imobiliária bloqueado manualmente!" 
          : "Acesso da imobiliária liberado com sucesso!"
      );
      notifyBillingChange();
      await loadAllData();
    } catch (err) {
      console.error("Failed to toggle tenant block:", err);
      toast.error("Falha ao salvar ação de bloqueio.");
      await loadAllData();
    } finally {
      setSavePending(false);
    }
  }

  // Quitar faturas pendentes e liberar imobiliária
  async function confirmPaymentAndUnlock(tenant: TenantItem) {
    if (!config) return;
    setIsUnlocking(true);
    setSavePending(true);

    try {
      const currentLedger = config.payments || {};
      const tenantLedger = { ...(currentLedger[tenant.id] || {}) };
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const dueDay = config.dueDays?.[tenant.id] ?? tenant.dueDay ?? 10;
      const today = new Date();

      // Marca todas as faturas vencidas como PAGO
      for (let i = 24; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const status = tenantLedger[mKey] || 'pendente';
        const dueMidnight = new Date(d.getFullYear(), d.getMonth(), dueDay);
        
        if (status !== 'pago' && (today.getTime() >= dueMidnight.getTime() || status === 'atrasado')) {
          tenantLedger[mKey] = 'pago';
        }
      }

      if (tenant.oldestOverdueMonthKey) {
        tenantLedger[tenant.oldestOverdueMonthKey] = 'pago';
      }

      const updatedBlocked = (config.blockedTenantIds || []).filter(id => id !== tenant.id);
      const updatedUnlocked = (config.unlockedTenantIds || []).filter(id => id !== tenant.id);

      const updatedConfig: SaaSAdminConfig = {
        ...config,
        blockedTenantIds: updatedBlocked,
        unlockedTenantIds: updatedUnlocked,
        payments: {
          ...config.payments,
          [tenant.id]: tenantLedger
        }
      };

      setConfig(updatedConfig);

      await apiFetch("/api/tenants/config", {
        method: "POST",
        body: JSON.stringify(updatedConfig)
      });

      await apiFetch(`/api/tenants?id=${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isBlocked: false, isManuallyUnlocked: false })
      });

      toast.success(`Fatura quitada e acesso de "${tenant.name}" liberado com sucesso!`);
      setUnlockModalTenant(null);
      notifyBillingChange();
      await loadAllData();
    } catch (err) {
      console.error("Failed to confirm payment and unlock:", err);
      toast.error("Erro ao regularizar fatura e liberar imobiliária.");
      await loadAllData();
    } finally {
      setIsUnlocking(false);
      setSavePending(false);
    }
  }

  // Liberar acesso sob carência (mantém fatura pendente para controle de cobrança)
  async function grantGracePeriodAndUnlock(tenant: TenantItem) {
    if (!config) return;
    setIsUnlocking(true);
    setSavePending(true);

    try {
      const updatedBlocked = (config.blockedTenantIds || []).filter(id => id !== tenant.id);
      const updatedUnlocked = [...(config.unlockedTenantIds || [])];
      if (!updatedUnlocked.includes(tenant.id)) {
        updatedUnlocked.push(tenant.id);
      }

      const updatedConfig: SaaSAdminConfig = {
        ...config,
        blockedTenantIds: updatedBlocked,
        unlockedTenantIds: updatedUnlocked
      };

      setConfig(updatedConfig);

      await apiFetch("/api/tenants/config", {
        method: "POST",
        body: JSON.stringify(updatedConfig)
      });

      await apiFetch(`/api/tenants?id=${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isBlocked: false, isManuallyUnlocked: true })
      });

      toast.success(`Acesso de "${tenant.name}" liberado sob carência administrativa!`);
      setUnlockModalTenant(null);
      notifyBillingChange();
      await loadAllData();
    } catch (err) {
      console.error("Failed to grant grace period:", err);
      toast.error("Erro ao conceder carência para a imobiliária.");
      await loadAllData();
    } finally {
      setIsUnlocking(false);
      setSavePending(false);
    }
  }

  // Ação ao clicar no botão de Acesso
  function handleToggleClick(tenant: TenantItem, isBlockedOnSaaS: boolean) {
    if (isBlockedOnSaaS) {
      // Se a imobiliária tem inadimplência cadastrada, abre as opções para o Master
      if ((tenant.overdueCount || 0) > 0 || (tenant.diffDays !== undefined && tenant.diffDays >= (config?.blockStart || 7))) {
        setUnlockModalTenant(tenant);
        return;
      }
      // Se estava bloqueada sem inadimplência de data, desbloqueia direto
      toggleTenantBlock(tenant.id, true);
    } else {
      // Se está liberada, suspende o acesso manualmente
      toggleTenantBlock(tenant.id, false);
    }
  }

  // Handle individual payment ledger cycle toggle: PENDENTE -> PAGO -> ATRASADO -> PENDENTE
  async function cyclePaymentStatus(tenantId: string, monthKey: string) {
    if (!config) return;

    const currentLedger = config.payments || {};
    const tenantLedger = currentLedger[tenantId] || {};
    const currentStatus = tenantLedger[monthKey] || "pendente";
    
    let nextStatus: 'pago' | 'pendente' | 'atrasado' = "pago";
    if (currentStatus === "pendente") {
      nextStatus = "pago";
    } else if (currentStatus === "pago") {
      nextStatus = "atrasado";
    } else {
      nextStatus = "pendente";
    }

    const updatedPayments = {
      ...config.payments,
      [tenantId]: {
        ...(config.payments[tenantId] || {}),
        [monthKey]: nextStatus
      }
    };

    const updatedConfig: SaaSAdminConfig = {
      ...config,
      payments: updatedPayments
    };

    setConfig(updatedConfig);

    // Optimistically update tenant billing status
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      const newBilling = getTenantBillingStatus(updatedConfig, tenantId, new Date(), tenant.createdAt, tenant.dueDay);
      setTenants(prev => prev.map(t => t.id === tenantId ? {
        ...t,
        billingStatus: newBilling.status,
        diffDays: newBilling.diffDays,
        overdueCount: newBilling.overdueCount,
        oldestOverdueMonthKey: newBilling.oldestOverdueMonthKey,
        isBlocked: updatedConfig.blockedTenantIds?.includes(tenantId) || newBilling.status === 'bloqueado'
      } : t));
    }

    try {
      await apiFetch("/api/tenants/config", {
        method: "POST",
        body: JSON.stringify(updatedConfig)
      });
      toast.success(`Mensalidade de ${monthKey} atualizada para ${nextStatus.toUpperCase()}!`);
      notifyBillingChange();
      await loadAllData();
    } catch (err) {
      console.error("Failed to cycle payment status:", err);
      toast.error("Erro ao registrar pagamento.");
      await loadAllData();
    }
  }

  // Handle dueDay base change
  async function updateTenantDueDay(tenantId: string, newDay: number) {
    if (!config) return;

    const updatedDueDays = {
      ...(config.dueDays || {}),
      [tenantId]: newDay
    };

    const updatedConfig: SaaSAdminConfig = {
      ...config,
      dueDays: updatedDueDays
    };

    setConfig(updatedConfig);

    try {
      await apiFetch("/api/tenants/config", {
        method: "POST",
        body: JSON.stringify(updatedConfig)
      });
      await apiFetch(`/api/tenants?id=${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ due_day: newDay })
      });
      toast.success(`Dia de vencimento alterado para dia ${newDay}!`);
      notifyBillingChange();
      loadAllData();
    } catch (err) {
      console.error("Failed to update tenant due day:", err);
      toast.error("Erro ao alterar dia de vencimento.");
      loadAllData();
    }
  }

  // Handle userLimit change per tenant
  async function updateTenantLimit(tenantId: string, limit: number) {
    if (!config) return;
    const cleanLimit = Math.max(1, limit);

    const updatedUserLimits = {
      ...(config.userLimits || {}),
      [tenantId]: cleanLimit
    };

    const updatedConfig: SaaSAdminConfig = {
      ...config,
      userLimits: updatedUserLimits
    };

    setConfig(updatedConfig);

    try {
      await apiFetch(`/api/tenants?id=${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ userLimit: cleanLimit })
      });
      toast.success(`Limite de vagas atualizado para ${cleanLimit} usuários!`);
      loadAllData();
    } catch (err) {
      console.error("Failed to update tenant user limit:", err);
      toast.error("Erro ao alterar limite de usuários.");
      loadAllData();
    }
  }

  // Handle global rule settings save
  async function handleSaveGeneralSettings() {
    if (!config) return;
    
    if (suttleStart < 0 || criticalStart < 0 || blockStart < 0) {
      toast.error("Os dias devem ser números positivos.");
      return;
    }
    if (suttleStart >= criticalStart) {
      toast.error("O Aviso Crítico deve iniciar após o Aviso Sutil (Ex: Aviso Sutil D+1, Aviso Crítico D+5).");
      return;
    }
    if (criticalStart >= blockStart) {
      toast.error("O Bloqueio Total deve iniciar após o Aviso Crítico (Ex: Aviso Crítico D+5, Bloqueio Total D+7).");
      return;
    }

    setSavingSettings(true);
    const updatedConfig: SaaSAdminConfig = {
      ...config,
      suttleStart,
      criticalStart,
      blockStart
    };

    try {
      await apiFetch("/api/tenants/config", {
        method: "POST",
        body: JSON.stringify(updatedConfig)
      });
      setConfig(updatedConfig);
      toast.success("Configuração de prazos e bloqueios atualizada com sucesso!");
      notifyBillingChange();
      loadAllData();
    } catch (err) {
      console.error("Failed to save billing rules:", err);
      toast.error("Erro ao salvar regras de faturamento.");
    } finally {
      setSavingSettings(false);
    }
  }

  // Statistics calculation
  const totalImobiliarias = tenants.length;
  const blockedCount = tenants.filter(t => {
    const isManuallyUnlocked = Boolean(t.isManuallyUnlocked || config?.unlockedTenantIds?.includes(t.id));
    return !isManuallyUnlocked && (t.isBlocked || t.billingStatus === 'bloqueado');
  }).length;
  const overdueAlertCount = tenants.filter(t => {
    const isManuallyUnlocked = Boolean(t.isManuallyUnlocked || config?.unlockedTenantIds?.includes(t.id));
    const isBlocked = !isManuallyUnlocked && (t.isBlocked || t.billingStatus === 'bloqueado');
    return !isBlocked && (t.billingStatus === 'aviso_sutil' || t.billingStatus === 'aviso_critico' || (t.overdueCount || 0) > 0);
  }).length;
  const activeCount = totalImobiliarias - blockedCount;
  const monthlySubscriptionPrice = 299;
  const estimatedRevenue = activeCount * monthlySubscriptionPrice;

  // Filter tenants for search bar & status filter
  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.slug?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    const isManuallyUnlocked = Boolean(t.isManuallyUnlocked || config?.unlockedTenantIds?.includes(t.id));
    const isBlockedOnSaaS = !isManuallyUnlocked && (t.isBlocked || t.billingStatus === "bloqueado");

    if (statusFilter === "overdue") {
      return (t.billingStatus === "aviso_sutil" || t.billingStatus === "aviso_critico" || (t.overdueCount || 0) > 0) && !isBlockedOnSaaS;
    }
    if (statusFilter === "regular") {
      return !isBlockedOnSaaS && ((t.billingStatus === "regular" && (t.overdueCount || 0) === 0) || isManuallyUnlocked);
    }
    if (statusFilter === "blocked") {
      return isBlockedOnSaaS;
    }
    return true;
  });

  if (authLoading || loadingData) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-foreground">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
          </div>
          <p className="text-xs font-bold font-mono tracking-widest uppercase text-muted-foreground mt-4">
            Carregando Controle Financeiro...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      {/* Persistent CRM Sidebar */}
      <Sidebar />

      {/* Main Administrative Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto overflow-x-hidden bg-[#070a13] text-slate-100 selection:bg-indigo-500 selection:text-white">
        
        {/* Header Container */}
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-2xl pl-14 md:pl-5 px-3 sm:px-4 md:px-5 h-14 md:h-16 shrink-0 sticky top-0 z-30 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link 
              href="/"
              className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all active:scale-95 shrink-0"
              title="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/25 font-mono">
                  SaaS Admin
                </span>
              </div>
              <h1 className="text-xs sm:text-sm md:text-base font-bold text-slate-100 tracking-tight font-sans truncate">
                Controle de Clientes, Cobrança & Bloqueios
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button 
              onClick={() => setPreviewModalOpen(true)}
              className="text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 px-2.5 sm:px-3 py-1.5 rounded-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Eye className="w-3 h-3" />
              <span className="hidden sm:inline">Testar Alertas</span>
            </button>

            <button 
              onClick={loadAllData}
              className="text-[11px] font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 px-2.5 sm:px-3 py-1.5 rounded-lg active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              title="Recarregar dados do servidor"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </header>

        <main className="w-full px-3 sm:px-4 md:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4 flex-1 max-w-7xl mx-auto">
          
          {/* Bento Statistics Section */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 sm:p-3.5 relative overflow-hidden backdrop-blur-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#717d96]">Total Imobiliárias</p>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight mt-1 text-slate-100">{totalImobiliarias}</h3>
                </div>
                <div className="p-1.5 sm:p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/15">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-[9px] font-medium text-[#717d96] mt-2 font-mono truncate">
                Empresas no SaaS
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 sm:p-3.5 relative overflow-hidden backdrop-blur-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#717d96]">Contratos Regulares</p>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight mt-1 text-emerald-400">{activeCount - overdueAlertCount}</h3>
                </div>
                <div className="p-1.5 sm:p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/15">
                  <CalendarCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-[9px] font-medium text-emerald-500/80 mt-2 font-mono truncate">
                Em dia (sem avisos)
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 sm:p-3.5 relative overflow-hidden backdrop-blur-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#717d96]">Em Régua de Alerta</p>
                  <h3 className={`text-lg sm:text-xl font-bold tracking-tight mt-1 ${overdueAlertCount > 0 ? "text-amber-400" : "text-slate-100"}`}>
                    {overdueAlertCount}
                  </h3>
                </div>
                <div className="p-1.5 sm:p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/15">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-[9px] font-medium text-amber-500/80 mt-2 font-mono truncate">
                Aviso Sutil ou Crítico
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 sm:p-3.5 relative overflow-hidden backdrop-blur-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#717d96]">Acessos Suspensos</p>
                  <h3 className={`text-lg sm:text-xl font-bold tracking-tight mt-1 ${blockedCount > 0 ? "text-rose-500" : "text-slate-100"}`}>
                    {blockedCount}
                  </h3>
                </div>
                <div className="p-1.5 sm:p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/15">
                  <Lock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-[9px] font-medium text-rose-500/80 mt-2 font-mono truncate">
                Bloqueados por atraso
              </div>
            </div>
          </section>

          {/* Validation & Explanation Banner about Automatic Months & Pending Status */}
          <div className="bg-slate-950/60 border border-indigo-500/20 rounded-xl p-3 sm:p-3.5 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 sm:p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 shrink-0 mt-0.5">
                <Info className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-200">
                  Validação Automática de Parcelas & Régua Financeira
                </h4>
                <p className="text-[10px] text-slate-400 leading-relaxed max-w-3xl">
                  <strong>1. Meses Automáticos:</strong> Linha do tempo contínua projetada. 
                  <strong className="ml-2">2. Status Padrão PENDENTE:</strong> Parcelas nascem pendentes até marcação. 
                  <strong className="ml-2">3. Régua:</strong> Alertas em D+{suttleStart}, D+{criticalStart} e Bloqueio em D+{blockStart}.
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                R$ {estimatedRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
              </span>
            </div>
          </div>

          {/* SaaS Automation & Delinquency Rules Configuration */}
          <section className="bg-slate-950/40 border border-slate-900/60 rounded-xl backdrop-blur-xl overflow-hidden shadow-xs p-3.5 sm:p-4 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900/60 pb-3 mb-3">
              <div>
                <h2 className="text-xs font-bold tracking-tight text-white uppercase font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Régua de Cobrança Automática & Tolerância
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Defina os prazos em dias após o vencimento (Dia D) para acionar cada alerta visual e o bloqueio automático.
                </p>
              </div>
              
              <button
                onClick={handleSaveGeneralSettings}
                disabled={savingSettings}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs shrink-0 self-start sm:self-auto"
              >
                {savingSettings ? "Salvando..." : "Salvar Prazos Globais"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Suttle Warning Card */}
              <div className="bg-slate-950/30 border border-slate-900/50 rounded-xl p-3 hover:border-slate-800 transition-all">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                    <Clock className="w-3 h-3" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">1. Aviso Sutil</h3>
                    <span className="text-[9px] font-mono text-amber-400 font-bold uppercase tracking-wider">Banner no Menu Lateral</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                  Exibe um alerta discreto no menu lateral informando que o boleto do mês venceu.
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400">A partir de D+</span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={suttleStart}
                    onChange={(e) => setSuttleStart(parseInt(e.target.value) || 1)}
                    className="w-12 text-center font-mono font-bold text-xs py-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-md focus:outline-none text-slate-100"
                  />
                  <span className="text-[10px] text-slate-500">dia(s) de atraso</span>
                </div>
              </div>

              {/* Critical Warning Card */}
              <div className="bg-slate-950/30 border border-slate-900/50 rounded-xl p-3 hover:border-slate-800 transition-all">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 bg-orange-500/10 text-orange-400 rounded-lg border border-orange-500/20">
                    <AlertTriangle className="w-3 h-3" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">2. Aviso Crítico</h3>
                    <span className="text-[9px] font-mono text-orange-400 font-bold uppercase tracking-wider">Pop-up ao fazer Login</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                  Apresenta um pop-up de notificação avisando sobre o risco iminente de suspensão.
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400">A partir de D+</span>
                  <input
                    type="number"
                    min={2}
                    max={30}
                    value={criticalStart}
                    onChange={(e) => setCriticalStart(parseInt(e.target.value) || 5)}
                    className="w-12 text-center font-mono font-bold text-xs py-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-md focus:outline-none text-slate-100"
                  />
                  <span className="text-[10px] text-slate-500">dia(s) de atraso</span>
                </div>
              </div>

              {/* Total Block Card */}
              <div className="bg-slate-950/30 border border-slate-900/50 rounded-xl p-3 hover:border-slate-800 transition-all">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
                    <Lock className="w-3 h-3" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">3. Bloqueio Total</h3>
                    <span className="text-[9px] font-mono text-rose-400 font-bold uppercase tracking-wider">Suspensão de Acesso</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                  Interrompe imediatamente o acesso de todos os corretores e administradores da imobiliária.
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400">A partir de D+</span>
                  <input
                    type="number"
                    min={3}
                    max={45}
                    value={blockStart}
                    onChange={(e) => setBlockStart(parseInt(e.target.value) || 7)}
                    className="w-12 text-center font-mono font-bold text-xs py-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-md focus:outline-none text-slate-100"
                  />
                  <span className="text-[10px] text-slate-500">dia(s) de tolerância</span>
                </div>
              </div>
            </div>
          </section>

          {/* Management and Ledger Card */}
          <section className="bg-slate-950/40 border border-slate-900/60 rounded-xl backdrop-blur-xl overflow-hidden shadow-xs">
            
            {/* Top Controls Bar with 6-Month Period Navigation and Filters */}
            <div className="p-3 sm:p-3.5 border-b border-slate-900/60 bg-slate-950/70 flex flex-col gap-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h2 className="text-xs sm:text-sm font-bold tracking-tight text-slate-100 flex items-center gap-2">
                    Lista de Clientes & Histórico de Parcelas
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
                      6 em 6 meses
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Período: <span className="text-indigo-400 font-semibold">{periodDescription}</span>. Clique nas parcelas para alterar o status.
                  </p>
                </div>
                
                {/* Search Bar & Status Filter */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[170px]">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-500">
                      <Search className="w-3 h-3" />
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar imobiliária..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full text-xs py-1.5 pl-8 pr-2.5 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg focus:outline-none transition-all placeholder:text-slate-500 text-slate-200"
                    />
                  </div>

                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                    <button
                      onClick={() => setStatusFilter("all")}
                      className={`px-2 py-1 rounded-md font-bold transition-all text-[10px] ${statusFilter === "all" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Todos ({tenants.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter("overdue")}
                      className={`px-2 py-1 rounded-md font-bold transition-all text-[10px] ${statusFilter === "overdue" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Pendência ({overdueAlertCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter("regular")}
                      className={`px-2 py-1 rounded-md font-bold transition-all text-[10px] ${statusFilter === "regular" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Regulares ({activeCount - overdueAlertCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter("blocked")}
                      className={`px-2 py-1 rounded-md font-bold transition-all text-[10px] ${statusFilter === "blocked" ? "bg-rose-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Bloqueados ({blockedCount})
                    </button>
                  </div>
                </div>
              </div>

              {/* Period Selector and 6-Month Navigation */}
              <div className="pt-2 border-t border-slate-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                
                {/* 6-Month Stepper Navigation */}
                <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => {
                      setPeriodMode("custom");
                      setMonthOffset(prev => prev + 1);
                    }}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer flex items-center gap-1 font-bold text-[10px]"
                    title="Retroceder 6 meses no tempo"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span>6 Meses Ant.</span>
                  </button>

                  <button
                    onClick={() => {
                      setPeriodMode("current_6");
                      setMonthOffset(0);
                    }}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                      periodMode === "current_6" && monthOffset === 0
                        ? "bg-indigo-600 text-white" 
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    Mês Atual
                  </button>

                  <button
                    onClick={() => {
                      setPeriodMode("custom");
                      setMonthOffset(prev => prev - 1);
                    }}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer flex items-center gap-1 font-bold text-[10px]"
                    title="Avançar 6 meses no tempo"
                  >
                    <span>Próximos 6M</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Quick Period Presets */}
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-slate-500 font-mono mr-0.5">Período:</span>
                  
                  <button
                    onClick={() => { setPeriodMode("s1_2026"); setMonthOffset(0); }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border ${
                      periodMode === "s1_2026" 
                        ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" 
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    1º Sem/26
                  </button>

                  <button
                    onClick={() => { setPeriodMode("s2_2026"); setMonthOffset(0); }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border ${
                      periodMode === "s2_2026" 
                        ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" 
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    2º Sem/26
                  </button>

                  <button
                    onClick={() => { setPeriodMode("full_year_2026"); setMonthOffset(0); }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border ${
                      periodMode === "full_year_2026" 
                        ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" 
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Ano 2026
                  </button>

                  <button
                    onClick={() => { setPeriodMode("s2_2025"); setMonthOffset(0); }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border ${
                      periodMode === "s2_2025" 
                        ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" 
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    2º Sem/25
                  </button>
                </div>
              </div>
            </div>

            {/* Tenants Ledger Grid */}
            <div className="overflow-x-auto min-w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/40 text-[9px] font-black uppercase text-[#717d96] tracking-wider font-mono">
                    <th className="px-3.5 py-2.5">Imobiliária</th>
                    <th className="px-2.5 py-2.5 text-center">Status</th>
                    <th className="px-2.5 py-2.5 text-center">Vencimento</th>
                    <th className="px-2.5 py-2.5 text-center" title="Limite contratado de usuários/corretores">Vagas</th>
                    {displayedMonths.map(month => (
                      <th 
                        key={month.key} 
                        className={`px-2 py-2.5 text-center select-none font-bold ${
                          month.isCurrent ? "bg-indigo-950/40 text-indigo-300 border-b-2 border-indigo-500" : ""
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span>{month.label}</span>
                          {month.isCurrent && (
                            <span className="text-[7px] tracking-normal font-sans text-indigo-400 uppercase font-black">
                              (Atual)
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center">Acesso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={5 + displayedMonths.length} className="px-4 py-8 text-center text-xs text-slate-500 font-medium">
                        Nenhuma imobiliária encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map(tenant => {
                      const isManuallyUnlocked = Boolean(tenant.isManuallyUnlocked || config?.unlockedTenantIds?.includes(tenant.id));
                      const isBlockedOnSaaS = !isManuallyUnlocked && (tenant.isBlocked || tenant.billingStatus === 'bloqueado');
                      const tenantPayments = config?.payments?.[tenant.id] || {};

                      // Visual badge for the live billing evaluation
                      let statusBadge = (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Regular
                        </span>
                      );

                      if (isBlockedOnSaaS) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30" title={`Suspensão (${tenant.diffDays || 0} dias de atraso)`}>
                            <Lock className="w-2.5 h-2.5" />
                            Bloqueado {tenant.diffDays ? `(D+${tenant.diffDays})` : ""}
                          </span>
                        );
                      } else if (isManuallyUnlocked && (tenant.overdueCount || 0) > 0) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30" title={`Acesso liberado sob carência administrativa (${tenant.diffDays || 0} dias de pendência)`}>
                            <Unlock className="w-2.5 h-2.5" />
                            Carência (D+{tenant.diffDays || 0})
                          </span>
                        );
                      } else if (tenant.billingStatus === 'aviso_critico') {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-orange-500/15 text-orange-400 border border-orange-500/30" title={`Pop-up crítico (${tenant.diffDays || 0} dias de atraso)`}>
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Crítico (D+{tenant.diffDays || 0})
                          </span>
                        );
                      } else if (tenant.billingStatus === 'aviso_sutil') {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30" title={`Banner sutil (${tenant.diffDays || 0} dias de atraso)`}>
                            <Clock className="w-2.5 h-2.5" />
                            Sutil (D+{tenant.diffDays || 0})
                          </span>
                        );
                      }

                      return (
                        <tr key={tenant.id} className="hover:bg-slate-900/20 transition-colors">
                          <td className="px-3.5 py-2.5 min-w-[170px]">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] border shrink-0 ${
                                isBlockedOnSaaS 
                                  ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                                  : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              }`}>
                                {tenant.name?.[0]?.toUpperCase() || "I"}
                              </div>
                              <div className="truncate">
                                <span className="text-xs font-semibold text-slate-100 block truncate">{tenant.name}</span>
                                <span className="text-[8px] font-mono text-slate-500 block truncate">
                                  {tenant.slug || tenant.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Calculated Billing Status Badge */}
                          <td className="px-2.5 py-2.5 text-center min-w-[120px]">
                            {statusBadge}
                          </td>

                          {/* Custom Due Day Select Column */}
                          <td className="px-2.5 py-2.5 text-center min-w-[95px]">
                            <select
                              value={config?.dueDays?.[tenant.id] ?? 10}
                              onChange={(e) => updateTenantDueDay(tenant.id, parseInt(e.target.value))}
                              className="bg-slate-950 border border-slate-800 text-[11px] text-slate-100 rounded-md px-1.5 py-0.5 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer font-bold select-none font-mono text-center mx-auto block hover:bg-slate-900"
                              title="Dia do vencimento mensal desta imobiliária"
                            >
                              {[1, 5, 10, 15, 20, 25].map((day) => (
                                <option key={day} value={day}>
                                  Dia {day}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Custom User Limit (Vagas) Column */}
                          <td className="px-2.5 py-2.5 text-center min-w-[85px]">
                            <div className="flex items-center justify-center gap-1">
                              <input 
                                type="number"
                                min={1}
                                max={500}
                                defaultValue={config?.userLimits?.[tenant.id] ?? tenant.userLimit ?? 5}
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val) && val >= 1) {
                                    updateTenantLimit(tenant.id, val);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseInt((e.target as HTMLInputElement).value);
                                    if (!isNaN(val) && val >= 1) {
                                      updateTenantLimit(tenant.id, val);
                                    }
                                  }
                                }}
                                className="w-12 bg-slate-950 border border-slate-800 text-[11px] text-slate-100 rounded-md px-1 py-0.5 text-center font-mono font-bold focus:border-indigo-500 focus:outline-none"
                                title="Limite de vagas ativas (pressione Enter ou saia do campo para salvar)"
                              />
                              <span className="text-[9px] text-slate-500 font-mono">vagas</span>
                            </div>
                          </td>

                          {/* Dynamic Month Columns */}
                          {displayedMonths.map(month => {
                            const status = tenantPayments[month.key] || "pendente";
                            let badgeBg = "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:border-amber-500/40";
                            let label = "PENDENTE";
                            
                            if (status === "pago") {
                              badgeBg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40";
                              label = "PAGO";
                            } else if (status === "atrasado") {
                              badgeBg = "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:border-rose-500/40";
                              label = "ATRASADO";
                            }

                            return (
                              <td 
                                key={month.key} 
                                className={`px-1.5 py-2 text-center min-w-[80px] ${
                                  month.isCurrent ? "bg-indigo-950/15" : ""
                                }`}
                              >
                                <button
                                  onClick={() => cyclePaymentStatus(tenant.id, month.key)}
                                  className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border cursor-pointer hover:filter hover:brightness-125 transition-all w-16 mx-auto block text-center font-mono ${badgeBg}`}
                                  title="Clique para alternar: PAGO -> PENDENTE -> ATRASADO"
                                >
                                  {label}
                                </button>
                              </td>
                            );
                          })}

                          {/* Lock / Unlock Toggle Action Button */}
                          <td className="px-3 py-2 text-center min-w-[105px]">
                            <button
                              onClick={() => handleToggleClick(tenant, isBlockedOnSaaS)}
                              className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider font-mono border select-none transition-all cursor-pointer ${
                                isBlockedOnSaaS
                                  ? "bg-rose-600 border-rose-600 text-white hover:bg-rose-500 shadow-xs"
                                  : isManuallyUnlocked && (tenant.overdueCount || 0) > 0
                                  ? "bg-blue-900/50 border-blue-500/50 text-blue-300 hover:bg-blue-800/60"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                              }`}
                              title={isBlockedOnSaaS ? "Clique para liberar o acesso desta imobiliária" : "Clique para suspender o acesso manualmente"}
                            >
                              {isBlockedOnSaaS ? (
                                <>
                                  <Lock className="w-2.5 h-2.5 text-white" />
                                  Bloqueado
                                </>
                              ) : isManuallyUnlocked && (tenant.overdueCount || 0) > 0 ? (
                                <>
                                  <Unlock className="w-2.5 h-2.5 text-blue-300" />
                                  Carência
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-2.5 h-2.5 text-slate-400" />
                                  Liberado
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Informative Guidance */}
          <div className="bg-[#0c1221] border border-slate-900 rounded-xl p-3.5 sm:p-4 flex flex-col md:flex-row gap-3 sm:gap-4 items-center">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/15 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed space-y-1">
              <h4 className="text-[11px] font-bold text-slate-100 uppercase tracking-wider">
                Como os Alertas e a Exibição de 6 em 6 Meses Funcionam:
              </h4>
              <p>
                • <strong>Exibição Compacta:</strong> Por padrão, a tabela exibe um bloco com 6 meses. Use os botões para navegar no histórico.
              </p>
              <p>
                • <strong>Meses Nascem como Pendentes:</strong> O sistema projeta os meses e qualquer parcela não expressamente paga nasce como <strong>PENDENTE</strong>.
              </p>
              <p>
                • <strong>Priorização de Inadimplência:</strong> A régua de tolerância é contabilizada a partir da fatura mais antiga em aberto.
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* Alert Preview Modal (Interactive Simulator for Admin) */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-xl rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 relative text-slate-100">
            <button
              onClick={() => setPreviewModalOpen(false)}
              className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono uppercase tracking-widest bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                  Simulador de Alertas
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                Pré-visualização dos Alertas Vistos pelo Cliente
              </h3>
              <p className="text-[11px] text-slate-400">
                Veja como cada nível de alerta aparece para corretores e gestores da imobiliária.
              </p>
            </div>

            {/* Switch preview tabs */}
            <div className="flex items-center gap-1.5 border-b border-slate-900 pb-2.5">
              <button
                onClick={() => setPreviewType("sutil")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  previewType === "sutil" 
                    ? "bg-amber-500 text-slate-950 font-black" 
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                1. Aviso Sutil
              </button>
              <button
                onClick={() => setPreviewType("critico")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  previewType === "critico" 
                    ? "bg-orange-500 text-slate-950 font-black" 
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                2. Aviso Crítico
              </button>
              <button
                onClick={() => setPreviewType("bloqueado")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  previewType === "bloqueado" 
                    ? "bg-rose-600 text-white font-black" 
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                3. Bloqueio Total
              </button>
            </div>

            {/* Preview Body */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 min-h-[160px] flex flex-col justify-center">
              {previewType === "sutil" && (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-slate-400">
                    O cliente vê este card persistente no rodapé da barra lateral:
                  </p>
                  <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 rounded-xl p-2.5 flex items-start gap-2.5 shadow-sm">
                    <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 shrink-0">
                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono">
                          Aviso de Vencimento
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-amber-200 mt-0.5">
                        Mensalidade com pendência em aberto
                      </p>
                      <p className="text-[10px] text-amber-300/80 mt-0.5 leading-tight">
                        Regularize até <strong>21/09/2026</strong> para evitar a suspensão automática das operações.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {previewType === "critico" && (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-slate-400">
                    Ao fazer login no CRM, este diálogo modal centralizado é apresentado:
                  </p>
                  <div className="bg-slate-950 border border-orange-500/40 rounded-xl p-3 shadow-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-orange-500/20 text-orange-400 rounded-lg border border-orange-500/30">
                        <AlertTriangle className="w-4 h-4 animate-bounce" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-orange-200">
                          Aviso Importante: Suspensão Iminente de Acesso
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Consta fatura pendente com tolerância prestes a expirar.
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Sua mensalidade está em aberto. O acesso da imobiliária será bloqueado caso a confirmação não ocorra.
                    </p>
                    <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-900">
                      <button className="px-2.5 py-1 text-[10px] font-bold text-slate-300 bg-slate-900 rounded-md hover:bg-slate-800">
                        Ciente
                      </button>
                      <button className="px-2.5 py-1 text-[10px] font-bold text-slate-950 bg-orange-500 rounded-md hover:bg-orange-400">
                        Contatar Financeiro
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {previewType === "bloqueado" && (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-slate-400">
                    Quando o prazo expira ou o bloqueio manual é acionado:
                  </p>
                  <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3.5 text-center space-y-2">
                    <div className="w-8 h-8 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-rose-300">
                        Acesso Suspenso Temporariamente
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                        O acesso ao CRM para <strong>Nando Imobiliária</strong> foi suspenso por pendência financeira.
                      </p>
                    </div>
                    <div className="pt-1">
                      <span className="inline-block px-2.5 py-1 text-[10px] font-bold bg-rose-600 text-white rounded-lg shadow-xs">
                        Fale com o Administrador da Plataforma
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                Fechar Simulador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Desbloqueio & Regularização de Faturamento */}
      {unlockModalTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 relative text-slate-100">
            <button
              onClick={() => !isUnlocking && setUnlockModalTenant(null)}
              disabled={isUnlocking}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono uppercase tracking-widest bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded border border-rose-500/30 font-bold">
                  Desbloqueio de Acesso
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  {unlockModalTenant.slug || unlockModalTenant.id.slice(0, 8)}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1.5">
                Liberar Acesso: {unlockModalTenant.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Esta imobiliária possui fatura em atraso há <strong className="text-rose-400">{unlockModalTenant.diffDays || 8} dias</strong> (vencimento todo dia {unlockModalTenant.dueDay || 10}). Como deseja proceder?
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {/* Option 1: Confirm Payment and Unlock */}
              <button
                onClick={() => confirmPaymentAndUnlock(unlockModalTenant)}
                disabled={isUnlocking}
                className="w-full text-left p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200">
                        Marcar Fatura como PAGA e Liberar
                      </span>
                      <span className="text-[8px] uppercase tracking-wider bg-emerald-500/20 text-emerald-300 font-mono px-1 py-0.5 rounded font-bold">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-200/70 mt-0.5 leading-snug">
                      Quita o histórico de mensalidades pendentes, altera o status para <strong>Regular</strong> e restaura o acesso sem pendências.
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 2: Grant Grace Period / Provisional Unlock */}
              <button
                onClick={() => grantGracePeriodAndUnlock(unlockModalTenant)}
                disabled={isUnlocking}
                className="w-full text-left p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30 mt-0.5">
                    <Unlock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-300 group-hover:text-blue-200">
                        Liberar Acesso Provisório (Carência)
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-200/70 mt-0.5 leading-snug">
                      Mantém a fatura como <strong>PENDENTE</strong> para cobrança administrativa, mas desbloqueia os usuários para utilizarem o CRM normalmente.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-900">
              <button
                type="button"
                onClick={() => setUnlockModalTenant(null)}
                disabled={isUnlocking}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
