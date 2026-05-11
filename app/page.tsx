"use client";

/**
 * SalesScore CRM - Versão Estável Sincronizada
 * Build: 2026-05-10 v0.2.0 - Novo Leads corrigido para 1
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { Sidebar } from "@/components/sidebar";
import { 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  Search,
  Bell,
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
  UserProfile
} from "@/lib/db";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Suspense } from "react";

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
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

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['Visão Geral', 'Relatórios', 'Equipe', 'Previsões'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else {
        // Stop showing generic loader if auth is done and user is here
        // Even if profile is still syncing, the UI will handle it
        const timer = setTimeout(() => {
          setLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;

    // Subscriptions
    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsubDeals = subscribeToDeals((data) => {
      setDeals(data);
    }, ownerId);
    
    const unsubContacts = subscribeToContacts(setContacts, ownerId);
    const unsubProperties = subscribeToProperties(setProperties, ownerId);
    
    const unsubGoals = subscribeToGoals((data) => {
      setGoals(data);
    }, ownerId);
    
    const unsubActivities = subscribeToActivities((data) => {
      setActivities(data);
    }, ownerId);

    // Initial load markers - we can set loading to false quickly
    // as Firestore is very responsive
    setLoading(false);

    // Fetch team members if Admin
    let unsubUsers = () => {};
    if (profile.role === 'Admin') {
      import("@/lib/db").then(({ subscribeToUsers }) => {
        unsubUsers = subscribeToUsers(setUsers);
      });
    }

    return () => {
      unsubDeals();
      unsubContacts();
      unsubProperties();
      unsubGoals();
      unsubActivities();
      unsubUsers();
    };
  }, [user, profile]);

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium animate-pulse">Carregando painel...</p>
        </div>
      </div>
    );
  }

  // --- Calculations ---
  const now = new Date();
  const currentMonthStr = format(now, "yyyy-MM");
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = format(lastMonthDate, "yyyy-MM");

  const currentGoal = goals.find(g => g.month === currentMonthStr);
  const goalRevenue = currentGoal?.stageGoals?.['closed'] || currentGoal?.revenue || 100000;
  const closedDealsTotal = deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + d.value, 0);
  const progressPercentage = Math.round((closedDealsTotal / goalRevenue) * 100);

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

  // New Leads (Deals in Novo Lead stage created this month) - Force Sync trigger
  // We use deals instead of contacts as it aligns better with the pipeline view
  const currentMonthDeals = deals.filter(d => d.createdAt?.startsWith(currentMonthStr));
  const newLeads = currentMonthDeals.filter(d => d.stage === 'lead').length;
  const lastMonthDeals = deals.filter(d => d.createdAt?.startsWith(lastMonthStr));
  const lastMonthLeads = lastMonthDeals.filter(d => d.stage === 'lead').length;
  const leadsTrend = lastMonthLeads > 0 ? ((newLeads - lastMonthLeads) / lastMonthLeads) * 100 : (newLeads > 0 ? 100 : 0);

  // Open Deals
  const openDeals = deals.filter(d => d.stage !== 'closed');

  // Forecast Calculation (consistency with ForecastView)
  const closedDealsTotalForForecast = deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + d.value, 0);
  const totalPipelineValue = deals
    .filter(d => STAGES.some(s => s.id === d.stage && s.id !== 'closed'))
    .reduce((acc, d) => acc + d.value, 0);
  const forecastValue = (totalPipelineValue * 0.2) + closedDealsTotalForForecast;
  
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
    const monthGoal = goals.find(g => g.month === mStr);
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
        value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.value),
        stage: stage?.title || d.stage,
        color: stage?.color || 'slate',
        date: d.updatedAt ? format(new Date(d.updatedAt), "MMM dd, yyyy") : '-',
        probability: d.stage === 'closed' ? 100 : (STAGES.findIndex(s => s.id === d.stage) + 1) * 20
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
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Header */}
        <header className="h-auto md:h-24 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 py-4 md:py-0 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-20 gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-12 flex-1">
            <div className="flex flex-col">
              <h2 className="text-lg md:text-xl font-bold text-slate-900 shrink-0">Dashboard</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Bem-vindo, {profile?.displayName?.split(' ')[0]}</p>
            </div>
            
            <div className="w-full md:max-w-md relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="w-full bg-slate-100/50 border-none rounded-2xl py-2.5 md:py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all border border-transparent focus:border-slate-200"
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
                  className={`text-sm font-bold transition-all relative py-9 ${activeTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full"
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
            <div className="flex items-center gap-2">
              <button className="p-2.5 md:p-3 hover:bg-slate-100 rounded-2xl transition-all relative group">
                <Bell className="w-5 h-5 text-slate-500 group-hover:scale-110 transition-transform" />
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white shadow-sm" />
              </button>
            </div>
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
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(currentMonthRevenue)} 
                    trend={`${revenueTrend > 0 ? '+' : ''}${revenueTrend.toFixed(1)}% vs mês ant.`}
                    description="Valor total faturado este mês com imóveis vendidos ou alugados. Reflete o desempenho financeiro direto do período atual."
                    isPositive={revenueTrend >= 0}
                    chartData={getTrendData('revenue')}
                  />
                  <MetricCard 
                    variants={itemVariants}
                    title="TAXA DE CONVERSÃO" 
                    value={`${winRate.toFixed(1)}%`} 
                    trend="Sucesso do Funil"
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
                    className="lg:col-span-2 bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 p-6 md:p-10 shadow-sm relative overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 md:mb-10 gap-4">
                      <div className="text-left">
                        <h3 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Análise de Performance</h3>
                        <p className="text-xs md:text-sm text-slate-500 mt-1 md:mt-2">Vendas e previsões atuais.</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button className="px-3 md:px-4 py-2 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500 rounded-xl hover:bg-slate-100 transition-colors">Semanal</button>
                        <button className="px-3 md:px-4 py-2 bg-blue-50 text-[10px] font-bold uppercase tracking-widest text-blue-600 rounded-xl">Mensal</button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10 mb-8 md:mb-10 border-b border-slate-50 pb-8 md:pb-10">
                      <div>
                        <div className="flex items-center gap-2 mb-1 md:mb-2">
                          <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-blue-600 shadow-lg shadow-blue-500/40" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receita Real</span>
                        </div>
                        <p className="text-2xl md:text-3xl font-light text-slate-900 tracking-tighter">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(currentMonthRevenue)}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 md:mb-2">
                          <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-slate-200" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Previsão</span>
                          <div className="relative group/info">
                            <HelpCircle className="w-3 h-3 cursor-help text-slate-400 opacity-50 hover:opacity-100 transition-opacity" />
                            <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-slate-900/95 backdrop-blur-sm text-white text-[11px] rounded-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all duration-300 z-50 shadow-2xl normal-case font-normal leading-relaxed border border-white/10 translate-y-1 group-hover/info:translate-y-0">
                              Previsão baseada em 20% do valor total das negociações em aberto + 100% dos negócios já fechados no mês.
                            </div>
                          </div>
                        </div>
                        <p className="text-2xl md:text-3xl font-light text-slate-900 tracking-tighter">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(forecastValue)}
                        </p>
                      </div>
                    </div>

                    <div className="h-[250px] md:h-[350px] w-full">
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
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-2">{payload[0].payload.name}</p>
                                    <div className="space-y-1">
                                      <div className="flex justify-between gap-6">
                                        <span className="text-xs text-slate-300">Realizado:</span>
                                        <span className="text-xs font-bold text-blue-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(payload[1].value as number)}</span>
                                      </div>
                                      <div className="flex justify-between gap-6">
                                        <span className="text-xs text-slate-300">Objetivo:</span>
                                        <span className="text-xs font-bold text-slate-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(payload[0].value as number)}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="projected" fill="#F1F5F9" radius={[12, 12, 12, 12]} barSize={32} />
                          <Bar dataKey="actual" fill="#2563EB" radius={[12, 12, 12, 12]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>

                  {/* Activities Column */}
                  <motion.div 
                    variants={itemVariants}
                    className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 p-6 md:p-10 shadow-sm flex flex-col relative overflow-hidden"
                  >
                    <div className="flex justify-between items-center mb-8 md:mb-10">
                      <h3 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Atividades</h3>
                      <button 
                        onClick={() => router.push("/calendar")}
                        className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all text-slate-400"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-6 md:space-y-8 flex-1">
                      {displayActivities.length > 0 ? displayActivities.map((activity) => (
                        <div 
                          key={activity.id} 
                          className={cn(
                            "flex gap-4 md:gap-6 group cursor-pointer items-center",
                            activity.isCompleted && "opacity-60"
                          )}
                          onClick={() => handleToggleActivity(activity.raw)}
                        >
                          <div className={cn(
                            "flex flex-col items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl md:rounded-3xl shrink-0 transition-all shadow-sm ring-1",
                            activity.isCompleted 
                              ? "bg-slate-100 text-slate-400 ring-slate-200" 
                              : "bg-slate-50 text-slate-900 ring-slate-100 group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-500/20"
                          )}>
                            <span className="text-[9px] md:text-[10px] font-bold uppercase leading-none tracking-widest">{activity.date.split(' ')[1]}</span>
                            <span className="text-lg md:text-xl font- black leading-none mt-1 tracking-tighter">{activity.date.split(' ')[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h4 className={cn(
                              "text-xs md:text-sm font-bold transition-colors truncate mb-1",
                              activity.isCompleted ? "text-slate-400 line-through" : "text-slate-900 group-hover:text-blue-600"
                            )}>
                              {activity.title}
                            </h4>
                            <div className="flex items-center gap-2 md:gap-3">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-widest",
                                activity.isCompleted ? "text-slate-400" : "text-blue-600"
                              )}>
                                {activity.time}
                              </span>
                              <div className="w-1 h-1 rounded-full bg-slate-200" />
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                                {activity.statusLabel}
                              </p>
                            </div>
                          </div>
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                            activity.isCompleted 
                              ? "bg-blue-600 border-blue-600 text-white" 
                              : "border-slate-200 text-transparent group-hover:border-blue-400"
                          )}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      )) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300 py-12">
                          <Calendar className="w-12 md:w-16 h-12 md:h-16 mb-4 opacity-10" />
                          <p className="text-xs font-bold uppercase tracking-widest">Sem tarefas</p>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => router.push("/calendar")}
                      className="w-full mt-8 md:mt-10 py-4 md:py-5 bg-slate-50 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all border border-slate-100"
                    >
                      Gerenciar Agenda
                    </button>
                  </motion.div>
                </div>

                {/* Recent Deals Table */}
                <motion.div 
                  variants={itemVariants}
                  className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 p-6 md:p-10 shadow-sm overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 md:mb-10 gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 text-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Negócios Recentes</h3>
                        <p className="text-xs md:text-sm text-slate-400">Últimas movimentações</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all">
                        <Filter className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => router.push("/pipeline")}
                        className="flex-1 sm:flex-none px-6 md:px-8 py-2.5 md:py-3 bg-blue-600 text-white rounded-xl md:rounded-2xl text-[10px] font-bold shadow-xl shadow-blue-900/20 hover:opacity-90 transition-all font-sans uppercase tracking-widest"
                      >
                        Pipeline
                      </button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto -mx-6 md:-mx-10 px-6 md:px-10">
                    <table className="w-full border-separate border-spacing-y-4">
                      <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-left">
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
                            <td className="px-6 py-6 bg-slate-50 group-hover:bg-white border-y border-l border-transparent group-hover:border-slate-100 ring-1 ring-slate-100 group-hover:shadow-lg transition-all rounded-l-[28px]">
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-bold bg-white text-blue-600 shadow-sm`}>
                                  {deal.initials}
                                </div>
                                <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{deal.account}</span>
                              </div>
                            </td>
                            <td className="px-6 py-6 bg-slate-50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 ring-1 ring-slate-100 group-hover:shadow-lg transition-all">
                              <span className="text-sm font-bold text-slate-900">{deal.value}</span>
                            </td>
                            <td className="px-6 py-6 bg-slate-50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 ring-1 ring-slate-100 group-hover:shadow-lg transition-all">
                              <span className={cn(
                                "inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset",
                                deal.color === 'emerald' ? "bg-emerald-50 text-emerald-600 ring-emerald-600/10" :
                                deal.color === 'blue' ? "bg-blue-50 text-blue-600 ring-blue-600/10" :
                                deal.color === 'purple' ? "bg-purple-50 text-purple-600 ring-purple-600/10" :
                                deal.color === 'orange' ? "bg-orange-50 text-orange-600 ring-orange-600/10" :
                                "bg-yellow-50 text-yellow-600 ring-yellow-600/10"
                              )}>
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full animate-pulse",
                                  deal.color === 'emerald' ? "bg-emerald-500" :
                                  deal.color === 'blue' ? "bg-blue-500" :
                                  deal.color === 'purple' ? "bg-purple-500" :
                                  deal.color === 'orange' ? "bg-orange-500" :
                                  "bg-yellow-500"
                                )} />
                                {deal.stage}
                              </span>
                            </td>
                            <td className="px-6 py-6 bg-slate-50 group-hover:bg-white border-y border-transparent group-hover:border-slate-100 ring-1 ring-slate-100 group-hover:shadow-lg transition-all">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-400 w-8">{deal.probability}%</span>
                                <div className="h-1.5 w-24 bg-white rounded-full overflow-hidden shadow-inner ring-1 ring-slate-100">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${deal.probability}%` }}
                                    className={cn(
                                      "h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
                                      deal.color === 'emerald' ? "bg-emerald-500 shadow-emerald-500/50" : "bg-blue-600"
                                    )} 
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6 bg-slate-50 group-hover:bg-white border-y border-r border-transparent group-hover:border-slate-100 ring-1 ring-slate-100 group-hover:shadow-lg transition-all rounded-r-[28px] text-right">
                              <button className="p-3 hover:bg-slate-50 rounded-xl transition-all text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100">
                                < MoreHorizontal className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 font-medium text-sm">
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
              <ForecastView deals={deals} goals={goals} goalRevenue={goalRevenue} progressPercentage={progressPercentage} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Floating Action Button */}
        <button 
          onClick={() => router.push("/pipeline")}
          className="fixed bottom-6 right-6 md:bottom-12 md:right-12 bg-slate-900 text-white p-4 md:p-6 rounded-2xl md:rounded-[32px] shadow-2xl hover:scale-110 active:scale-95 transition-all z-30 flex items-center gap-3 md:gap-4 group ring-2 md:ring-4 ring-white"
        >
          <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40">
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
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Média de Vendas/Agente</p>
          <p className="text-2xl font-light text-slate-900 tracking-tighter">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(
              agents.reduce((acc, a) => acc + a.stats.totalValue, 0) / (agents.length || 1)
            )}
          </p>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Melhor Performance</p>
          <p className="text-2xl font-light text-slate-900 tracking-tighter truncate">
            {agents[0]?.displayName || '-'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-50">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Performance da Equipe</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">
                <th className="px-10 py-6 border-b border-slate-50">Membro</th>
                <th className="px-10 py-6 border-b border-slate-50">Vendas Totais</th>
                <th className="px-10 py-6 border-b border-slate-50">Negócios Fechados</th>
                <th className="px-10 py-6 border-b border-slate-50">Taxa de Conversão</th>
                <th className="px-10 py-6 border-b border-slate-50">Ativos</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-10 py-6 border-b border-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center font-bold text-blue-600 text-xs shadow-sm shadow-blue-200/50 overflow-hidden relative">
                        {agent.photoURL ? <Image src={agent.photoURL} alt="" fill className="w-full h-full object-cover" /> : agent.displayName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{agent.displayName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{agent.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 border-b border-slate-50">
                    <p className="text-sm font-bold text-slate-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(agent.stats.totalValue)}
                    </p>
                  </td>
                  <td className="px-10 py-6 border-b border-slate-50 text-sm font-medium text-slate-600">{agent.stats.count}</td>
                  <td className="px-10 py-6 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-900">{agent.stats.winRate.toFixed(1)}%</span>
                      <div className="h-1 w-20 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${agent.stats.winRate}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 border-b border-slate-50">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-widest ring-1 ring-blue-600/10">
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

function ForecastView({ deals, goals, goalRevenue, progressPercentage }: { deals: Deal[], goals: Goal[], goalRevenue: number, progressPercentage: number }) {
  const currentMonthStr = format(new Date(), "yyyy-MM");
  const currentGoal = goals.find(g => g.month === currentMonthStr);
  
  const closedDealsTotal = deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + d.value, 0);
  const totalPipelineValue = deals
    .filter(d => STAGES.some(s => s.id === d.stage && s.id !== 'closed'))
    .reduce((acc, d) => acc + d.value, 0);

  const forecastValue = (totalPipelineValue * 0.2) + closedDealsTotal;
  
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
        <div className="lg:col-span-2 bg-white rounded-[40px] border border-slate-100 p-10 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Funil de Vendas</h3>
              <p className="text-sm text-slate-500 mt-1">Estimativa de conversão por estágio.</p>
            </div>
            <div className="text-right group relative">
              <div className="flex items-center justify-end gap-1.5 mb-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor Total Pipeline</p>
                <div className="cursor-help text-slate-300 hover:text-blue-500 transition-colors">
                  <Info className="w-3 h-3" />
                  <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-white/10 font-medium normal-case tracking-normal">
                    <p>A &quot;Previsão de Fechamento&quot; é calculada somando suas vendas realizadas ao 20% do valor total deste pipeline.</p>
                  </div>
                </div>
              </div>
              <p className="text-2xl font-light text-slate-900 tracking-tighter">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalPipelineValue)}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {stageCounts.map((stage, idx) => {
              const progress = stage.goal > 0 ? (stage.count / stage.goal) * 100 : 0;
              const funnelWidth = 100 - (idx * 10); // Simple visual funnel effect

              return (
                <div key={stage.name} className="relative group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        stage.color === 'blue' ? "bg-blue-600" :
                        stage.color === 'purple' ? "bg-purple-600" :
                        stage.color === 'orange' ? "bg-orange-600" :
                        stage.color === 'yellow' ? "bg-yellow-600" : "bg-emerald-600"
                      )} />
                      <span className="text-sm font-bold text-slate-900">{stage.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">
                        {stage.count} negócios
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stage.value)}
                      </p>
                      {stage.goal > 0 && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Meta: {stage.goal} units
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="h-4 bg-slate-50 rounded-full overflow-hidden shadow-inner ring-1 ring-slate-100 p-0.5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${funnelWidth}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        stage.color === 'blue' ? "bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]" :
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

        <div className="bg-slate-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-10">
            <TrendingUp className="w-40 h-40" />
          </div>
          
          <div className="relative z-10">
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
                  className="h-full bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                />
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Objetivo:</span>
                <span className="text-xs font-bold text-white">
                   {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(goalRevenue)}
                </span>
              </div>
            </div>

            <div className="space-y-6 pt-10 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Previsão Fechamento</p>
                  <p className="text-lg font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(forecastValue)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                Sua previsão é baseada em 20% do valor total do seu funil atual somado às vendas já realizadas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsView({ deals, contacts, progressPercentage }: { deals: Deal[], contacts: Contact[], progressPercentage: number }) {
  // Define color mapping for the chart to match STAGES colors
  const STAGE_COLORS: Record<string, string> = {
    blue: '#2563EB',
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
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalRevenue)} 
          trend="+12.5% vs histórico"
          isPositive={true}
          description="Total gerado em negócios fechados."
          chartData={salesData.map(s => ({ value: s.revenue }))}
        />
        <MetricCard 
          title="Ticket Médio" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(avgTicket)} 
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
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(activePipelineValue)} 
          trend="Oportunidades em aberto"
          isPositive={true}
          isNeutral={true}
          description="Valor total estacionado no funil (exceto vendidos)."
          chartData={Array.from({ length: 12 }).map((_, i) => ({ value: 50 + Math.random() * 50 }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white rounded-[40px] border border-slate-100 p-10 shadow-sm">
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Fluxo de Receita</h3>
            <p className="text-sm text-slate-500 mt-1">Sazonalidade das vendas (últimos 6 meses).</p>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={15}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '20px' }}
                  formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[40px] border border-slate-100 p-10 shadow-sm flex flex-col items-center justify-center">
          <div className="mb-8 w-full text-center">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Fases do Funil</h3>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Distribuição por Status</p>
          </div>
          <div className="h-[280px] w-full relative">
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
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-slate-900">{validDeals.length}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Negócios</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 justify-center">
            {stageData.map((stage, i) => (
              <div key={stage.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stage.name}</span>
                <span className="text-[10px] font-bold text-slate-300 ml-0.5">{stage.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white rounded-[40px] border border-slate-100 p-10 shadow-sm">
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Saúde da Carteira</h3>
            <p className="text-sm text-slate-500 mt-1">Eficiência multidimensional.</p>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={[
                { subject: 'Volume', A: winRate },
                { subject: 'Ticket', A: Math.min((avgTicket/100000)*100, 100) },
                { subject: 'Velocidade', A: 80 },
                { subject: 'Retenção', A: 70 },
                { subject: 'Meta', A: progressPercentage },
              ]}>
                <PolarGrid stroke="#f1f5f9" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <Radar
                   name="Enterprise"
                   dataKey="A"
                   stroke="#2563EB"
                   fill="#2563EB"
                   fillOpacity={0.1}
                 />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[40px] border border-slate-100 p-10 shadow-sm">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
               <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Performance Proativa</h3>
              <p className="text-sm text-slate-500">Acompanhamento vs Objetivos.</p>
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
                  <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${val}%` }}
                      className={cn("h-full rounded-full", val > 50 ? "bg-emerald-500" : "bg-blue-600")}
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

