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

  // Handle master Block/Unblock actions
  async function toggleTenantBlock(tenantId: string, currentStatus: boolean) {
    if (!config) return;
    
    const nextStatus = !currentStatus;
    setSavePending(true);
    
    try {
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, isBlocked: nextStatus } : t));
      
      const updatedBlocked = [...(config.blockedTenantIds || [])];
      const index = updatedBlocked.indexOf(tenantId);
      
      if (nextStatus && index === -1) {
        updatedBlocked.push(tenantId);
      } else if (!nextStatus && index !== -1) {
        updatedBlocked.splice(index, 1);
      }

      const updatedConfig: SaaSAdminConfig = {
        ...config,
        blockedTenantIds: updatedBlocked
      };

      setConfig(updatedConfig);

      await apiFetch("/api/tenants/config", {
        method: "POST",
        body: JSON.stringify(updatedConfig)
      });

      await apiFetch(`/api/tenants?id=${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ isBlocked: nextStatus })
      });

      toast.success(
        nextStatus 
          ? "Acesso da imobiliária bloqueado manualmente!" 
          : "Acesso da imobiliária liberado com sucesso!"
      );
      loadAllData();
    } catch (err) {
      console.error("Failed to toggle tenant block:", err);
      toast.error("Falha ao salvar ação de bloqueio.");
      loadAllData();
    } finally {
      setSavePending(false);
    }
  }

  // Handle individual payment ledger cycle toggle: PAGO -> PENDENTE -> ATRASADO -> PAGO
  async function cyclePaymentStatus(tenantId: string, monthKey: string) {
    if (!config) return;

    const currentLedger = config.payments || {};
    const tenantLedger = currentLedger[tenantId] || {};
    const currentStatus = tenantLedger[monthKey] || "pendente";
    
    let nextStatus: 'pago' | 'pendente' | 'atrasado' = "pago";
    if (currentStatus === "pago") {
      nextStatus = "pendente";
    } else if (currentStatus === "pendente") {
      nextStatus = "atrasado";
    } else {
      nextStatus = "pago";
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
      const newBilling = getTenantBillingStatus(updatedConfig, tenantId, new Date(), tenant.createdAt);
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
    } catch (err) {
      console.error("Failed to cycle payment status:", err);
      toast.error("Erro ao registrar pagamento.");
      loadAllData();
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
      toast.success(`Dia de vencimento alterado para dia ${newDay}!`);
      loadAllData();
    } catch (err) {
      console.error("Failed to update tenant due day:", err);
      toast.error("Erro ao alterar dia de vencimento.");
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
  const blockedCount = tenants.filter(t => t.isBlocked || t.billingStatus === 'bloqueado').length;
  const overdueAlertCount = tenants.filter(t => t.billingStatus === 'aviso_sutil' || t.billingStatus === 'aviso_critico').length;
  const activeCount = totalImobiliarias - blockedCount;
  const monthlySubscriptionPrice = 299;
  const estimatedRevenue = activeCount * monthlySubscriptionPrice;

  // Filter tenants for search bar & status filter
  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.slug?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === "overdue") {
      return t.billingStatus === "aviso_sutil" || t.billingStatus === "aviso_critico" || (t.overdueCount || 0) > 0;
    }
    if (statusFilter === "regular") {
      return t.billingStatus === "regular" && !t.isBlocked;
    }
    if (statusFilter === "blocked") {
      return t.isBlocked || t.billingStatus === "bloqueado";
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
      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto bg-[#070a13] text-slate-100 selection:bg-indigo-500 selection:text-white">
        
        {/* Header Container */}
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-2xl px-6 md:px-10 py-5 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link 
                href="/"
                className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95"
                title="Voltar ao Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/25 font-mono">
                    SaaS Platform Admin
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                    • Menu lateral ativo
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-black mt-0.5 text-slate-100 tracking-tight font-sans">
                  Controle de Clientes, Cobrança & Bloqueios
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5">
              <button 
                onClick={() => setPreviewModalOpen(true)}
                className="text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 px-3.5 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Testar Visualização dos Alertas</span>
              </button>

              <button 
                onClick={loadAllData}
                className="text-xs font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 px-3.5 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Recarregar dados do servidor"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto w-full px-6 md:px-10 py-8 space-y-8 flex-1">
          
          {/* Bento Statistics Section */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] uppercase font-mono font-black tracking-widest text-[#717d96]">Total Imobiliárias</p>
                  <h3 className="text-2xl font-black tracking-tight mt-1.5 text-slate-100">{totalImobiliarias}</h3>
                </div>
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/15">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-[10px] font-medium text-[#717d96] mt-3 font-mono">
                Empresas cadastradas no SaaS
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] uppercase font-mono font-black tracking-widest text-[#717d96]">Contratos Regulares</p>
                  <h3 className="text-2xl font-black tracking-tight mt-1.5 text-emerald-400">{activeCount - overdueAlertCount}</h3>
                </div>
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/15">
                  <CalendarCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-[10px] font-medium text-emerald-500/80 mt-3 font-mono">
                Em dia (sem avisos)
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] uppercase font-mono font-black tracking-widest text-[#717d96]">Em Régua de Alerta</p>
                  <h3 className={`text-2xl font-black tracking-tight mt-1.5 ${overdueAlertCount > 0 ? "text-amber-400" : "text-slate-100"}`}>
                    {overdueAlertCount}
                  </h3>
                </div>
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/15">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-[10px] font-medium text-amber-500/80 mt-3 font-mono">
                Aviso Sutil ou Crítico ativo
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] uppercase font-mono font-black tracking-widest text-[#717d96]">Acessos Suspensos</p>
                  <h3 className={`text-2xl font-black tracking-tight mt-1.5 ${blockedCount > 0 ? "text-rose-500" : "text-slate-100"}`}>
                    {blockedCount}
                  </h3>
                </div>
                <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/15">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-[10px] font-medium text-rose-500/80 mt-3 font-mono">
                Bloqueados por tolerância ou manual
              </div>
            </div>
          </section>

          {/* Validation & Explanation Banner about Automatic Months & Pending Status */}
          <div className="bg-slate-950/60 border border-indigo-500/20 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-200">
                  Validação Automática de Parcelas & Régua Financeira
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-3xl">
                  <strong>1. Meses Gerados Automaticamente:</strong> O sistema projeta a linha do tempo contínua para cada cliente. <br />
                  <strong>2. Status Padrão PENDENTE:</strong> Todas as parcelas não marcadas expressamente como pagas nascem automaticamente como <strong>PENDENTE</strong>. <br />
                  <strong>3. Disparo de Alertas:</strong> Assim que a data de vencimento da imobiliária passa, as faturas pendentes entram na régua de tolerância (Aviso Sutil em D+{suttleStart}, Aviso Crítico em D+{criticalStart} e Bloqueio em D+{blockStart}).
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg">
                Faturamento: R$ {estimatedRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
              </span>
            </div>
          </div>

          {/* SaaS Automation & Delinquency Rules Configuration */}
          <section className="bg-slate-950/40 border border-slate-900/60 rounded-3xl backdrop-blur-xl overflow-hidden shadow-xl p-5 md:p-7 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900/60 pb-5 mb-5">
              <div>
                <h2 className="text-xs font-black tracking-tight text-white uppercase font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  Régua de Cobrança Automática & Tolerância
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Defina os prazos em dias após o vencimento (Dia D) para acionar cada alerta visual e o bloqueio automático.
                </p>
              </div>
              
              <button
                onClick={handleSaveGeneralSettings}
                disabled={savingSettings}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/15"
              >
                {savingSettings ? "Salvando..." : "Salvar Prazos Globais"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Suttle Warning Card */}
              <div className="bg-slate-950/30 border border-slate-900/50 rounded-2xl p-4 hover:border-slate-800 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">1. Aviso Sutil</h3>
                    <span className="text-[9px] font-mono text-amber-400 font-bold uppercase tracking-wider">Banner no Menu Lateral</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  Exibe um alerta discreto no menu lateral informando que o boleto do mês venceu.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">A partir de D+</span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={suttleStart}
                    onChange={(e) => setSuttleStart(parseInt(e.target.value) || 1)}
                    className="w-16 text-center font-mono font-bold text-xs py-1.5 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg focus:outline-none text-slate-100"
                  />
                  <span className="text-[11px] text-slate-500">dia(s) de atraso</span>
                </div>
              </div>

              {/* Critical Warning Card */}
              <div className="bg-slate-950/30 border border-slate-900/50 rounded-2xl p-4 hover:border-slate-800 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-orange-500/10 text-orange-400 rounded-lg border border-orange-500/20">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">2. Aviso Crítico</h3>
                    <span className="text-[9px] font-mono text-orange-400 font-bold uppercase tracking-wider">Pop-up ao fazer Login</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  Apresenta um pop-up de notificação avisando sobre o risco iminente de suspensão.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">A partir de D+</span>
                  <input
                    type="number"
                    min={2}
                    max={30}
                    value={criticalStart}
                    onChange={(e) => setCriticalStart(parseInt(e.target.value) || 5)}
                    className="w-16 text-center font-mono font-bold text-xs py-1.5 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg focus:outline-none text-slate-100"
                  />
                  <span className="text-[11px] text-slate-500">dia(s) de atraso</span>
                </div>
              </div>

              {/* Total Block Card */}
              <div className="bg-slate-950/30 border border-slate-900/50 rounded-2xl p-4 hover:border-slate-800 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">3. Bloqueio Total</h3>
                    <span className="text-[9px] font-mono text-rose-400 font-bold uppercase tracking-wider">Suspensão de Acesso</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  Interrompe imediatamente o acesso de todos os corretores e administradores da imobiliária.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">A partir de D+</span>
                  <input
                    type="number"
                    min={3}
                    max={45}
                    value={blockStart}
                    onChange={(e) => setBlockStart(parseInt(e.target.value) || 7)}
                    className="w-16 text-center font-mono font-bold text-xs py-1.5 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg focus:outline-none text-slate-100"
                  />
                  <span className="text-[11px] text-slate-500">dia(s) de tolerância</span>
                </div>
              </div>
            </div>
          </section>

          {/* Management and Ledger Card */}
          <section className="bg-slate-950/40 border border-slate-900/60 rounded-3xl backdrop-blur-xl overflow-hidden shadow-xl">
            
            {/* Top Controls Bar with 6-Month Period Navigation and Filters */}
            <div className="p-5 md:p-6 border-b border-slate-900/60 bg-slate-950/70 flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-100 flex items-center gap-2">
                    Lista de Clientes & Histórico de Parcelas
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
                      Exibição padrão: 6 em 6 meses
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Período em tela: <span className="text-indigo-400 font-semibold">{periodDescription}</span>. Clique nas parcelas para alterar o status.
                  </p>
                </div>
                
                {/* Search Bar & Status Filter */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative min-w-[200px]">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar por imobiliária..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full text-xs py-2 pl-9 pr-3 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl focus:outline-none transition-all placeholder:text-slate-500 text-slate-200"
                    />
                  </div>

                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs">
                    <button
                      onClick={() => setStatusFilter("all")}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all text-[11px] ${statusFilter === "all" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Todos ({tenants.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter("overdue")}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all text-[11px] ${statusFilter === "overdue" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Com Pendência ({overdueAlertCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter("regular")}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all text-[11px] ${statusFilter === "regular" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Regulares ({activeCount - overdueAlertCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter("blocked")}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all text-[11px] ${statusFilter === "blocked" ? "bg-rose-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Bloqueados ({blockedCount})
                    </button>
                  </div>
                </div>
              </div>

              {/* Period Selector and 6-Month Navigation */}
              <div className="pt-3 border-t border-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                
                {/* 6-Month Stepper Navigation */}
                <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 rounded-xl p-1">
                  <button
                    onClick={() => {
                      setPeriodMode("custom");
                      setMonthOffset(prev => prev + 1);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-bold text-[11px]"
                    title="Retroceder 6 meses no tempo"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>6 Meses Anteriores</span>
                  </button>

                  <button
                    onClick={() => {
                      setPeriodMode("current_6");
                      setMonthOffset(0);
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      periodMode === "current_6" && monthOffset === 0
                        ? "bg-indigo-600 text-white" 
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    Mês Atual (Padrão)
                  </button>

                  <button
                    onClick={() => {
                      setPeriodMode("custom");
                      setMonthOffset(prev => prev - 1);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-bold text-[11px]"
                    title="Avançar 6 meses no tempo"
                  >
                    <span>Próximos 6 Meses</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Period Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-mono mr-1">Filtrar por:</span>
                  
                  <button
                    onClick={() => { setPeriodMode("s1_2026"); setMonthOffset(0); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                      periodMode === "s1_2026" 
                        ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" 
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    1º Sem/26 (Jan-Jun)
                  </button>

                  <button
                    onClick={() => { setPeriodMode("s2_2026"); setMonthOffset(0); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                      periodMode === "s2_2026" 
                        ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" 
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    2º Sem/26 (Jul-Dez)
                  </button>

                  <button
                    onClick={() => { setPeriodMode("full_year_2026"); setMonthOffset(0); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                      periodMode === "full_year_2026" 
                        ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" 
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Ano 2026 Completo (12m)
                  </button>

                  <button
                    onClick={() => { setPeriodMode("s2_2025"); setMonthOffset(0); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
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
                  <tr className="border-b border-slate-900 bg-slate-950/40 text-[10px] font-black uppercase text-[#717d96] tracking-widest font-mono">
                    <th className="px-5 py-3.5">Imobiliária</th>
                    <th className="px-3 py-3.5 text-center">Status de Cobrança</th>
                    <th className="px-3 py-3.5 text-center">Vencimento</th>
                    {displayedMonths.map(month => (
                      <th 
                        key={month.key} 
                        className={`px-2.5 py-3.5 text-center select-none font-bold ${
                          month.isCurrent ? "bg-indigo-950/40 text-indigo-300 border-b-2 border-indigo-500" : ""
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span>{month.label}</span>
                          {month.isCurrent && (
                            <span className="text-[8px] tracking-normal font-sans text-indigo-400 uppercase font-black">
                              (Atual)
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3.5 text-center">Acesso / Bloqueio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={4 + displayedMonths.length} className="px-8 py-12 text-center text-sm text-slate-500 font-medium">
                        Nenhuma imobiliária encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map(tenant => {
                      const isBlockedOnSaaS = tenant.isBlocked || tenant.billingStatus === 'bloqueado';
                      const tenantPayments = config?.payments?.[tenant.id] || {};

                      // Visual badge for the live billing evaluation
                      let statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Regular
                        </span>
                      );

                      if (tenant.billingStatus === 'bloqueado') {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30" title={`Suspensão automática ou manual (${tenant.diffDays || 0} dias de atraso)`}>
                            <Lock className="w-3 h-3" />
                            Bloqueado {tenant.diffDays ? `(D+${tenant.diffDays})` : ""}
                          </span>
                        );
                      } else if (tenant.billingStatus === 'aviso_critico') {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-orange-500/15 text-orange-400 border border-orange-500/30" title={`Pop-up crítico exibido no login (${tenant.diffDays || 0} dias de atraso)`}>
                            <AlertTriangle className="w-3 h-3" />
                            Aviso Crítico (D+{tenant.diffDays || 0})
                          </span>
                        );
                      } else if (tenant.billingStatus === 'aviso_sutil') {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30" title={`Banner sutil exibido na barra lateral (${tenant.diffDays || 0} dias de atraso)`}>
                            <Clock className="w-3 h-3" />
                            Aviso Sutil (D+{tenant.diffDays || 0})
                          </span>
                        );
                      }

                      return (
                        <tr key={tenant.id} className="hover:bg-slate-900/20 transition-colors">
                          <td className="px-5 py-3.5 min-w-[190px]">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border shrink-0 ${
                                isBlockedOnSaaS 
                                  ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                                  : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              }`}>
                                {tenant.name?.[0]?.toUpperCase() || "I"}
                              </div>
                              <div className="truncate">
                                <span className="text-xs font-bold text-slate-100 block truncate">{tenant.name}</span>
                                <span className="text-[9px] font-mono text-slate-500 block truncate">
                                  {tenant.slug || tenant.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Calculated Billing Status Badge */}
                          <td className="px-3 py-3.5 text-center min-w-[140px]">
                            {statusBadge}
                          </td>

                          {/* Custom Due Day Select Column */}
                          <td className="px-3 py-3.5 text-center min-w-[105px]">
                            <select
                              value={config?.dueDays?.[tenant.id] ?? 10}
                              onChange={(e) => updateTenantDueDay(tenant.id, parseInt(e.target.value))}
                              className="bg-slate-950 border border-slate-800 text-xs text-slate-100 rounded-lg px-2 py-1 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer font-bold select-none font-mono text-center mx-auto block hover:bg-slate-900"
                              title="Dia do vencimento mensal desta imobiliária"
                            >
                              {[1, 5, 10, 15, 20, 25].map((day) => (
                                <option key={day} value={day}>
                                  Dia {day}
                                </option>
                              ))}
                            </select>
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
                                className={`px-2 py-3 text-center min-w-[95px] ${
                                  month.isCurrent ? "bg-indigo-950/15" : ""
                                }`}
                              >
                                <button
                                  onClick={() => cyclePaymentStatus(tenant.id, month.key)}
                                  className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border cursor-pointer hover:filter hover:brightness-125 transition-all w-20 mx-auto block text-center font-mono ${badgeBg}`}
                                  title="Clique para alternar: PAGO -> PENDENTE -> ATRASADO"
                                >
                                  {label}
                                </button>
                              </td>
                            );
                          })}

                          {/* Lock / Unlock Toggle Action Button */}
                          <td className="px-4 py-3 text-center min-w-[125px]">
                            <button
                              onClick={() => toggleTenantBlock(tenant.id, isBlockedOnSaaS)}
                              className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider font-mono border select-none transition-all cursor-pointer ${
                                isBlockedOnSaaS
                                  ? "bg-rose-600 border-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-950/20"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                              }`}
                              title={isBlockedOnSaaS ? "Clique para liberar o acesso" : "Clique para suspender o acesso manualmente"}
                            >
                              {isBlockedOnSaaS ? (
                                <>
                                  <Lock className="w-3 h-3 text-white" />
                                  Bloqueado
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3 h-3 text-slate-400" />
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
          <div className="bg-[#0c1221] border border-slate-900 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row gap-5 items-center">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/15 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-xs text-slate-400 leading-relaxed space-y-1.5">
              <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider">
                Como os Alertas e a Exibição de 6 em 6 Meses Funcionam:
              </h4>
              <p>
                • <strong>Exibição Compacta de 6 Meses:</strong> Por padrão, a tabela exibe um bloco com os últimos 4 meses, o mês atual e o mês seguinte. Use os botões <strong>6 Meses Anteriores</strong> ou <strong>Próximos 6 Meses</strong> para navegar facilmente pelo histórico ou selecione um semestre no filtro.
              </p>
              <p>
                • <strong>Meses Nascem como Pendentes:</strong> Não é necessário criar cada mês manualmente. O sistema gera os meses conforme o calendário e qualquer mês sem marcação nasce como <strong>PENDENTE</strong>.
              </p>
              <p>
                • <strong>Priorização de Inadimplência Anterior:</strong> O cálculo de atraso avalia todo o histórico desde o início do cliente. Se houver qualquer mês anterior não pago cujo vencimento já expirou, a tolerância é contabilizada a partir da fatura mais antiga em aberto.
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* Alert Preview Modal (Interactive Simulator for Admin) */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-6 relative text-slate-100">
            <button
              onClick={() => setPreviewModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                  Simulador de Alertas
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-1">
                Pré-visualização dos Alertas Vistos pelo Cliente
              </h3>
              <p className="text-xs text-slate-400">
                Veja exatamente como cada nível de alerta aparece para os corretores e gestores da imobiliária quando há atraso na mensalidade.
              </p>
            </div>

            {/* Switch preview tabs */}
            <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
              <button
                onClick={() => setPreviewType("sutil")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  previewType === "sutil" 
                    ? "bg-amber-500 text-slate-950 font-black" 
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                1. Aviso Sutil (Sidebar)
              </button>
              <button
                onClick={() => setPreviewType("critico")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  previewType === "critico" 
                    ? "bg-orange-500 text-slate-950 font-black" 
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                2. Aviso Crítico (Pop-up)
              </button>
              <button
                onClick={() => setPreviewType("bloqueado")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  previewType === "bloqueado" 
                    ? "bg-rose-600 text-white font-black" 
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                3. Bloqueio Total (Tela de Bloqueio)
              </button>
            </div>

            {/* Preview Body */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 min-h-[220px] flex flex-col justify-center">
              {previewType === "sutil" && (
                <div className="space-y-3">
                  <p className="text-[11px] font-mono text-slate-400">
                    O cliente vê este card persistente no rodapé da barra lateral:
                  </p>
                  <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-3 shadow-lg">
                    <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
                      <Clock className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                          Aviso de Vencimento
                        </span>
                      </div>
                      <p className="text-xs font-bold text-amber-200 mt-1">
                        Mensalidade com pendência em aberto
                      </p>
                      <p className="text-[11px] text-amber-300/80 mt-0.5 leading-tight">
                        Regularize até <strong>21/09/2026</strong> para evitar a suspensão automática das operações.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {previewType === "critico" && (
                <div className="space-y-3">
                  <p className="text-[11px] font-mono text-slate-400">
                    Ao fazer login no CRM, este diálogo modal centralizado é apresentado:
                  </p>
                  <div className="bg-slate-950 border border-orange-500/40 rounded-2xl p-4 shadow-2xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
                        <AlertTriangle className="w-5 h-5 animate-bounce" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-orange-200">
                          Aviso Importante: Suspensão Iminente de Acesso
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Consta fatura pendente com tolerância prestes a expirar.
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Sua mensalidade está em aberto. O acesso de todos os corretores e painéis da sua imobiliária será bloqueado automaticamente caso a confirmação de pagamento não ocorra.
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900">
                      <button className="px-3 py-1.5 text-xs font-bold text-slate-300 bg-slate-900 rounded-lg hover:bg-slate-800">
                        Ciente, acessar o sistema temporariamente
                      </button>
                      <button className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-orange-500 rounded-lg hover:bg-orange-400">
                        Contatar Financeiro
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {previewType === "bloqueado" && (
                <div className="space-y-3">
                  <p className="text-[11px] font-mono text-slate-400">
                    Quando o prazo expira ou o bloqueio manual é acionado, a tela do cliente é interceptada:
                  </p>
                  <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-5 text-center space-y-3">
                    <div className="w-10 h-10 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-rose-300">
                        Acesso Suspenso Temporariamente
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        O acesso ao CRM para <strong>Nando Imobiliária</strong> foi suspenso por pendência financeira na assinatura.
                      </p>
                    </div>
                    <div className="pt-2">
                      <span className="inline-block px-3 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-xl shadow">
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
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fechar Simulador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
