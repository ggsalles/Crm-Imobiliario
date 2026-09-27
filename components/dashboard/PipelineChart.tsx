"use client";

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { HelpCircle } from "lucide-react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { Deal, Goal } from "@/lib/db";

const STAGES = [
  { id: "lead", title: "Novo Lead", color: "blue" },
  { id: "qualification", title: "Qualificação / Visita", color: "purple" },
  { id: "proposal", title: "Proposta", color: "orange" },
  { id: "negotiation", title: "Análise Jurídica", color: "yellow" },
  { id: "closed", title: "Vendido / Alugado", color: "emerald" },
];

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

    // Weekly view: Last 6 calendar weeks (Monday to Sunday)
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

  return (
    <motion.div 
      variants={variants}
      className={cn(
        "bg-card rounded-2xl md:rounded-3xl border border-border p-4 sm:p-5 md:p-6 shadow-sm relative overflow-hidden card-hover",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-3">
        <div className="text-left">
          <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">Análise de Performance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Vendas e previsões atuais do pipeline.</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button 
            type="button"
            onClick={() => setPeriod('weekly')}
            className={cn(
              "px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer",
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
              "px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer",
              activePeriod === 'monthly' 
                ? "bg-primary/10 text-primary" 
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Mensal
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6 border-b border-border pb-4 md:pb-6">
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
  );
});

export default PipelineChart;
