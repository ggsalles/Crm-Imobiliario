"use client";

import { useState, useMemo, useEffect, memo } from "react";
import { 
  X, 
  Sparkles, 
  Calculator, 
  TrendingUp, 
  CheckCircle2, 
  Calendar, 
  Percent,
  DollarSign,
  Sliders,
  CheckSquare,
  Square
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PIPELINE_STAGES } from "@/lib/constants";
import { formatCurrencyBRL, parseCurrencyBRLToNumber } from "@/lib/utils";
import { safeSetJson } from "@/lib/safe-storage";

export interface GoalSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: string;
  onApplyGoals: (goals: Record<string, number>) => Promise<void>;
  initialClosedGoal?: number;
  currentProbabilities?: Record<string, number>;
  onUpdateProbabilities?: (probs: Record<string, number>) => void;
}

type ModeType = "sales_target" | "commission_target";
type PresetType = "current" | "conservative" | "standard" | "high_performance" | "custom";

const PRESET_DEFINITIONS: Record<Exclude<PresetType, "current" | "custom">, { label: string; desc: string; rates: Record<string, number> }> = {
  standard: {
    label: "Padrão do Mercado",
    desc: "Média recomendada para o mercado imobiliário",
    rates: {
      lead: 15,
      qualification: 35,
      proposal: 60,
      negotiation: 85,
      closed: 100,
      lost: 0,
    },
  },
  conservative: {
    label: "Conservador",
    desc: "Mais leads e visitas necessárias para garantir a meta",
    rates: {
      lead: 10,
      qualification: 25,
      proposal: 45,
      negotiation: 70,
      closed: 100,
      lost: 0,
    },
  },
  high_performance: {
    label: "Alta Performance",
    desc: "Leads qualificados e alta taxa de conversão",
    rates: {
      lead: 25,
      qualification: 50,
      proposal: 75,
      negotiation: 90,
      closed: 100,
      lost: 0,
    },
  },
};

