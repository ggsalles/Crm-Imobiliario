"use client";

export const dynamic = 'force-dynamic';

/**
 * SalesScore CRM - Versão Estável Sincronizada & Modularizada
 */

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  TrendingUp, 
  Search, 
  Info, 
  ArrowRight, 
  AlertTriangle, 
  MessageCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";

import { Sidebar } from "@/components/sidebar";
import { SoundControlButton } from "@/components/NewLeadSoundNotifier";
import { MetricsSummary } from "@/components/dashboard/MetricsSummary";
import { PipelineChart } from "@/components/dashboard/PipelineChart";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { RecentDealsTable } from "@/components/dashboard/RecentDealsTable";
import { ForecastView } from "@/components/dashboard/ForecastView";
import { ReportsView } from "@/components/dashboard/ReportsView";
import { TeamView } from "@/components/dashboard/TeamView";

import { useAuth } from "@/providers/auth-provider";
import { getDealStaleInfo, getWhatsAppRescueUrl } from "@/lib/lead-health";
import { STAGES } from "@/lib/constants";
import { safeGetJson, safeSetJson, getTenantPipelineProbabilities } from "@/lib/safe-storage";
import { safeAiCall } from "@/lib/ai";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { 
  Deal, 
  Contact, 
  Goal, 
  Activity, 
  Property, 
  UserProfile,
  subscribeToDeals, 
  subscribeToContacts, 
  subscribeToGoals,
  subscribeToActivities,
  subscribeToProperties,
  subscribeToUsers,
  updateActivity,
  getDeals,
  getContacts,
  getGoals,
  getProperties,
  getCachedDeals,
  getCachedContacts,
  getCachedProperties,
  getCachedActivities
} from "@/lib/db";

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const DASHBOARD_TABS = ['Visão Geral', 'Relatórios', 'Equipe', 'Previsões'] as const;

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [deals, setDeals] = useState<Deal[]>(() => {
    const cached = getCachedDeals();
    return cached && cached.length > 0 ? cached : [];
  });
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const cached = getCachedContacts();
    return cached && cached.length > 0 ? cached : [];
  });
  const [properties, setProperties] = useState<Property[]>(() => {
    const cached = getCachedProperties();
    return cached && cached.length > 0 ? cached : [];
  });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activities, setActivities] = useState<Activity[]>(() => {
    const cached = getCachedActivities();
    return cached && cached.length > 0 ? cached : [];
  });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<string>("Visão Geral");

  const [loading, setLoading] = useState(() => {
    const cached = getCachedDeals();
    return !(cached && cached.length > 0);
  });
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [customProbabilities, setCustomProbabilities] = useState<Record<string, number>>({});
  const aiCacheKey = useMemo(() => {
    return profile?.tenantId ? `dashboard_ai_insights_${profile.tenantId}` : "dashboard_ai_insights";
  }, [profile?.tenantId]);

  const [aiInsights, setAiInsights] = useState<string | null>(null);

  useEffect(() => {
    const cached = safeGetJson<{ text: string; timestamp: number }>(aiCacheKey);
    if (cached?.text && !cached.text.includes("Ops!") && !cached.text.includes("Limite de cota") && !cached.text.includes("Erro na API")) {
      setAiInsights(cached.text);
    } else {
      setAiInsights(null);
    }
  }, [aiCacheKey]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'weekly' | 'monthly'>('monthly');

  // --- Dates & Base Calculations ---
  const now = useMemo(() => new Date(), []);
  const currentMonthStr = useMemo(() => format(now, "yyyy-MM"), [now]);
  const lastMonthDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), [now]);
  const lastMonthStr = useMemo(() => format(lastMonthDate, "yyyy-MM"), [lastMonthDate]);

  const currentGoal = useMemo(() => {
    const monthGoals = goals.filter(g => g.month === currentMonthStr);
    return monthGoals.find(g => g.ownerId === user?.id) || monthGoals[0];
  }, [goals, currentMonthStr, user]);

  const goalRevenue = useMemo(() => currentGoal?.stageGoals?.['closed'] || currentGoal?.revenue || 0, [currentGoal]);

  const staleDeals = useMemo(() => deals.filter(d => getDealStaleInfo(d).isStale), [deals]);
  const staleDealsValue = useMemo(() => staleDeals.reduce((acc, d) => acc + (d.value || 0), 0), [staleDeals]);

  // Indexed Contacts Map for O(1) lookups
  const contactsMap = useMemo(() => new Map(contacts.map(c => [c.id, c])), [contacts]);

  const refreshData = useCallback(async (showLoading = true) => {
    if (!user || !profile) return;
    if (showLoading) setLoading(true);
    setErrorStatus(null);
    try {
      const ownerId = profile.role === 'Admin' ? undefined : user.id;
      
      const results = await Promise.allSettled([
        getDeals(ownerId),
        getContacts(ownerId),
        getProperties(ownerId),
        getGoals(ownerId)
      ]);
      
      if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) setDeals(results[0].value);
      if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) setContacts(results[1].value);
      if (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) setProperties(results[2].value);
      if (results[3].status === 'fulfilled' && Array.isArray(results[3].value)) setGoals(results[3].value);
    } catch (err: any) {
      console.error("[Dashboard] Refresh error:", err);
      if (deals.length === 0 && contacts.length === 0) {
        setErrorStatus(err.message || "Erro ao carregar dados.");
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user, profile, deals.length, contacts.length]);

  useEffect(() => {
    if (user && profile && deals.length === 0 && contacts.length === 0) {
      const timer = setTimeout(() => {
        if (deals.length === 0 && contacts.length === 0) {
          refreshData(false);
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [user, profile, refreshData, deals.length, contacts.length]);

  const generateAIInsights = useCallback(async (bypassCache = false) => {
    const mStr = format(new Date(), "yyyy-MM");
    const cGoal = goals.find(g => g.month === mStr && g.ownerId === user?.id) || 
                  goals.find(g => g.month === mStr);
    const gRevenue = cGoal?.stageGoals?.['closed'] || cGoal?.revenue || 0;
    const closedTotal = deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + (d.value || 0), 0);
    const totalPipeline = deals
      .filter(d => STAGES.some(s => s.id === d.stage && s.id !== 'closed'))
      .reduce((acc, d) => acc + (d.value || 0), 0);
    
    // Fingerprint dinâmico do estado atual dos dados
    const currentDataFingerprint = `${mStr}_${gRevenue}_${closedTotal}_${totalPipeline}_${deals.map(d => `${d.id}:${d.stage}:${d.value}`).sort().join(';')}`;

    if (!bypassCache) {
      const cached = safeGetJson<{ text: string; timestamp: number; fingerprint?: string }>(aiCacheKey);
      if (cached?.text && cached.timestamp && cached.fingerprint === currentDataFingerprint) {
        const age = Date.now() - cached.timestamp;
        if (age < 3600000) { // 1 hora com dados idênticos
          setAiInsights(cached.text);
          return;
        }
      }
    }

    setLoadingAI(true);
    
    const weightedPipeline = deals
      .filter(d => d.stage !== 'closed')
      .reduce((acc, d) => {
        const prob = customProbabilities[d.stage] ?? (STAGES.findIndex(s => s.id === d.stage) + 1) * 20;
        return acc + ((d.value || 0) * (prob / 100));
      }, 0);

    const fValue = weightedPipeline + closedTotal;
    
    const stageCounts = STAGES.map(stage => ({
      id: stage.id,
      name: stage.title,
      count: deals.filter(d => d.stage === stage.id).length,
      value: deals.filter(d => d.stage === stage.id).reduce((acc, d) => acc + (d.value || 0), 0),
    }));

    const prompt = `
      Analise os seguintes dados do CRM SalesScore e forneça um resumo executivo de previsões de vendas e recomendações estratégicas.
      Mês Atual: ${mStr}
      Objetivo de Receita: ${formatCurrencyBRL(gRevenue, { maximumFractionDigits: 0 })}
      Vendas Realizadas (Closed): ${formatCurrencyBRL(closedTotal, { maximumFractionDigits: 0 })}
      Valor em Pipeline (Aberto): ${formatCurrencyBRL(totalPipeline, { maximumFractionDigits: 0 })}
      Previsão Ponderada (Realista): ${formatCurrencyBRL(fValue, { maximumFractionDigits: 0 })}

      Distribuição do Pipeline:
      ${stageCounts.map(s => `- ${s.name}: ${s.count} negócios, total ${formatCurrencyBRL(s.value, { maximumFractionDigits: 0 })}`).join('\n')}

      Por favor, forneça:
      1. Uma avaliação da probabilidade de atingir a meta.
      2. Qual estágio do funil é o maior gargalo.
      3. Uma recomendação prática para fechar mais negócios.
      
      Responda em PORTUGUÊS, use tom profissional e direto. Use formatação em parágrafos curtos.
    `;

    // Análise estratégica matemática determinística (fallback infalível)
    const pctGoal = gRevenue > 0 ? Math.round((closedTotal / gRevenue) * 100) : (closedTotal > 0 ? 100 : 0);
    const sortedActiveStages = [...stageCounts].filter(s => s.id !== 'closed' && s.id !== 'lost').sort((a, b) => b.value - a.value);
    const bottleneckStage = sortedActiveStages[0] || { id: 'proposal', name: 'Proposta', count: 0, value: 0 };
    const dealsToClose = deals.filter(d => d.stage === 'proposal' || d.stage === 'legal' || d.stage === 'negotiation');
    
    const fallbackInsightText = [
      `📊 Diagnóstico do Mês (${mStr}): O time já atingiu ${pctGoal}% da meta de receita (${formatCurrencyBRL(closedTotal, { maximumFractionDigits: 0 })} realizados de ${formatCurrencyBRL(gRevenue, { maximumFractionDigits: 0 })}). O pipeline ativo possui ${formatCurrencyBRL(totalPipeline, { maximumFractionDigits: 0 })} em aberto com previsão ponderada realista de ${formatCurrencyBRL(fValue, { maximumFractionDigits: 0 })}.`,
      `🚨 Ponto de Atenção (Gargalo do Funil): A etapa "${bottleneckStage.name}" concentra o maior volume financeiro represado, somando ${bottleneckStage.count} negócios e ${formatCurrencyBRL(bottleneckStage.value, { maximumFractionDigits: 0 })}. Destravar essas oportunidades é crucial para atingir a meta.`,
      `🎯 Recomendação Prática: Foque o esforço dos corretores prioritariamente nos ${dealsToClose.length} negócios em estágio avançado (Proposta/Negociação) através de contatos telefônicos diretos e condições exclusivas de fechamento esta semana.`
    ].join('\n\n');

    const result = await safeAiCall(prompt, fallbackInsightText);
    const textToDisplay = (!result.text || result.text.includes("Ops!") || result.text.includes("Limite de cota") || result.text.includes("Erro na API")) 
      ? fallbackInsightText 
      : result.text;

    setAiInsights(textToDisplay);
    safeSetJson(aiCacheKey, {
      text: textToDisplay,
      fingerprint: currentDataFingerprint,
      timestamp: Date.now()
    });
    setLoadingAI(false);
  }, [goals, deals, customProbabilities, user?.id, aiCacheKey]);

  useEffect(() => {
    if (activeTab === 'Previsões' && deals.length > 0 && !aiInsights && !loadingAI) {
      generateAIInsights(false);
    }
  }, [activeTab, deals.length, aiInsights, loadingAI, generateAIInsights]);

  useEffect(() => {
    const loadProbabilities = () => {
      const saved = getTenantPipelineProbabilities(profile?.tenantId);
      if (saved && typeof saved === "object" && Object.keys(saved).length > 0) {
        setCustomProbabilities(saved);
      } else {
        const defaults = STAGES.reduce((acc, stage, idx) => {
          acc[stage.id] = (idx + 1) * 20;
          return acc;
        }, {} as Record<string, number>);
        setCustomProbabilities(defaults);
      }
    };

    loadProbabilities();

    const handleUpdate = () => loadProbabilities();
    window.addEventListener("storage_probabilities_updated", handleUpdate);
    return () => window.removeEventListener("storage_probabilities_updated", handleUpdate);
  }, [profile?.tenantId]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['Visão Geral', 'Relatórios', 'Equipe', 'Previsões'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 3500);

    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsubDeals = subscribeToDeals((data) => {
      setDeals(data);
      setLoading(false);
      clearTimeout(safetyTimer);
    }, ownerId);
    
    const unsubContacts = subscribeToContacts(setContacts, ownerId);
    const unsubProperties = subscribeToProperties(setProperties, ownerId);
    const unsubGoals = subscribeToGoals(setGoals, ownerId);
    const unsubActivities = subscribeToActivities(setActivities, ownerId);

    let unsubUsers = () => {};
    if (profile.role === 'Admin') {
      unsubUsers = subscribeToUsers(setUsers);
    }

    return () => {
      unsubDeals();
      unsubContacts();
      unsubProperties();
      unsubGoals();
      unsubActivities();
      unsubUsers();
      clearTimeout(safetyTimer);
    };
  }, [user, profile]);

  // --- Memoized Metrics Calculations ---
  const currentMonthRevenue = useMemo(() => {
    return deals
      .filter(d => d.stage === 'closed' && d.updatedAt?.startsWith(currentMonthStr))
      .reduce((acc, d) => acc + (d.value || 0), 0);
  }, [deals, currentMonthStr]);

  const lastMonthRevenue = useMemo(() => {
    return deals
      .filter(d => d.stage === 'closed' && d.updatedAt?.startsWith(lastMonthStr))
      .reduce((acc, d) => acc + (d.value || 0), 0);
  }, [deals, lastMonthStr]);

  const revenueTrend = useMemo(() => {
    return lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 100;
  }, [currentMonthRevenue, lastMonthRevenue]);

  const validDeals = useMemo(() => deals.filter(d => STAGES.some(s => s.id === d.stage)), [deals]);
  const totalDealsFinished = useMemo(() => validDeals.filter(d => d.stage === 'closed').length, [validDeals]);
  const winRate = useMemo(() => validDeals.length > 0 ? (totalDealsFinished / validDeals.length) * 100 : 0, [validDeals.length, totalDealsFinished]);
  const winRateDetails = useMemo(() => `${totalDealsFinished} de ${validDeals.length} negócios`, [totalDealsFinished, validDeals.length]);

  const progressPercentage = useMemo(() => goalRevenue > 0 ? Math.round((currentMonthRevenue / goalRevenue) * 100) : 0, [goalRevenue, currentMonthRevenue]);

  const { newLeads, leadsTrend } = useMemo(() => {
    const curMonthLeads = deals.filter(d => d.createdAt?.startsWith(currentMonthStr) && d.stage === 'lead').length;
    const prevMonthLeads = deals.filter(d => d.createdAt?.startsWith(lastMonthStr) && d.stage === 'lead').length;
    const trend = prevMonthLeads > 0 
      ? ((curMonthLeads - prevMonthLeads) / prevMonthLeads) * 100 
      : (curMonthLeads > 0 ? 100 : 0);
    return { newLeads: curMonthLeads, leadsTrend: trend };
  }, [deals, currentMonthStr, lastMonthStr]);

  const openDeals = useMemo(() => deals.filter(d => d.stage !== 'closed'), [deals]);

  const { forecastValue } = useMemo(() => {
    let closedSum = 0;
    let weightedSum = 0;
    for (const d of deals) {
      const val = d.value || 0;
      if (d.stage === 'closed') {
        closedSum += val;
      } else {
        const prob = customProbabilities[d.stage] ?? ((STAGES.findIndex(s => s.id === d.stage) + 1) * 20);
        weightedSum += val * (prob / 100);
      }
    }
    return {
      closedDealsTotalForForecast: closedSum,
      weightedPipelineValue: weightedSum,
      forecastValue: weightedSum + closedSum
    };
  }, [deals, customProbabilities]);

  const activeProperties = useMemo(() => properties.filter(p => p.status === 'disponível').length, [properties]);

  // Memoized action callbacks
  const handleToggleActivity = useCallback(async (activity: Activity) => {
    const newStatus = activity.status === 'pending' ? 'completed' : 'pending';
    await updateActivity(activity.id, { status: newStatus });
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    router.push(`/?tab=${tab}`);
  }, [router]);

  const handleOpenPipeline = useCallback(() => {
    router.push('/pipeline');
  }, [router]);

  const handleOpenDeal = useCallback((dealId: string) => {
    router.push(`/deals/${dealId}`);
  }, [router]);

  const handleRefreshAI = useCallback(() => {
    generateAIInsights(true);
  }, [generateAIInsights]);

  const handleReload = useCallback(() => {
    refreshData();
  }, [refreshData]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#090d16] text-white gap-6">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <TrendingUp className="w-6 h-6 text-primary animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-100 animate-pulse">Carregando o SalesScore...</p>
          <p className="text-xs text-slate-500 mt-2 select-none">Sincronizando ambiente seguro de negócios</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (loading && deals.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#090d16] text-white gap-6">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <TrendingUp className="w-6 h-6 text-primary animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-100 animate-pulse">Carregando o SalesScore...</p>
          <p className="text-xs text-slate-500 mt-2 select-none">Sincronizando ambiente seguro de negócios</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Header */}
        <header className="h-auto md:h-16 lg:h-18 bg-card/80 backdrop-blur-md border-b border-border px-3 sm:px-4 md:px-6 py-2.5 md:py-0 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-20 gap-2.5 md:gap-3">
          <div className="flex flex-col md:flex-row md:items-center gap-2.5 md:gap-8 flex-1">
            {/* Top row with Title, Greeting, Reload and Sound Button on Mobile */}
            <div className="flex items-center justify-between pl-11 sm:pl-12 md:pl-0 w-full md:w-auto">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex flex-col">
                  <h2 className="text-base md:text-lg font-black text-foreground shrink-0 leading-tight">Dashboard</h2>
                  <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider leading-none mt-0.5">Bem-vindo, {profile?.displayName?.split(' ')[0]}</p>
                </div>
                <button 
                  onClick={handleReload}
                  className="p-1.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-primary cursor-pointer"
                  title="Recarregar Dados"
                >
                  <TrendingUp className={cn("w-4 h-4", loading && "animate-pulse")} />
                </button>
              </div>

              {/* Mobile quick sound control */}
              <div className="flex items-center gap-2 md:hidden">
                <SoundControlButton />
              </div>
            </div>
            
            {errorStatus && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[9.5px] font-bold uppercase tracking-wider">
                <Info className="w-3 h-3" />
                {errorStatus}
              </div>
            )}
            
            <div className="w-full md:max-w-xs lg:max-w-sm relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="w-full bg-muted/50 border-none rounded-xl py-1.5 md:py-2 pl-9 pr-3 text-xs focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-border"
              />
            </div>

            <nav className="hidden xl:flex items-center gap-6 ml-2 h-full">
              {DASHBOARD_TABS.map((tab) => (
                <button 
                  key={tab} 
                  onClick={() => handleTabChange(tab)}
                  className={`text-xs font-bold transition-all relative py-5 md:py-5.5 ${activeTab === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="hidden md:flex items-center justify-end gap-3">
            <SoundControlButton />
          </div>
        </header>

        {/* Dashboard Content */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-3.5 sm:p-4 md:p-5 lg:p-6 space-y-4 md:space-y-5 max-w-[1700px] w-full mx-auto pb-16 md:pb-20"
          >
            {activeTab === 'Visão Geral' && (
              <>
                {/* Metrics Rows */}
                <MetricsSummary
                  itemVariants={ITEM_VARIANTS}
                  currentMonthRevenue={currentMonthRevenue}
                  revenueTrend={revenueTrend}
                  winRate={winRate}
                  winRateDetails={winRateDetails}
                  newLeads={newLeads}
                  leadsTrend={leadsTrend}
                  openDealsCount={openDeals.length}
                  activePropertiesCount={activeProperties}
                />

                {/* Stale Leads Rescue Widget */}
                {staleDeals.length > 0 && (
                  <motion.div
                    variants={ITEM_VARIANTS}
                    className="p-4 md:p-5 rounded-2xl md:rounded-3xl border border-amber-500/30 bg-amber-500/[0.04] shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5 animate-bounce" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm md:text-base font-bold text-foreground">
                              Atenção Comercial: {staleDeals.length} {staleDeals.length === 1 ? 'Lead Parado' : 'Leads Parados'}
                            </h4>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                              {formatCurrencyBRL(staleDealsValue, { maximumFractionDigits: 0 })} em risco
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Oportunidades sem contato há mais de 5 dias. Recupere estes clientes antes que desistam ou busquem outra imobiliária.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleOpenPipeline}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
                      >
                        Abrir Funil de Resgate
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {staleDeals.slice(0, 4).map(deal => {
                        const staleInfo = getDealStaleInfo(deal);
                        const contact = contactsMap.get(deal.contactId);
                        const rescueUrl = contact?.phone 
                          ? getWhatsAppRescueUrl(contact.phone, contact.name, deal.title)
                          : null;

                        return (
                          <div 
                            key={deal.id}
                            className="p-3 rounded-xl border border-border/80 bg-card hover:border-amber-500/40 transition-all flex flex-col justify-between gap-2 shadow-2xs"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className={cn(
                                  "text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md",
                                  staleInfo.severity === 'critical' 
                                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" 
                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                )}>
                                  {staleInfo.daysInactive}d sem contato
                                </span>
                                <span className="text-[10px] font-bold text-foreground">
                                  {formatCurrencyBRL(deal.value || 0, { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                              <p className="font-bold text-xs text-foreground line-clamp-1" title={deal.title}>
                                {deal.title}
                              </p>
                              <p className="text-[10.5px] text-muted-foreground truncate">
                                {contact?.name || 'Cliente sem nome'}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-1">
                              <button
                                onClick={() => handleOpenDeal(deal.id)}
                                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Ver detalhes
                              </button>
                              {rescueUrl ? (
                                <a
                                  href={rescueUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold flex items-center gap-1 transition-all"
                                  title="Enviar mensagem no WhatsApp"
                                >
                                  <MessageCircle className="w-2.5 h-2.5" />
                                  Resgatar
                                </a>
                              ) : (
                                <button
                                  onClick={() => handleOpenDeal(deal.id)}
                                  className="px-2 py-1 rounded-lg bg-muted text-muted-foreground text-[9.5px] font-bold"
                                >
                                  Sem telefone
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Main Grid: Pipeline Chart & Recent Activities */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                  <PipelineChart 
                    className="lg:col-span-2"
                    variants={ITEM_VARIANTS}
                    deals={deals}
                    goals={goals}
                    userId={user?.id}
                    currentMonthRevenue={currentMonthRevenue}
                    forecastValue={forecastValue}
                    customProbabilities={customProbabilities}
                    chartPeriod={chartPeriod}
                    onPeriodChange={setChartPeriod}
                  />

                  <RecentActivities 
                    className="lg:col-span-1"
                    variants={ITEM_VARIANTS}
                    activities={activities}
                    deals={deals}
                    onToggle={handleToggleActivity}
                  />
                </div>

                {/* Recent Deals Table with Complete Filtering & Actions */}
                <RecentDealsTable 
                  deals={deals}
                  contacts={contacts}
                  properties={properties}
                  users={users}
                  customProbabilities={customProbabilities}
                  profile={profile}
                  onDealsChange={setDeals}
                  onRefreshData={refreshData}
                  variants={ITEM_VARIANTS}
                />
              </>
            )}

            {activeTab === 'Equipe' && (
              <TeamView users={users} deals={deals} />
            )}

            {activeTab === 'Relatórios' && (
              <ReportsView 
                deals={deals} 
                contacts={contacts} 
                activities={activities}
                properties={properties}
                progressPercentage={progressPercentage} 
              />
            )}

            {activeTab === 'Previsões' && (
              <ForecastView 
                deals={deals} 
                goals={goals} 
                goalRevenue={goalRevenue} 
                progressPercentage={progressPercentage}
                customProbabilities={customProbabilities}
                aiInsights={aiInsights}
                loadingAI={loadingAI}
                onRefreshAI={handleRefreshAI}
                currentGoal={currentGoal}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
