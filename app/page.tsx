"use client";

/**
 * SalesScore CRM - Versão Estável Sincronizada
 * Build: 2026-05-10 v0.2.0 - Novo Leads corrigido para 1
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { Sidebar } from "@/components/sidebar";
import { 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  Search,
  HelpCircle,
  MoreHorizontal,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Plus,
  Calendar,
  Mail,
  Info,
  BarChart3,
  Target,
  Zap,
  Layers
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { 
  Deal, 
  Contact, 
  Goal, 
  subscribeToDeals, 
  subscribeToContacts, 
  subscribeToGoals,
  subscribeToActivities,
  subscribeToProperties,
  updateActivity,
  Activity,
  Property,
  UserProfile,
  getDeals,
  getContacts,
  getGoals,
  getProperties,
  subscribeToUsers
} from "@/lib/db";
import { safeAiCall } from "@/lib/ai";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Suspense } from "react";
import { IntelligenceWidget } from "@/components/IntelligenceWidget";

const STAGES = [
  { id: "lead", title: "Novo Lead", color: "blue" },
  { id: "qualification", title: "Qualificação / Visita", color: "purple" },
  { id: "proposal", title: "Proposta", color: "orange" },
  { id: "negotiation", title: "Análise Jurídica", color: "yellow" },
  { id: "closed", title: "Vendido / Alugado", color: "emerald" },
];

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
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState("Visão Geral");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [customProbabilities, setCustomProbabilities] = useState<Record<string, number>>({});
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Pequeno delay para garantir que containers Recharts tenham largura calculada
    const timer = setTimeout(() => setMounted(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // --- Calculations ---
  const now = useMemo(() => new Date(), []);
  const currentMonthStr = useMemo(() => format(now, "yyyy-MM"), [now]);
  const lastMonthDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), [now]);
  const lastMonthStr = useMemo(() => format(lastMonthDate, "yyyy-MM"), [lastMonthDate]);

  const currentGoal = useMemo(() => {
    const monthGoals = goals.filter(g => g.month === currentMonthStr);
    return monthGoals.find(g => g.ownerId === user?.id) || monthGoals[0];
  }, [goals, currentMonthStr, user]);

  const goalRevenue = useMemo(() => currentGoal?.stageGoals?.['closed'] || currentGoal?.revenue || 0, [currentGoal]);
  const closedDealsTotal = useMemo(() => deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + d.value, 0), [deals]);

  const refreshData = useCallback(async (showLoading = true) => {
    if (!user || !profile) return;
    if (showLoading) setLoading(true);
    setErrorStatus(null);
    try {
      const ownerId = profile.role === 'Admin' ? undefined : user.id;
      
      const [dealsData, contactsData, propertiesData, goalsData] = await Promise.all([
        getDeals(ownerId),
        getContacts(ownerId),
        getProperties(ownerId),
        getGoals(ownerId)
      ]);
      
      setDeals(dealsData);
      setContacts(contactsData);
      setProperties(propertiesData);
      setGoals(goalsData);
    } catch (err: any) {
      console.error("[Dashboard] Refresh error:", err);
      setErrorStatus(err.message || "Erro ao carregar dados.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    // Only call refreshData if we don't have data yet to avoid redundant loads
    // since the subscriptions will also fetch data initially.
    if (user && profile && deals.length === 0 && contacts.length === 0) {
      refreshData(true);
    }
  }, [user, profile, refreshData, deals.length, contacts.length]);

  const generateAIInsights = useCallback(async () => {
    setLoadingAI(true);
    const currentMonthStr = format(new Date(), "yyyy-MM");
    const currentGoal = goals.find(g => g.month === currentMonthStr && g.ownerId === user?.id) || 
                        goals.find(g => g.month === currentMonthStr);
    const goalRevenue = currentGoal?.stageGoals?.['closed'] || currentGoal?.revenue || 0;
    const closedDealsTotal = deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + d.value, 0);
    const totalPipelineValue = deals
      .filter(d => STAGES.some(s => s.id === d.stage && s.id !== 'closed'))
      .reduce((acc, d) => acc + d.value, 0);
    
    const weightedPipelineValue = deals
      .filter(d => d.stage !== 'closed')
      .reduce((acc, d) => {
        const prob = customProbabilities[d.stage] ?? (STAGES.findIndex(s => s.id === d.stage) + 1) * 20;
        return acc + (d.value * (prob / 100));
      }, 0);

    const forecastValue = weightedPipelineValue + closedDealsTotal;
    
    const stageCounts = STAGES.map(stage => ({
      name: stage.title,
      count: deals.filter(d => d.stage === stage.id).length,
      value: deals.filter(d => d.stage === stage.id).reduce((acc, d) => acc + d.value, 0),
    }));

    const prompt = `
      Analise os seguintes dados do CRM SalesScore e forneça um resumo executivo de previsões de vendas e recomendações estratégicas.
      Mês Atual: ${currentMonthStr}
      Objetivo de Receita: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(goalRevenue) || 0)}
      Vendas Realizadas (Closed): ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(closedDealsTotal) || 0)}
      Valor em Pipeline (Aberto): ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(totalPipelineValue) || 0)}
      Previsão Ponderada (Realista): ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(forecastValue) || 0)}

      Distribuição do Pipeline:
      ${stageCounts.map(s => `- ${s.name}: ${s.count} negócios, total ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(s.value) || 0)}`).join('\n')}

      Por favor, forneça:
      1. Uma avaliação da probabilidade de atingir a meta.
      2. Qual estágio do funil é o maior gargalo.
      3. Uma recomendação prática para fechar mais negócios.
      
      Responda em PORTUGUÊS, use tom profissional e direto. Use formatação em parágrafos curtos.
    `;

    const result = await safeAiCall(prompt, "Não foi possível gerar os insights agora. Tente novamente em alguns minutos.");
    setAiInsights(result.text);
    setLoadingAI(false);
  }, [goals, deals, customProbabilities, user?.id]);

  useEffect(() => {
    if (activeTab === 'Previsões' && deals.length > 0 && !aiInsights && !loadingAI) {
      generateAIInsights();
    }
  }, [activeTab, deals.length, aiInsights, loadingAI, generateAIInsights]);

  useEffect(() => {
    const loadProbabilities = () => {
      const saved = localStorage.getItem("pipeline_probabilities");
      if (saved) {
        setCustomProbabilities(JSON.parse(saved));
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
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['Visão Geral', 'Relatórios', 'Equipe', 'Previsões'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    // Trava de segurança: força o carregamento do painel após 5 segundos
    // para evitar que o usuário fique preso no "Carregando" caso o perfil demore a sincronizar
    const timer = setTimeout(() => {
      if (loading) {
        console.log("[Dashboard] Safety timeout (5s) triggered, forcing loading false");
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    console.log("[Dashboard] Auth State:", { authLoading, hasUser: !!user });
    if (!authLoading) {
      if (!user) {
        console.log("[Dashboard] Roteando para login...");
        router.push("/login");
      } else {
        // Stop showing generic loader if auth is done and user is here
        console.log("[Dashboard] Auth concluído, liberando interface.");
        setLoading(false);
      }
    }
  }, [user, authLoading, router, loading]);

  useEffect(() => {
    if (!user || !profile) return;

    // Safety timeout: force loading false if it takes too long
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 8000);

    // Subscriptions
    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsubDeals = subscribeToDeals((data) => {
      setDeals(data);
      setLoading(false);
      clearTimeout(safetyTimer);
    }, ownerId);
    
    const unsubContacts = subscribeToContacts(setContacts, ownerId);
    const unsubProperties = subscribeToProperties(setProperties, ownerId);
    
    const unsubGoals = subscribeToGoals((data) => {
      setGoals(data);
    }, ownerId);
    
    const unsubActivities = subscribeToActivities((data) => {
      setActivities(data);
    }, ownerId);

    // Fetch team members if Admin
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

  // Metric Data helper for Sparklines

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

  // Metric Data helper for Sparklines
  const getTrendData = (type: 'revenue' | 'leads' | 'deals') => {
    return Array.from({ length: 12 }).map((_, i) => ({
      value: Math.floor(Math.random() * 50) + 50
    }));
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Revenue
  const currentMonthRevenue = deals
    .filter(d => d.stage === 'closed' && d.updatedAt?.startsWith(currentMonthStr))
    .reduce((acc, d) => acc + d.value, 0);

  const lastMonthRevenue = deals
    .filter(d => d.stage === 'closed' && d.updatedAt?.startsWith(lastMonthStr))
    .reduce((acc, d) => acc + d.value, 0);

  const revenueTrend = lastMonthRevenue > 0 
    ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
    : 100;

  // Win Rate (Conversion Rate)
  // We only count deals that are actually in one of the pipeline stages
  const validDeals = deals.filter(d => STAGES.some(s => s.id === d.stage));
  const totalDealsFinished = validDeals.filter(d => d.stage === 'closed').length;
  const winRate = validDeals.length > 0 ? (totalDealsFinished / validDeals.length) * 100 : 0;
  const winRateDetails = `${totalDealsFinished} de ${validDeals.length} negócios`;

  // progressPercentage - Use monthly revenue for monthly goal
  const progressPercentage = goalRevenue > 0 ? Math.round((currentMonthRevenue / goalRevenue) * 100) : 0;

  // New Leads (Deals in Novo Lead stage created this month) - Force Sync trigger
  // We use deals instead of contacts as it aligns better with the pipeline view
  const currentMonthDeals = deals.filter(d => d.createdAt?.startsWith(currentMonthStr));
  const newLeads = currentMonthDeals.filter(d => d.stage === 'lead').length;
  const lastMonthDeals = deals.filter(d => d.createdAt?.startsWith(lastMonthStr));
  const lastMonthLeads = lastMonthDeals.filter(d => d.stage === 'lead').length;
  const leadsTrend = lastMonthLeads > 0 ? ((newLeads - lastMonthLeads) / lastMonthLeads) * 100 : (newLeads > 0 ? 100 : 0);

  // Open Deals
  const openDeals = deals.filter(d => d.stage !== 'closed');

  // Forecast Calculation (Weighted by custom probabilities)
  const closedDealsTotalForForecast = deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + d.value, 0);
  
  const weightedPipelineValue = deals
    .filter(d => d.stage !== 'closed')
    .reduce((acc, d) => {
      const prob = customProbabilities[d.stage] ?? (STAGES.findIndex(s => s.id === d.stage) + 1) * 20;
      return acc + (d.value * (prob / 100));
    }, 0);

  const forecastValue = weightedPipelineValue + closedDealsTotalForForecast;
  
  // Properties Available
  const activeProperties = properties.filter(p => p.status === 'disponível').length;

  // Chart Data (Last 6 months)
  const chartData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const mStr = format(d, "yyyy-MM");
    const mLabel = format(d, "MMM").toUpperCase();
    
    const monthlyActual = deals
      .filter(deal => deal.stage === 'closed' && deal.updatedAt?.startsWith(mStr))
      .reduce((acc, deal) => acc + deal.value, 0);
    
    // Projected could be from Goal
    const monthGoals = goals.filter(g => g.month === mStr);
    const monthGoal = monthGoals.find(g => g.ownerId === user?.id) || monthGoals[0];
    const monthlyProjected = monthGoal?.stageGoals?.['closed'] || 0;

    return { name: mLabel, actual: monthlyActual, projected: monthlyProjected };
  });

  // Recent Deals (limit 4)
  const displayRecentDeals = [...deals]
    .sort((a, b) => (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime()))
    .slice(0, 4)
    .map(d => {
      const stage = STAGES.find(s => s.id === d.stage);
      return {
        id: d.id,
        account: d.title,
        initials: d.title.substring(0, 2).toUpperCase(),
        value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(d.value) || 0),
        stage: stage?.title || d.stage,
        color: stage?.color || 'slate',
        date: d.updatedAt ? format(new Date(d.updatedAt), "MMM dd, yyyy") : '-',
        probability: customProbabilities[d.stage] ?? (d.stage === 'closed' ? 100 : (STAGES.findIndex(s => s.id === d.stage) + 1) * 20)
      };
    });

  const handleToggleActivity = async (activity: Activity) => {
    const newStatus = activity.status === 'pending' ? 'completed' : 'pending';
    await updateActivity(activity.id, { status: newStatus });
  };

  // Activities (Using real activities)
  const displayActivities = [...activities]
    .sort((a, b) => {
      // Prioritize pending
      if (a.status === 'pending' && b.status === 'completed') return -1;
      if (a.status === 'completed' && b.status === 'pending') return 1;
      // Then by date ascending (for pending) or descending (for completed)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
    .slice(0, 4) // Show up to 4
    .map(a => {
      return {
        id: a.id,
        raw: a,
        date: format(new Date(a.date), "dd MMM", { locale: ptBR }).toUpperCase(),
        title: a.title,
        time: format(new Date(a.date), "HH:mm"),
        statusLabel: a.status === 'completed' ? 'Concluída' : 'Pendente',
        isCompleted: a.status === 'completed',
        type: a.type
      };
    });

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Header */}
        <header className="h-auto md:h-24 bg-card/80 backdrop-blur-md border-b border-border px-4 md:px-8 py-4 md:py-0 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-20 gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-12 flex-1">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <h2 className="text-lg md:text-xl font-bold text-foreground shrink-0">Dashboard</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Bem-vindo, {profile?.displayName?.split(' ')[0]}</p>
              </div>
              <button 
                onClick={() => refreshData()}
                className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                title="Recarregar Dados"
              >
                <TrendingUp className={cn("w-5 h-5", loading && "animate-pulse")} />
              </button>
            </div>
            
            {errorStatus && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-widest">
                <Info className="w-3 h-3" />
                {errorStatus}
              </div>
            )}
            
            <div className="w-full md:max-w-md relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="w-full bg-muted/50 border-none rounded-2xl py-2.5 md:py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-border"
              />
            </div>

            <nav className="hidden xl:flex items-center gap-8 ml-4 h-full">
              {['Visão Geral', 'Relatórios', 'Equipe', 'Previsões'].map((tab) => (
                <button 
                  key={tab} 
                  onClick={() => {
                    setActiveTab(tab);
                    router.push(`/?tab=${tab}`);
                  }}
                  className={`text-sm font-bold transition-all relative py-9 ${activeTab === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full"
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-border">
            {/* Notifications removed as per user request */}
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
            className="p-4 md:p-8 lg:p-10 space-y-6 md:space-y-10"
          >
            {activeTab === 'Visão Geral' && (
              <>
                {/* Metrics Rows */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
                  <MetricCard 
                    variants={itemVariants}
                    title="RECEITA MENSAL" 
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(currentMonthRevenue) || 0)} 
                    trend={`${revenueTrend > 0 ? '+' : ''}${revenueTrend.toFixed(1)}% vs mês ant.`}
                    description="Valor total faturado este mês com imóveis vendidos ou alugados. Reflete o desempenho financeiro direto do período atual."
                    isPositive={revenueTrend >= 0}
                    chartData={getTrendData('revenue')}
                  />
                  <MetricCard 
                    variants={itemVariants}
                    title="TAXA DE CONVERSÃO" 
                    value={`${winRate.toFixed(1)}%`} 
                    trend={winRateDetails}
                    description="Percentual de fechamentos bem-sucedidos em relação ao volume total de oportunidades. Indica a eficiência do seu processo comercial."
                    isPositive={winRate > 15}
                    chartData={getTrendData('revenue').reverse()}
                  />
                  <MetricCard 
                    variants={itemVariants}
                    title="NOVOS LEADS" 
                    value={newLeads.toString()} 
                    trend={`${leadsTrend > 0 ? '+' : ''}${leadsTrend.toFixed(1)}% vs mês ant.`}
                    description="Novos clientes potenciais e negócios que entraram no pipeline este mês. Mede a eficácia das suas ações de prospecção."
                    isPositive={leadsTrend >= 0}
                    chartData={getTrendData('leads')}
                  />
                  <MetricCard 
                    variants={itemVariants}
                    title="NEGÓCIOS ABERTOS" 
                    value={openDeals.length.toString()} 
                    trend={`Fluxo total ativo`}
                    description="Negociações em andamento em todas as fases do funil. Representa o volume de trabalho e oportunidades de receita futura."
                    isPositive={true}
                    isNeutral={true}
                    chartData={getTrendData('deals')}
                  />
                  <MetricCard 
                    variants={itemVariants}
                    title="IMÓVEIS DISPONÍVEIS" 
                    value={activeProperties.toString()} 
                    trend={`Total em portfólio`}
                    description="Unidades prontas para comercialização em seu inventário. Um portfólio atualizado é essencial para gerar novas oportunidades."
                    isPositive={true}
                    isNeutral={true}
                    chartData={getTrendData('leads').reverse()}
                  />
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  {/* Chart Column */}
                  <motion.div 
                    variants={itemVariants}
                    className="lg:col-span-2 bg-card rounded-[32px] md:rounded-[40px] border border-border p-6 md:p-10 shadow-sm relative overflow-hidden card-hover"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 md:mb-10 gap-4">
                      <div className="text-left">
                        <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Análise de Performance</h3>
                        <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2">Vendas e previsões atuais.</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button className="px-3 md:px-4 py-2 bg-muted text-[10px] font-bold uppercase tracking-widest text-muted-foreground rounded-xl hover:bg-muted/80 transition-colors">Semanal</button>
                        <button className="px-3 md:px-4 py-2 bg-primary/10 text-[10px] font-bold uppercase tracking-widest text-primary rounded-xl">Mensal</button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10 mb-8 md:mb-10 border-b border-border pb-8 md:pb-10">
                      <div>
                        <div className="flex items-center gap-2 mb-1 md:mb-2">
                          <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-primary shadow-lg shadow-primary/40" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Receita Real</span>
                        </div>
                        <p className="text-2xl md:text-3xl font-light text-foreground tracking-tighter">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(currentMonthRevenue) || 0)}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 md:mb-2">
                          <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-border" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Previsão</span>
                          <div className="relative group/info">
                            <HelpCircle className="w-3 h-3 cursor-help text-muted-foreground opacity-50 hover:opacity-100 transition-opacity" />
                            <div className="absolute right-0 top-full mt-2 w-64 p-3.5 bg-slate-900 dark:bg-slate-950 text-white text-[11px] rounded-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all duration-200 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-800 dark:border-slate-800/80 font-medium leading-relaxed normal-case tracking-normal -translate-y-1 group-hover/info:translate-y-0">
                              Previsão baseada em 20% do valor total das negociações em aberto + 100% dos negócios já fechados no mês.
                            </div>
                          </div>
                        </div>
                        <p className="text-2xl md:text-3xl font-light text-foreground tracking-tighter">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(forecastValue) || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="h-[250px] md:h-[350px] w-full min-h-[250px]">
                      {mounted && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                              dy={15}
                            />
                            <YAxis hide />
                            <Tooltip 
                              cursor={{ fill: 'rgba(59, 130, 246, 0.03)' }}
                              wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/50 relative z-50">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-2">{payload[0].payload.name}</p>
                                      <div className="space-y-1">
                                        <div className="flex justify-between gap-6">
                                          <span className="text-xs text-slate-300">Realizado:</span>
                                          <span className="text-xs font-bold text-blue-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(payload[1].value) || 0)}</span>
                                        </div>
                                        <div className="flex justify-between gap-6">
                                          <span className="text-xs text-slate-300">Objetivo:</span>
                                          <span className="text-xs font-bold text-slate-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(payload[0].value) || 0)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="projected" fill="#F1F5F9" radius={[12, 12, 12, 12]} barSize={32} />
                            <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[12, 12, 12, 12]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </motion.div>

                  {/* Activities Column: Intelligence Widget */}
                  <motion.div variants={itemVariants}>
                    <IntelligenceWidget 
                      activities={activities} 
                      deals={deals} 
                      onToggle={handleToggleActivity}
                    />
                  </motion.div>
                </div>

                {/* Recent Deals Table */}
                <motion.div 
                  variants={itemVariants}
                  className="bg-card rounded-[32px] md:rounded-[40px] border border-border p-6 md:p-10 shadow-sm overflow-hidden card-hover"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 md:mb-10 gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 text-primary rounded-xl md:rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Negócios Recentes</h3>
                        <p className="text-xs md:text-sm text-muted-foreground">Últimas movimentações</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2.5 bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 transition-all">
                        <Filter className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => router.push("/pipeline")}
                        className="flex-1 sm:flex-none px-6 md:px-8 py-2.5 md:py-3 bg-primary text-white rounded-xl md:rounded-2xl text-[10px] font-bold shadow-xl shadow-primary/20 hover:opacity-90 transition-all font-sans uppercase tracking-widest"
                      >
                        Pipeline
                      </button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto -mx-6 md:-mx-10 px-6 md:px-10">
                    <table className="w-full border-separate border-spacing-y-4">
                      <thead>
                        <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] text-left">
                          <th className="px-6 pb-2">Empresa / Projeto</th>
                          <th className="px-6 pb-2">Valor</th>
                          <th className="px-6 pb-2">Fase Atual</th>
                          <th className="px-6 pb-2">Score</th>
                          <th className="px-6 pb-2 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="">
                        {displayRecentDeals.length > 0 ? displayRecentDeals.map((deal) => (
                          <tr key={deal.id} className="group cursor-pointer" onClick={() => router.push("/pipeline")}>
                            <td className="px-6 py-6 bg-muted/30 group-hover:bg-card border-y border-l border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-lg transition-all rounded-l-[28px]">
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-bold bg-background text-primary shadow-sm`}>
                                  {deal.initials}
                                </div>
                                <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors uppercase tracking-tight">{deal.account}</span>
                              </div>
                            </td>
                            <td className="px-6 py-6 bg-muted/30 group-hover:bg-card border-y border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-lg transition-all">
                              <span className="text-sm font-bold text-foreground">{deal.value}</span>
                            </td>
                            <td className="px-6 py-6 bg-muted/30 group-hover:bg-card border-y border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-lg transition-all">
                              <span className={cn(
                                "inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset",
                                deal.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20" :
                                deal.color === 'blue' ? "bg-primary/10 text-primary ring-primary/20" :
                                deal.color === 'purple' ? "bg-purple-500/10 text-purple-500 ring-purple-500/20" :
                                deal.color === 'orange' ? "bg-orange-500/10 text-orange-500 ring-orange-500/20" :
                                "bg-yellow-500/10 text-yellow-500 ring-yellow-500/20"
                              )}>
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full animate-pulse",
                                  deal.color === 'emerald' ? "bg-emerald-500" :
                                  deal.color === 'blue' ? "bg-primary" :
                                  deal.color === 'purple' ? "bg-purple-500" :
                                  deal.color === 'orange' ? "bg-orange-500" :
                                  "bg-yellow-500"
                                )} />
                                {deal.stage}
                              </span>
                            </td>
                            <td className="px-6 py-6 bg-muted/30 group-hover:bg-card border-y border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-lg transition-all">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-muted-foreground w-8">{deal.probability}%</span>
                                <div className="h-1.5 w-24 bg-background rounded-full overflow-hidden shadow-inner ring-1 ring-border">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${deal.probability}%` }}
                                    className={cn(
                                      "h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(var(--primary),0.5)]",
                                      deal.color === 'emerald' ? "bg-emerald-500 shadow-emerald-500/50" : "bg-primary"
                                    )} 
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6 bg-muted/30 group-hover:bg-card border-y border-r border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-lg transition-all rounded-r-[28px] text-right">
                              <button className="p-3 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100">
                                < MoreHorizontal className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-muted-foreground font-medium text-sm">
                              Nenhum negócio encontrado recentemente.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </>
            )}

            {activeTab === 'Equipe' && (
              <TeamView users={users} deals={deals} />
            )}

            {activeTab === 'Relatórios' && (
              <ReportsView deals={deals} contacts={contacts} progressPercentage={progressPercentage} />
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
                onRefreshAI={generateAIInsights}
                currentGoal={currentGoal}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Floating Action Button */}
        <button 
          onClick={() => router.push("/pipeline")}
          className="fixed bottom-6 right-6 md:bottom-12 md:right-12 bg-slate-900 text-white p-4 md:p-6 rounded-2xl md:rounded-[32px] shadow-2xl hover:scale-110 active:scale-95 transition-all z-30 flex items-center gap-3 md:gap-4 group ring-2 md:ring-4 ring-white"
        >
          <div className="w-7 h-7 md:w-8 md:h-8 bg-primary rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-primary/40">
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 font-bold uppercase tracking-widest text-[9px] md:text-[10px] whitespace-nowrap">Novo Lead</span>
        </button>
      </main>
    </div>
  );
}

function TeamView({ users, deals }: { users: UserProfile[], deals: Deal[] }) {
  const getAgentPerformance = (userId: string) => {
    const agentDeals = deals.filter(d => d.ownerId === userId);
    const closed = agentDeals.filter(d => d.stage === 'closed');
    const totalValue = closed.reduce((acc, d) => acc + d.value, 0);
    const winRate = agentDeals.length > 0 ? (closed.length / agentDeals.length) * 100 : 0;
    
    return {
      totalValue,
      count: closed.length,
      winRate,
      active: agentDeals.filter(d => d.stage !== 'closed').length
    };
  };

  const agents = users
    .filter(u => u.role === 'Membro' || u.role === 'Admin')
    .map(u => ({
      ...u,
      stats: getAgentPerformance(u.id)
    }))
    .sort((a, b) => b.stats.totalValue - a.stats.totalValue);

  return (
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card p-8 rounded-[32px] border border-border shadow-sm card-hover">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Média de Vendas/Agente</p>
          <p className="text-2xl font-light text-foreground tracking-tighter">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(
              Number(agents.reduce((acc, a) => acc + a.stats.totalValue, 0) / (agents.length || 1)) || 0
            )}
          </p>
        </div>
        <div className="bg-card p-8 rounded-[32px] border border-border shadow-sm card-hover">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Melhor Performance</p>
          <p className="text-2xl font-light text-foreground tracking-tighter truncate">
            {agents[0]?.displayName || '-'}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-[32px] md:rounded-[40px] border border-border shadow-sm overflow-hidden card-hover">
        <div className="p-10 border-b border-border">
          <h3 className="text-2xl font-bold text-foreground tracking-tight">Performance da Equipe</h3>
        </div>
        <div className="overflow-x-auto px-4 md:px-0">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-left">
                <th className="px-10 py-6 border-b border-border">Membro</th>
                <th className="px-10 py-6 border-b border-border">Vendas Totais</th>
                <th className="px-10 py-6 border-b border-border">Negócios Fechados</th>
                <th className="px-10 py-6 border-b border-border">Taxa de Conversão</th>
                <th className="px-10 py-6 border-b border-border">Ativos</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="group hover:bg-muted/50 transition-colors">
                  <td className="px-10 py-6 border-b border-border">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shadow-sm shadow-primary/5 overflow-hidden relative">
                        {agent.photoURL ? <Image src={agent.photoURL} alt="" fill className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : agent.displayName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{agent.displayName}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{agent.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 border-b border-border">
                    <p className="text-sm font-bold text-foreground">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(agent.stats.totalValue) || 0)}
                    </p>
                  </td>
                  <td className="px-10 py-6 border-b border-border text-sm font-medium text-muted-foreground">{agent.stats.count}</td>
                  <td className="px-10 py-6 border-b border-border">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-foreground">{agent.stats.winRate.toFixed(1)}%</span>
                      <div className="h-1 w-20 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${agent.stats.winRate}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 border-b border-border">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-bold uppercase tracking-widest ring-1 ring-primary/10">
                      {agent.stats.active} ativos
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ForecastView({ 
  deals, 
  goals, 
  goalRevenue, 
  progressPercentage,
  customProbabilities,
  aiInsights,
  loadingAI,
  onRefreshAI,
  currentGoal
}: { 
  deals: Deal[], 
  goals: Goal[], 
  goalRevenue: number, 
  progressPercentage: number,
  customProbabilities: Record<string, number>,
  aiInsights: string | null,
  loadingAI: boolean,
  onRefreshAI: () => void,
  currentGoal?: Goal
}) {
  const closedDealsTotal = deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + d.value, 0);
  const totalPipelineValue = deals
    .filter(d => STAGES.some(s => s.id === d.stage && s.id !== 'closed'))
    .reduce((acc, d) => acc + d.value, 0);

  const weightedPipelineValue = deals
    .filter(d => d.stage !== 'closed')
    .reduce((acc, d) => {
      const prob = customProbabilities[d.stage] ?? (STAGES.findIndex(s => s.id === d.stage) + 1) * 20;
      return acc + (d.value * (prob / 100));
    }, 0);

  const forecastValue = weightedPipelineValue + closedDealsTotal;
  
  const stageCounts = STAGES.map(stage => ({
    name: stage.title,
    count: deals.filter(d => d.stage === stage.id).length,
    value: deals.filter(d => d.stage === stage.id).reduce((acc, d) => acc + d.value, 0),
    goal: currentGoal?.stageGoals?.[stage.id] || 0,
    color: stage.color
  }));

  return (
    <div className="space-y-10 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-card rounded-[40px] border border-border p-10 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 pointer-events-none">
              <Layers className="w-64 h-64" />
            </div>

            <div className="flex items-center justify-between mb-10 relative z-20">
              <div>
                <h3 className="text-2xl font-bold text-foreground tracking-tight">Funil de Vendas</h3>
                <p className="text-sm text-muted-foreground mt-1">Sua pipeline ativa distribuída por estágio.</p>
              </div>
              <div className="text-right group relative">
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Valor Total Pipeline</p>
                  <div className="cursor-help text-muted-foreground/30 hover:text-primary transition-colors">
                    <Info className="w-3 h-3" />
                    <div className="absolute right-0 top-full mt-2 w-64 p-3.5 bg-slate-900 dark:bg-slate-950 text-white text-[11px] rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-800 dark:border-slate-800/80 font-medium normal-case tracking-normal translate-y-1 group-hover:translate-y-0">
                      <p className="leading-relaxed">Valor bruto de todos os negócios que estão ativos no seu funil, sem considerar a probabilidade de fechamento.</p>
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-light text-foreground tracking-tighter">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(totalPipelineValue) || 0)}
                </p>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              {stageCounts.map((stage, idx) => {
                const progressByValue = stage.goal > 0 
                  ? (stage.value / stage.goal) * 100 
                  : (totalPipelineValue > 0 ? (stage.value / totalPipelineValue) * 100 : 0);
                
                const visualProgress = stage.value > 0 ? Math.max(2, Math.min(100, progressByValue)) : 0;

                return (
                  <div key={stage.name} className="relative group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          stage.color === 'blue' ? "bg-primary" :
                          stage.color === 'purple' ? "bg-purple-600" :
                          stage.color === 'orange' ? "bg-orange-600" :
                          stage.color === 'yellow' ? "bg-yellow-600" : "bg-emerald-600"
                        )} />
                        <span className="text-sm font-bold text-foreground">{stage.name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-2">
                          {stage.count} {stage.count === 1 ? 'negócio' : 'negócios'}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-foreground">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(stage.value) || 0)}
                        </p>
                        {stage.goal > 0 && (
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(stage.goal) || 0)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="h-4 bg-muted rounded-full overflow-hidden shadow-inner ring-1 ring-border p-0.5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${visualProgress}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          stage.color === 'blue' ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]" :
                          stage.color === 'purple' ? "bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.4)]" :
                          stage.color === 'orange' ? "bg-orange-600 shadow-[0_0_8px_rgba(234,88,12,0.4)]" :
                          stage.color === 'yellow' ? "bg-yellow-600 shadow-[0_0_8px_rgba(202,138,4,0.4)]" : 
                          "bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.4)]"
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card rounded-[40px] border border-border p-10 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Insights de IA</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Análise Estratégica do Pipeline</p>
                </div>
              </div>
              <button 
                onClick={onRefreshAI}
                disabled={loadingAI}
                className="p-3 bg-muted hover:bg-muted-foreground/10 text-muted-foreground rounded-xl transition-all disabled:opacity-50"
              >
                <div className={cn(loadingAI && "animate-spin")}>
                  <Clock className="w-5 h-5" />
                </div>
              </button>
            </div>

            <div className="min-h-[150px] relative">
              {loadingAI ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Inteligência Artificial processando...</p>
                </div>
              ) : aiInsights ? (
                <div className="space-y-4 text-sm leading-relaxed text-muted-foreground font-medium">
                  {aiInsights.split('\n').map((para, i) => para.trim() ? (
                    <p key={i}>{para}</p>
                  ) : null)}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-sm text-muted-foreground italic">Clique no ícone de relógio para gerar novas previsões baseadas no estado atual dos negócios.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 p-10 opacity-10">
            <TrendingUp className="w-40 h-40" />
          </div>
          
          <div className="relative z-10 flex-1">
            <h3 className="text-xl font-bold tracking-tight mb-8">Meta Mensal</h3>
            
            <div className="mb-12">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Progresso Geral (Valor)</p>
              <div className="flex items-baseline gap-2 mb-4">
                <p className="text-4xl font-light tracking-tighter">
                  {progressPercentage}%
                </p>
                <span className="text-slate-400 text-sm font-medium">realizado</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, progressPercentage)}%` }}
                  className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(var(--color-primary),0.6)]"
                />
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Objetivo:</span>
                <span className="text-xs font-bold text-white">
                   {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(goalRevenue) || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-8 pt-10 border-t border-white/10 mt-auto">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Previsão Realista</p>
                  <div className="flex items-center gap-3">
                    <div className="group relative">
                      <div className="cursor-help text-slate-500 hover:text-emerald-500 transition-colors">
                        <Info className="w-3.5 h-3.5" />
                        <div className="absolute right-0 top-full mt-2 w-64 p-5 bg-slate-800 text-white text-[10px] rounded-[24px] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 shadow-2xl border border-white/10 font-medium normal-case tracking-normal backdrop-blur-xl translate-y-1 group-hover:translate-y-0">
                          <p className="font-bold mb-3 uppercase tracking-widest text-emerald-400 border-b border-white/10 pb-2 flex items-center gap-2">
                            <Layers className="w-3 h-3" />
                            Equação do Momento
                          </p>
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                              <span className="text-slate-400">Realizado (100%):</span>
                              <span className="font-bold font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(closedDealsTotal) || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                              <span className="text-slate-400">Ponderado (Pipeline):</span>
                              <span className="font-bold font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(weightedPipelineValue) || 0)}</span>
                            </div>
                            <div className="h-px bg-white/10 my-1"></div>
                            <div className="flex justify-between items-center text-[11px] px-1">
                              <span className="font-bold text-emerald-400">Previsão Final:</span>
                              <span className="font-bold text-emerald-400 font-mono italic">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(forecastValue) || 0)}</span>
                            </div>
                          </div>
                          <p className="mt-4 text-[9px] text-slate-500 leading-tight">
                            * O valor ponderado é a soma de cada negócio multiplicado pela probabilidade de fechamento do seu respectivo estágio.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="w-8 h-8 bg-emerald-500/20 text-emerald-500 rounded-lg flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <p className="text-3xl font-light tracking-tighter mb-2">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(forecastValue) || 0)}
                </p>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                  Cálculo baseado no fechamento atual somado à probabilidade de conversão ponderada de cada estágio do funil.
                </p>
              </div>

              <div className="bg-white/5 rounded-[24px] p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-blue-500/20 text-blue-500 rounded-lg flex items-center justify-center">
                    <Target className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status da Meta</span>
                </div>
                <p className="text-sm font-medium leading-relaxed">
                  {progressPercentage >= 100 
                    ? "Meta atingida! Excelente trabalho! Sua previsão indica que você pode superar o objetivo em mais de " + 
                      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Math.max(0, (Number(forecastValue) || 0) - (Number(goalRevenue) || 0))) + "."
                    : "Você ainda tem " + (100 - progressPercentage) + "% para atingir seu objetivo. Foque nos estágios de negociação final para acelerar o fechamento."
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CustomRevenueTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-[#0c1020] text-foreground px-4 py-2.5 border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl shadow-2xl relative z-50">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold text-foreground mt-1">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-[#0c1020] border border-[#e2e8f0] dark:border-[#1e293b] text-foreground md:min-w-[150px] shadow-2xl p-2.5 rounded-2xl flex flex-col gap-1 relative z-50">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
          <span className="text-xs font-bold text-foreground tracking-wider uppercase">{data.name}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Negócios: <span className="font-bold text-foreground">{data.value}</span>
        </p>
      </div>
    );
  }
  return null;
};