export const GoalSimulatorModal = memo(function GoalSimulatorModal({
  isOpen,
  onClose,
  currentMonth,
  onApplyGoals,
  initialClosedGoal = 1000000,
  currentProbabilities = {
    lead: 20,
    qualification: 40,
    proposal: 60,
    negotiation: 80,
    closed: 100,
    lost: 0,
  },
  onUpdateProbabilities,
}: GoalSimulatorModalProps) {
  const [mode, setMode] = useState<ModeType>("sales_target");
  const [salesTargetInput, setSalesTargetInput] = useState(
    formatCurrencyBRL(initialClosedGoal > 0 ? initialClosedGoal : 1000000)
  );
  const [commissionTargetInput, setCommissionTargetInput] = useState("R$ 30.000,00");
  const [commissionPercent, setCommissionPercent] = useState<number>(4);
  const [avgTicketInput, setAvgTicketInput] = useState("R$ 500.000,00");
  const [selectedPreset, setSelectedPreset] = useState<PresetType>("current");
  const [customRates, setCustomRates] = useState<Record<string, number>>({ ...currentProbabilities });
  const [syncProbabilitiesWithPipeline, setSyncProbabilitiesWithPipeline] = useState(true);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCustomRates({ ...currentProbabilities });
      if (initialClosedGoal > 0) {
        setSalesTargetInput(formatCurrencyBRL(initialClosedGoal));
      }
    }
  }, [isOpen, currentProbabilities, initialClosedGoal]);

  // Cálculos Básicos
  const avgTicket = useMemo(() => {
    const val = parseCurrencyBRLToNumber(avgTicketInput);
    return val > 0 ? val : 500000;
  }, [avgTicketInput]);

  const targetSalesVGV = useMemo(() => {
    if (mode === "sales_target") {
      const val = parseCurrencyBRLToNumber(salesTargetInput);
      return val > 0 ? val : 1000000;
    } else {
      const comm = parseCurrencyBRLToNumber(commissionTargetInput);
      const rate = commissionPercent > 0 ? commissionPercent / 100 : 0.04;
      return comm / rate;
    }
  }, [mode, salesTargetInput, commissionTargetInput, commissionPercent]);

  const estimatedCommission = useMemo(() => {
    return targetSalesVGV * (commissionPercent / 100);
  }, [targetSalesVGV, commissionPercent]);

  const unitsNeeded = useMemo(() => {
    return Math.max(1, Math.round((targetSalesVGV / avgTicket) * 10) / 10);
  }, [targetSalesVGV, avgTicket]);

  // Determinação das taxas ativas
  const activeRates = useMemo(() => {
    if (selectedPreset === "current") {
      return currentProbabilities;
    }
    if (selectedPreset === "custom") {
      return customRates;
    }
    return PRESET_DEFINITIONS[selectedPreset].rates;
  }, [selectedPreset, currentProbabilities, customRates]);

  // Engenharia Reversa por Etapa
  const simulationResults = useMemo(() => {
    const stageValues: Record<string, { value: number; count: number; rate: number }> = {};

    PIPELINE_STAGES.forEach((stage) => {
      if (stage.id === "lost") return;

      const rawRate = activeRates[stage.id] ?? 100;
      const rate = Math.max(1, Math.min(100, rawRate));
      
      // Volume financeiro necessário na etapa = Meta de Vendas / (Taxa / 100)
      const requiredValue = targetSalesVGV / (rate / 100);
      const requiredCount = Math.ceil(requiredValue / avgTicket);

      stageValues[stage.id] = {
        value: Math.round(requiredValue),
        count: requiredCount,
        rate,
      };
    });

    return stageValues;
  }, [targetSalesVGV, activeRates, avgTicket]);

  // Plano Tático de Atividades (Baseado em 22 dias úteis e 4 semanas)
  const tacticalPlan = useMemo(() => {
    const leadsNeeded = simulationResults["lead"]?.count || 10;
    const visitsNeeded = simulationResults["qualification"]?.count || 4;
    const proposalsNeeded = simulationResults["proposal"]?.count || 2;

    return {
      dailyLeads: Math.max(1, Math.round((leadsNeeded / 22) * 10) / 10),
      weeklyVisits: Math.max(1, Math.round((visitsNeeded / 4) * 10) / 10),
      weeklyProposals: Math.max(1, Math.round((proposalsNeeded / 4) * 10) / 10),
      unitsToClose: unitsNeeded,
    };
  }, [simulationResults, unitsNeeded]);

  const handleApply = async () => {
    try {
      setIsApplying(true);
      const goalsToSave: Record<string, number> = {};
      PIPELINE_STAGES.forEach((stage) => {
        if (stage.id === "lost") {
          goalsToSave[stage.id] = 0;
        } else if (stage.id === "closed") {
          goalsToSave[stage.id] = targetSalesVGV;
        } else {
          goalsToSave[stage.id] = simulationResults[stage.id]?.value || targetSalesVGV;
        }
      });

      // 1. Salva as metas em R$ no banco de dados
      await onApplyGoals(goalsToSave);

      // 2. Se o usuário marcou para sincronizar as probabilidades no pipeline
      if (syncProbabilitiesWithPipeline) {
        const probsToSave: Record<string, number> = {
          lead: activeRates.lead ?? 20,
          qualification: activeRates.qualification ?? 40,
          proposal: activeRates.proposal ?? 60,
          negotiation: activeRates.negotiation ?? 80,
          closed: 100,
          lost: 0,
        };
        safeSetJson("pipeline_probabilities", probsToSave);
        if (onUpdateProbabilities) {
          onUpdateProbabilities(probsToSave);
        }
        window.dispatchEvent(new Event("storage_probabilities_updated"));
      }

      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-3xl p-5 sm:p-7 w-full max-w-2xl relative shadow-2xl border border-border z-10 flex flex-col max-h-[92vh] my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                    Simulador & Calculadora Reversa de Metas
                  </h2>
                  <p className="text-xs text-muted-foreground font-medium">
                    Descubra exatamente quantos contatos e visitas você precisa gerar para bater sua meta em {currentMonth}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto pr-1 -mr-1 space-y-5 my-4 flex-1 text-start">
              {/* 1. Escolha do Ponto de Partida */}
              <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    1. Seu Objetivo Principal
                  </label>
                  <div className="flex bg-muted/60 p-0.5 rounded-xl border border-border text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setMode("sales_target")}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        mode === "sales_target" ? "bg-primary text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Meta de Vendas (VGV)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("commission_target")}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        mode === "commission_target" ? "bg-primary text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Renda / Comissão no Bolso
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {mode === "sales_target" ? (
                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">Valor Total que Deseja Vender (R$)</span>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={salesTargetInput}
                          onChange={(e) => setSalesTargetInput(formatCurrencyBRL(e.target.value))}
                          placeholder="R$ 1.000.000,00"
                          className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl font-bold text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">Quanto Deseja Ganhar Líquido (R$)</span>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={commissionTargetInput}
                          onChange={(e) => setCommissionTargetInput(formatCurrencyBRL(e.target.value))}
                          placeholder="R$ 30.000,00"
                          className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl font-bold text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">Sua Comissão Média (%)</span>
                    <div className="relative">
                      <Percent className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="0.5"
                        max="20"
                        step="0.5"
                        value={commissionPercent}
                        onChange={(e) => setCommissionPercent(Number(e.target.value) || 4)}
                        className="w-full px-3 py-2.5 bg-card border border-border rounded-xl font-bold text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Parâmetro de Ticket Médio e Perfil */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">Ticket Médio dos Imóveis</span>
                    <input
                      type="text"
                      value={avgTicketInput}
                      onChange={(e) => setAvgTicketInput(formatCurrencyBRL(e.target.value))}
                      placeholder="R$ 500.000,00"
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl font-bold text-xs sm:text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">Taxas de Probabilidade / Conversão</span>
                    <select
                      value={selectedPreset}
                      onChange={(e) => setSelectedPreset(e.target.value as PresetType)}
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl font-bold text-xs sm:text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                    >
                      <option value="current">Minhas Probabilidades Atuais ({currentProbabilities.lead || 20}%, {currentProbabilities.qualification || 40}%, {currentProbabilities.proposal || 60}%, {currentProbabilities.negotiation || 80}%)</option>
                      <option value="standard">Padrão Imobiliário (15%, 35%, 60%, 85%)</option>
                      <option value="conservative">Conservador (10%, 25%, 45%, 70%)</option>
                      <option value="high_performance">Alta Performance (25%, 50%, 75%, 90%)</option>
                      <option value="custom">Personalizar Taxas Manualmente...</option>
                    </select>
                  </div>
                </div>

                {/* Edição Manual se 'custom' estiver selecionado */}
                {selectedPreset === "custom" && (
                  <div className="pt-2 border-t border-border/40 space-y-2">
                    <p className="text-[11px] font-bold text-foreground flex items-center gap-1">
                      <Sliders className="w-3 h-3 text-primary" />
                      Ajuste as Probabilidades de Fechamento de cada Etapa (%):
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PIPELINE_STAGES.filter(s => s.id !== "closed" && s.id !== "lost").map(stage => (
                        <div key={stage.id} className="bg-card p-2 rounded-xl border border-border">
                          <label className="text-[9px] font-bold text-muted-foreground block truncate">{stage.title}</label>
                          <div className="flex items-center gap-1 mt-1">
                            <input
                              type="number"
                              min="1"
                              max="99"
                              value={customRates[stage.id] ?? 20}
                              onChange={(e) => setCustomRates(prev => ({
                                ...prev,
                                [stage.id]: Number(e.target.value) || 1
                              }))}
                              className="w-full bg-muted/30 px-2 py-1 rounded font-bold text-xs outline-none"
                            />
                            <span className="text-xs font-bold text-muted-foreground">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Cartões de Resumo Executivo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 text-center">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Vendas Necessárias</p>
                  <p className="text-base sm:text-lg font-black text-foreground">{formatCurrencyBRL(targetSalesVGV)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">~{unitsNeeded} {unitsNeeded === 1 ? 'imóvel' : 'imóveis'}</p>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3 text-center">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-0.5">Comissão Estimada</p>
                  <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrencyBRL(estimatedCommission)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">{commissionPercent}% de comissão</p>
                </div>

                <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-3 text-center">
                  <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-0.5">Leads Necessários</p>
                  <p className="text-base sm:text-lg font-black text-foreground">{simulationResults["lead"]?.count || 0} contatos</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">no topo do funil</p>
                </div>
              </div>

              {/* 3. Engenharia Reversa por Etapas do Funil */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                    Engenharia Reversa das Etapas (Valores a Aplicar nas Metas)
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-semibold">Probabilidade usada</span>
                </div>

                <div className="space-y-2">
                  {PIPELINE_STAGES.filter(s => s.id !== "lost").map((stage) => {
                    const res = simulationResults[stage.id];
                    const isClosed = stage.id === "closed";
                    return (
                      <div
                        key={stage.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isClosed 
                            ? "bg-emerald-500/10 border-emerald-500/30" 
                            : "bg-muted/20 border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              stage.color === "blue"
                                ? "bg-primary"
                                : stage.color === "purple"
                                ? "bg-purple-500"
                                : stage.color === "orange"
                                ? "bg-orange-500"
                                : stage.color === "yellow"
                                ? "bg-yellow-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          <div>
                            <p className="text-xs font-bold text-foreground leading-tight">{stage.title}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">
                              Probabilidade aplicada: <span className="font-bold text-primary">{res?.rate || 100}%</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs sm:text-sm font-black text-foreground">
                            {formatCurrencyBRL(isClosed ? targetSalesVGV : (res?.value || 0))}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-semibold">
                            ~{isClosed ? unitsNeeded : (res?.count || 0)} oportunidades
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Opção de Sincronizar Probabilidades */}
              <div 
                onClick={() => setSyncProbabilitiesWithPipeline(!syncProbabilitiesWithPipeline)}
                className="flex items-center gap-3 p-3 bg-card border border-primary/30 rounded-2xl cursor-pointer hover:bg-primary/5 transition-all"
              >
                {syncProbabilitiesWithPipeline ? (
                  <CheckSquare className="w-5 h-5 text-primary shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
                <div className="text-left">
                  <p className="text-xs font-bold text-foreground">
                    Sincronizar e atualizar as probabilidades das colunas do Pipeline ({activeRates.lead || 20}%, {activeRates.qualification || 40}%, {activeRates.proposal || 60}%, {activeRates.negotiation || 80}%)
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Atualiza tanto as metas em R$ quanto as tags de probabilidade exibidas nos cabeçalhos das colunas e nas Configurações.
                  </p>
                </div>
              </div>

              {/* 4. Plano de Ação Tático do Corretor */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Seu Plano de Atividades Recomendado (Ritmo de Trabalho)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-foreground font-medium pt-1">
                  <div className="bg-card p-2.5 rounded-xl border border-border flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="font-bold text-foreground">{tacticalPlan.dailyLeads} novos leads / dia</p>
                      <p className="text-[10px] text-muted-foreground">Prospecção diária constante</p>
                    </div>
                  </div>
                  <div className="bg-card p-2.5 rounded-xl border border-border flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                    <div>
                      <p className="font-bold text-foreground">{tacticalPlan.weeklyVisits} visitas / semana</p>
                      <p className="text-[10px] text-muted-foreground">Apresentações presenciais</p>
                    </div>
                  </div>
                  <div className="bg-card p-2.5 rounded-xl border border-border flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-bold text-foreground">{tacticalPlan.weeklyProposals} propostas / semana</p>
                      <p className="text-[10px] text-muted-foreground">Para fechar {unitsNeeded} {unitsNeeded === 1 ? 'venda' : 'vendas'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="pt-3 border-t border-border flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 font-bold text-xs sm:text-sm text-muted-foreground hover:bg-muted rounded-2xl transition-all cursor-pointer border border-border"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={handleApply}
                className="flex-1 py-3 px-4 font-bold text-xs sm:text-sm bg-primary text-white rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isApplying ? "Aplicando..." : "Aplicar Automaticamente ao Funil"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
