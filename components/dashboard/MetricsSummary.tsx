"use client";

import { useEffect, useState, useMemo, memo } from "react";
import { 
  HelpCircle, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight 
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { motion } from "motion/react";
import { Deal, Property } from "@/lib/db";
import { format } from "date-fns";
import { formatCurrencyBRL } from "@/lib/utils";

const STAGES = [
  { id: "lead", title: "Novo Lead", color: "blue" },
  { id: "qualification", title: "Qualificação / Visita", color: "purple" },
  { id: "proposal", title: "Proposta", color: "orange" },
  { id: "negotiation", title: "Análise Jurídica", color: "yellow" },
  { id: "closed", title: "Vendido / Alugado", color: "emerald" },
];

export interface MetricCardProps {
  title: string;
  value: string;
  trend: string;
  description?: string;
  isNeutral?: boolean;
  isPositive?: boolean;
  chartData?: Array<{ value: number }>;
  variants?: any;
}

export const MetricCard = memo(function MetricCard({ 
  title, 
  value, 
  trend, 
  description, 
  isNeutral, 
  isPositive, 
  chartData, 
  variants 
}: MetricCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <motion.div 
      variants={variants}
      className="bg-card p-4 md:p-5 pb-3 rounded-2xl md:rounded-3xl border border-border shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all group relative h-full flex flex-col hover:z-30"
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
      <div className="absolute inset-x-0 bottom-0 h-16 opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none overflow-hidden rounded-b-2xl md:rounded-b-3xl min-h-[64px]">
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
});

export interface MetricsSummaryProps {
  deals?: Deal[];
  properties?: Property[];
  currentMonthRevenue?: number;
  revenueTrend?: number;
  winRate?: number;
  winRateDetails?: string;
  newLeads?: number;
  leadsTrend?: number;
  openDealsCount?: number;
  activePropertiesCount?: number;
  itemVariants?: any;
}

export const MetricsSummary = memo(function MetricsSummary({
  deals = [],
  properties = [],
  currentMonthRevenue: propRevenue,
  revenueTrend: propRevenueTrend,
  winRate: propWinRate,
  winRateDetails: propWinRateDetails,
  newLeads: propNewLeads,
  leadsTrend: propLeadsTrend,
  openDealsCount: propOpenDealsCount,
  activePropertiesCount: propActivePropertiesCount,
  itemVariants
}: MetricsSummaryProps) {
  // Helpers for calculations if not provided directly
  const now = useMemo(() => new Date(), []);
  const currentMonthStr = useMemo(() => format(now, "yyyy-MM"), [now]);
  const lastMonthDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), [now]);
  const lastMonthStr = useMemo(() => format(lastMonthDate, "yyyy-MM"), [lastMonthDate]);

  // Receita Mensal
  const currentMonthRevenue = useMemo(() => {
    if (propRevenue !== undefined) return propRevenue;
    return deals
      .filter(d => d.stage === 'closed' && d.updatedAt?.startsWith(currentMonthStr))
      .reduce((acc, d) => acc + d.value, 0);
  }, [propRevenue, deals, currentMonthStr]);

  const lastMonthRevenue = useMemo(() => {
    return deals
      .filter(d => d.stage === 'closed' && d.updatedAt?.startsWith(lastMonthStr))
      .reduce((acc, d) => acc + d.value, 0);
  }, [deals, lastMonthStr]);

  const revenueTrend = useMemo(() => {
    if (propRevenueTrend !== undefined) return propRevenueTrend;
    return lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 100;
  }, [propRevenueTrend, currentMonthRevenue, lastMonthRevenue]);

  // Taxa de Conversão
  const validDeals = useMemo(() => deals.filter(d => STAGES.some(s => s.id === d.stage)), [deals]);
  const totalDealsFinished = useMemo(() => validDeals.filter(d => d.stage === 'closed').length, [validDeals]);
  
  const winRate = useMemo(() => {
    if (propWinRate !== undefined) return propWinRate;
    return validDeals.length > 0 ? (totalDealsFinished / validDeals.length) * 100 : 0;
  }, [propWinRate, validDeals, totalDealsFinished]);

  const winRateDetails = useMemo(() => {
    if (propWinRateDetails !== undefined) return propWinRateDetails;
    return `${totalDealsFinished} de ${validDeals.length} negócios`;
  }, [propWinRateDetails, totalDealsFinished, validDeals]);

  // Novos Leads
  const newLeads = useMemo(() => {
    if (propNewLeads !== undefined) return propNewLeads;
    const currentMonthDeals = deals.filter(d => d.createdAt?.startsWith(currentMonthStr));
    return currentMonthDeals.filter(d => d.stage === 'lead').length;
  }, [propNewLeads, deals, currentMonthStr]);

  const leadsTrend = useMemo(() => {
    if (propLeadsTrend !== undefined) return propLeadsTrend;
    const currentMonthDeals = deals.filter(d => d.createdAt?.startsWith(currentMonthStr));
    const currentLeadsCount = currentMonthDeals.filter(d => d.stage === 'lead').length;
    const lastMonthDeals = deals.filter(d => d.createdAt?.startsWith(lastMonthStr));
    const lastMonthLeadsCount = lastMonthDeals.filter(d => d.stage === 'lead').length;
    return lastMonthLeadsCount > 0 
      ? ((currentLeadsCount - lastMonthLeadsCount) / lastMonthLeadsCount) * 100 
      : (currentLeadsCount > 0 ? 100 : 0);
  }, [propLeadsTrend, deals, currentMonthStr, lastMonthStr]);

  // Negócios Abertos
  const openDealsCount = useMemo(() => {
    if (propOpenDealsCount !== undefined) return propOpenDealsCount;
    return deals.filter(d => d.stage !== 'closed').length;
  }, [propOpenDealsCount, deals]);

  // Imóveis Disponíveis
  const activePropertiesCount = useMemo(() => {
    if (propActivePropertiesCount !== undefined) return propActivePropertiesCount;
    return properties.filter(p => p.status === 'disponível').length;
  }, [propActivePropertiesCount, properties]);

  // Sparkline data
  const trendDataRevenue = useMemo(() => [
    { value: 55 }, { value: 62 }, { value: 58 }, { value: 71 }, 
    { value: 68 }, { value: 79 }, { value: 74 }, { value: 85 }, 
    { value: 82 }, { value: 91 }, { value: 87 }, { value: 96 }
  ], []);

  const trendDataConversion = useMemo(() => [
    { value: 96 }, { value: 87 }, { value: 91 }, { value: 82 }, 
    { value: 85 }, { value: 74 }, { value: 79 }, { value: 68 }, 
    { value: 71 }, { value: 58 }, { value: 62 }, { value: 55 }
  ], []);

  const trendDataLeads = useMemo(() => [
    { value: 45 }, { value: 50 }, { value: 48 }, { value: 60 }, 
    { value: 65 }, { value: 58 }, { value: 72 }, { value: 70 }, 
    { value: 80 }, { value: 85 }, { value: 82 }, { value: 90 }
  ], []);

  const trendDataDeals = useMemo(() => [
    { value: 50 }, { value: 54 }, { value: 52 }, { value: 64 }, 
    { value: 60 }, { value: 68 }, { value: 75 }, { value: 72 }, 
    { value: 78 }, { value: 84 }, { value: 82 }, { value: 89 }
  ], []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
      <MetricCard 
        variants={itemVariants}
        title="RECEITA MENSAL" 
        value={formatCurrencyBRL(currentMonthRevenue, { maximumFractionDigits: 0 })} 
        trend={`${revenueTrend > 0 ? '+' : ''}${revenueTrend.toFixed(1)}% vs mês ant.`}
        description="Valor total faturado este mês com imóveis vendidos ou alugados. Reflete o desempenho financeiro direto do período atual."
        isPositive={revenueTrend >= 0}
        chartData={trendDataRevenue}
      />
      <MetricCard 
        variants={itemVariants}
        title="TAXA DE CONVERSÃO" 
        value={`${winRate.toFixed(1)}%`} 
        trend={winRateDetails}
        description="Percentual de fechamentos bem-sucedidos em relação ao volume total de oportunidades. Indica a eficiência do seu processo comercial."
        isPositive={winRate > 15}
        chartData={trendDataConversion}
      />
      <MetricCard 
        variants={itemVariants}
        title="NOVOS LEADS" 
        value={newLeads.toString()} 
        trend={`${leadsTrend > 0 ? '+' : ''}${leadsTrend.toFixed(1)}% vs mês ant.`}
        description="Novos clientes potenciais e negócios que entraram no pipeline este mês. Mede a eficácia das suas ações de prospecção."
        isPositive={leadsTrend >= 0}
        chartData={trendDataLeads}
      />
      <MetricCard 
        variants={itemVariants}
        title="NEGÓCIOS ABERTOS" 
        value={openDealsCount.toString()} 
        trend="Fluxo total ativo"
        description="Negociações em andamento em todas as fases do funil. Representa o volume de trabalho e oportunidades de receita futura."
        isPositive={true}
        isNeutral={true}
        chartData={trendDataDeals}
      />
      <MetricCard 
        variants={itemVariants}
        title="IMÓVEIS DISPONÍVEIS" 
        value={activePropertiesCount.toString()} 
        trend="Total em portfólio"
        description="Unidades prontas para comercialização em seu inventário. Um portfólio atualizado é essencial para gerar novas oportunidades."
        isPositive={true}
        isNeutral={true}
        chartData={trendDataConversion}
      />
    </div>
  );
});

export default MetricsSummary;
