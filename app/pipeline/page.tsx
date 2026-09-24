"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from "react";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { recordAuditEvent } from "@/lib/audit";
import { 
  Trello, 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  LayoutGrid, 
  List,
  ChevronRight,
  Clock,
  Building2,
  Trash2,
  Edit2,
  ExternalLink,
  X,
  Loader2,
  Target,
  AlertTriangle,
  AlertOctagon,
  MessageCircle,
  RotateCcw,
  Flame,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { SoundControlButton } from "@/components/NewLeadSoundNotifier";
import { 
  Deal, 
  Company, 
  Contact, 
  Goal,
  subscribeToDeals, 
  subscribeToCompanies, 
  subscribeToContacts,
  subscribeToGoals,
  subscribeToProperties,
  subscribeToUsers,
  createDeal,
  updateDeal,
  deleteDeal,
  setGoal,
  createCompany,
  createTimelineEvent,
  Property,
  getDeals,
  getGoals,
  UserProfile,
} from "@/lib/db";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { cn, formatCurrencyBRL, parseCurrencyBRLToNumber } from "@/lib/utils";
import { getDealStaleInfo, getWhatsAppRescueUrl, LOST_REASONS } from "@/lib/lead-health";
import Link from "next/link";

const STAGES = [
  { id: "lead", title: "Novo Lead", color: "bg-primary" },
  { id: "qualification", title: "Qualificação / Visita", color: "bg-purple-500" },
  { id: "proposal", title: "Proposta", color: "bg-orange-500" },
  { id: "negotiation", title: "Análise Jurídica", color: "bg-yellow-500" },
  { id: "closed", title: "Vendido / Alugado", color: "bg-emerald-500" },
  { id: "lost", title: "Perdido / Desistência", color: "bg-rose-500" },
];

const BADGE_COLORS: Record<string, string> = {
  lead: "bg-blue-500/10 text-blue-500 border border-blue-500/20",
  qualification: "bg-purple-500/10 text-purple-500 border border-purple-500/20",
  proposal: "bg-orange-500/10 text-orange-500 border border-orange-500/20",
  negotiation: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
  closed: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
  lost: "bg-rose-500/10 text-rose-500 border border-rose-500/20",
};

export default function PipelinePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isLostReasonModalOpen, setIsLostReasonModalOpen] = useState(false);
  const [pendingLostDeal, setPendingLostDeal] = useState<{
    dealId: string;
    previousStage: string;
    dealTitle?: string;
    contactId?: string;
  } | null>(null);
  const [selectedLostReason, setSelectedLostReason] = useState<string>(LOST_REASONS[0].id);
  const [lostNotes, setLostNotes] = useState<string>("");
  const [healthFilter, setHealthFilter] = useState<'all' | 'stale' | 'critical' | 'lost' | 'active'>('all');
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);
  const [isDeletingDeal, setIsDeletingDeal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [displayGoals, setDisplayGoals] = useState<{ [key: string]: string }>({});
  const [probabilities, setProbabilities] = useState<Record<string, number>>({
    lead: 20,
    qualification: 40,
    proposal: 60,
    negotiation: 80,
    closed: 100,
    lost: 0
  });

  const currentMonth = useMemo(() => new Date().toISOString().substring(0, 7), []);

  useEffect(() => {
    const loadProbabilities = () => {
      const saved = localStorage.getItem("pipeline_probabilities");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setProbabilities(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error("Error parsing pipeline probabilities:", e);
        }
      } else {
        const defaults = STAGES.reduce((acc, stage, idx) => {
          acc[stage.id] = stage.id === 'lost' ? 0 : Math.min((idx + 1) * 20, 100);
          return acc;
        }, {} as Record<string, number>);
        setProbabilities(defaults);
      }
    };

    loadProbabilities();

    window.addEventListener("storage_probabilities_updated", loadProbabilities);
    return () => {
      window.removeEventListener("storage_probabilities_updated", loadProbabilities);
    };
  }, []);

  const currentGoal = useMemo(() => {
    const monthGoals = goals.filter(g => g.month === currentMonth);
    // Prioritize the user's specific goal if multiple exist
    return monthGoals.find(g => g.ownerId === user?.id) || monthGoals[0];
  }, [goals, currentMonth, user]);
  const stageGoals = useMemo(() => currentGoal?.stageGoals || {}, [currentGoal]);
  const goalValue = useMemo(() => stageGoals['closed'] || 0, [stageGoals]);

  useEffect(() => {
    if (isModalOpen) {
      setDisplayValue(formatCurrencyBRL(editingDeal?.value || 0));
    }
  }, [isModalOpen, editingDeal]);

  useEffect(() => {
    if (isGoalModalOpen) {
      const goalsObj: { [key: string]: string } = {};
      STAGES.forEach(stage => {
        goalsObj[stage.id] = formatCurrencyBRL(stageGoals[stage.id] || 0);
      });
      setDisplayGoals(goalsObj);
    }
  }, [isGoalModalOpen, stageGoals]);

  const fetchDealsData = async () => {
    if (!user || !profile) return;
    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    const [dealsData, goalsData] = await Promise.all([
      getDeals(ownerId),
      getGoals(ownerId)
    ]);
    setDeals(dealsData);
    setGoals(goalsData);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;

    setLoading(true);

    // Safety timeout to clear loading spinner
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 8000);

    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsubDeals = subscribeToDeals((data) => {
      setDeals(data);
      setLoading(false);
      clearTimeout(safetyTimer);
    }, ownerId);

    const unsubCompanies = subscribeToCompanies(setCompanies, ownerId);
    const unsubContacts = subscribeToContacts(setContacts, ownerId);
    const unsubProperties = subscribeToProperties(setProperties, ownerId);
    const unsubGoals = subscribeToGoals(setGoals, ownerId);
    const unsubUsers = subscribeToUsers(setUsers);

    return () => {
      unsubDeals();
      unsubCompanies();
      unsubContacts();
      unsubProperties();
      unsubGoals();
      unsubUsers();
      clearTimeout(safetyTimer);
    };
  }, [user, profile]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStage = destination.droppableId;

    if (!draggableId || draggableId === 'undefined' || draggableId === 'null') {
      console.warn("[Pipeline] onDragEnd: draggableId is invalid", draggableId);
      return;
    }

    const currentDeal = deals.find(d => d.id === draggableId);

    // If moved to "lost", prompt the reason modal
    if (newStage === 'lost') {
      if (currentDeal && currentDeal.stage !== 'lost') {
        setPendingLostDeal({
          dealId: draggableId,
          previousStage: currentDeal.stage,
          dealTitle: currentDeal.title,
          contactId: currentDeal.contactId
        });
        setSelectedLostReason(LOST_REASONS[0].id);
        setLostNotes("");
        setIsLostReasonModalOpen(true);
        return;
      }
    }

    // Optimistic update
    const updatedDeals = deals.map(d => d.id === draggableId ? { ...d, stage: newStage } : d);
    setDeals(updatedDeals);

    try {
      await updateDeal(draggableId, { stage: newStage });
      
      // Log stage change
      const stageName = STAGES.find(s => s.id === newStage)?.title || newStage;
      const deal = deals.find(d => d.id === draggableId);

      recordAuditEvent({
        action: 'UPDATE_DEAL_STAGE',
        title: 'Movimentação no Funil de Vendas',
        content: `Oportunidade "${deal?.title || draggableId}" movida para o estágio "${stageName}".`,
        severity: 'low',
        category: 'modification',
        relatedId: draggableId,
        entityId: draggableId,
        entityType: 'deal',
        metadata: {
          title: deal?.title,
          newStage: stageName,
          value: deal?.value
        }
      });
      
      await createTimelineEvent({
        type: 'system',
        category: 'deal',
        relatedId: draggableId,
        content: `Negócio "${deal?.title}" movido para o estágio: ${stageName}`,
        title: 'Mudança de Estágio',
        metadata: { 
          type: 'stage_change', 
          newStage: stageName,
          dealId: draggableId
        }
      });

      // If there's a contactId, also log in contact timeline
      if (deal?.contactId) {
        await createTimelineEvent({
          type: 'system',
          category: 'contact',
          relatedId: deal.contactId,
          content: `Negócio associado "${deal.title}" movido para: ${stageName}`,
          title: 'Atualização de Negócio',
          metadata: { 
            type: 'stage_change', 
            newStage: stageName,
            dealId: draggableId
          }
        });
      }
    } catch (err) {
      toast.error("Erro ao atualizar estágio do negócio.");
    }
  };

  const handleConfirmLost = async () => {
    if (!pendingLostDeal) return;
    const { dealId, dealTitle, contactId } = pendingLostDeal;
    const reasonObj = LOST_REASONS.find(r => r.id === selectedLostReason);
    const reasonLabel = reasonObj?.label || selectedLostReason;
    const notesFormatted = lostNotes.trim() ? ` Detalhes: "${lostNotes.trim()}"` : '';

    try {
      await updateDeal(dealId, { stage: 'lost' });
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: 'lost' } : d));

      recordAuditEvent({
        action: 'UPDATE_DEAL',
        title: 'Oportunidade Marcada como Perdida',
        content: `Negócio "${dealTitle || dealId}" marcado como Perdido / Desistência. Motivo: ${reasonLabel}.${notesFormatted}`,
        severity: 'medium',
        category: 'modification',
        relatedId: dealId,
        entityType: 'deal',
        metadata: {
          stage: 'lost',
          lostReason: reasonLabel,
          lostNotes: lostNotes.trim()
        }
      });

      await createTimelineEvent({
        type: 'system',
        category: 'deal',
        relatedId: dealId,
        content: `Negócio registrado como Perdido / Desistência. Motivo: ${reasonLabel}.${notesFormatted}`,
        title: 'Negócio Perdido',
        metadata: {
          type: 'deal_lost',
          lostReason: reasonLabel,
          lostNotes: lostNotes.trim(),
          dealId
        }
      });

      if (contactId) {
        await createTimelineEvent({
          type: 'system',
          category: 'contact',
          relatedId: contactId,
          content: `Negócio "${dealTitle || ''}" arquivado como perdido. Motivo: ${reasonLabel}`,
          title: 'Desistência / Perda de Oportunidade',
          metadata: {
            type: 'deal_lost',
            lostReason: reasonLabel,
            dealId
          }
        });
      }

      toast.success("Negócio marcado como perdido e registrado no histórico.");
      setIsLostReasonModalOpen(false);
      setPendingLostDeal(null);
    } catch (err) {
      toast.error("Erro ao registrar perda.");
    }
  };

  const handleCancelLost = () => {
    if (pendingLostDeal) {
      setDeals(prev => prev.map(d => d.id === pendingLostDeal.dealId ? { ...d, stage: pendingLostDeal.previousStage } : d));
    }
    setIsLostReasonModalOpen(false);
    setPendingLostDeal(null);
  };

  const handleReactivateDeal = async (deal: Deal) => {
    try {
      await updateDeal(deal.id, { stage: 'lead' });
      setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: 'lead' } : d));

      recordAuditEvent({
        action: 'UPDATE_DEAL',
        title: 'Reativação de Oportunidade',
        content: `Negócio "${deal.title}" reativado para o estágio inicial "Novo Lead".`,
        severity: 'medium',
        category: 'modification',
        relatedId: deal.id,
        entityType: 'deal',
        metadata: {
          previousStage: deal.stage,
          newStage: 'lead'
        }
      });

      await createTimelineEvent({
        type: 'system',
        category: 'deal',
        relatedId: deal.id,
        content: `Negócio reativado pelo corretor e retornado para "Novo Lead".`,
        title: 'Negócio Reativado',
        metadata: { type: 'deal_reactivated', dealId: deal.id }
      });

      if (deal.contactId) {
        await createTimelineEvent({
          type: 'system',
          category: 'contact',
          relatedId: deal.contactId,
          content: `Negócio "${deal.title}" foi reativado no pipeline.`,
          title: 'Lead Reativado',
          metadata: { type: 'deal_reactivated', dealId: deal.id }
        });
      }

      toast.success("Negócio reativado e retornado ao funil!");
    } catch (err) {
      toast.error("Erro ao reativar negócio.");
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get('title') as string,
      value: parseCurrencyBRLToNumber(formData.get('value') as string),
      stage: formData.get('stage') as string,
      companyId: formData.get('companyId') as string || undefined,
      contactId: formData.get('contactId') as string || undefined,
      propertyId: formData.get('propertyId') as string || undefined,
      ownerId: formData.get('ownerId') as string || undefined,
    };

    try {
      if (editingDeal?.id) {
        await updateDeal(editingDeal.id, data);
        
        recordAuditEvent({
          action: 'UPDATE_DEAL',
          title: 'Edição de Oportunidade / Negócio',
          content: `Negócio "${data.title}" (R$ ${data.value || 0}) foi atualizado.`,
          severity: 'medium',
          category: 'modification',
          relatedId: editingDeal.id,
          entityId: editingDeal.id,
          entityType: 'deal',
          metadata: {
            title: data.title,
            value: data.value,
            stage: data.stage
          }
        });

        toast.success("Negócio atualizado!");
      } else {
        const dealId = await createDeal(data);
        if (dealId) {
          const stageName = STAGES.find(s => s.id === data.stage)?.title || data.stage;
          
          recordAuditEvent({
            action: 'CREATE_DEAL',
            title: 'Abertura de Nova Oportunidade',
            content: `Novo negócio "${data.title}" (R$ ${data.value || 0}) aberto no estágio "${stageName}".`,
            severity: 'info',
            category: 'modification',
            relatedId: dealId,
            entityId: dealId,
            entityType: 'deal',
            metadata: {
              title: data.title,
              value: data.value,
              stage: stageName
            }
          });

          await createTimelineEvent({
            type: 'system',
            category: 'deal',
            relatedId: dealId,
            content: `Negócio "${data.title}" criado no estágio: ${stageName}`,
            title: 'Criação de Negócio',
            metadata: { type: 'creation', stage: stageName }
          });

          if (data.contactId) {
            await createTimelineEvent({
              type: 'system',
              category: 'contact',
              relatedId: data.contactId,
              content: `Novo negócio associado criado: "${data.title}"`,
              title: 'Novo Negócio',
              metadata: { type: 'creation', dealId }
            });
          }
        }
        toast.success("Negócio criado!");
      }
      await fetchDealsData();
      setIsModalOpen(false);
      setEditingDeal(null);
    } catch (err) {
      toast.error("Erro ao salvar negócio.");
    }
  };

  const handleSaveGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newStageGoals: { [key: string]: number } = {};
    
    STAGES.forEach(stage => {
      newStageGoals[stage.id] = parseCurrencyBRLToNumber(formData.get(`goal_${stage.id}`) as string);
    });
    
    try {
      await setGoal(currentMonth, newStageGoals);
      recordAuditEvent({
        action: 'UPDATE_GOALS',
        title: 'Atualização de Metas do Funil',
        content: `Metas de desempenho do funil atualizadas para o período ${currentMonth}.`,
        severity: 'medium',
        category: 'modification',
        metadata: {
          period: currentMonth,
          goals: newStageGoals
        }
      });
      toast.success("Metas atualizadas!");
      await fetchDealsData();
      setIsGoalModalOpen(false);
    } catch (err: any) {
      console.error("Erro detalhado ao salvar metas:", err);
      toast.error(`Erro ao salvar metas: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const confirmDeleteDeal = async () => {
    if (!dealToDelete) return;
    const target = dealToDelete;
    const id = target.id;

    setIsDeletingDeal(true);
    const toastId = toast.loading("Excluindo negócio...");
    setDeals(prev => prev.filter(d => d.id !== id));

    try {
      await deleteDeal(id);

      recordAuditEvent({
        action: 'DELETE_DEAL',
        title: 'Exclusão de Oportunidade',
        content: `Negócio "${target?.title || id}" (R$ ${target?.value || 0}) foi excluído do funil.`,
        severity: 'high',
        category: 'deletion',
        relatedId: id,
        entityType: 'deal',
        metadata: {
          title: target?.title,
          value: target?.value,
          stage: target?.stage
        }
      });

      toast.success("Negócio excluído com sucesso!", { id: toastId });
      setDealToDelete(null);
      if (editingDeal && editingDeal.id === id) {
        setIsModalOpen(false);
        setEditingDeal(null);
      }
    } catch (err: any) {
      console.error("Erro ao excluir negócio:", err);
      setDeals(prev => [...prev, target]);
      toast.error(err?.message || "Erro ao excluir negócio.", { id: toastId });
    } finally {
      setIsDeletingDeal(false);
    }
  };

  const staleDeals = useMemo(() => deals.filter(d => getDealStaleInfo(d).isStale), [deals]);
  const criticalDeals = useMemo(() => deals.filter(d => getDealStaleInfo(d).severity === 'critical'), [deals]);
  const lostDeals = useMemo(() => deals.filter(d => d.stage === 'lost'), [deals]);
  const activeDeals = useMemo(() => deals.filter(d => !getDealStaleInfo(d).isStale && d.stage !== 'closed' && d.stage !== 'lost'), [deals]);
  const staleDealsValue = useMemo(() => staleDeals.reduce((acc, d) => acc + d.value, 0), [staleDeals]);

  if (authLoading || (loading && !user)) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredDeals = deals.filter(d => {
    const contact = contacts.find(c => c.id === d.contactId);
    const company = companies.find(c => c.id === d.companyId);
    const matchesSearch = 
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (company?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const staleInfo = getDealStaleInfo(d);
    if (healthFilter === 'stale') return staleInfo.isStale;
    if (healthFilter === 'critical') return staleInfo.severity === 'critical';
    if (healthFilter === 'lost') return d.stage === 'lost';
    if (healthFilter === 'active') return !staleInfo.isStale && d.stage !== 'closed' && d.stage !== 'lost';
    return true;
  });

  const totalClosed = deals
    .filter(d => d.stage === 'closed')
    .reduce((acc, d) => acc + d.value, 0);

  const progressPercentage = goalValue > 0 ? Math.min((totalClosed / goalValue) * 100, 100) : 0;

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="px-4 py-3 md:px-6 md:py-3.5 bg-card/15 border-b border-border/50">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-2.5 gap-3">
            <div className="pl-11 sm:pl-12 md:pl-0">
              <h1 className="text-xl md:text-2xl font-black tracking-tight">Pipeline de Vendas</h1>
              <p className="text-muted-foreground text-xs font-medium">Visualize e gerencie seus negócios em andamento.</p>
            </div>
            <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-muted/20 p-2.5 rounded-xl border border-border/40 lg:bg-transparent lg:p-0 lg:border-0">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => setIsGoalModalOpen(true)}
                  className="bg-card border border-primary/35 px-3.5 py-1.5 rounded-xl font-bold text-foreground shadow-sm hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2 group flex-1 sm:flex-initial"
                  title="Clique para definir ou alterar suas metas mensais"
                >
                  <Target className="w-4 h-4 text-primary group-hover:text-white transition-colors shrink-0" />
                  <div className="text-left">
                    <p className="text-[8.5px] uppercase tracking-widest text-muted-foreground group-hover:text-white/80 leading-none mb-0.5 font-black">Definir Meta</p>
                    <p className="leading-none text-xs font-bold">{formatCurrencyBRL(goalValue)}</p>
                  </div>
                </button>
                <button 
                  onClick={() => {
                    setEditingDeal(null);
                    setIsModalOpen(true);
                  }}
                  className="bg-primary text-white px-3.5 py-2 rounded-xl font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-1.5 text-xs whitespace-nowrap flex-1 sm:flex-initial"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Negócio
                </button>
                <SoundControlButton />
              </div>
              
              {/* Goal Progress Bar */}
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
                      "h-full rounded-full transition-all duration-1050",
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

          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Pesquisar por título, cliente ou imobiliária..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-xs md:text-sm shadow-sm"
              />
            </div>

            {/* Health Filter Chips - Wraps gracefully on mobile so all options remain visible */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 sm:pt-0">
              <button
                onClick={() => setHealthFilter('all')}
                className={cn(
                  "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                  healthFilter === 'all'
                    ? "bg-foreground text-background border-foreground shadow-xs"
                    : "bg-card border-border text-muted-foreground hover:bg-muted"
                )}
              >
                Todos ({deals.length})
              </button>
              <button
                onClick={() => setHealthFilter('active')}
                className={cn(
                  "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                  healthFilter === 'active'
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-card border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <Flame className="w-3.5 h-3.5 text-blue-500" />
                Em Dia ({activeDeals.length})
              </button>
              <button
                onClick={() => setHealthFilter('stale')}
                className={cn(
                  "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                  healthFilter === 'stale'
                    ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                    : "bg-card border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Parados &gt; 5d
                {staleDeals.length > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                    healthFilter === 'stale' ? "bg-white/25 text-white" : "bg-amber-500 text-white"
                  )}>
                    {staleDeals.length}
                  </span>
                )}
              </button>
              {criticalDeals.length > 0 && (
                <button
                  onClick={() => setHealthFilter('critical')}
                  className={cn(
                    "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                    healthFilter === 'critical'
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-card border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  )}
                >
                  <AlertOctagon className="w-3.5 h-3.5 animate-pulse" />
                  Críticos &gt; 10d ({criticalDeals.length})
                </button>
              )}
              {lostDeals.length > 0 && (
                <button
                  onClick={() => setHealthFilter('lost')}
                  className={cn(
                    "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                    healthFilter === 'lost'
                      ? "bg-rose-800 text-white border-rose-800 shadow-xs"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <X className="w-3.5 h-3.5 text-rose-500" />
                  Perdidos ({lostDeals.length})
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Attention Banner for Stale Deals */}
        {staleDeals.length > 0 && healthFilter === 'all' && (
          <div className="mx-4 md:mx-6 mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs md:text-sm font-black text-foreground">
                    {staleDeals.length} {staleDeals.length === 1 ? 'oportunidade parada' : 'oportunidades paradas'} (&gt; 5 dias sem contato)
                  </p>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    {formatCurrencyBRL(staleDealsValue)} em risco
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Negócios sem atualização recente correm risco de esfriamento. Use o botão &quot;Resgatar&quot; no cartão para acionar o cliente via WhatsApp.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setHealthFilter('stale')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-all"
              >
                Filtrar Leads Parados ({staleDeals.length})
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-x-auto px-2.5 md:px-3.5 py-2.5">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex h-full gap-2 md:gap-2.5 w-full min-w-[950px] pb-1">
              {STAGES.map((stage) => {
                const stageDeals = filteredDeals.filter(d => d.stage === stage.id);
                const stageTotal = stageDeals.reduce((acc, d) => acc + d.value, 0);
                const stageGoalValue = stageGoals[stage.id] || 0;
                const stageProgress = stageGoalValue > 0 ? Math.min((stageTotal / stageGoalValue) * 100, 100) : 0;

                return (
                  <div key={stage.id} className="flex-1 min-w-[170px] flex flex-col">
                    <div className="mb-2 px-1 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${stage.color}`} />
                          <h3 className="font-bold text-foreground text-[11px] uppercase tracking-wider truncate" title={stage.title}>
                            {stage.title}
                          </h3>
                          <span className="text-[9px] bg-muted px-1.5 py-0.2 rounded font-bold text-muted-foreground shrink-0">
                            {stageDeals.length}
                          </span>
                        </div>
                        <span className={cn(
                          "text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-full border shadow-sm tracking-wider uppercase backdrop-blur-sm shrink-0",
                          BADGE_COLORS[stage.id] || "bg-muted text-muted-foreground border-border"
                        )}>
                          {probabilities[stage.id] ?? 0}%
                        </span>
                      </div>
                      
                      {/* Stage Mini Progress */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center text-[8.5px] font-bold">
                          <span className="text-muted-foreground uppercase truncate">Meta: {formatCurrencyBRL(stageGoalValue)}</span>
                          <span className={cn("shrink-0", stageProgress >= 100 ? "text-emerald-500" : "text-primary")}>{Math.round(stageProgress)}%</span>
                        </div>
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-1000", stageProgress >= 100 ? "bg-emerald-500" : "bg-primary")}
                            style={{ width: `${stageProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <Droppable droppableId={stage.id}>
                      {(provided) => (
                        <div 
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={cn(
                            "flex-1 rounded-xl p-2 space-y-2 border border-dashed transition-colors",
                            stage.id === 'lost' 
                              ? "bg-rose-500/[0.04] border-rose-500/20" 
                              : "bg-muted/20 border-border"
                          )}
                        >
                          {stageDeals.map((deal, index) => {
                            const staleInfo = getDealStaleInfo(deal);
                            const contact = contacts.find(c => c.id === deal.contactId);
                            const rescueUrl = contact?.phone 
                              ? getWhatsAppRescueUrl(contact.phone, contact.name, deal.title)
                              : null;

                            return (
                              <Draggable key={deal.id} draggableId={deal.id} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "bg-card p-2.5 rounded-xl border shadow-sm group hover:shadow-md transition-all active:scale-[0.98]",
                                    staleInfo.cardBorderClass || "border-border hover:border-primary/30",
                                    deal.stage === 'lost' && "opacity-85 hover:opacity-100 border-rose-500/30"
                                  )}
                                >
                                  {/* Stale Warning Badge */}
                                  {staleInfo.isStale && (
                                    <div className={cn(
                                      "mb-2 px-2 py-1 rounded-lg text-[9.5px] font-bold flex items-center justify-between gap-1 border",
                                      staleInfo.severity === 'critical'
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                    )}>
                                      <div className="flex items-center gap-1 min-w-0">
                                        {staleInfo.severity === 'critical' ? (
                                          <AlertOctagon className="w-3 h-3 text-rose-500 animate-pulse shrink-0" />
                                        ) : (
                                          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                        )}
                                        <span className="truncate">{staleInfo.label}</span>
                                      </div>
                                      {rescueUrl && (
                                        <a
                                          href={rescueUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 shrink-0"
                                          title="Enviar WhatsApp de resgate para o cliente"
                                        >
                                          <MessageCircle className="w-2.5 h-2.5" />
                                          Resgatar
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  <div className="flex justify-between items-start mb-1.5">
                                    <div className="flex gap-1">
                                      <Link href={`/deals/${deal.id}`} className="p-0.5 text-muted-foreground hover:text-indigo-500 transition-all" title="Ver detalhes">
                                        <ExternalLink className="w-3 h-3" />
                                      </Link>
                                      <button onClick={() => { setEditingDeal(deal); setIsModalOpen(true); }} className="p-0.5 text-muted-foreground hover:text-primary transition-all cursor-pointer" title="Editar"><Edit2 className="w-3 h-3" /></button>
                                      <button 
                                        onClick={() => setDealToDelete(deal)} 
                                        className="p-0.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                                        title="Excluir negócio"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="flex -space-x-1.5">
                                      <div className="w-5 h-5 rounded-full border border-card bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary uppercase" title={contact?.name || 'Cliente não atribuído'}>
                                        {contact?.name.charAt(0) || '?'}
                                      </div>
                                    </div>
                                  </div>

                                  <Link href={`/deals/${deal.id}`} className="block hover:text-primary transition-colors">
                                    <h4 className="font-bold text-foreground text-xs mb-0.5 line-clamp-2 leading-tight" title={deal.title}>{deal.title}</h4>
                                  </Link>

                                  {contact && (
                                    <div className="flex items-center justify-between text-[10.5px] text-muted-foreground mb-1">
                                      <span className="truncate font-semibold text-foreground/80">{contact.name}</span>
                                      {rescueUrl && (
                                        <a
                                          href={rescueUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 p-0.5 rounded hover:bg-emerald-500/10 transition-colors shrink-0"
                                          title={`Conversar com ${contact.name} no WhatsApp`}
                                        >
                                          <MessageCircle className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  <p className="text-[10px] text-muted-foreground mb-2 truncate flex items-center gap-1">
                                    <Building2 className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{companies.find(c => c.id === deal.companyId)?.name || 'Empresa não vinculada'}</span>
                                  </p>
                                  
                                  <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-border/50">
                                    <span className="text-xs font-bold text-foreground">
                                      {formatCurrencyBRL(deal.value)}
                                    </span>
                                    <div className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
                                      <Clock className="w-2.5 h-2.5 shrink-0" />
                                      <span>{deal.updatedAt ? new Date(deal.updatedAt).toLocaleDateString() : '-'}</span>
                                    </div>
                                  </div>

                                  {/* Reactivate button for lost deals */}
                                  {deal.stage === 'lost' && (
                                    <div className="mt-2 pt-1.5 border-t border-rose-500/20 flex items-center justify-between gap-1">
                                      <span className="text-[9.5px] font-bold text-rose-500 flex items-center gap-1">
                                        <X className="w-3 h-3" /> Arquivado
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReactivateDeal(deal);
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[9.5px] font-bold flex items-center gap-1 transition-all"
                                        title="Reativar oportunidade para Novo Lead"
                                      >
                                        <RotateCcw className="w-2.5 h-2.5" />
                                        Reativar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                            );
                          })}
                          {provided.placeholder}
                          <button 
                            onClick={() => {
                              setEditingDeal({ stage: stage.id } as Deal);
                              setIsModalOpen(true);
                            }}
                            className="w-full py-1.5 border border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-all group"
                          >
                            <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                          </button>
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        </div>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-6 md:p-8 w-full max-w-lg relative shadow-2xl border border-border"
            >
              <button onClick={() => setIsModalOpen(false)} className="absolute right-6 top-6 p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              <h2 className="text-2xl font-bold mb-6 text-foreground">{editingDeal?.id ? 'Editar Negócio' : 'Novo Negócio'}</h2>
              <form onSubmit={handleSave} className="space-y-4 font-medium text-start">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 ml-1 block">Título</label>
                  <input name="title" required defaultValue={editingDeal?.title} placeholder="Ex: Projeto Reforma 2024" className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 ml-1 block">Valor (R$)</label>
                  <input 
                    name="value" 
                    type="text" 
                    required 
                    value={displayValue} 
                    onChange={(e) => setDisplayValue(formatCurrencyBRL(e.target.value))}
                    placeholder="R$ 0,00" 
                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 ml-1 block">Estágio</label>
                    <select 
                      name="stage" 
                      defaultValue={editingDeal?.stage} 
                      className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em]"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                    >
                      {STAGES.map(s => <option key={s.id} value={s.id} className="bg-card">{s.title}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 ml-1 block">Empresa</label>
                    <div className="flex gap-2">
                      <select 
                        name="companyId" 
                        defaultValue={editingDeal?.companyId} 
                        className="flex-1 px-4 py-3 rounded-xl border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em] font-medium"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                      >
                        <option value="" className="bg-card text-muted-foreground italic">Nenhuma</option>
                        {companies.map(c => <option key={c.id} value={c.id} className="bg-card">{c.name}</option>)}
                      </select>
                      <button 
                        type="button"
                        onClick={() => {
                          const name = prompt("Nome da nova empresa:");
                          if (name) {
                            createCompany({ name }).then(id => {
                              if (id) toast.success("Empresa criada!");
                            });
                          }
                        }}
                        className="p-3 bg-muted/50 hover:bg-primary hover:text-white rounded-xl transition-all text-muted-foreground shadow-sm group"
                        title="Nova Empresa"
                      >
                        <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 ml-1 block">Imóvel Associado (Inventário)</label>
                  <select 
                    name="propertyId" 
                    defaultValue={editingDeal?.propertyId} 
                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                  >
                    <option value="" className="bg-card">Nenhum imóvel vinculado</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id} className="bg-card">{p.title} - {formatCurrencyBRL(p.price)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 ml-1 block">Corretor Responsável</label>
                  <select 
                    name="ownerId" 
                    defaultValue={editingDeal?.ownerId || user?.id} 
                    disabled={profile?.role !== 'Admin'}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em] disabled:opacity-70"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                  >
                    <option value="" className="bg-card">Nenhum</option>
                    {users
                      .filter(u => u.userType !== 'cliente')
                      .map(u => (
                        <option key={u.id} value={u.id} className="bg-card font-medium">
                          {u.displayName} ({u.role})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 ml-1 block">Contato de Referência</label>
                  <select 
                    name="contactId" 
                    defaultValue={editingDeal?.contactId} 
                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                  >
                    <option value="" className="bg-card">Nenhum</option>
                    {contacts.filter(c => c.type === 'cliente').map(c => <option key={c.id} value={c.id} className="bg-card">{c.name}</option>)}
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  {editingDeal?.id && (
                    <button 
                      type="button" 
                      onClick={() => setDealToDelete(editingDeal)} 
                      className="px-4 py-3 rounded-2xl transition-all border text-red-500 hover:bg-red-500/10 border-red-500/20 flex items-center justify-center cursor-pointer"
                      title="Excluir negócio"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-bold text-muted-foreground hover:bg-muted rounded-2xl transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 font-bold bg-primary text-white rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20">Salvar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-8 w-full max-w-sm relative shadow-2xl border border-border"
            >
              <button onClick={() => setIsGoalModalOpen(false)} className="absolute right-6 top-6 p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              <h2 className="text-2xl font-bold mb-2 text-foreground text-start">Definir Metas</h2>
              <p className="text-sm text-muted-foreground mb-6 text-start">Defina os valores de venda desejados para cada situação em {currentMonth}.</p>
              <form onSubmit={handleSaveGoal} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar text-start font-medium leading-none">
                {STAGES.map(stage => (
                  <div key={stage.id} className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1 flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${stage.color}`} />
                      {stage.title} (R$)
                    </label>
                    <input 
                      name={`goal_${stage.id}`} 
                      type="text" 
                      required 
                      value={displayGoals[stage.id] || "R$ 0,00"} 
                      onChange={(e) => setDisplayGoals(prev => ({ ...prev, [stage.id]: formatCurrencyBRL(e.target.value) }))}
                      placeholder="R$ 0,00" 
                      className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>
                ))}
                <div className="pt-4 flex gap-3 sticky bottom-0 bg-card">
                  <button type="button" onClick={() => setIsGoalModalOpen(false)} className="flex-1 py-3 font-bold text-muted-foreground hover:bg-muted rounded-2xl transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 font-bold bg-primary text-white rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20">Salvar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lost Reason Modal */}
      <AnimatePresence>
        {isLostReasonModalOpen && pendingLostDeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-6 md:p-8 w-full max-w-lg relative shadow-2xl border border-rose-500/30"
            >
              <button onClick={handleCancelLost} className="absolute right-6 top-6 p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Registrar Motivo da Perda</h2>
                  <p className="text-xs text-muted-foreground">Oportunidade: &quot;{pendingLostDeal.dealTitle}&quot;</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-4">
                Identificar a causa da perda gera inteligência de mercado para calibrar o portfólio de imóveis e os preços da imobiliária.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 ml-1 block">Motivo Principal</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {LOST_REASONS.map(reason => (
                      <button
                        key={reason.id}
                        type="button"
                        onClick={() => setSelectedLostReason(reason.id)}
                        className={cn(
                          "p-2.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between",
                          selectedLostReason === reason.id
                            ? "bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 shadow-xs"
                            : "bg-muted/30 border-border text-foreground/80 hover:bg-muted"
                        )}
                      >
                        <span className="truncate">{reason.label}</span>
                        {selectedLostReason === reason.id && (
                          <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 ml-1.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 ml-1 block">Observações Adicionais (Opcional)</label>
                  <textarea
                    value={lostNotes}
                    onChange={(e) => setLostNotes(e.target.value)}
                    placeholder="Ex: O cliente optou por apartamento de 3 quartos no Bairro Jardins com taxa condominial mais baixa..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <button 
                    type="button" 
                    onClick={handleCancelLost} 
                    className="flex-1 py-2.5 font-bold text-xs text-muted-foreground hover:bg-muted rounded-xl transition-all border border-border"
                  >
                    Cancelar (Manter no Funil)
                  </button>
                  <button 
                    type="button" 
                    onClick={handleConfirmLost} 
                    className="flex-1 py-2.5 font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5"
                  >
                    Confirmar Perda
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão de Oportunidade */}
      <ConfirmDeleteModal
        isOpen={!!dealToDelete}
        onClose={() => setDealToDelete(null)}
        onConfirm={confirmDeleteDeal}
        title="Excluir Negócio"
        itemName={dealToDelete?.title}
        itemType="oportunidade de negócio"
        isDeleting={isDeletingDeal}
      />
    </div>
  );
}
