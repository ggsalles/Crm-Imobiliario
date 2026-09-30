"use client";

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  HelpCircle, 
  Filter, 
  TrendingUp, 
  ArrowRight, 
  AlertCircle,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { Deal, Goal } from "@/lib/db";
import { STAGES } from "@/lib/constants";

export interface PipelineChartProps {
  deals: Deal[];
  goals?: Goal[];
  currentMonthRevenue?: number;
  forecastValue?: number;
  customProbabilities?: Record<string, number>;
  userId?: string;
  chartPeriod?: 'weekly' | 'monthly';
  onPeriodChange?: (period: 'weekly' | 'monthly') => void;
  variants?: any;
  className?: string;
}

const STAGE_COLORS: Record<string, { fill: string; border: string; bg: string; text: string }> = {
  lead: {
    fill: "hsl(var(--primary))",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    text: "text-blue-500 dark:text-blue-400"
  },
  qualification: {
    fill: "#8B5CF6",
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    text: "text-purple-500 dark:text-purple-400"
  },
  proposal: {
    fill: "#F97316",
    border: "border-orange-500/30",
    bg: "bg-orange-500/10",
    text: "text-orange-500 dark:text-orange-400"
  },
  negotiation: {
    fill: "#EAB308",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-500 dark:text-amber-400"
  },
  closed: {
    fill: "#10B981",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-500 dark:text-emerald-400"
  }
};