function MetricCard({ title, value, trend, description, isPositive, isNeutral, chartData, variants }: any) {
  return (
    <motion.div 
      variants={variants}
      className="bg-white p-5 md:p-8 pb-4 rounded-[28px] md:rounded-[36px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative h-full flex flex-col"
    >
      <div className="relative z-10 flex-1">
        <div className="flex items-start justify-between mb-1 md:mb-2 text-slate-400 group-hover:text-blue-500 transition-colors">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em]">{title}</p>
          {description && (
            <div className="relative group/info">
              <HelpCircle className="w-3 h-3 cursor-help opacity-40 hover:opacity-100 transition-opacity" />
              <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-slate-900/95 backdrop-blur-sm text-white text-[11px] rounded-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all duration-300 z-50 shadow-2xl normal-case font-normal leading-relaxed border border-white/10 translate-y-1 group-hover/info:translate-y-0">
                {description}
              </div>
            </div>
          )}
        </div>
        <p className="text-2xl md:text-3xl font-light text-slate-900 tracking-tighter group-hover:text-blue-600 transition-colors leading-none">{value}</p>
        
        <div className="mt-3 md:mt-4 flex items-center gap-2">
          {isNeutral ? (
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Plus className="w-2.5 h-2.5" />
            </div>
          ) : isPositive ? (
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
               <ArrowUpRight className="w-2.5 h-2.5" />
            </div>
          ) : (
            <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">
               <ArrowDownRight className="w-2.5 h-2.5" />
            </div>
          )}
          <div className="flex flex-col">
            <span className={`text-[10px] font-bold leading-none ${isNeutral ? 'text-blue-600' : isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend.split(' ')[0]}
            </span>
            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">{trend.split(' ').slice(1).join(' ')}</span>
          </div>
        </div>
      </div>

      {/* Sparkline in the background */}
      <div className="absolute inset-x-0 bottom-0 h-16 opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none overflow-hidden rounded-b-[28px] md:rounded-b-[36px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={isNeutral ? "#3b82f6" : isPositive ? "#10b981" : "#ef4444"} 
              strokeWidth={3} 
              dot={false}
              animationDuration={2000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
