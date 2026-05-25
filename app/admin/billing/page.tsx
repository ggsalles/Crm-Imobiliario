"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { 
  Building2, 
  CreditCard, 
  Search, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Lock, 
  Unlock, 
  ArrowLeft, 
  DollarSign,
  TrendingUp,
  ShieldCheck,
  CalendarCheck
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/db";
import Link from "next/link";
import { SaaSAdminConfig } from "@/lib/billing";

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  isBlocked: boolean;
}

// Generate the last 5 months for the manual billing ledger
function getRecentMonths() {
  const list: { key: string; label: string }[] = [];
  const MONTHS_NAMES = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", 
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];
  
  const today = new Date();
  for (let i = 4; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MONTHS_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
    list.push({ key, label });
  }
  return list;
}

export default function AdminBillingPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [config, setConfig] = useState<SaaSAdminConfig | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [savePending, setSavePending] = useState(false);
  const [recentMonths] = useState(getRecentMonths());

  // Dynamic Rule customization states
  const [suttleStart, setSuttleStart] = useState<number>(1);
  const [criticalStart, setCriticalStart] = useState<number>(5);
  const [blockStart, setBlockStart] = useState<number>(7);
  const [savingSettings, setSavingSettings] = useState(false);

  // Security Lock check
  useEffect(() => {
    if (!authLoading && (!profile || profile.email?.toLowerCase() !== 'ggsalles@gmail.com')) {
      toast.error("Acesso restrito apenas ao Administrador do Sistema.");
      router.push("/");
    }
  }, [profile, authLoading, router]);

  // Load Tenants and Admin Config
  async function loadAllData() {
    setLoadingData(true);
    try {
      const allTenants = await apiFetch("/api/tenants");
      // Filter out the system config tenant itself in case it made it through
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
    if (profile && profile.email?.toLowerCase() === 'ggsalles@gmail.com') {
      loadAllData();
    }
  }, [profile]);

  // Handle master Block/Unblock actions
  async function toggleTenantBlock(tenantId: string, currentStatus: boolean) {
    if (!config) return;
    
    const nextStatus = !currentStatus;
    setSavePending(true);
    
    try {
      // Optmistic state update on tenants
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

      // Save to server config
      await apiFetch("/api/tenants/config", {
        method: "POST",
        body: JSON.stringify(updatedConfig)
      });

      // Also trigger standard patch update on tenant to update DB caching if needed
      await apiFetch(`/api/tenants?id=${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ isBlocked: nextStatus })
      });

      toast.success(
        nextStatus 
          ? "Acesso da imobiliária bloqueado manualmente!" 
          : "Acesso da imobiliária liberado com sucesso!"
      );
    } catch (err) {
      console.error("Failed to toggle tenant block:", err);
      toast.error("Falha ao salvar ação de bloqueio.");
      // Rollback
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

    // Deep copy for React state updates
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
    } catch (err) {
      console.error("Failed to save billing rules:", err);
      toast.error("Erro ao salvar regras de faturamento.");
    } finally {
      setSavingSettings(false);
    }
  }

  // Statistics calculation
  const totalImobiliarias = tenants.length;
  const blockedCount = tenants.filter(t => t.isBlocked).length;
  const activeCount = totalImobiliarias - blockedCount;
  // Estimate monthly invoice based on current active tenants (mock calculation R$ 299 per active tenant)
  const monthlySubscriptionPrice = 299;
  const estimatedRevenue = activeCount * monthlySubscriptionPrice;

  // Filter tenants for search bar
  const filteredTenants = tenants.filter(t => 
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loadingData) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
        </div>
        <p className="text-xs font-bold font-mono tracking-widest uppercase text-muted-foreground mt-4">Carregando Controle Financeiro...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-100 pb-16 selection:bg-indigo-500 selection:text-white">
      {/* Visual glowing ambience background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/4 left-12 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[90px] pointer-events-none" />

      {/* Header Container */}
      <header className="border-b border-slate-900 bg-slate-950/40 backdrop-blur-2xl px-6 md:px-12 py-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/25 font-mono">
                  SaaS Platform Admin
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black mt-1 text-slate-100 tracking-tight font-sans">
                Controle Manual de Pagamentos & Bloqueios
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={loadAllData}
              className="text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800/80 hover:border-slate-700 px-4 py-2.5 rounded-xl active:scale-95 transition-all"
            >
              Recarregar Dados
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-12 mt-8 space-y-8">
        
        {/* Bento Statistics Section */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-mono font-black tracking-widest text-[#717d96]">Total Imobiliárias</p>
                <h3 className="text-3xl font-black tracking-tight mt-2 text-slate-100">{totalImobiliarias}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/15">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[10px] font-medium text-[#717d96] mt-4 flex items-center gap-1 font-mono">
              Empresas registradas no CRM
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-mono font-black tracking-widest text-[#717d96]">Contratos Ativos</p>
                <h3 className="text-3xl font-black tracking-tight mt-2 text-emerald-400">{activeCount}</h3>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/15">
                <CalendarCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[10px] font-medium text-[#717d96] mt-4 flex items-center gap-1 font-mono">
              Com acesso livre ao sistema
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-mono font-black tracking-widest text-[#717d96]">Acessos Suspensos</p>
                <h3 className={`text-3xl font-black tracking-tight mt-2 ${blockedCount > 0 ? "text-rose-500" : "text-slate-100"}`}>
                  {blockedCount}
                </h3>
              </div>
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/15">
                <Lock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[10px] font-medium text-[#717d96] mt-4 flex items-center gap-1 font-mono">
              Bloqueados por inadimplência
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-mono font-black tracking-widest text-[#717d96]">Receita Recorrente Est.</p>
                <h3 className="text-3xl font-black tracking-tight mt-2 text-indigo-400">
                  R$ {estimatedRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/15">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[10px] font-medium text-[#717d96] mt-4 flex items-center gap-1 font-mono">
              Soma estimada (R$ {monthlySubscriptionPrice}/mês)
            </div>
          </div>
        </section>

        {/* SaaS Automation & Delinquency Rules Configuration */}
        <section className="bg-slate-950/40 border border-slate-900/60 rounded-3xl backdrop-blur-xl overflow-hidden shadow-xl p-6 md:p-8 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900/60 pb-6 mb-6">
            <div>
              <h2 className="text-sm font-black tracking-tight text-white uppercase font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                Regras de Atraso e Régua de Cobrança Automática
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Defina em quantos dias após o vencimento (Dia D) cada limite da régua e seus avisos visuais devem entrar em vigor no SaaS.
              </p>
            </div>
            
            <button
              onClick={handleSaveGeneralSettings}
              disabled={savingSettings}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/15 select-none"
            >
              {savingSettings ? "Salvando..." : "Salvar Prazos Globais"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Suttle Warning Card */}
            <div className="bg-slate-950/30 border border-slate-900/50 rounded-2xl p-5 hover:border-slate-800 transition-all">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider font-mono">Aviso Sutil</h4>
                  <span className="text-[9px] text-amber-500 font-mono font-black uppercase tracking-widest bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10">D + {suttleStart}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-4 min-h-[48px]">
                Exibe um banner amigável de pendência na barra lateral do painel para o inquilino. O app continua 100% funcional.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={suttleStart}
                  onChange={(e) => setSuttleStart(parseInt(e.target.value) || 1)}
                  className="w-20 text-center font-mono font-bold text-xs py-2 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl focus:outline-none text-slate-100 focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-500 font-medium">dia(s) de tolerância</span>
              </div>
            </div>

            {/* Critical Warning Card */}
            <div className="bg-slate-950/30 border border-slate-900/50 rounded-2xl p-5 hover:border-slate-800 transition-all">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider font-mono">Aviso Crítico</h4>
                  <span className="text-[9px] text-amber-500 font-mono font-black uppercase tracking-widest bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10">D + {criticalStart}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-4 min-h-[48px]">
                Exibe um pop-up persistente ao fazer login, mas ainda permitindo usar o app em segundo plano após darciente.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={2}
                  max={30}
                  value={criticalStart}
                  onChange={(e) => setCriticalStart(parseInt(e.target.value) || 5)}
                  className="w-20 text-center font-mono font-bold text-xs py-2 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl focus:outline-none text-slate-100 focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-500 font-medium">dia(s) de tolerância</span>
              </div>
            </div>

            {/* Total Block Card */}
            <div className="bg-slate-950/30 border border-slate-900/50 rounded-2xl p-5 hover:border-slate-800 transition-all">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider font-mono">Bloqueio Total</h4>
                  <span className="text-[9px] text-rose-500 font-mono font-black uppercase tracking-widest bg-rose-500/5 px-1.5 py-0.5 rounded border border-rose-500/10">D + {blockStart}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-4 min-h-[48px]">
                O status do inquilino é alterado para suspenso. Qualquer acesso à plataforma é imediatamente interceptado.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={3}
                  max={45}
                  value={blockStart}
                  onChange={(e) => setBlockStart(parseInt(e.target.value) || 7)}
                  className="w-20 text-center font-mono font-bold text-xs py-2 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl focus:outline-none text-slate-100 focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-500 font-medium">dia(s) de tolerância</span>
              </div>
            </div>
          </div>
        </section>

        {/* Management and Ledger Card */}
        <section className="bg-slate-950/40 border border-slate-900/60 rounded-3xl backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="px-6 py-6 md:px-8 border-b border-slate-900/60 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-100">
                Lista de Clientes & Histórico de Parcelas
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Monitore o status do mês atual e clique nas parcelas para alterar o status do pagamento manual.
              </p>
            </div>
            
            {/* Search Input */}
            <div className="w-full sm:w-64 relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar imobiliária..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-xs py-2.5 pl-10 pr-4 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl focus:outline-none transition-all placeholder:text-slate-500 text-slate-200"
              />
            </div>
          </div>

          {/* Tenants Ledger Grid */}
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/30 text-[10px] font-black uppercase text-[#717d96] tracking-widest font-mono">
                  <th className="px-6 md:px-8 py-4">Imobiliária</th>
                  <th className="px-4 py-4 text-center">Dia Base</th>
                  {recentMonths.map(month => (
                    <th key={month.key} className="px-4 py-4 text-center select-none font-bold">
                      {month.label}
                    </th>
                  ))}
                  <th className="px-6 md:px-8 py-4 text-center">Master Bloqueio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-slate-300">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={3 + recentMonths.length} className="px-8 py-12 text-center text-sm text-slate-500 font-medium">
                      Nenhuma imobiliária cadastrada ou encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map(tenant => {
                    const isBlockedOnSaaS = tenant.isBlocked;
                    const tenantPayments = config?.payments?.[tenant.id] || {};

                    return (
                      <tr key={tenant.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="px-6 md:px-8 py-5 min-w-[200px]">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border ${
                              isBlockedOnSaaS 
                                ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                                : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                            }`}>
                              {tenant.name?.[0]?.toUpperCase() || "I"}
                            </div>
                            <div className="truncate">
                              <span className="text-xs font-bold text-slate-100 block truncate">{tenant.name}</span>
                              <span className="text-[10px] font-mono text-slate-500 tracking-wider font-bold block truncate">ID: {tenant.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Custom Due Day Select Column */}
                        <td className="px-4 py-3 text-center min-w-[125px]">
                          <select
                            value={config?.dueDays?.[tenant.id] ?? 10}
                            onChange={(e) => updateTenantDueDay(tenant.id, parseInt(e.target.value))}
                            className="bg-slate-950 border border-slate-800 text-xs text-slate-100 rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer font-bold select-none font-mono text-center mx-auto block hover:bg-slate-900"
                          >
                            {[1, 5, 10, 15, 20, 25].map((day) => (
                              <option key={day} value={day}>
                                Dia {day}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Recent months payment ledger cells */}
                        {recentMonths.map(month => {
                          const status = tenantPayments[month.key] || "pendente";
                          let badgeBg = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                          let label = "PENDENTE";
                          
                          if (status === "pago") {
                            badgeBg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                            label = "PAGO";
                          } else if (status === "atrasado") {
                            badgeBg = "bg-rose-500/10 text-rose-500 border-rose-500/20";
                            label = "ATRASADO";
                          }

                          return (
                            <td key={month.key} className="px-4 py-3 text-center min-w-[110px]">
                              <button
                                onClick={() => cyclePaymentStatus(tenant.id, month.key)}
                                className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border cursor-pointer hover:filter hover:brightness-125 transition-all w-24 mx-auto block text-center font-mono ${badgeBg}`}
                                title="Clique para rotacionar o status (PAGO -> PENDENTE -> ATRASADO)"
                              >
                                {label}
                              </button>
                            </td>
                          );
                        })}

                        {/* Lock / Unlock Toggle Action Button */}
                        <td className="px-6 md:px-8 py-3 text-center min-w-[150px]">
                          <button
                            onClick={() => toggleTenantBlock(tenant.id, isBlockedOnSaaS)}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest font-mono border select-none transition-all cursor-pointer ${
                              isBlockedOnSaaS
                                ? "bg-rose-600 border-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-950/20"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                            }`}
                          >
                            {isBlockedOnSaaS ? (
                              <>
                                <Lock className="w-3.5 h-3.5 text-white" />
                                Bloqueado
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5 text-slate-400" />
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
        <div className="bg-[#0c1221] border border-slate-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center">
          <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/15 shrink-0">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">Como funciona o Fluxo do Mecanismo de Bloqueio?</h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-4xl mt-1.5">
              1. <strong>Controle Manual Simplificado:</strong> Administre os pagamentos das imobiliárias nesta tela mês a mês. Se o pagamento do mês atual estiver atrasado, você poderá mudar o status correspondente para <strong>ATRASADO</strong> ou <strong>PENDENTE</strong> de forma organizada.
              <br />
              2. <strong>Ação de Bloqueio Direto:</strong> Ao identificar inadimplência no histórico, clique no botão <strong>Master Bloqueio</strong> para alternar o status para <strong>Bloqueado</strong>. O bloqueio entrará em vigor instantaneamente para todos os usuários daquela imobiliária.
              <br />
              3. <strong>Bypass Administrativo:</strong> O usuário administrador supremo do sistema (<code>ggsalles@gmail.com</code>) possui bypass garantido. Você poderá navegar por todo o CRM, visualizar relatórios e carregar esta tela de controle de faturamento livremente, independentemente de haver inquilinos bloqueados ou ativos no momento.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
