"use client";

import { useEffect, useState, useMemo } from "react";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
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
  Target
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
import Link from "next/link";

const STAGES = [
  { id: "lead", title: "Novo Lead", color: "bg-primary" },
  { id: "qualification", title: "Qualificação / Visita", color: "bg-purple-500" },
  { id: "proposal", title: "Proposta", color: "bg-orange-500" },
  { id: "negotiation", title: "Análise Jurídica", color: "bg-yellow-500" },
  { id: "closed", title: "Vendido / Alugado", color: "bg-emerald-500" },
];

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
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [displayGoals, setDisplayGoals] = useState<{ [key: string]: string }>({});

  const currentMonth = useMemo(() => new Date().toISOString().substring(0, 7), []);

  useEffect(() => {
    if (deleteConfirmId) {
      const timer = setTimeout(() => setDeleteConfirmId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteConfirmId]);

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

    // Optimistic update
    const updatedDeals = deals.map(d => d.id === draggableId ? { ...d, stage: newStage } : d);
    setDeals(updatedDeals);

    if (!draggableId || draggableId === 'undefined' || draggableId === 'null') {
      console.warn("[Pipeline] onDragEnd: draggableId is invalid", draggableId);
      return;
    }

    try {
      await updateDeal(draggableId, { stage: newStage });
      
      // Log stage change
      const stageName = STAGES.find(s => s.id === newStage)?.title || newStage;
      const deal = deals.find(d => d.id === draggableId);
      
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
        toast.success("Negócio atualizado!");
      } else {
        const dealId = await createDeal(data);
        if (dealId) {
          const stageName = STAGES.find(s => s.id === data.stage)?.title || data.stage;
          
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
      toast.success("Metas atualizadas!");
      await fetchDealsData();
      setIsGoalModalOpen(false);
    } catch (err: any) {
      console.error("Erro detalhado ao salvar metas:", err);
      toast.error(`Erro ao salvar metas: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDeal(id);
      toast.success("Negócio excluído.");
      setDeleteConfirmId(null);
      await fetchDealsData();
    } catch (err) {
      toast.error("Erro ao excluir.");
    }
  };

  if (authLoading || (loading && !user)) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredDeals = deals.filter(d => 
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    companies.find(c => c.id === d.companyId)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClosed = deals
    .filter(d => d.stage === 'closed')
    .reduce((acc, d) => acc + d.value, 0);

  const progressPercentage = goalValue > 0 ? Math.min((totalClosed / goalValue) * 100, 100) : 0;

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="p-4 md:p-8 pb-4 pt-20 md:pt-8 bg-card/15 border-b border-border/50">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Pipeline de Vendas</h1>
              <p className="text-muted-foreground mt-1 text-sm font-semibold">Visualize e gerencie seus negócios em andamento.</p>
            </div>
            <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-4 shadow-sm bg-muted/25 p-4 rounded-2xl border border-border/40 lg:bg-transparent lg:p-0 lg:border-0 lg:shadow-none">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => setIsGoalModalOpen(true)}
                  className="bg-card border border-primary/35 px-5 py-2.5 rounded-xl font-bold text-foreground shadow-sm hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2 group w-full sm:w-auto"
                  title="Clique para definir ou alterar suas metas mensais"
                >
                  <Target className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                  <div className="text-left">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground group-hover:text-white/80 leading-none mb-1 font-black">Definir Meta</p>
                    <p className="leading-none text-xs">{formatCurrencyBRL(goalValue)}</p>
                  </div>
                </button>
                <button 
                  onClick={() => {
                    setEditingDeal(null);
                    setIsModalOpen(true);
                  }}
                  className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 w-full sm:w-auto text-xs whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Novo Negócio
                </button>
              </div>
              
              {/* Goal Progress Bar */}
              <div className="w-full sm:w-64 space-y-2 mt-2 sm:mt-0">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Progresso (Fechado)</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/30">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1050",
                      progressPercentage >= 100 ? "bg-emerald-500" : "bg-primary"
                    )}
                  />
                </div>
                <div className="text-[10px] text-right font-black text-muted-foreground uppercase tracking-wider">
                  {formatCurrencyBRL(totalClosed)} / {formatCurrencyBRL(goalValue)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Pesquisar negócios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-2xl focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm shadow-sm"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-3 bg-card border border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-all">
              <Filter className="w-4 h-4" />
              Filtros
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-x-auto p-8 pt-0">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex h-full gap-6 min-w-[1280px]">
              {STAGES.map((stage) => {
                const stageDeals = filteredDeals.filter(d => d.stage === stage.id);
                const stageTotal = stageDeals.reduce((acc, d) => acc + d.value, 0);
                const stageGoalValue = stageGoals[stage.id] || 0;
                const stageProgress = stageGoalValue > 0 ? Math.min((stageTotal / stageGoalValue) * 100, 100) : 0;

                return (
                  <div key={stage.id} className="w-[300px] flex flex-col">
                    <div className="mb-4 px-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                          <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">{stage.title}</h3>
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md font-bold text-muted-foreground">
                            {stageDeals.length}
                          </span>
                        </div>
                        <button className="text-muted-foreground hover:text-foreground transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
                      </div>
                      
                      {/* Stage Mini Progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-muted-foreground uppercase">Meta: {formatCurrencyBRL(stageGoalValue)}</span>
                          <span className={cn(stageProgress >= 100 ? "text-emerald-500" : "text-primary")}>{Math.round(stageProgress)}%</span>
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
                          className="flex-1 bg-muted/20 rounded-2xl p-3 space-y-3 border border-dashed border-border"
                        >
                          {stageDeals.map((deal, index) => (
                            <Draggable key={deal.id} draggableId={deal.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="bg-card p-4 rounded-xl border border-border shadow-sm group hover:border-primary/30 hover:shadow-md transition-all active:scale-[0.98]"
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex gap-1">
                                    <Link href={`/deals/${deal.id}`} className="p-1 text-muted-foreground hover:text-indigo-500 transition-all" title="Ver detalhes">
                                      <ExternalLink className="w-3 h-3" />
                                    </Link>
                                    <button onClick={() => { setEditingDeal(deal); setIsModalOpen(true); }} className="p-1 text-muted-foreground hover:text-primary transition-all" title="Editar"><Edit2 className="w-3 h-3" /></button>
                                    <button 
                                      onClick={() => {
                                        if (deleteConfirmId === deal.id) {
                                          handleDelete(deal.id);
                                        } else {
                                          setDeleteConfirmId(deal.id);
                                        }
                                      }} 
                                      className={cn(
                                        "p-1 rounded-md transition-all",
                                        deleteConfirmId === deal.id 
                                          ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/20" 
                                          : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                      )}
                                      title={deleteConfirmId === deal.id ? "Clique novamente para confirmar" : "Excluir"}
                                    >
                                      <Trash2 className={cn("w-3 h-3", deleteConfirmId === deal.id && "animate-pulse")} />
                                    </button>
                                  </div>
                                  <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full border-2 border-card bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary uppercase">
                                      {contacts.find(c => c.id === deal.contactId)?.name.charAt(0) || '?'}
                                    </div>
                                  </div>
                                </div>
                                <Link href={`/deals/${deal.id}`} className="block hover:text-primary transition-colors">
                                  <h4 className="font-bold text-foreground text-sm mb-1">{deal.title}</h4>
                                </Link>
                                <p className="text-xs text-muted-foreground mb-4 truncate flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {companies.find(c => c.id === deal.companyId)?.name || 'Empresa não vinculada'}
                                </p>
                                
                                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                  <span className="text-sm font-bold text-foreground">
                                    {formatCurrencyBRL(deal.value)}
                                  </span>
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    {deal.updatedAt ? new Date(deal.updatedAt).toLocaleDateString() : '-'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        <button 
                          onClick={() => {
                            setEditingDeal({ stage: stage.id } as Deal);
                            setIsModalOpen(true);
                          }}
                          className="w-full py-3 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-all group"
                        >
                          <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
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
                      onClick={() => { 
                        if (deleteConfirmId === editingDeal.id) {
                          handleDelete(editingDeal.id); 
                          setIsModalOpen(false);
                        } else {
                          setDeleteConfirmId(editingDeal.id);
                        }
                      }} 
                      className={cn(
                        "px-4 py-3 rounded-2xl transition-all border",
                        deleteConfirmId === editingDeal.id 
                          ? "bg-red-500 text-white border-red-600 shadow-lg shadow-red-500/20 scale-105" 
                          : "text-red-500 hover:bg-red-500/10 border-red-500/20"
                      )}
                      title={deleteConfirmId === editingDeal.id ? "Clique novamente para confirmar" : "Excluir negócio"}
                    >
                      <Trash2 className={cn("w-5 h-5", deleteConfirmId === editingDeal.id && "animate-pulse")} />
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
    </div>
  );
}
