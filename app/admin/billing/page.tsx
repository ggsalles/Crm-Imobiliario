"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { 
  ArrowLeft, 
  Eye, 
  RefreshCw, 
  ShieldAlert 
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/db";
import Link from "next/link";
import { SaaSAdminConfig, getTenantBillingStatus } from "@/lib/billing-types";
import { isPlatformAdmin } from "@/lib/constants";
import { safeSetItem } from "@/lib/safe-storage";
import { Sidebar } from "@/components/sidebar";

import { TenantItem, MonthColumn, BillingFilterStatus } from "@/components/admin/billing/types";
import { BillingStatsSection } from "@/components/admin/billing/BillingStatsSection";
import { BillingRulesCard } from "@/components/admin/billing/BillingRulesCard";
import { BillingFilterToolbar } from "@/components/admin/billing/BillingFilterToolbar";
import { BillingMatrixTable } from "@/components/admin/billing/BillingMatrixTable";
import { BillingPreviewModal } from "@/components/admin/billing/BillingPreviewModal";
import { BillingUnlockModal } from "@/components/admin/billing/BillingUnlockModal";

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", 
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export default function AdminBillingPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [config, setConfig] = useState<SaaSAdminConfig | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillingFilterStatus>("all");
  const [, setSavePending] = useState(false);
  const [unlockModalTenant, setUnlockModalTenant] = useState<TenantItem | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Period management (default: 6-month block centered around current month)
  const [startDate, setStartDate] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() - 4, 1);
  });
  const [windowSize, setWindowSize] = useState<number>(6);

  // Dynamic years for presets (automatically adapts on year turnover)
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const prevYear = currentYear - 1;

  // Dynamic Rule customization states
  const [suttleStart, setSuttleStart] = useState<number>(1);
  const [criticalStart, setCriticalStart] = useState<number>(5);
  const [blockStart, setBlockStart] = useState<number>(7);
  const [savingSettings, setSavingSettings] = useState(false);

  // Modal for alert preview/simulation
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

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

  // Helper to step in months (positive = future, negative = past)
  const stepMonths = (count: number) => {
    setStartDate(prev => new Date(prev.getFullYear(), prev.getMonth() + count, 1));
  };

  // Helper to return to the current month default window
  const goToCurrentPeriod = () => {
    const today = new Date();
    setStartDate(new Date(today.getFullYear(), today.getMonth() - 4, 1));
    setWindowSize(6);
  };

  // Helper to select preset (semester 1, 2 or full year 12)
  const selectPreset = (year: number, semester: 1 | 2 | 12) => {
    if (semester === 12) {
      setStartDate(new Date(year, 0, 1));
      setWindowSize(12);
    } else if (semester === 1) {
      setStartDate(new Date(year, 0, 1));
      setWindowSize(6);
    } else {
      setStartDate(new Date(year, 6, 1));
      setWindowSize(6);
    }
  };

  // Check if current month view is active
  const isCurrentMonthView = useMemo(() => {
    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth() - 4, 1);
    return (
      windowSize === 6 &&
      startDate.getFullYear() === defaultStart.getFullYear() &&
      startDate.getMonth() === defaultStart.getMonth()
    );
  }, [startDate, windowSize]);

  // Check if a specific preset is active
  const isPresetActive = (year: number, semester: 1 | 2 | 12) => {
    const y = startDate.getFullYear();
    const m = startDate.getMonth();
    if (semester === 12) {
      return windowSize === 12 && y === year && m === 0;
    }
    if (semester === 1) {
      return windowSize === 6 && y === year && m === 0;
    }
    return windowSize === 6 && y === year && m === 6;
  };

  // Generate the displayed months strictly chronologically based on startDate and windowSize
  const displayedMonths = useMemo((): MonthColumn[] => {
    const today = new Date();
    const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const list: MonthColumn[] = [];

    for (let i = 0; i < windowSize; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
      list.push({ key, label, isCurrent: key === currentKey });
    }
    return list;
  }, [startDate, windowSize]);

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
        safeSetItem('saas-billing-timestamp', String(Date.now()));
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
      if ((tenant.overdueCount || 0) > 0 || (tenant.diffDays !== undefined && tenant.diffDays >= (config?.blockStart || 7))) {
        setUnlockModalTenant(tenant);
        return;
      }
      toggleTenantBlock(tenant.id, true);
    } else {
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
          {/* Bento Statistics & Summary Banner */}
          <BillingStatsSection
            totalImobiliarias={totalImobiliarias}
            activeCount={activeCount}
            overdueAlertCount={overdueAlertCount}
            blockedCount={blockedCount}
            estimatedRevenue={estimatedRevenue}
            suttleStart={suttleStart}
            criticalStart={criticalStart}
            blockStart={blockStart}
          />

          {/* Delinquency & Automation Rules Configuration */}
          <BillingRulesCard
            suttleStart={suttleStart}
            setSuttleStart={setSuttleStart}
            criticalStart={criticalStart}
            setCriticalStart={setCriticalStart}
            blockStart={blockStart}
            setBlockStart={setBlockStart}
            savingSettings={savingSettings}
            onSave={handleSaveGeneralSettings}
          />

          {/* Management and Ledger Card */}
          <section className="bg-slate-950/40 border border-slate-900/60 rounded-xl backdrop-blur-xl overflow-hidden shadow-xs">
            {/* Top Controls Bar with Filters and Stepper Navigation */}
            <BillingFilterToolbar
              windowSize={windowSize}
              periodDescription={periodDescription}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              totalCount={tenants.length}
              overdueCount={overdueAlertCount}
              regularCount={activeCount - overdueAlertCount}
              blockedCount={blockedCount}
              stepMonths={stepMonths}
              goToCurrentPeriod={goToCurrentPeriod}
              isCurrentMonthView={isCurrentMonthView}
              selectPreset={selectPreset}
              isPresetActive={isPresetActive}
              currentYear={currentYear}
              prevYear={prevYear}
            />

            {/* Tenants Ledger Grid */}
            <BillingMatrixTable
              tenants={filteredTenants}
              config={config}
              displayedMonths={displayedMonths}
              onCyclePayment={cyclePaymentStatus}
              onUpdateDueDay={updateTenantDueDay}
              onUpdateUserLimit={updateTenantLimit}
              onToggleAccess={handleToggleClick}
            />
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
      <BillingPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
      />

      {/* Modal de Desbloqueio & Regularização de Faturamento */}
      <BillingUnlockModal
        tenant={unlockModalTenant}
        isUnlocking={isUnlocking}
        onClose={() => !isUnlocking && setUnlockModalTenant(null)}
        onConfirmPaymentAndUnlock={confirmPaymentAndUnlock}
        onGrantGracePeriodAndUnlock={grantGracePeriodAndUnlock}
      />
    </div>
  );
}
