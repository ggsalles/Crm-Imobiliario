"use client";

import { useMemo, memo } from "react";
import { motion } from "motion/react";
import { Layers, Info, Zap, Clock, TrendingUp, ArrowUpRight, Target } from "lucide-react";
import { Deal, Goal } from "@/lib/db";
import { STAGES } from "@/lib/constants";
import { cn, formatCurrencyBRL } from "@/lib/utils";

export interface ForecastViewProps {
  deals: Deal[];
  goals: Goal[];
  goalRevenue: number;
  progressPercentage: number;
  customProbabilities: Record<string, number>;
  aiInsights: string | null;
  loadingAI: boolean;
  onRefreshAI: () => void;
  currentGoal?: Goal;
}

export const ForecastView = memo(function ForecastView({ 
  deals, 
  goals: _goals, 
  goalRevenue, 
  progressPercentage,
  customProbabilities,
  aiInsights,
  loadingAI,
  onRefreshAI,
  currentGoal
}: ForecastViewProps) {
  const { closedDealsTotal, totalPipelineValue, weightedPipelineValue, forecastValue } = useMemo(() => {
    let closedSum = 0;
    let totalPipe = 0;
    let weightedPipe = 0;

    for (const d of deals) {
      const val = d.value || 0;
      if (d.stage === 'closed') {
        closedSum += val;
      } else if (STAGES.some(s => s.id === d.stage)) {
        totalPipe += val;
        const prob = customProbabilities[d.stage] ?? ((STAGES.findIndex(s => s.id === d.stage) + 1) * 20);
        weightedPipe += val * (prob / 100);
      }
    }

    return {
      closedDealsTotal: closedSum,
      totalPipelineValue: totalPipe,
      weightedPipelineValue: weightedPipe,
      forecastValue: weightedPipe + closedSum
    };
  }, [deals, customProbabilities]);
  
  const stageCounts = useMemo(() => {
    return STAGES.map(stage => {
      const stageDeals = deals.filter(d => d.stage === stage.id);
      return {
        name: stage.title,
        count: stageDeals.length,
        value: stageDeals.reduce((acc, d) => acc + (d.value || 0), 0),
        goal: currentGoal?.stageGoals?.[stage.id] || 0,
        color: stage.color
      };
    });
  }, [deals, currentGoal]);

  return (
    <div className="space-y-4 md:space-y-5 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-5">
          <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-6 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] rotate-12 pointer-events-none">
              <Layers className="w-48 h-48" />
            </div>

            <div className="flex items-center justify-between mb-6 relative z-20">
              <div>
                <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">Funil de Vendas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Sua pipeline ativa distribuída por estágio.</p>
              </div>
              <div className="text-right group relative">
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Valor Total Pipeline</p>
                  <div className="cursor-help text-muted-foreground/30 hover:text-primary transition-colors">
                    <Info className="w-3 h-3" />
                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-900 dark:bg-slate-950 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 shadow-2xl border border-slate-800 dark:border-slate-800/80 font-medium normal-case tracking-normal translate-y-1 group-hover:translate-y-0">
                      <p className="leading-relaxed">Valor bruto de todos os negócios que estão ativos no seu funil, sem considerar a probabilidade de fechamento.</p>
                    </div>
                  </div>
                </div>
                <p className="text-xl md:text-2xl font-light text-foreground tracking-tight">
                  {formatCurrencyBRL(totalPipelineValue, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              {stageCounts.map((stage) => {
                const progressByValue = stage.goal > 0 
                  ? (stage.value / stage.goal) * 100 
                  : (totalPipelineValue > 0 ? (stage.value / totalPipelineValue) * 100 : 0);
                
                const visualProgress = stage.value > 0 ? Math.max(2, Math.min(100, progressByValue)) : 0;

                return (
                  <div key={stage.name} className="relative group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          stage.color === 'blue' ? "bg-primary" :
                          stage.color === 'purple' ? "bg-purple-600" :
                          stage.color === 'orange' ? "bg-orange-600" :
                          stage.color === 'yellow' ? "bg-yellow-600" : "bg-emerald-600"
                        )} />
                        <span className="text-xs md:text-sm font-bold text-foreground">{stage.name}</span>
                        <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider ml-1.5">
                          {stage.count} {stage.count === 1 ? 'negócio' : 'negócios'}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-foreground">
                          {formatCurrencyBRL(stage.value, { maximumFractionDigits: 0 })}
                        </p>
                        {stage.goal > 0 && (
                          <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
                            Meta: {formatCurrencyBRL(stage.goal, { maximumFractionDigits: 0 })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner ring-1 ring-border p-0.5">
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

          <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-6 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-bold tracking-tight">Insights de IA</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Análise Estratégica do Pipeline</p>
                </div>
              </div>
              <button 
                onClick={onRefreshAI}
                disabled={loadingAI}
                className="p-2 bg-muted hover:bg-muted-foreground/10 text-muted-foreground rounded-xl transition-all disabled:opacity-50"
                title="Atualizar Insights de IA"
              >
                <div className={cn(loadingAI && "animate-spin")}>
                  <Clock className="w-4 h-4" />
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

        <div className="bg-slate-900 rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 text-white shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <TrendingUp className="w-32 h-32" />
          </div>
          
          <div className="relative z-10 flex-1">
            <h3 className="text-base md:text-lg font-bold tracking-tight mb-5">Meta Mensal</h3>
            
            <div className="mb-6">
              <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso Geral (Valor)</p>
              <div className="flex items-baseline gap-2 mb-3">
                <p className="text-3xl md:text-4xl font-light tracking-tight">
                  {progressPercentage}%
                </p>
                <span className="text-slate-400 text-xs font-medium">realizado</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, progressPercentage)}%` }}
                  className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(var(--color-primary),0.6)]"
                />
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Objetivo:</span>
                <span className="text-xs font-bold text-white">
                   {formatCurrencyBRL(goalRevenue, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            <div className="space-y-5 pt-5 border-t border-white/10 mt-auto">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Previsão Realista</p>
                  <div className="flex items-center gap-2">
                    <div className="group relative">
                      <div className="cursor-help text-slate-500 hover:text-emerald-500 transition-colors">
                        <Info className="w-3.5 h-3.5" />
                        <div className="absolute right-0 top-full mt-2 w-64 p-3.5 bg-slate-800 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 shadow-2xl border border-white/10 font-medium normal-case tracking-normal backdrop-blur-xl translate-y-1 group-hover:translate-y-0">
                          <p className="font-bold mb-2 uppercase tracking-wider text-emerald-400 border-b border-white/10 pb-1.5 flex items-center gap-2">
                            <Layers className="w-3 h-3" />
                            Equação do Momento
                          </p>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center bg-white/5 p-1.5 rounded-lg">
                              <span className="text-slate-400">Realizado (100%):</span>
                              <span className="font-bold font-mono">{formatCurrencyBRL(closedDealsTotal, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-1.5 rounded-lg">
                              <span className="text-slate-400">Ponderado (Pipeline):</span>
                              <span className="font-bold font-mono">{formatCurrencyBRL(weightedPipelineValue, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="h-px bg-white/10 my-1"></div>
                            <div className="flex justify-between items-center text-[10px] px-1">
                              <span className="font-bold text-emerald-400">Previsão Final:</span>
                              <span className="font-bold text-emerald-400 font-mono italic">{formatCurrencyBRL(forecastValue, { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                          <p className="mt-3 text-[9px] text-slate-500 leading-tight">
                            * O valor ponderado é a soma de cada negócio multiplicado pela probabilidade de fechamento do seu respectivo estágio.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="w-7 h-7 bg-emerald-500/20 text-emerald-500 rounded-lg flex items-center justify-center">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
                <p className="text-2xl md:text-3xl font-light tracking-tight mb-1.5">
                  {formatCurrencyBRL(forecastValue, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                  Cálculo baseado no fechamento atual somado à probabilidade de conversão ponderada de cada estágio do funil.
                </p>
              </div>

              <div className="bg-white/5 rounded-xl md:rounded-2xl p-4 border border-white/10">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-7 h-7 bg-blue-500/20 text-blue-500 rounded-lg flex items-center justify-center">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Status da Meta</span>
                </div>
                <p className="text-xs font-medium leading-relaxed">
                  {progressPercentage >= 100 
                    ? "Meta atingida! Excelente trabalho! Sua previsão indica que você pode superar o objetivo em mais de " + 
                      formatCurrencyBRL(Math.max(0, (Number(forecastValue) || 0) - (Number(goalRevenue) || 0)), { maximumFractionDigits: 0 }) + "."
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
});

export default ForecastView;
