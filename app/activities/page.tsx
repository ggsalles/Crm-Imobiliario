"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo, useRef, useCallback, memo } from "react";
import { toast } from "sonner";
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
  ChevronRight,
  CheckSquare,
  Download
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
  Deal,
  getCachedActivities,
  getCachedContacts,
  getCachedDeals
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { groupActivities, isPriorityActivity, UrgencyGroup } from "@/lib/intelligence";
import { GeminiBanner } from "@/components/GeminiBanner";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { exportActivitiesToCsv } from "@/lib/csv-export";

export default function ActivitiesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>(() => {
    const cached = getCachedActivities();
    return cached && cached.length > 0 ? cached : [];
  });
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const cached = getCachedContacts();
    return cached && cached.length > 0 ? cached : [];
  });
  const [deals, setDeals] = useState<Deal[]>(() => {
    const cached = getCachedDeals();
    return cached && cached.length > 0 ? cached : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = getCachedActivities();
    return !(cached && cached.length > 0);
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [isDeletingActivity, setIsDeletingActivity] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingRef = useRef(false);

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

    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    const existing = getCachedActivities(ownerId);
    if (!existing || existing.length === 0) {
      setLoading(true);
    }

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

    return () => {
      unsubActivities();
      unsubContacts();
      unsubDeals();
      clearTimeout(safetyTimer);
    };
  }, [user, profile]);

  // Memoized fast lookup maps O(1)
  const contactsMap = useMemo(() => new Map(contacts.map(c => [c.id, c])), [contacts]);
  const dealsMap = useMemo(() => new Map(deals.map(d => [d.id, d])), [deals]);

  // Activity counts by status
  const activityCounts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    activities.forEach(a => {
      if (a.status === 'completed') completed++;
      else pending++;
    });
    return {
      total: activities.length,
      pending,
      completed
    };
  }, [activities]);

  // Grouped activities with search and status filter memoized
  const groupedActivities = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = activities.filter(a => {
      if (filter !== 'all' && a.status !== filter) return false;
      if (!q) return true;

      const titleMatch = (a.title || "").toLowerCase().includes(q);
      const descMatch = (a.description || "").toLowerCase().includes(q);
      const contactMatch = a.contactId ? (contactsMap.get(a.contactId)?.name || "").toLowerCase().includes(q) : false;
      const dealMatch = a.dealId ? (dealsMap.get(a.dealId)?.title || "").toLowerCase().includes(q) : false;

      return titleMatch || descMatch || contactMatch || dealMatch;
    });

    return groupActivities(filtered);
  }, [activities, filter, searchQuery, contactsMap, dealsMap]);

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  }, []);

  const handleOpenAddModal = useCallback(() => {
    setEditingActivity(null);
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    setFormData({
      title: "",
      type: 'task',
      date: format(nextHour, "yyyy-MM-dd'T'HH:mm"),
      contactId: "",
      dealId: "",
      description: ""
    });
    setIsAddModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((activity: Activity) => {
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
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSaving) return;
    if (!formData.title.trim()) {
      toast.error("Por favor, preencha o título da atividade.");
      return;
    }

    if (!editingActivity && formData.date) {
      const selectedTime = new Date(formData.date).getTime();
      if (selectedTime < Date.now() - 60000) {
        toast.error("Não é possível agendar uma atividade com data/horário no passado.");
        return;
      }
    }

    isSubmittingRef.current = true;
    setIsSaving(true);

    try {
      const activityData = {
        title: formData.title.trim(),
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
        toast.success("Atividade atualizada com sucesso!");
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
        toast.success("Atividade criada com sucesso!");
      }

      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error("Error saving activity:", err);
      toast.error(err?.message || "Erro ao salvar atividade.");
    } finally {
      isSubmittingRef.current = false;
      setIsSaving(false);
    }
  }, [editingActivity, formData, isSaving]);

  const toggleStatus = useCallback(async (activity: Activity) => {
    const nextStatus = activity.status === 'completed' ? 'pending' : 'completed';
    // Otimistic update
    setActivities(prev => prev.map(a => a.id === activity.id ? { ...a, status: nextStatus } : a));

    try {
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
    } catch (err) {
      // Revert optimistic update
      setActivities(prev => prev.map(a => a.id === activity.id ? { ...a, status: activity.status } : a));
      toast.error("Erro ao atualizar status da atividade.");
    }
  }, []);

  const confirmDeleteActivity = useCallback(async () => {
    if (!activityToDelete) return;
    const targetActivity = activityToDelete;
    const id = targetActivity.id;

    setIsDeletingActivity(true);
    const toastId = toast.loading("Excluindo atividade...");

    // Atualização otimista
    setActivities(prev => prev.filter(a => a.id !== id));

    try {
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
      toast.success("Atividade excluída com sucesso!", { id: toastId });
      setActivityToDelete(null);
      if (isAddModalOpen && editingActivity?.id === id) {
        setIsAddModalOpen(false);
      }
    } catch (err: any) {
      console.error("[ActivitiesPage] Erro ao excluir atividade:", err);
      setActivities(prev => [...prev, targetActivity]);
      toast.error(err?.message || "Não foi possível excluir a atividade. Tente novamente.", { id: toastId });
    } finally {
      setIsDeletingActivity(false);
    }
  }, [activityToDelete, editingActivity, isAddModalOpen]);

  const handleDeleteClick = useCallback((activity: Activity) => {
    setActivityToDelete(activity);
  }, []);

  const handleExportActivities = useCallback(() => {
    if (activities.length === 0) {
      toast.info("Nenhuma atividade cadastrada para exportar.");
      return;
    }
    const contactsObj: Record<string, Contact> = {};
    contacts.forEach((c) => {
      if (c.id) contactsObj[c.id] = c;
    });

    const dealsObj: Record<string, Deal> = {};
    deals.forEach((d) => {
      if (d.id) dealsObj[d.id] = d;
    });

    exportActivitiesToCsv(activities, contactsObj, dealsObj);
    recordAuditEvent({
      action: "EXPORT_REPORT",
      title: "Exportação de Atividades e Tarefas",
      content: `${activities.length} atividades exportadas para planilha CSV.`,
      severity: "low",
      category: "export",
      metadata: {
        activitiesCount: activities.length,
        filter,
      },
    });
    toast.success(`Exportadas ${activities.length} atividades para CSV!`);
  }, [activities, contacts, deals, filter]);

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
              <p className="text-muted-foreground font-medium mt-0.5 text-xs md:text-sm">
                Gerencie suas tarefas, chamadas e reuniões ({activityCounts.total}).
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleExportActivities}
                className="bg-card border border-border px-3.5 py-2 rounded-xl font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer flex-1 sm:flex-initial"
                title="Exportar todas as atividades cadastradas para CSV"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>Exportar .CSV</span>
              </button>
              <button 
                onClick={handleOpenAddModal}
                className="bg-primary text-white px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all w-full sm:w-auto text-xs cursor-pointer flex-1 sm:flex-initial"
              >
                <Plus className="w-4 h-4" />
                Nova Atividade
              </button>
            </div>
          </div>

          {/* Filters & Search Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Status Tabs */}
            <div className="flex gap-1.5 bg-card p-1 rounded-xl border border-border w-fit shrink-0">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  filter === 'all' 
                    ? "bg-primary text-white shadow-xs" 
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                Todas ({activityCounts.total})
              </button>
              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  filter === 'pending' 
                    ? "bg-primary text-white shadow-xs" 
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                Pendentes ({activityCounts.pending})
              </button>
              <button
                type="button"
                onClick={() => setFilter('completed')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  filter === 'completed' 
                    ? "bg-primary text-white shadow-xs" 
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                Concluídas ({activityCounts.completed})
              </button>
            </div>

            {/* Quick Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Buscar por título, lead ou negócio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 bg-card text-foreground border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
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
                      className="flex items-center gap-2 group/title cursor-pointer"
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
                        {groupItems.map((activity) => (
                          <ActivityCardItem
                            key={activity.id}
                            activity={activity}
                            contact={activity.contactId ? contactsMap.get(activity.contactId) : undefined}
                            deal={activity.dealId ? dealsMap.get(activity.dealId) : undefined}
                            deals={deals}
                            onToggleStatus={toggleStatus}
                            onEdit={handleOpenEditModal}
                            onDelete={handleDeleteClick}
                          />
                        ))}
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
                onClick={handleOpenAddModal}
                className="mt-5 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-primary/20 hover:scale-105 transition-all cursor-pointer"
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
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 hover:bg-muted rounded-lg transition-all cursor-pointer">
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
                    min={!editingActivity ? format(new Date(), "yyyy-MM-dd'T'HH:mm") : undefined}
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
                    onClick={() => setActivityToDelete(editingActivity)}
                    className="px-3.5 py-2 rounded-xl transition-all border border-red-500/20 text-red-500 hover:bg-red-500/10 flex items-center justify-center cursor-pointer"
                    title="Excluir atividade"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 border border-border rounded-xl font-bold text-xs md:text-sm text-muted-foreground hover:bg-muted transition-all font-sans cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-primary text-white py-2 rounded-xl font-bold text-xs md:text-sm shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-sans flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? 'Salvando...' : editingActivity ? 'Salvar Alterações' : 'Salvar Atividade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteModal
        isOpen={!!activityToDelete}
        onClose={() => setActivityToDelete(null)}
        onConfirm={confirmDeleteActivity}
        title="Excluir Atividade"
        itemName={activityToDelete?.title}
        itemType="atividade"
        isDeleting={isDeletingActivity}
      />
    </div>
  );
}

// Memoized Card Item for high-performance virtual rendering
const ActivityCardItem = memo(function ActivityCardItem({
  activity,
  contact,
  deal,
  deals,
  onToggleStatus,
  onEdit,
  onDelete
}: {
  activity: Activity;
  contact?: Contact;
  deal?: Deal;
  deals: Deal[];
  onToggleStatus: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
}) {
  const isPriority = isPriorityActivity(activity, deals);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
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
        type="button"
        onClick={() => onToggleStatus(activity)}
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer",
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
          type="button"
          onClick={() => onEdit(activity)}
          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button 
          type="button"
          onClick={() => onDelete(activity)} 
          className="p-2 rounded-lg transition-all shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
          title="Excluir atividade"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
});
