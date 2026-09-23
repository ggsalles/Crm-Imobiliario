"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Phone, 
  Mail, 
  Users, 
  Briefcase,
  Trash2,
  Pencil,
  X,
  Filter,
  Zap,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { 
  Activity, 
  subscribeToActivities, 
  createActivity, 
  updateActivity, 
  deleteActivity,
  subscribeToContacts,
  subscribeToDeals,
  Contact,
  Deal
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { groupActivities, isPriorityActivity, UrgencyGroup } from "@/lib/intelligence";
import { GeminiBanner } from "@/components/GeminiBanner";
import { motion, AnimatePresence } from "motion/react";

export default function ActivitiesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const groupedActivities = useMemo(() => {
    const filtered = activities.filter(a => {
      if (filter === 'all') return true;
      return a.status === filter;
    });
    return groupActivities(filtered);
  }, [activities, filter]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    type: 'task' as Activity['type'],
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    contactId: "",
    dealId: "",
    description: ""
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;

    setLoading(true);
    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    // Safety timeout: force loading false after 8 seconds if it's still stuck
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 8000);

    const unsubActivities = subscribeToActivities((data) => {
      setActivities(data);
      setLoading(false);
      clearTimeout(safetyTimer);
    }, ownerId);
    
    const unsubContacts = subscribeToContacts(setContacts, ownerId);
    const unsubDeals = subscribeToDeals(setDeals, ownerId);

    // Re-sync when tab gains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("[Activities] Tab visible, triggering re-sync...");
        // subscribe functions already handle initial fetch and polling, 
        // but visibility changes often mean the environment was hibernating
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubActivities();
      unsubContacts();
      unsubDeals();
      clearTimeout(safetyTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, profile]);

  const handleOpenAddModal = () => {
    setEditingActivity(null);
    setFormData({
      title: "",
      type: 'task',
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      contactId: "",
      dealId: "",
      description: ""
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (activity: Activity) => {
    setEditingActivity(activity);
    setFormData({
      title: activity.title,
      type: activity.type,
      date: format(new Date(activity.date), "yyyy-MM-dd'T'HH:mm"),
      contactId: activity.contactId || "",
      dealId: activity.dealId || "",
      description: activity.description || ""
    });
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    const activityData = {
      title: formData.title,
      type: formData.type,
      date: new Date(formData.date).toISOString(),
      contactId: formData.contactId || undefined,
      dealId: formData.dealId || undefined,
      description: formData.description || undefined,
    };

    if (editingActivity) {
      await updateActivity(editingActivity.id, activityData);
      recordAuditEvent({
        action: 'UPDATE_ACTIVITY',
        title: 'Edição de Atividade',
        content: `Atividade "${formData.title}" (${formData.type}) foi atualizada.`,
        severity: 'medium',
        category: 'modification',
        relatedId: editingActivity.id,
        entityType: 'activity',
        metadata: {
          title: formData.title,
          type: formData.type,
          date: formData.date
        }
      });
    } else {
      const newActivityId = await createActivity({
        ...activityData,
        status: 'pending',
      });
      recordAuditEvent({
        action: 'CREATE_ACTIVITY',
        title: 'Criação de Nova Atividade',
        content: `Nova atividade/tarefa "${formData.title}" (${formData.type}) agendada para ${format(new Date(formData.date), "dd/MM/yyyy HH:mm")}.`,
        severity: 'info',
        category: 'modification',
        relatedId: typeof newActivityId === 'string' ? newActivityId : undefined,
        entityType: 'activity',
        metadata: {
          title: formData.title,
          type: formData.type,
          date: formData.date
        }
      });
    }

    setIsAddModalOpen(false);
  };

  const toggleStatus = async (activity: Activity) => {
    const nextStatus = activity.status === 'completed' ? 'pending' : 'completed';
    await updateActivity(activity.id, {
      status: nextStatus
    });
    recordAuditEvent({
      action: 'UPDATE_ACTIVITY',
      title: nextStatus === 'completed' ? 'Atividade Concluída' : 'Atividade Reaberta',
      content: `Atividade "${activity.title}" foi marcada como ${nextStatus === 'completed' ? 'Concluída' : 'Pendente'}.`,
      severity: 'low',
      category: 'modification',
      relatedId: activity.id,
      entityType: 'activity',
      metadata: {
        title: activity.title,
        status: nextStatus
      }
    });
  };

  const handleDelete = async (id: string) => {
    const targetActivity = activities.find(a => a.id === id);
    await deleteActivity(id);
    recordAuditEvent({
      action: 'DELETE_ACTIVITY',
      title: 'Exclusão de Atividade',
      content: `Atividade "${targetActivity?.title || id}" foi excluída.`,
      severity: 'high',
      category: 'deletion',
      relatedId: id,
      entityType: 'activity',
      metadata: {
        title: targetActivity?.title,
        type: targetActivity?.type
      }
    });
    setDeleteConfirmId(null);
  };

  const filteredActivities = activities.filter(a => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  useEffect(() => {
    if (!isAddModalOpen) {
      setDeleteConfirmId(null);
    }
  }, [isAddModalOpen]);

  if (authLoading || !user) return null;

  const groupLabels: Record<UrgencyGroup, string> = {
    overdue: "Atrasadas",
    today: "Hoje",
    tomorrow: "Amanhã",
    soon: "Em breve",
    completed: "Concluídas"
  };

  const groupColors: Record<UrgencyGroup, string> = {
    overdue: "text-red-500",
    today: "text-primary",
    tomorrow: "text-purple-500",
    soon: "text-orange-500",
    completed: "text-emerald-500"
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500 font-sans">
      <Sidebar />
      <main className="flex-1 p-3 sm:p-4 md:p-5 pt-16 md:pt-6 overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-5">
          {/* IA Banner */}
          <GeminiBanner activities={activities} deals={deals} />

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">Atividades</h1>
              <p className="text-muted-foreground font-medium mt-0.5 text-xs md:text-sm">Gerencie suas tarefas, chamadas e reuniões</p>
            </div>
            <button 
              onClick={handleOpenAddModal}
              className="bg-primary text-white px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all w-full sm:w-auto text-xs"
            >
              <Plus className="w-4 h-4" />
              Nova Atividade
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-1.5">
            {(['all', 'pending', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                  filter === f 
                    ? "bg-primary text-white shadow-xs shadow-primary/10" 
                    : "bg-card text-muted-foreground border border-border hover:bg-muted"
                )}
              >
                {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Concluídas'}
              </button>
            ))}
          </div>

          {/* List */}
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-muted-foreground font-bold text-xs">Carregando atividades...</p>
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-6">
              {(Object.keys(groupedActivities) as UrgencyGroup[]).map((groupKey) => {
                const groupItems = groupedActivities[groupKey];
                if (groupItems.length === 0) return null;

                const isCollapsed = collapsedGroups[groupKey];

                return (
                  <div key={groupKey} className="space-y-2.5">
                    <button 
                      onClick={() => toggleGroup(groupKey)}
                      className="flex items-center gap-2 group/title"
                    >
                      <h2 className={cn("text-xs font-black uppercase tracking-wider", groupColors[groupKey])}>
                        {groupLabels[groupKey]}
                      </h2>
                      <span className="bg-muted px-1.5 py-0.5 rounded text-[9px] font-bold text-muted-foreground">
                        {groupItems.length}
                      </span>
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>

                    {!isCollapsed && (
                      <div className="space-y-2.5">
                        {groupItems.map((activity) => {
                          const contact = contacts.find(c => c.id === activity.contactId);
                          const deal = deals.find(d => d.id === activity.dealId);
                          const isPriority = isPriorityActivity(activity, deals);
                          
                          return (
                            <motion.div 
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              key={activity.id}
                              className={cn(
                                "group bg-card p-3.5 md:p-4 rounded-xl border border-border shadow-xs flex items-center gap-3 md:gap-4 transition-all hover:bg-muted/10 relative overflow-hidden",
                                activity.status === 'completed' && "opacity-60",
                                isPriority && "ring-1 ring-primary/20 bg-primary/[0.02]"
                              )}
                            >
                              {isPriority && (
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                              )}

                              <button 
                                onClick={() => toggleStatus(activity)}
                                className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0",
                                  activity.status === 'completed' 
                                    ? "bg-emerald-500 text-white" 
                                    : "border-2 border-border text-muted-foreground/30 group-hover:border-primary/50 group-hover:text-primary/50"
                                )}
                              >
                                {activity.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center flex-wrap gap-1.5 mb-1">
                                  <h3 className={cn(
                                    "text-sm md:text-base font-bold text-foreground truncate",
                                    activity.status === 'completed' && "line-through text-muted-foreground"
                                  )}>
                                    {activity.title}
                                  </h3>
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0",
                                      activity.type === 'call' ? "bg-primary/10 text-primary" :
                                      activity.type === 'meeting' ? "bg-purple-500/10 text-purple-500" :
                                      activity.type === 'email' ? "bg-orange-500/10 text-orange-500" :
                                      "bg-muted text-muted-foreground"
                                    )}>
                                      {activity.type === 'meeting' ? 'Reunião' : 
                                       activity.type === 'task' ? 'Tarefa' : 
                                       activity.type === 'call' ? 'Chamada' : 
                                       activity.type === 'email' ? 'E-mail' : 
                                       activity.type}
                                    </span>
                                    {isPriority && (
                                      <span className="px-2 py-0.5 bg-primary text-white rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs shadow-primary/20 animate-pulse">
                                        <Zap className="w-2.5 h-2.5" />
                                        Prioridade
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3">
                                  <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(activity.date), "dd MMM, yyyy", { locale: ptBR })}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground md:border-l md:border-border md:pl-3">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(activity.date), "HH:mm")}
                                  </div>
                                  {contact && (
                                    <div className="flex items-center gap-1 text-xs font-bold text-primary md:border-l md:border-border md:pl-3">
                                      <Users className="w-3 h-3" />
                                      {contact.name}
                                    </div>
                                  )}
                                  {deal && (
                                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-500 md:border-l md:border-border md:pl-3">
                                      <Briefcase className="w-3 h-3" />
                                      {deal.title}
                                    </div>
                                  )}
                                </div>
                                {activity.description && (
                                  <p className="text-xs text-muted-foreground mt-2 font-medium line-clamp-2">{activity.description}</p>
                                )}
                              </div>

                              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleOpenEditModal(activity)}
                                  className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                  title="Editar"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => {
                                    if (deleteConfirmId === activity.id) {
                                      handleDelete(activity.id);
                                    } else {
                                      setDeleteConfirmId(activity.id);
                                    }
                                  }} 
                                  className={cn(
                                    "p-2 rounded-lg transition-all shadow-xs shrink-0",
                                    deleteConfirmId === activity.id 
                                      ? "bg-red-500 text-white scale-105 shadow-xs" 
                                      : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                  )}
                                  title={deleteConfirmId === activity.id ? "Clique novamente para confirmar" : "Excluir"}
                                >
                                  <Trash2 className={cn("w-3.5 h-3.5", deleteConfirmId === activity.id && "animate-pulse")} />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-dashed border-border py-20 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-bold">Nenhuma atividade encontrada</h3>
              <p className="text-muted-foreground text-xs font-medium mt-1">Relaxe! Você está em dia com suas tarefas.</p>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="mt-5 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-primary/20 hover:scale-105 transition-all"
              >
                Criar Minha Primeira Atividade
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-card w-full max-w-xl rounded-2xl overflow-hidden shadow-xl animate-in fade-in zoom-in duration-300 border border-border"
          >
            <div className="p-5 md:p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-black tracking-tight">
                {editingActivity ? 'Editar Atividade' : 'Nova Atividade'}
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 hover:bg-muted rounded-lg transition-all">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Título</label>
                <input 
                  autoFocus
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Ligar para prospecto..."
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-bold focus:border-primary outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Tipo</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-bold focus:border-primary outline-none transition-all"
                  >
                    <option value="task">Tarefa</option>
                    <option value="call">Chamada</option>
                    <option value="meeting">Reunião</option>
                    <option value="email">E-mail</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Data/Hora</label>
                  <input 
                    type="datetime-local"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-bold focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Lead/Contato</label>
                  <select 
                    value={formData.contactId}
                    onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-bold focus:border-primary outline-none transition-all"
                  >
                    <option value="">Nenhum</option>
                    {contacts.filter(c => c.type === 'cliente').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Negócio</label>
                  <select 
                    value={formData.dealId}
                    onChange={(e) => setFormData({ ...formData, dealId: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-bold focus:border-primary outline-none transition-all"
                  >
                    <option value="">Nenhum</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Observações</label>
                <textarea 
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-medium focus:border-primary outline-none transition-all"
                />
              </div>

              <div className="flex gap-2 pt-2">
                {editingActivity && (
                  <button 
                    type="button"
                    onClick={() => {
                      if (deleteConfirmId === editingActivity.id) {
                        handleDelete(editingActivity.id);
                        setIsAddModalOpen(false);
                      } else {
                        setDeleteConfirmId(editingActivity.id);
                      }
                    }}
                    className={cn(
                      "px-3.5 py-2 rounded-xl transition-all border",
                      deleteConfirmId === editingActivity.id
                        ? "bg-red-500 text-white border-red-600 shadow-md shadow-red-500/20 scale-105"
                        : "border-red-500/10 text-red-500 hover:bg-red-500/5"
                    )}
                    title={deleteConfirmId === editingActivity.id ? "Clique para confirmar" : "Excluir atividade"}
                  >
                    <Trash2 className={cn("w-4 h-4", deleteConfirmId === editingActivity.id && "animate-pulse")} />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 border border-border rounded-xl font-bold text-xs md:text-sm text-muted-foreground hover:bg-muted transition-all font-sans"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-primary text-white py-2 rounded-xl font-bold text-xs md:text-sm shadow-md shadow-primary/20 hover:opacity-90 transition-all font-sans"
                >
                  {editingActivity ? 'Salvar Alterações' : 'Salvar Atividade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

