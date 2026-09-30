"use client";

import { 
  Search, 
  Target, 
  Plus, 
  Flame, 
  AlertTriangle, 
  AlertOctagon, 
  X,
  Download,
  Calculator
} from "lucide-react";
import { motion } from "motion/react";
import { SoundControlButton } from "@/components/NewLeadSoundNotifier";
import { formatCurrencyBRL, cn } from "@/lib/utils";

export type HealthFilterType = "all" | "stale" | "critical" | "lost" | "active";

export interface PipelineHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  healthFilter: HealthFilterType;
  onHealthFilterChange: (filter: HealthFilterType) => void;
  goalValue: number;
  totalClosed: number;
  progressPercentage: number;
  totalDealsCount: number;
  activeDealsCount: number;
  staleDealsCount: number;
  criticalDealsCount: number;
  lostDealsCount: number;
  staleDealsValue: number;
  onOpenGoalModal: () => void;
  onOpenSimulatorModal?: () => void;
  onOpenCreateDealModal: () => void;
  onExportDeals?: () => void;
}

export function PipelineHeader({
  searchQuery,
  onSearchChange,
  healthFilter,
  onHealthFilterChange,
  goalValue,
  totalClosed,
  progressPercentage,
  totalDealsCount,
  activeDealsCount,
  staleDealsCount,
  criticalDealsCount,
  lostDealsCount,
  staleDealsValue,
  onOpenGoalModal,
  onOpenSimulatorModal,
  onOpenCreateDealModal,
  onExportDeals,
}: PipelineHeaderProps) {
  return (
    <>
      <header className="px-4 py-3 md:px-6 md:py-3.5 bg-card/15 border-b border-border/50">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-2.5 gap-3">
          <div className="pl-11 sm:pl-12 md:pl-0">
            <h1 className="text-xl md:text-2xl font-black tracking-tight">Pipeline de Vendas</h1>
            <p className="text-muted-foreground text-xs font-medium">
              Visualize e gerencie seus negócios em andamento no funil.
            </p>
          </div>
          <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-muted/20 p-2.5 rounded-xl border border-border/40 lg:bg-transparent lg:p-0 lg:border-0">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <button
                type="button"
                onClick={onOpenGoalModal}
                className="bg-card border border-primary/35 px-3.5 py-1.5 rounded-xl font-bold text-foreground shadow-sm hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2 group flex-1 sm:flex-initial cursor-pointer"
                title="Clique para definir ou alterar suas metas mensais"
              >
                <Target className="w-4 h-4 text-primary group-hover:text-white transition-colors shrink-0" />
                <div className="text-left">
                  <p className="text-[8.5px] uppercase tracking-widest text-muted-foreground group-hover:text-white/80 leading-none mb-0.5 font-black">
                    Definir Meta
                  </p>
                  <p className="leading-none text-xs font-bold">{formatCurrencyBRL(goalValue)}</p>
                </div>
              </button>

              {onOpenSimulatorModal && (
                <button
                  type="button"
                  onClick={onOpenSimulatorModal}
                  className="bg-card border border-border hover:border-primary/40 hover:bg-primary/5 px-3 py-2 rounded-xl font-bold text-foreground transition-all flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer"
                  title="Simulador de Metas e Engenharia Reversa do Funil"
                >
                  <Calculator className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Simulador</span>
                </button>
              )}

              {onExportDeals && (
                <button
                  type="button"
                  onClick={onExportDeals}
                  className="bg-card border border-border px-3 py-2 rounded-xl font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer"
                  title="Exportar todos os negócios filtrados do funil para CSV"
                >
                  <Download className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Exportar .CSV</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenCreateDealModal}
                className="bg-primary text-white px-3.5 py-2 rounded-xl font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-1.5 text-xs whitespace-nowrap flex-1 sm:flex-initial cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Negócio
              </button>
              <SoundControlButton />
            </div>

            {/* Barra de Progresso da Meta */}
            <div className="w-full sm:w-48 space-y-1">
              <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>Progresso (Fechado)</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    progressPercentage >= 100 ? "bg-emerald-500" : "bg-primary"
                  )}
                />
              </div>
              <div className="text-[9px] text-right font-bold text-muted-foreground uppercase tracking-wider">
                {formatCurrencyBRL(totalClosed)} / {formatCurrencyBRL(goalValue)}
              </div>
            </div>
          </div>
        </div>

        {/* Linha de Busca e Filtros de Saúde do Lead */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisar por título, cliente ou imobiliária..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-xs md:text-sm shadow-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 sm:pt-0">
            <button
              type="button"
              onClick={() => onHealthFilterChange("all")}
              className={cn(
                "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                healthFilter === "all"
                  ? "bg-foreground text-background border-foreground shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              )}
            >
              Todos ({totalDealsCount})
            </button>
            <button
              type="button"
              onClick={() => onHealthFilterChange("active")}
              className={cn(
                "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                healthFilter === "active"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <Flame className="w-3.5 h-3.5 text-blue-500" />
              Em Dia ({activeDealsCount})
            </button>
            <button
              type="button"
              onClick={() => onHealthFilterChange("stale")}
              className={cn(
                "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                healthFilter === "stale"
                  ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                  : "bg-card border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Parados &gt; 5d
              {staleDealsCount > 0 && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                    healthFilter === "stale" ? "bg-white/25 text-white" : "bg-amber-500 text-white"
                  )}
                >
                  {staleDealsCount}
                </span>
              )}
            </button>
            {criticalDealsCount > 0 && (
              <button
                type="button"
                onClick={() => onHealthFilterChange("critical")}
                className={cn(
                  "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                  healthFilter === "critical"
                    ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                    : "bg-card border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                )}
              >
                <AlertOctagon className="w-3.5 h-3.5 animate-pulse" />
                Críticos &gt; 10d ({criticalDealsCount})
              </button>
            )}
            {lostDealsCount > 0 && (
              <button
                type="button"
                onClick={() => onHealthFilterChange("lost")}
                className={cn(
                  "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                  healthFilter === "lost"
                    ? "bg-rose-800 text-white border-rose-800 shadow-xs"
                    : "bg-card border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <X className="w-3.5 h-3.5 text-rose-500" />
                Perdidos ({lostDealsCount})
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Banner de Atenção Comercial para Oportunidades Paradas */}
      {staleDealsCount > 0 && healthFilter === "all" && (
        <div className="mx-4 md:mx-6 mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs md:text-sm font-black text-foreground">
                  {staleDealsCount} {staleDealsCount === 1 ? "oportunidade parada" : "oportunidades paradas"} (&gt; 5 dias sem contato)
                </p>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  {formatCurrencyBRL(staleDealsValue, { maximumFractionDigits: 0 })} em risco
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Negócios sem atualização recente correm risco de esfriamento. Use o botão &quot;Resgatar&quot; no cartão para acionar o cliente via WhatsApp.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