export const PipelineChart = memo(function PipelineChart({
  deals,
  goals = [],
  currentMonthRevenue: propRevenue,
  forecastValue: propForecast,
  customProbabilities = {},
  userId,
  chartPeriod: controlledPeriod,
  onPeriodChange,
  variants,
  className
}: PipelineChartProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'funnel' | 'performance'>('funnel');
  const [internalPeriod, setInternalPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [mounted, setMounted] = useState(false);

  const activePeriod = controlledPeriod ?? internalPeriod;
  const setPeriod = useCallback((period: 'weekly' | 'monthly') => {
    if (onPeriodChange) {
      onPeriodChange(period);
    } else {
      setInternalPeriod(period);
    }
  }, [onPeriodChange]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const now = useMemo(() => new Date(), []);
  const currentMonthStr = useMemo(() => format(now, "yyyy-MM"), [now]);

  // Receita Real
  const currentMonthRevenue = useMemo(() => {
    if (propRevenue !== undefined) return propRevenue;
    return deals
      .filter(d => d.stage === 'closed' && d.updatedAt?.startsWith(currentMonthStr))
      .reduce((acc, d) => acc + (d.value || 0), 0);
  }, [propRevenue, deals, currentMonthStr]);

  // Previsão Ponderada
  const forecastValue = useMemo(() => {
    if (propForecast !== undefined) return propForecast;
    const closedTotal = deals
      .filter(d => d.stage === 'closed')
      .reduce((acc, d) => acc + (d.value || 0), 0);

    const weightedPipeline = deals
      .filter(d => d.stage !== 'closed')
      .reduce((acc, d) => {
        const prob = customProbabilities[d.stage] ?? (STAGES.findIndex(s => s.id === d.stage) + 1) * 20;
        return acc + ((d.value || 0) * (prob / 100));
      }, 0);

    return weightedPipeline + closedTotal;
  }, [propForecast, deals, customProbabilities]);

  // --- Funnel Data Computations ---
  const { funnelData, totalPipelineVolume, activeDealsCount, bottleneckStage, avgTicket } = useMemo(() => {
    const openDeals = deals.filter(d => d.stage !== 'closed');
    const totalOpenVal = openDeals.reduce((acc, d) => acc + (d.value || 0), 0);

    const stagesList = STAGES.map((stage) => {
      const stageDeals = deals.filter(d => d.stage === stage.id);
      const stageVal = stageDeals.reduce((acc, d) => acc + (d.value || 0), 0);
      const count = stageDeals.length;
      const pctOfPipeline = totalOpenVal > 0 && stage.id !== 'closed'
        ? Math.round((stageVal / totalOpenVal) * 100)
        : (stage.id === 'closed' ? 100 : 0);

      const colorMeta = STAGE_COLORS[stage.id] || STAGE_COLORS.lead;

      return {
        id: stage.id,
        name: stage.title,
        shortName: stage.id === 'qualification' 
          ? 'Qualificação' 
          : stage.id === 'negotiation' 
          ? 'Análise Jurídica' 
          : stage.title,
        value: stageVal,
        count,
        percent: pctOfPipeline,
        fill: colorMeta.fill,
        colorMeta,
        probability: customProbabilities[stage.id] ?? stage.defaultProb
      };
    });

    // Identificação do gargalo nas etapas em andamento (maior volume represado)
    const activeStagesOnly = stagesList.filter(s => s.id !== 'closed');
    const sortedActive = [...activeStagesOnly].sort((a, b) => b.value - a.value);
    const bottleneck = sortedActive.length > 0 && sortedActive[0].value > 0 ? sortedActive[0] : null;

    const averageTicket = openDeals.length > 0 
      ? Math.round(totalOpenVal / openDeals.length) 
      : 0;

    return {
      funnelData: stagesList,
      totalPipelineVolume: totalOpenVal,
      activeDealsCount: openDeals.length,
      bottleneckStage: bottleneck,
      avgTicket: averageTicket
    };
  }, [deals, customProbabilities]);

  // Pre-index goals by month and owner for rapid retrieval
  const goalsByMonth = useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const g of goals) {
      const list = map.get(g.month);
      if (list) {
        list.push(g);
      } else {
        map.set(g.month, [g]);
      }
    }
    return map;
  }, [goals]);

  // Chart Data (Last 6 months / 6 weeks)
  const chartData = useMemo(() => {
    if (activePeriod === 'monthly') {
      return Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const mStr = format(d, "yyyy-MM");
        const mLabel = format(d, "MMM", { locale: ptBR }).replace('.', '').toUpperCase();

        const monthlyActual = deals
          .filter(deal => deal.stage === 'closed' && deal.updatedAt?.startsWith(mStr))
          .reduce((acc, deal) => acc + (deal.value || 0), 0);

        const monthGoals = goalsByMonth.get(mStr) || [];
        const monthGoal = monthGoals.find(g => g.ownerId === userId) || monthGoals[0];
        const monthlyProjected = monthGoal?.stageGoals?.['closed'] || 0;

        return { name: mLabel, actual: monthlyActual, projected: monthlyProjected };
      });
    }

    // Weekly view: Last 6 calendar weeks
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const startOfCurrentWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday, 0, 0, 0, 0);

    return Array.from({ length: 6 }).map((_, i) => {
      const weekStart = new Date(startOfCurrentWeek.getTime() - (5 - i) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000);
      const weekLabel = `Sem ${format(weekStart, "dd/MM")}`;

      const weeklyActual = deals
        .filter(deal => {
          if (deal.stage !== 'closed' || !deal.updatedAt) return false;
          const dealDate = new Date(deal.updatedAt);
          return dealDate >= weekStart && dealDate <= weekEnd;
        })
        .reduce((acc, deal) => acc + (deal.value || 0), 0);

      const mStr = format(weekStart, "yyyy-MM");
      const monthGoals = goalsByMonth.get(mStr) || [];
      const monthGoal = monthGoals.find(g => g.ownerId === userId) || monthGoals[0];
      const monthlyProjected = monthGoal?.stageGoals?.['closed'] || 0;
      const weeklyProjected = monthlyProjected / 4;

      return { name: weekLabel, actual: weeklyActual, projected: Math.round(weeklyProjected) };
    });
  }, [activePeriod, now, deals, goalsByMonth, userId]);

  const handleOpenStage = useCallback((stageId: string) => {
    router.push(`/pipeline?stage=${stageId}`);
  }, [router]);

  return (
    <motion.div 
      variants={variants}
      className={cn(
        "bg-card rounded-2xl md:rounded-3xl border border-border p-4 sm:p-5 md:p-6 shadow-xs relative overflow-hidden card-hover",
        className
      )}
    >
      {/* Top Header with Title, Mode Switcher & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-5 gap-3 border-b border-border/60 pb-3.5">
        <div className="text-left">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg md:text-xl font-black text-foreground tracking-tight">
              {viewMode === 'funnel' ? 'Funil de Vendas Atual' : 'Análise de Performance'}
            </h3>
            {viewMode === 'funnel' && bottleneckStage && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertCircle className="w-2.5 h-2.5" />
                Gargalo: {bottleneckStage.shortName}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {viewMode === 'funnel' 
              ? 'Volume financeiro (R$) e oportunidades ativas por etapa do pipeline.' 
              : 'Evolução de faturamento realizado vs. objetivos projetados.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main View Mode Selector */}
          <div className="flex p-0.5 bg-muted/60 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setViewMode('funnel')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer",
                viewMode === 'funnel'
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Filter className="w-3 h-3 text-primary" />
              Funil por Etapas
            </button>
            <button
              type="button"
              onClick={() => setViewMode('performance')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer",
                viewMode === 'performance'
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              Evolução Temporal
            </button>
          </div>

          {/* Secondary Sub-Controls depending on Active View */}
          {viewMode === 'performance' ? (
            <div className="flex gap-1 shrink-0">
              <button 
                type="button"
                onClick={() => setPeriod('weekly')}
                className={cn(
                  "px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer",
                  activePeriod === 'weekly' 
                    ? "bg-primary/10 text-primary" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                Semanal
              </button>
              <button 
                type="button"
                onClick={() => setPeriod('monthly')}
                className={cn(
                  "px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer",
                  activePeriod === 'monthly' 
                    ? "bg-primary/10 text-primary" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                Mensal
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/pipeline')}
              className="hidden lg:flex items-center gap-1 px-3 py-1.5 text-[10px] sm:text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
            >
              Ver Kanban
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'funnel' ? (
          <motion.div
            key="funnel-view"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 md:space-y-5"
          >
            {/* Quick KPI Strip for Pipeline Health */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pb-1">
              <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Em Aberto no Funil
                </span>
                <p className="text-base sm:text-lg font-black text-foreground tracking-tight mt-0.5">
                  {formatCurrencyBRL(totalPipelineVolume, { maximumFractionDigits: 0 })}
                </p>
                <span className="text-[10.5px] text-muted-foreground">
                  {activeDealsCount} {activeDealsCount === 1 ? 'oportunidade' : 'oportunidades'}
                </span>
              </div>

              <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Gargalo Comercial
                </span>
                <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 tracking-tight mt-0.5 truncate" title={bottleneckStage?.name || 'Nenhum'}>
                  {bottleneckStage ? bottleneckStage.shortName : 'Equilibrado'}
                </p>
                <span className="text-[10.5px] text-muted-foreground">
                  {bottleneckStage ? formatCurrencyBRL(bottleneckStage.value, { maximumFractionDigits: 0 }) : 'Sem gargalos'}
                </span>
              </div>

              <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Ticket Médio
                </span>
                <p className="text-base sm:text-lg font-black text-foreground tracking-tight mt-0.5">
                  {formatCurrencyBRL(avgTicket, { maximumFractionDigits: 0 })}
                </p>
                <span className="text-[10.5px] text-muted-foreground">
                  Por oportunidade
                </span>
              </div>

              <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  Vendido / Alugado
                </span>
                <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
                  {formatCurrencyBRL(funnelData.find(s => s.id === 'closed')?.value || 0, { maximumFractionDigits: 0 })}
                </p>
                <span className="text-[10.5px] text-muted-foreground">
                  {funnelData.find(s => s.id === 'closed')?.count || 0} negócios fechados
                </span>
              </div>
            </div>

            {/* Recharts Funnel: Horizontal Bar Chart with Stage Progression */}
            <div className="h-[250px] sm:h-[280px] w-full min-h-[240px]">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={funnelData} 
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <XAxis 
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={(val) => {
                        if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
                        if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)}k`;
                        return `R$ ${val}`;
                      }}
                    />
                    <YAxis 
                      type="category"
                      dataKey="shortName"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'currentColor', fontSize: 11, fontWeight: 700 }}
                      width={115}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(59, 130, 246, 0.04)' }}
                      wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700/80 p-3.5 rounded-2xl shadow-2xl text-white min-w-[210px] text-left">
                              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                                <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                                  {item.name}
                                </span>
                              </div>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Volume em R$:</span>
                                  <span className="font-bold text-white font-mono">
                                    {formatCurrencyBRL(item.value, { maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Oportunidades:</span>
                                  <span className="font-bold text-blue-400 font-mono">
                                    {item.count} {item.count === 1 ? 'negócio' : 'negócios'}
                                  </span>
                                </div>
                                {item.id !== 'closed' && (
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-400">Fatia do Funil:</span>
                                    <span className="font-bold text-amber-400 font-mono">
                                      {item.percent}%
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Probabilidade:</span>
                                  <span className="font-bold text-emerald-400 font-mono">
                                    {item.probability}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[0, 8, 8, 0]} 
                      barSize={24}
                    >
                      {funnelData.map((entry) => (
                        <Cell 
                          key={`cell-${entry.id}`} 
                          fill={entry.fill} 
                          className="cursor-pointer hover:opacity-85 transition-opacity"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Interactive Stages Cards Strip (Quick jump to Kanban) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-border/50">
              {funnelData.map((stage) => {
                return (
                  <button
                    key={stage.id}
                    onClick={() => handleOpenStage(stage.id)}
                    className={cn(
                      "p-2.5 rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:bg-muted/40 transition-all text-left group cursor-pointer shadow-2xs flex flex-col justify-between"
                    )}
                    title={`Ver negócios na etapa ${stage.name}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.fill }} />
                        <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground transition-colors truncate">
                          {stage.shortName}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                        {stage.count}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-1">
                      <p className="text-xs font-black text-foreground tracking-tight truncate">
                        {formatCurrencyBRL(stage.value, { maximumFractionDigits: 0 })}
                      </p>
                      {stage.id !== 'closed' && (
                        <span className="text-[9px] font-semibold text-muted-foreground shrink-0">
                          {stage.percent}%
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="performance-view"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {/* Performance KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-5 border-b border-border pb-4 md:pb-5">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-primary shadow-md shadow-primary/40" />
                  <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Receita Real</span>
                </div>
                <p className="text-xl md:text-2xl font-light text-foreground tracking-tighter">
                  {formatCurrencyBRL(Number(currentMonthRevenue) || 0, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-border" />
                  <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Previsão</span>
                  <div className="relative group/info">
                    <HelpCircle className="w-3 h-3 cursor-help text-muted-foreground opacity-50 hover:opacity-100 transition-opacity" />
                    <div className="absolute right-0 top-full mt-2 w-64 p-3.5 bg-slate-900 dark:bg-slate-950 text-white text-[11px] rounded-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all duration-200 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-800 dark:border-slate-800/80 font-medium leading-relaxed normal-case tracking-normal -translate-y-1 group-hover/info:translate-y-0">
                      Previsão baseada em probabilidade de cada estágio do pipeline + 100% dos negócios fechados.
                    </div>
                  </div>
                </div>
                <p className="text-xl md:text-2xl font-light text-foreground tracking-tighter">
                  {formatCurrencyBRL(Number(forecastValue) || 0, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            {/* Performance Chart (Bar chart actual vs projected) */}
            <div className="h-[250px] md:h-[320px] w-full min-h-[250px]">
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
                            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/50 relative z-50 text-left">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-2">
                                {payload[0].payload.name}
                              </p>
                              <div className="space-y-1">
                                <div className="flex justify-between gap-6">
                                  <span className="text-xs text-slate-300">Realizado:</span>
                                  <span className="text-xs font-bold text-blue-400">
                                    {formatCurrencyBRL(Number(payload[1]?.value ?? payload[0]?.value) || 0, { maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-6">
                                  <span className="text-xs text-slate-300">Objetivo:</span>
                                  <span className="text-xs font-bold text-slate-200">
                                    {formatCurrencyBRL(Number(payload[0]?.value) || 0, { maximumFractionDigits: 0 })}
                                  </span>
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
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default PipelineChart;
