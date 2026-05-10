"use client";

import { useEffect, useState } from "react";
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
  X,
  Loader2,
  Target
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  createDeal,
  updateDeal,
  deleteDeal,
  setGoal,
  createCompany,
  createTimelineEvent,
  Property,
  getDeals,
  getGoals,
} from "@/lib/db";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import Link from "next/link";

const STAGES = [
  { id: "lead", title: "Novo Lead", color: "bg-blue-500" },
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
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
  const currentGoal = goals.find(g => g.month === currentMonth);
  const stageGoals = currentGoal?.stageGoals || {};
  const goalValue = stageGoals['closed'] || 0; // Total goal is usually what's closed

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;

    setLoading(true);
    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsubDeals = subscribeToDeals((data) => {
      setDeals(data);
      setLoading(false);
    }, ownerId);
    const unsubCompanies = subscribeToCompanies(setCompanies, ownerId);
    const unsubContacts = subscribeToContacts(setContacts, ownerId);
    const unsubProperties = subscribeToProperties(setProperties, ownerId);
    const unsubGoals = subscribeToGoals(setGoals, ownerId);

    return () => {
      unsubDeals();
      unsubCompanies();
      unsubContacts();
      unsubProperties();
      unsubGoals();
    };
  }, [user, profile]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStage = destination.droppableId;

    // Optimistic update
    const updatedDeals = deals.map(d => d.id === draggableId ? { ...d, stage: newStage } : d);
    setDeals(updatedDeals);

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
      value: Number(formData.get('value')),
      stage: formData.get('stage') as string,
      companyId: formData.get('companyId') as string || undefined,
      contactId: formData.get('contactId') as string || undefined,
      propertyId: formData.get('propertyId') as string || undefined,
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
      newStageGoals[stage.id] = Number(formData.get(`goal_${stage.id}`)) || 0;
    });
    
    try {
      await setGoal(currentMonth, newStageGoals);
      toast.success("Metas atualizadas!");
      await fetchDealsData();
      setIsGoalModalOpen(false);
    } catch (err) {
      toast.error("Erro ao salvar metas.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deseja realmente excluir este negócio?")) {
      try {
        await deleteDeal(id);
        toast.success("Negócio excluído.");
        await fetchDealsData();
      } catch (err) {
        toast.error("Erro ao excluir.");
      }
    }
  };

  if (authLoading) return null;

  const filteredDeals = deals.filter(d => 
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    companies.find(c => c.id === d.companyId)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClosed = deals
    .filter(d => d.stage === 'closed')
    .reduce((acc, d) => acc + d.value, 0);

  const progressPercentage = goalValue > 0 ? Math.min((totalClosed / goalValue) * 100, 100) : 0;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="p-8 pb-4">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Pipeline de Vendas</h1>
              <p className="text-slate-500 mt-1">Visualize e gerencie seus negócios em andamento.</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsGoalModalOpen(true)}
                  className="bg-white border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <Target className="w-5 h-5 text-blue-600" />
                  Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(goalValue)}
                </button>
                <button 
                  onClick={() => {
                    setEditingDeal(null);
                    setIsModalOpen(true);
                  }}
                  className="bg-[#1e3a8a] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Novo Negócio
                </button>
              </div>
              
              {/* Goal Progress Bar */}
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Progresso (Fechado)</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      progressPercentage >= 100 ? "bg-emerald-500" : "bg-blue-600"
                    )}
                  />
                </div>
                <div className="text-[10px] text-right font-bold text-slate-500 uppercase tracking-wider">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalClosed)} / {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(goalValue)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Pesquisar negócios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm shadow-sm"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
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
                          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">{stage.title}</h3>
                          <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded-md font-bold text-slate-600">
                            {stageDeals.length}
                          </span>
                        </div>
                        <button className="text-slate-400 hover:text-slate-600 transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
                      </div>
                      
                      {/* Stage Mini Progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-slate-400 uppercase">Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stageGoalValue)}</span>
                          <span className={cn(stageProgress >= 100 ? "text-emerald-500" : "text-blue-600")}>{Math.round(stageProgress)}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-1000", stageProgress >= 100 ? "bg-emerald-500" : "bg-blue-600")}
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
                          className="flex-1 bg-slate-100/50 rounded-2xl p-3 space-y-3 border border-dashed border-slate-200"
                        >
                          {stageDeals.map((deal, index) => (
                            <Draggable key={deal.id} draggableId={deal.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm group hover:border-blue-200 transition-all"
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex gap-1">
                                    <button onClick={() => { setEditingDeal(deal); setIsModalOpen(true); }} className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-all"><Edit2 className="w-3 h-3" /></button>
                                    <button onClick={() => handleDelete(deal.id)} className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                  <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 uppercase">
                                      {contacts.find(c => c.id === deal.contactId)?.name.charAt(0) || '?'}
                                    </div>
                                  </div>
                                </div>
                                <Link href={`/deals/${deal.id}`} className="block hover:text-blue-600 transition-colors">
                                  <h4 className="font-bold text-slate-900 text-sm mb-1">{deal.title}</h4>
                                </Link>
                                <p className="text-xs text-slate-500 mb-4 truncate flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {companies.find(c => c.id === deal.companyId)?.name || 'Empresa não vinculada'}
                                </p>
                                
                                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                  <span className="text-sm font-bold text-slate-900">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
                                  </span>
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
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
                          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-all group"
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white rounded-3xl p-8 w-full max-w-lg relative shadow-2xl">
              <button onClick={() => setIsModalOpen(false)} className="absolute right-6 top-6 p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              <h2 className="text-2xl font-bold mb-6">{editingDeal?.id ? 'Editar Negócio' : 'Novo Negócio'}</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Título</label>
                  <input name="title" required defaultValue={editingDeal?.title} placeholder="Ex: Projeto Reforma 2024" className="w-full px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Valor (R$)</label>
                  <input name="value" type="number" required defaultValue={editingDeal?.value} placeholder="0.00" className="w-full px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Estágio</label>
                    <select name="stage" defaultValue={editingDeal?.stage} className="w-full px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20">
                      {STAGES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Empresa</label>
                    <div className="flex gap-2">
                      <select name="companyId" defaultValue={editingDeal?.companyId} className="flex-1 px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="">Nenhuma</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button 
                        type="button"
                        onClick={() => {
                          const name = prompt("Nome da nova empresa:");
                          if (name) {
                            createCompany({ name }).then(id => {
                              if (id) toast.success("Empresa criada e selecionada!");
                            });
                          }
                        }}
                        className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-600"
                        title="Nova Empresa"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Imóvel Associado (Inventário)</label>
                  <select name="propertyId" defaultValue={editingDeal?.propertyId} className="w-full px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">Nenhum imóvel vinculado</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.title} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Contato de Referência</label>
                  <select name="contactId" defaultValue={editingDeal?.contactId} className="w-full px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">Nenhum</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-bold text-muted-foreground hover:bg-muted rounded-2xl transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 font-bold bg-[#1e3a8a] text-white rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20">Salvar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsGoalModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white rounded-3xl p-8 w-full max-w-sm relative shadow-2xl">
              <button onClick={() => setIsGoalModalOpen(false)} className="absolute right-6 top-6 p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              <h2 className="text-2xl font-bold mb-2">Definir Metas</h2>
              <p className="text-sm text-slate-500 mb-6">Defina os valores de venda desejados para cada situação em {currentMonth}.</p>
              <form onSubmit={handleSaveGoal} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {STAGES.map(stage => (
                  <div key={stage.id}>
                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${stage.color}`} />
                      {stage.title} (R$)
                    </label>
                    <input 
                      name={`goal_${stage.id}`} 
                      type="number" 
                      required 
                      defaultValue={stageGoals[stage.id] || 0} 
                      placeholder="0.00" 
                      className="w-full px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>
                ))}
                <div className="pt-4 flex gap-3 sticky bottom-0 bg-white">
                  <button type="button" onClick={() => setIsGoalModalOpen(false)} className="flex-1 py-3 font-bold text-muted-foreground hover:bg-muted rounded-2xl transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 font-bold bg-[#1e3a8a] text-white rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20">Salvar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
