"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { 
  TrendingUp, 
  SlidersHorizontal, 
  ArrowRight, 
  Search, 
  X, 
  RotateCcw, 
  Users, 
  Building2, 
  Eye, 
  MessageSquare, 
  MoreHorizontal, 
  Check, 
  ExternalLink, 
  Trash2, 
  ChevronRight 
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Deal, Contact, Property, UserProfile, updateDeal, deleteDeal } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { STAGES } from "@/lib/constants";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { format } from "date-fns";

export interface RecentDealsTableProps {
  deals: Deal[];
  contacts: Contact[];
  properties: Property[];
  users: UserProfile[];
  customProbabilities: Record<string, number>;
  profile: UserProfile | null;
  onDealsChange?: React.Dispatch<React.SetStateAction<Deal[]>>;
  onRefreshData?: (showLoading?: boolean) => void;
  variants?: any;
}

export const RecentDealsTable = memo(function RecentDealsTable({
  deals,
  contacts,
  properties,
  users,
  customProbabilities,
  profile,
  onDealsChange,
  onRefreshData,
  variants
}: RecentDealsTableProps) {
  const router = useRouter();

  // Filter & Action States
  const [showDealFilter, setShowDealFilter] = useState(false);
  const [dealSearch, setDealSearch] = useState("");
  const [dealStageFilter, setDealStageFilter] = useState<string>("all");
  const [dealValueRange, setDealValueRange] = useState<string>("all");
  const [dealScoreFilter, setDealScoreFilter] = useState<string>("all");
  const [dealOwnerFilter, setDealOwnerFilter] = useState<string>("all");
  const [dealSortBy, setDealSortBy] = useState<string>("recent");
  const [dealLimit, setDealLimit] = useState<number>(6);
  const [activeDealMenu, setActiveDealMenu] = useState<string | null>(null);
  const [deletingDealId, setDeletingDealId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest?.('.deal-menu-container')) {
        setActiveDealMenu(null);
      }
    };
    if (activeDealMenu) {
      document.addEventListener('click', handleGlobalClick);
      return () => document.removeEventListener('click', handleGlobalClick);
    }
  }, [activeDealMenu]);

  // Indexed O(1) lookups for ultra-fast filtering and rendering
  const contactsMap = useMemo(() => new Map(contacts.map(c => [c.id, c])), [contacts]);
  const propertiesMap = useMemo(() => new Map(properties.map(p => [p.id, p])), [properties]);
  const usersMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const stagesMap = useMemo(() => new Map(STAGES.map(s => [s.id, s])), []);

  // Filtered and Sorted Recent Deals
  const filteredRecentDeals = useMemo(() => {
    let list = [...deals];

    // Text search (Title, Contact, Property)
    if (dealSearch.trim()) {
      const q = dealSearch.toLowerCase().trim();
      list = list.filter(d => {
        const title = (d.title || "").toLowerCase();
        const contact = contactsMap.get(d.contactId);
        const contactName = (contact?.name || "").toLowerCase();
        const prop = propertiesMap.get(d.propertyId);
        const propTitle = (prop?.title || "").toLowerCase();
        return title.includes(q) || contactName.includes(q) || propTitle.includes(q);
      });
    }

    // Stage filter
    if (dealStageFilter !== "all") {
      list = list.filter(d => d.stage === dealStageFilter);
    }

    // Value Range filter
    if (dealValueRange !== "all") {
      list = list.filter(d => {
        const val = Number(d.value) || 0;
        if (dealValueRange === "under-500k") return val < 500000;
        if (dealValueRange === "500k-1.5m") return val >= 500000 && val <= 1500000;
        if (dealValueRange === "1.5m-3m") return val > 1500000 && val <= 3000000;
        if (dealValueRange === "above-3m") return val > 3000000;
        return true;
      });
    }

    // Owner filter
    if (dealOwnerFilter !== "all") {
      list = list.filter(d => d.ownerId === dealOwnerFilter);
    }

    // Score filter
    if (dealScoreFilter !== "all") {
      list = list.filter(d => {
        const prob = customProbabilities[d.stage] ?? (d.stage === 'closed' ? 100 : (STAGES.findIndex(s => s.id === d.stage) + 1) * 20);
        if (dealScoreFilter === "high") return prob >= 70;
        if (dealScoreFilter === "medium") return prob >= 30 && prob < 70;
        if (dealScoreFilter === "low") return prob < 30;
        return true;
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (dealSortBy === "value-desc") return (b.value || 0) - (a.value || 0);
      if (dealSortBy === "value-asc") return (a.value || 0) - (b.value || 0);
      if (dealSortBy === "probability-desc") {
        const probA = customProbabilities[a.stage] ?? (a.stage === 'closed' ? 100 : (STAGES.findIndex(s => s.id === a.stage) + 1) * 20);
        const probB = customProbabilities[b.stage] ?? (b.stage === 'closed' ? 100 : (STAGES.findIndex(s => s.id === b.stage) + 1) * 20);
        return probB - probA;
      }
      if (dealSortBy === "title-asc") return (a.title || "").localeCompare(b.title || "");
      // Default: recent (updatedAt or createdAt)
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return list;
  }, [deals, dealSearch, dealStageFilter, dealValueRange, dealOwnerFilter, dealScoreFilter, dealSortBy, customProbabilities, contactsMap, propertiesMap]);

  const hasActiveDealFilters = dealSearch !== "" || dealStageFilter !== "all" || dealValueRange !== "all" || dealScoreFilter !== "all" || dealOwnerFilter !== "all" || dealSortBy !== "recent";
  const activeDealFilterCount = [
    dealSearch !== "",
    dealStageFilter !== "all",
    dealValueRange !== "all",
    dealScoreFilter !== "all",
    dealOwnerFilter !== "all",
    dealSortBy !== "recent"
  ].filter(Boolean).length;

  const clearDealFilters = useCallback(() => {
    setDealSearch("");
    setDealStageFilter("all");
    setDealValueRange("all");
    setDealScoreFilter("all");
    setDealOwnerFilter("all");
    setDealSortBy("recent");
  }, []);

  const filteredDealsTotalValue = useMemo(() => {
    return filteredRecentDeals.reduce((acc, d) => acc + (Number(d.value) || 0), 0);
  }, [filteredRecentDeals]);

  // Prepared Deals for display
  const displayRecentDeals = useMemo(() => {
    return filteredRecentDeals.slice(0, dealLimit).map(d => {
      const stage = stagesMap.get(d.stage);
      const contact = contactsMap.get(d.contactId);
      const property = propertiesMap.get(d.propertyId);
      const owner = usersMap.get(d.ownerId);

      return {
        id: d.id,
        raw: d,
        account: d.title,
        initials: (d.title || "LE").substring(0, 2).toUpperCase(),
        valueNum: Number(d.value) || 0,
        value: formatCurrencyBRL(d.value || 0),
        stageId: d.stage,
        stage: stage?.title || d.stage,
        color: stage?.color || 'slate',
        contactName: contact?.name,
        contactPhone: contact?.phone,
        propertyTitle: property?.title,
        ownerName: owner?.displayName || owner?.name,
        date: d.updatedAt ? format(new Date(d.updatedAt), "dd/MM/yyyy") : '-',
        probability: customProbabilities[d.stage] ?? (d.stage === 'closed' ? 100 : (STAGES.findIndex(s => s.id === d.stage) + 1) * 20)
      };
    });
  }, [filteredRecentDeals, dealLimit, contactsMap, propertiesMap, usersMap, stagesMap, customProbabilities]);

  // Fast stage advance handler
  const handleAdvanceStage = useCallback(async (dealId: string, currentStageId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentIndex = STAGES.findIndex(s => s.id === currentStageId);
    if (currentIndex === -1 || currentIndex >= STAGES.length - 1) {
      toast.info("Este negócio já está na fase final (Vendido / Alugado).");
      return;
    }
    const nextStage = STAGES[currentIndex + 1];
    try {
      if (onDealsChange) {
        onDealsChange(prev => prev.map(d => d.id === dealId ? { ...d, stage: nextStage.id, updatedAt: new Date().toISOString() } : d));
      }
      await updateDeal(dealId, { stage: nextStage.id });
      recordAuditEvent({
        action: 'UPDATE_DEAL_STAGE',
        title: 'Avanço de Etapa no Funil',
        content: `Negócio avançado para "${nextStage.title}".`,
        severity: 'low',
        category: 'modification',
        relatedId: dealId,
        entityType: 'deal',
        metadata: { newStage: nextStage.id, stageTitle: nextStage.title }
      });
      toast.success(`Avançado para: ${nextStage.title}`);
    } catch {
      toast.error("Não foi possível atualizar a etapa.");
      if (onRefreshData) onRefreshData(false);
    }
  }, [onDealsChange, onRefreshData]);

  // Change stage directly
  const handleChangeStage = useCallback(async (dealId: string, targetStageId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetStage = STAGES.find(s => s.id === targetStageId);
    if (!targetStage) return;
    try {
      if (onDealsChange) {
        onDealsChange(prev => prev.map(d => d.id === dealId ? { ...d, stage: targetStage.id, updatedAt: new Date().toISOString() } : d));
      }
      await updateDeal(dealId, { stage: targetStage.id });
      recordAuditEvent({
        action: 'UPDATE_DEAL_STAGE',
        title: 'Alteração de Etapa do Negócio',
        content: `Negócio alterado para "${targetStage.title}".`,
        severity: 'low',
        category: 'modification',
        relatedId: dealId,
        entityType: 'deal',
        metadata: { newStage: targetStage.id, stageTitle: targetStage.title }
      });
      toast.success(`Etapa alterada para ${targetStage.title}!`);
      setActiveDealMenu(null);
    } catch {
      toast.error("Erro ao alterar etapa.");
      if (onRefreshData) onRefreshData(false);
    }
  }, [onDealsChange, onRefreshData]);

  // Delete deal from dashboard
  const handleDeleteDeal = useCallback(async (id: string, title?: string) => {
    try {
      if (onDealsChange) {
        onDealsChange(prev => prev.filter(d => d.id !== id));
      }
      await deleteDeal(id);
      recordAuditEvent({
        action: 'DELETE_DEAL',
        title: 'Exclusão de Negócio pelo Dashboard',
        content: `Negócio "${title || id}" foi excluído.`,
        severity: 'high',
        category: 'deletion',
        relatedId: id,
        entityType: 'deal',
        metadata: { dealId: id, title }
      });
      toast.success("Negócio excluído com sucesso.");
      setDeletingDealId(null);
      setActiveDealMenu(null);
    } catch {
      toast.error("Erro ao excluir negócio.");
      if (onRefreshData) onRefreshData(false);
    }
  }, [onDealsChange, onRefreshData]);

  return (
    <motion.div 
      variants={variants}
      className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 sm:p-5 md:p-6 shadow-sm overflow-hidden card-hover"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-inner">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Negócios Recentes</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-bold text-muted-foreground border border-border">
                {filteredRecentDeals.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Últimas movimentações e gestão do funil</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter Toggle Button */}
          <button 
            onClick={() => setShowDealFilter(prev => !prev)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs",
              showDealFilter 
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/30" 
                : hasActiveDealFilters
                  ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
            title="Filtrar negócios recentes"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeDealFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center -mr-0.5 shadow-xs animate-in zoom-in">
                {activeDealFilterCount}
              </span>
            )}
          </button>

          {/* Pipeline Button */}
          <button 
            onClick={() => router.push("/pipeline")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[10px] font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-all font-sans uppercase tracking-widest flex items-center gap-1.5"
          >
            <span>Pipeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable Filter Panel */}
      <AnimatePresence>
        {showDealFilter && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-muted/40 rounded-2xl md:rounded-3xl border border-border p-5 md:p-6 space-y-4 shadow-inner">
              {/* Top row: Search + Quick Reset */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    value={dealSearch}
                    onChange={(e) => setDealSearch(e.target.value)}
                    placeholder="Buscar por título do negócio, cliente ou imóvel..."
                    className="w-full pl-10 pr-9 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                  {dealSearch && (
                    <button 
                      onClick={() => setDealSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {hasActiveDealFilters && (
                  <button 
                    onClick={clearDealFilters}
                    className="text-xs text-muted-foreground hover:text-primary font-bold flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Limpar Filtros
                  </button>
                )}
              </div>

              {/* Filter Selects Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Fase */}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Fase do Funil
                  </label>
                  <select 
                    value={dealStageFilter}
                    onChange={(e) => setDealStageFilter(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl text-xs px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-medium"
                  >
                    <option value="all">Todas as Fases ({deals.length})</option>
                    {STAGES.map(stage => (
                      <option key={stage.id} value={stage.id}>
                        {stage.title} ({deals.filter(d => d.stage === stage.id).length})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Faixa de Valor */}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Faixa de Valor
                  </label>
                  <select 
                    value={dealValueRange}
                    onChange={(e) => setDealValueRange(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl text-xs px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-medium"
                  >
                    <option value="all">Todos os Valores</option>
                    <option value="under-500k">Até R$ 500 mil</option>
                    <option value="500k-1.5m">R$ 500k a R$ 1,5M</option>
                    <option value="1.5m-3m">R$ 1,5M a R$ 3M</option>
                    <option value="above-3m">Acima de R$ 3M</option>
                  </select>
                </div>

                {/* Score / Probabilidade */}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Probabilidade
                  </label>
                  <select 
                    value={dealScoreFilter}
                    onChange={(e) => setDealScoreFilter(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl text-xs px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-medium"
                  >
                    <option value="all">Todos os Scores</option>
                    <option value="high">Alta Chance (≥ 70%)</option>
                    <option value="medium">Média Chance (30-69%)</option>
                    <option value="low">Inicial (&lt; 30%)</option>
                  </select>
                </div>

                {/* Ordenação */}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Ordenar Por
                  </label>
                  <select 
                    value={dealSortBy}
                    onChange={(e) => setDealSortBy(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl text-xs px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-medium"
                  >
                    <option value="recent">Mais Recentes</option>
                    <option value="value-desc">Maior Valor (R$)</option>
                    <option value="value-asc">Menor Valor (R$)</option>
                    <option value="probability-desc">Maior Score (%)</option>
                    <option value="title-asc">Ordem Alfabética (A-Z)</option>
                  </select>
                </div>

                {/* Exibição */}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Exibição
                  </label>
                  <select 
                    value={dealLimit}
                    onChange={(e) => setDealLimit(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl text-xs px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-medium"
                  >
                    <option value={4}>4 negócios</option>
                    <option value={6}>6 negócios</option>
                    <option value={10}>10 negócios</option>
                    <option value={999}>Todos ({filteredRecentDeals.length})</option>
                  </select>
                </div>
              </div>

              {/* Quick Stage Chips */}
              <div className="pt-2 border-t border-border/60 flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
                  Etapas:
                </span>
                <button
                  onClick={() => setDealStageFilter("all")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0",
                    dealStageFilter === "all" 
                      ? "bg-foreground text-background shadow-xs" 
                      : "bg-background text-muted-foreground hover:text-foreground border border-border"
                  )}
                >
                  Todas ({deals.length})
                </button>
                {STAGES.map(stage => {
                  const count = deals.filter(d => d.stage === stage.id).length;
                  const isSelected = dealStageFilter === stage.id;
                  return (
                    <button
                      key={stage.id}
                      onClick={() => setDealStageFilter(stage.id)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border",
                        isSelected 
                          ? "bg-primary text-primary-foreground border-primary shadow-xs" 
                          : "bg-background text-muted-foreground hover:text-foreground border-border"
                      )}
                    >
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        stage.color === 'emerald' ? "bg-emerald-500" :
                        stage.color === 'blue' ? "bg-blue-500" :
                        stage.color === 'purple' ? "bg-purple-500" :
                        stage.color === 'orange' ? "bg-orange-500" :
                        "bg-yellow-500"
                      )} />
                      <span>{stage.title}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full",
                        isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Filter Badges Bar */}
      {hasActiveDealFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-muted/20 border border-border rounded-xl">
          <span className="text-[11px] font-bold text-muted-foreground">Filtros ativos:</span>
          
          {dealSearch && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border text-foreground rounded-lg text-xs font-medium">
              Busca: &ldquo;{dealSearch}&rdquo;
              <button onClick={() => setDealSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {dealStageFilter !== "all" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border text-foreground rounded-lg text-xs font-medium">
              Etapa: {STAGES.find(s => s.id === dealStageFilter)?.title}
              <button onClick={() => setDealStageFilter("all")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {dealValueRange !== "all" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border text-foreground rounded-lg text-xs font-medium">
              Valor: {
                dealValueRange === 'under-500k' ? 'Até R$ 500k' :
                dealValueRange === '500k-1.5m' ? 'R$ 500k a R$ 1,5M' :
                dealValueRange === '1.5m-3m' ? 'R$ 1,5M a R$ 3M' : 'Acima de R$ 3M'
              }
              <button onClick={() => setDealValueRange("all")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {dealScoreFilter !== "all" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border text-foreground rounded-lg text-xs font-medium">
              Score: {
                dealScoreFilter === 'high' ? 'Alta (≥ 70%)' :
                dealScoreFilter === 'medium' ? 'Média (30-69%)' : 'Inicial (< 30%)'
              }
              <button onClick={() => setDealScoreFilter("all")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {dealSortBy !== "recent" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border text-foreground rounded-lg text-xs font-medium">
              Ordem: {
                dealSortBy === 'value-desc' ? 'Maior Valor' :
                dealSortBy === 'value-asc' ? 'Menor Valor' :
                dealSortBy === 'probability-desc' ? 'Maior Score' : 'A-Z'
              }
              <button onClick={() => setDealSortBy("recent")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            Total: <strong className="text-foreground">{formatCurrencyBRL(filteredDealsTotalValue, { maximumFractionDigits: 0 })}</strong>
          </span>
        </div>
      )}
      
      {/* Deals Table */}
      <div className="overflow-x-auto w-full">
        <table className="w-full border-separate border-spacing-y-2 md:border-spacing-y-2.5">
          <thead>
            <tr className="text-[9.5px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
              <th className="px-3.5 md:px-4 pb-1.5">Empresa / Projeto</th>
              <th className="px-3.5 md:px-4 pb-1.5">Valor</th>
              <th className="px-3.5 md:px-4 pb-1.5">Fase Atual</th>
              <th className="px-3.5 md:px-4 pb-1.5">Score</th>
              <th className="px-3.5 md:px-4 pb-1.5 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {displayRecentDeals.length > 0 ? displayRecentDeals.map((deal) => (
              <tr 
                key={deal.id} 
                className="group cursor-pointer"
                onClick={() => router.push(`/deals/${deal.id}`)}
              >
                {/* EMPRESA / PROJETO */}
                <td className="px-3.5 md:px-4 py-2.5 md:py-3 bg-muted/30 group-hover:bg-card border-y border-l border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-md transition-all rounded-l-xl md:rounded-l-2xl">
                  <div className="flex items-center gap-2.5 md:gap-3">
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-[10px] md:text-xs font-bold bg-background text-primary shadow-xs shrink-0 border border-border">
                      {deal.initials}
                    </div>
                    <div className="min-w-0 max-w-[200px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                      <span className="text-xs md:text-sm font-bold text-foreground group-hover:text-primary transition-colors uppercase tracking-tight block truncate">
                        {deal.account}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 truncate">
                        {deal.contactName && (
                          <span className="flex items-center gap-1 font-medium truncate">
                            <Users className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                            <span className="truncate">{deal.contactName}</span>
                          </span>
                        )}
                        {deal.propertyTitle && (
                          <span className="flex items-center gap-1 text-muted-foreground/80 truncate">
                            <span>•</span>
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span className="truncate">{deal.propertyTitle}</span>
                          </span>
                        )}
                        {deal.ownerName && profile?.role === 'Admin' && (
                          <span className="text-[10px] text-muted-foreground/60 hidden lg:inline shrink-0">
                            • {deal.ownerName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                {/* VALOR */}
                <td className="px-3.5 md:px-4 py-2.5 md:py-3 bg-muted/30 group-hover:bg-card border-y border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-md transition-all whitespace-nowrap">
                  <span className="text-xs md:text-sm font-bold text-foreground tracking-tight">{deal.value}</span>
                </td>

                {/* FASE ATUAL */}
                <td className="px-3.5 md:px-4 py-2.5 md:py-3 bg-muted/30 group-hover:bg-card border-y border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-md transition-all whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9.5px] md:text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset shadow-xs",
                      deal.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20" :
                      deal.color === 'blue' ? "bg-primary/10 text-primary ring-primary/20" :
                      deal.color === 'purple' ? "bg-purple-500/10 text-purple-500 ring-purple-500/20" :
                      deal.color === 'orange' ? "bg-orange-500/10 text-orange-500 ring-orange-500/20" :
                      "bg-yellow-500/10 text-yellow-500 ring-yellow-500/20"
                    )}>
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse shrink-0",
                        deal.color === 'emerald' ? "bg-emerald-500" :
                        deal.color === 'blue' ? "bg-primary" :
                        deal.color === 'purple' ? "bg-purple-500" :
                        deal.color === 'orange' ? "bg-orange-500" :
                        "bg-yellow-500"
                      )} />
                      {deal.stage}
                    </span>

                    {/* Quick advance button if not closed */}
                    {deal.stageId !== 'closed' && (
                      <button
                        onClick={(e) => handleAdvanceStage(deal.id, deal.stageId, e)}
                        className="p-1 rounded-md bg-background hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors border border-border opacity-0 group-hover:opacity-100"
                        title="Avançar para próxima etapa no funil"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>

                {/* SCORE */}
                <td className="px-3.5 md:px-4 py-2.5 md:py-3 bg-muted/30 group-hover:bg-card border-y border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-md transition-all whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] md:text-[11px] font-bold text-muted-foreground w-8">{deal.probability}%</span>
                    <div className="h-1.5 w-16 sm:w-20 bg-background rounded-full overflow-hidden shadow-inner ring-1 ring-border">
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

                {/* AÇÃO */}
                <td className="px-3.5 md:px-4 py-2.5 md:py-3 bg-muted/30 group-hover:bg-card border-y border-r border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-md transition-all rounded-r-xl md:rounded-r-2xl text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1 deal-menu-container" onClick={(e) => e.stopPropagation()}>
                    {/* Quick View Details Button */}
                    <button
                      onClick={() => router.push(`/deals/${deal.id}`)}
                      className="p-1.5 hover:bg-background rounded-lg transition-all text-muted-foreground hover:text-primary border border-transparent hover:border-border shadow-xs"
                      title="Ver Detalhes 360°"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* WhatsApp Button if phone exists */}
                    {deal.contactPhone && (
                      <a
                        href={`https://wa.me/55${deal.contactPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-emerald-500/10 rounded-lg transition-all text-muted-foreground hover:text-emerald-500 border border-transparent hover:border-emerald-500/20 shadow-xs"
                        title={`Conversar no WhatsApp (${deal.contactPhone})`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Dropdown Menu Button */}
                    <div className="relative">
                      <button 
                        onClick={() => setActiveDealMenu(activeDealMenu === deal.id ? null : deal.id)}
                        className={cn(
                          "p-1.5 rounded-lg transition-all border shadow-xs",
                          activeDealMenu === deal.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground border-border"
                        )}
                        title="Mais opções de ação"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {/* Action Dropdown Menu */}
                      {activeDealMenu === deal.id && (
                        <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-2xl p-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                          <div className="px-2.5 py-1 text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border mb-1">
                            Ações Rápidas
                          </div>

                          <button
                            onClick={() => {
                              setActiveDealMenu(null);
                              router.push(`/deals/${deal.id}`);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-primary" />
                            <span>Ver Ficha Completa</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveDealMenu(null);
                              router.push("/pipeline");
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-primary" />
                            <span>Abrir no Funil Kanban</span>
                          </button>

                          {/* Sub-menu: Alterar Etapa */}
                          <div className="my-1 border-t border-border pt-1">
                            <div className="px-2.5 py-1 text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
                              Mover para Etapa
                            </div>
                            {STAGES.map(stage => (
                              <button
                                key={stage.id}
                                onClick={(e) => handleChangeStage(deal.id, stage.id, e)}
                                className={cn(
                                  "w-full px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center justify-between transition-colors",
                                  deal.stageId === stage.id
                                    ? "bg-primary/10 text-primary font-bold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                              >
                                <span className="flex items-center gap-2">
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    stage.color === 'emerald' ? "bg-emerald-500" :
                                    stage.color === 'blue' ? "bg-blue-500" :
                                    stage.color === 'purple' ? "bg-purple-500" :
                                    stage.color === 'orange' ? "bg-orange-500" :
                                    "bg-yellow-500"
                                  )} />
                                  {stage.title}
                                </span>
                                {deal.stageId === stage.id && (
                                  <Check className="w-3 h-3 text-primary" />
                                )}
                              </button>
                            ))}
                          </div>

                          {/* Delete action */}
                          <div className="mt-1 border-t border-border pt-1">
                            <button
                              onClick={() => {
                                setActiveDealMenu(null);
                                setDeletingDealId(deal.id);
                              }}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-lg flex items-center gap-2 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Excluir Negócio</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-2.5">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                      <Search className="w-5 h-5" />
                    </div>
                    <h4 className="text-xs font-bold text-foreground">Nenhum negócio encontrado</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Nenhum negócio corresponde aos filtros aplicados no momento.
                    </p>
                    {hasActiveDealFilters && (
                      <button
                        onClick={clearDealFilters}
                        className="mt-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:opacity-90 transition-opacity"
                      >
                        Limpar Filtros
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer: Count & Ver Mais */}
      <div className="mt-4 pt-3.5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Exibindo <strong className="text-foreground">{displayRecentDeals.length}</strong> de <strong className="text-foreground">{filteredRecentDeals.length}</strong> negócios encontrados
          {filteredRecentDeals.length !== deals.length && ` (total cadastrado: ${deals.length})`}
        </p>

        <div className="flex items-center gap-2.5">
          {filteredRecentDeals.length > displayRecentDeals.length && (
            <button
              onClick={() => setDealLimit(prev => prev + 4)}
              className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-colors"
            >
              Ver Mais (+4)
            </button>
          )}

          <button
            onClick={() => router.push("/pipeline")}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Abrir Funil Completo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence>
        {deletingDealId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Excluir Negócio?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Tem certeza de que deseja remover esta oportunidade? Esta ação será registrada no log de auditoria da imobiliária.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setDeletingDealId(null)}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const target = deals.find(d => d.id === deletingDealId);
                    handleDeleteDeal(deletingDealId, target?.title);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default RecentDealsTable;