function ReportsView({ deals, contacts, progressPercentage }: { deals: Deal[], contacts: Contact[], progressPercentage: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Define color mapping for the chart to match STAGES colors
  const STAGE_COLORS: Record<string, string> = {
    blue: 'hsl(var(--primary))',
    purple: '#7C3AED',
    orange: '#EA580C',
    yellow: '#F59E0B',
    emerald: '#10B981',
    slate: '#64748B'
  };

  const getMonthlyRevenue = () => {
    const months = Array.from({ length: 6 }).map((_, i) => {
      const d = subMonths(new Date(), 5 - i);
      return {
        name: format(d, "MMM", { locale: ptBR }).replace(/^./, (str) => str.toUpperCase()),
        monthKey: format(d, "yyyy-MM"),
        revenue: 0,
        deals: 0
      };
    });

    deals.forEach(deal => {
      if (deal.stage === 'closed' && deal.updatedAt) {
        try {
          const date = new Date(deal.updatedAt);
          if (date) {
            const key = format(date, "yyyy-MM");
            const month = months.find(m => m.monthKey === key);
            if (month) {
              month.revenue += deal.value || 0;
              month.deals += 1;
            }
          }
        } catch (e) {
          // Skip errors
        }
      }
    });
    return months;
  };

  const salesData = getMonthlyRevenue();
  
  // Dynamic stage distribution based on STAGES
  const stageData = STAGES.map(stage => ({
    name: stage.title,
    id: stage.id,
    color: STAGE_COLORS[stage.color] || STAGE_COLORS.slate,
    value: deals.filter(d => d.stage === stage.id).length
  })).filter(s => s.value > 0);

  // Filter deals to only include those in defined stages for the total count
  const validDeals = deals.filter(d => STAGES.some(s => s.id === d.stage));
  const closedDeals = validDeals.filter(d => d.stage === 'closed');
  const totalRevenue = closedDeals.reduce((acc, d) => acc + (d.value || 0), 0);
  const avgTicket = totalRevenue / (closedDeals.length || 1);
  const winRate = (closedDeals.length / (validDeals.length || 1)) * 100;
  
  // Pipeline Ativo: sum of deals in any stage except 'closed' (and only from valid STAGES)
  const activePipelineValue = validDeals
    .filter(d => d.stage !== 'closed')
    .reduce((acc, d) => acc + (d.value || 0), 0);

  return (
    <div className="space-y-10 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Faturamento Acumulado" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(totalRevenue) || 0)} 
          trend="+12.5% vs histórico"
          isPositive={true}
          description="Total gerado em negócios fechados."
          chartData={salesData.map(s => ({ value: s.revenue }))}
        />
        <MetricCard 
          title="Ticket Médio" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(avgTicket) || 0)} 
          trend="Equilíbrio de Vendas"
          isPositive={true}
          isNeutral={true}
          description="Valor médio por venda fechada."
          chartData={salesData.map(s => ({ value: s.deals }))}
        />
        <MetricCard 
          title="Taxa de Conversão" 
          value={`${winRate.toFixed(1)}%`} 
          trend="Eficiência do Funil"
          isPositive={winRate > 15}
          description="Porcentagem de leads que chegam ao status final."
          chartData={Array.from({ length: 12 }).map((_, i) => ({ value: 50 + Math.random() * 50 }))}
        />
        <MetricCard 
          title="Pipeline Ativo" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(activePipelineValue) || 0)} 
          trend="Oportunidades em aberto"
          isPositive={true}
          isNeutral={true}
          description="Valor total estacionado no funil (exceto vendidos)."
          chartData={Array.from({ length: 12 }).map((_, i) => ({ value: 50 + Math.random() * 50 }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-card rounded-[40px] border border-border p-10 shadow-sm">
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-foreground tracking-tight">Fluxo de Receita</h3>
            <p className="text-sm text-muted-foreground mt-1">Sazonalidade das vendas (últimos 6 meses).</p>
          </div>
          <div className="h-[350px] w-full min-h-[350px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }}
                    dy={15}
                  />
                  <YAxis hide />
                  <Tooltip 
                    content={<CustomRevenueTooltip />}
                    wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card rounded-[40px] border border-border p-10 shadow-sm flex flex-col items-center justify-center">
          <div className="mb-8 w-full text-center">
            <h3 className="text-xl font-bold text-foreground tracking-tight">Fases do Funil</h3>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-bold">Distribuição por Status</p>
          </div>
          <div className="h-[280px] w-full relative min-h-[280px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {stageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<CustomPieTooltip />}
                    wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-foreground">{validDeals.length}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Negócios</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 justify-center">
            {stageData.map((stage, i) => (
              <div key={stage.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stage.name}</span>
                <span className="text-[10px] font-bold text-muted-foreground/50 ml-0.5">{stage.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-card rounded-[40px] border border-border p-10 shadow-sm">
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-foreground tracking-tight">Saúde da Carteira</h3>
            <p className="text-sm text-muted-foreground mt-1">Eficiência multidimensional.</p>
          </div>
          <div className="h-[350px] w-full min-h-[350px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={[
                  { subject: 'Volume', A: winRate },
                  { subject: 'Ticket', A: Math.min((avgTicket/100000)*100, 100) },
                  { subject: 'Velocidade', A: 80 },
                  { subject: 'Retenção', A: 70 },
                  { subject: 'Meta', A: progressPercentage },
                ]}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} />
                  <Radar
                    name="Enterprise"
                    dataKey="A"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.1}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card rounded-[40px] border border-border p-10 shadow-sm">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
               <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground tracking-tight">Performance Proativa</h3>
              <p className="text-sm text-muted-foreground">Acompanhamento vs Objetivos.</p>
            </div>
          </div>
          
          <div className="space-y-8">
            {['Volume de Leads', 'Vendas Diretas', 'Faturamento', 'Retorno ROI'].map((item, i) => {
              const val = [85, 40, 65, 30][i];
              return (
                <div key={item} className="space-y-3">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span>{item}</span>
                    <span className={val > 50 ? 'text-emerald-500' : 'text-blue-500'}>{val}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${val}%` }}
                      className={cn("h-full rounded-full", val > 50 ? "bg-emerald-500" : "bg-primary")}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend, description, isNeutral, isPositive, chartData, variants }: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <motion.div 
      variants={variants}
      className="bg-card p-5 md:p-8 pb-4 rounded-[28px] md:rounded-[36px] border border-border shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all group relative h-full flex flex-col hover:z-30"
    >
      <div className="relative z-10 flex-1">
        <div className="flex items-start justify-between mb-1 md:mb-2 text-muted-foreground group-hover:text-primary transition-colors">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em]">{title}</p>
          {description && (
            <div className="relative group/info">
              <HelpCircle className="w-3 h-3 cursor-help opacity-40 hover:opacity-100 transition-opacity" />
              <div className="absolute right-0 top-full mt-2 w-64 p-3.5 bg-slate-900 dark:bg-slate-950 text-white text-[11px] rounded-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all duration-200 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-800 dark:border-slate-800/80 font-medium leading-relaxed normal-case tracking-normal -translate-y-1 group-hover/info:translate-y-0">
                {description}
              </div>
            </div>
          )}
        </div>
        <p className="text-2xl md:text-3xl font-light text-foreground tracking-tighter group-hover:text-primary transition-colors leading-none">{value}</p>
        
        <div className="mt-3 md:mt-4 flex items-center gap-2">
          {isNeutral ? (
            <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
              <Plus className="w-2.5 h-2.5" />
            </div>
          ) : isPositive ? (
            <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
               <ArrowUpRight className="w-2.5 h-2.5" />
            </div>
          ) : (
            <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg">
               <ArrowDownRight className="w-2.5 h-2.5" />
            </div>
          )}
          <div className="flex flex-col">
            <span className={`text-[10px] font-bold leading-none ${isNeutral ? 'text-primary' : isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
              {trend.split(' ')[0]}
            </span>
            <span className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-widest mt-0.5">{trend.split(' ').slice(1).join(' ')}</span>
          </div>
        </div>
      </div>

      {/* Sparkline in the background */}
      <div className="absolute inset-x-0 bottom-0 h-16 opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none overflow-hidden rounded-b-[28px] md:rounded-b-[36px] min-h-[64px]">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={isNeutral ? "hsl(var(--primary))" : isPositive ? "#10b981" : "#ef4444"} 
                strokeWidth={3} 
                dot={false}
                animationDuration={2000}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
