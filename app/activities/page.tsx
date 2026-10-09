"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Sidebar } from "@/components/sidebar";
import { 
  Calendar, 
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
  Deal,
  getCachedActivities,
  getCachedContacts,
  getCachedDeals
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { groupActivities, UrgencyGroup } from "@/lib/intelligence";
import { GeminiBanner } from "@/components/GeminiBanner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { exportActivitiesToCsv } from "@/lib/csv-export";

import { ActivityCardItem } from "@/components/activities/ActivityCardItem";
import { ActivityFormModal } from "@/components/activities/ActivityFormModal";
import { ActivityFilterToolbar } from "@/components/activities/ActivityFilterToolbar";

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

  // Fast lookup maps O(1)
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
        const updated = await updateActivity(editingActivity.id, activityData);
        setActivities(prev => prev.map(a => a.id === editingActivity.id ? (updated || { ...a, ...activityData }) : a));

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
        const res = await createActivity({
          ...activityData,
          status: 'pending',
        });
        if (res?.activity) {
          setActivities(prev => [...prev, res.activity]);
        }
        const newActivityId = res?.id || res?.activity?.id;

        recordAuditEvent({
          action: 'CREATE_ACTIVITY',
          title: 'Criação de Nova Atividade',
          content: `Nova atividade/tarefa "${formData.title}" (${formData.type}) agendada para ${format(new Date(formData.date), "dd/MM/yyyy HH:mm")}.`,
          severity: 'info',
          category: 'modification',
          relatedId: newActivityId,
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

    setActivities(prev => prev.filter(a => a.id !== id));

    try {
      await deleteActivity(id);
      try {
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
      } catch (auditErr) {
        console.warn("[ActivitiesPage] Erro ao registrar auditoria de exclusão:", auditErr);
      }

      toast.success("Atividade excluída com sucesso!", { id: toastId });
      setActivityToDelete(null);
      setIsAddModalOpen(false);
      setEditingActivity(null);
    } catch (err: any) {
      console.error("[ActivitiesPage] Erro ao excluir atividade:", err);
      setActivities(prev => [...prev, targetActivity]);
      toast.error(err?.message || "Não foi possível excluir a atividade. Tente novamente.", { id: toastId });
    } finally {
      setIsDeletingActivity(false);
    }
  }, [activityToDelete]);

  const handleDeleteClick = useCallback((activity: Activity) => {
    setIsAddModalOpen(false);
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
    <div className="flex h-screen bg-background text-foreground transition-colors duration-500 font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Fixed Area (Banner + Filter Toolbar) */}
        <div className="p-3 sm:p-4 md:px-5 md:pt-4 md:pb-2 shrink-0 max-w-7xl w-full mx-auto space-y-2">
          {/* IA Banner (Compact & Sleek) */}
          <GeminiBanner activities={activities} deals={deals} />

          {/* Header & Filter Toolbar */}
          <ActivityFilterToolbar
            activityCounts={activityCounts}
            filter={filter}
            setFilter={setFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onExport={handleExportActivities}
            onOpenAddModal={handleOpenAddModal}
          />
        </div>

        {/* Scrollable Activities List Container */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-5 pb-3 max-w-7xl w-full mx-auto flex flex-col">
          {loading ? (
            <div className="text-center py-8 my-auto">
              <div className="animate-spin w-7 h-7 border-3 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-muted-foreground font-bold text-xs">Carregando atividades...</p>
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-3.5">
              {(Object.keys(groupedActivities) as UrgencyGroup[]).map((groupKey) => {
                const groupItems = groupedActivities[groupKey];
                if (groupItems.length === 0) return null;

                const isCollapsed = collapsedGroups[groupKey];

                return (
                  <div key={groupKey} className="space-y-1.5">
                    <button 
                      onClick={() => toggleGroup(groupKey)}
                      className="flex items-center gap-1.5 group/title cursor-pointer"
                    >
                      <h2 className={cn("text-[11px] font-black uppercase tracking-wider", groupColors[groupKey])}>
                        {groupLabels[groupKey]}
                      </h2>
                      <span className="bg-muted px-1.5 py-0.2 rounded text-[9px] font-bold text-muted-foreground">
                        {groupItems.length}
                      </span>
                      {isCollapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                    </button>

                    {!isCollapsed && (
                      <div className="space-y-2">
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
            <div className="bg-card/40 rounded-2xl border border-dashed border-border py-6 px-4 text-center my-auto flex flex-col items-center justify-center max-w-sm mx-auto w-full shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center mb-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Nenhuma atividade encontrada</h3>
              <p className="text-muted-foreground text-[11px] font-medium mt-0.5 max-w-xs leading-relaxed">
                Relaxe! Você está em dia com suas tarefas e compromissos.
              </p>
              <button 
                onClick={handleOpenAddModal}
                className="mt-3 bg-primary text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                Criar Minha Primeira Atividade
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      <ActivityFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        editingActivity={editingActivity}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        onDeleteRequest={handleDeleteClick}
        isSaving={isSaving}
        contacts={contacts}
        deals={deals}
      />

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
