"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";

import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

import { PipelineHeader, HealthFilterType } from "@/components/pipeline/PipelineHeader";
import { KanbanColumn } from "@/components/pipeline/KanbanColumn";
import { DealModal } from "@/components/pipeline/DealModal";
import { GoalModal } from "@/components/pipeline/GoalModal";
import { LostReasonModal } from "@/components/pipeline/LostReasonModal";

import { recordAuditEvent } from "@/lib/audit";
import { getDealStaleInfo, LOST_REASONS } from "@/lib/lead-health";
import { PIPELINE_STAGES } from "@/lib/constants";
import { safeGetJson } from "@/lib/safe-storage";
import { exportDealsToCsv } from "@/lib/csv-export";
import { 
  Deal, 
  Company, 
  Contact, 
  Goal, 
  Property, 
  UserProfile,
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
  createTimelineEvent,
  getDeals,
  getGoals,
  getCachedDeals,
  getCachedContacts,
  getCachedProperties,
} from "@/lib/db";

const STAGES = PIPELINE_STAGES.map((s) => ({
  ...s,
  color:
    s.color === "blue"
      ? "bg-primary"
      : s.color === "purple"
      ? "bg-purple-500"
      : s.color === "orange"
      ? "bg-orange-500"
      : s.color === "yellow"
      ? "bg-yellow-500"
      : s.color === "emerald"
      ? "bg-emerald-500"
      : "bg-rose-500",
}));

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

  // Database Data States
  const [deals, setDeals] = useState<Deal[]>(() => {
    const cached = getCachedDeals();
    return cached && cached.length > 0 ? cached : [];
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const cached = getCachedContacts();
    return cached && cached.length > 0 ? cached : [];
  });
  const [properties, setProperties] = useState<Property[]>(() => {
    const cached = getCachedProperties();
    return cached && cached.length > 0 ? cached : [];
  });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(() => {
    const cached = getCachedDeals();
    return !(cached && cached.length > 0);
  });

  // Modal States
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isLostReasonModalOpen, setIsLostReasonModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);
  const [isDeletingDeal, setIsDeletingDeal] = useState(false);

  // Lost deal staging state
  const [pendingLostDeal, setPendingLostDeal] = useState<{
    dealId: string;
    previousStage: string;
    dealTitle?: string;
    contactId?: string;
  } | null>(null);

  // Filters & Probabilities
  const [searchQuery, setSearchQuery] = useState("");
  const [healthFilter, setHealthFilter] = useState<HealthFilterType>("all");
  const [probabilities, setProbabilities] = useState<Record<string, number>>({
    lead: 20,
    qualification: 40,
    proposal: 60,
    negotiation: 80,
    closed: 100,
    lost: 0,
  });

  const currentMonth = useMemo(() => new Date().toISOString().substring(0, 7), []);

  // Safe load of probabilities
  useEffect(() => {
    const loadProbabilities = () => {
      const saved = safeGetJson<Record<string, number>>("pipeline_probabilities");
      if (saved) {
        setProbabilities((prev) => ({ ...prev, ...saved }));
      } else {
        const defaults = STAGES.reduce((acc, stage, idx) => {
          acc[stage.id] = stage.id === "lost" ? 0 : Math.min((idx + 1) * 20, 100);
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

  // Sincronização e Subscrição em Tempo Real
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (!user || !profile) return;

    const safetyTimer = setTimeout(() => setLoading(false), 3000);
    const ownerId = profile.role === "Admin" ? undefined : user.id;

    const unsubDeals = subscribeToDeals((data) => {
      setDeals(data);
      setLoading(false);
      clearTimeout(safetyTimer);
    }, ownerId);

    const unsubCompanies = subscribeToCompanies(setCompanies, ownerId);
    const unsubContacts = subscribeToContacts(setContacts, ownerId);
    const unsubProperties = subscribeToProperties(setProperties, ownerId);
    const unsubGoals = subscribeToGoals(setGoals, ownerId);

    let unsubUsers = () => {};
    if (profile.role === "Admin") {
      unsubUsers = subscribeToUsers(setUsers);
    }

    return () => {
      unsubDeals();
      unsubCompanies();
      unsubContacts();
      unsubProperties();
      unsubGoals();
      unsubUsers();
      clearTimeout(safetyTimer);
    };
  }, [user, profile, authLoading, router]);

  // Fallback de recarregamento
  useEffect(() => {
    if (user && profile && deals.length === 0 && loading) {
      const timer = setTimeout(async () => {
        try {
          const ownerId = profile.role === "Admin" ? undefined : user.id;
          const [initialDeals, initialGoals] = await Promise.all([
            getDeals(ownerId),
            getGoals(ownerId),
          ]);
          if (Array.isArray(initialDeals)) setDeals(initialDeals);
          if (Array.isArray(initialGoals)) setGoals(initialGoals);
        } catch {
          // ignore
        } finally {
          setLoading(false);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, profile, deals.length, loading]);

  // Metas do Mês
  const currentGoal = useMemo(() => {
    const monthGoals = goals.filter((g) => g.month === currentMonth);
    return monthGoals.find((g) => g.ownerId === user?.id) || monthGoals[0];
  }, [goals, currentMonth, user]);

  const stageGoals = useMemo(() => currentGoal?.stageGoals || {}, [currentGoal]);
  const goalValue = useMemo(
    () => stageGoals["closed"] || currentGoal?.revenue || 0,
    [stageGoals, currentGoal]
  );

  // Cálculos de Saúde dos Leads
  const staleDeals = useMemo(
    () => deals.filter((d) => getDealStaleInfo(d).isStale),
    [deals]
  );
  const criticalDeals = useMemo(
    () => deals.filter((d) => getDealStaleInfo(d).severity === "critical"),
    [deals]
  );
  const lostDeals = useMemo(
    () => deals.filter((d) => d.stage === "lost"),
    [deals]
  );
  const activeDeals = useMemo(
    () => deals.filter((d) => !getDealStaleInfo(d).isStale && d.stage !== "closed" && d.stage !== "lost"),
    [deals]
  );
  const staleDealsValue = useMemo(
    () => staleDeals.reduce((acc, d) => acc + (d.value || 0), 0),
    [staleDeals]
  );

  // Fast lookups with Maps
  const contactsMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const companiesMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const propertiesMap = useMemo(() => {
    const map: Record<string, Property> = {};
    for (const p of properties) {
      if (p.id) map[p.id] = p;
    }
    return map;
  }, [properties]);

  // Filtragem de Deals com lookups O(1)
  const filteredDeals = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return deals.filter((d) => {
      const contact = d.contactId ? contactsMap.get(d.contactId) : undefined;
      const company = d.companyId ? companiesMap.get(d.companyId) : undefined;
      const matchesSearch =
        d.title.toLowerCase().includes(q) ||
        (company?.name || "").toLowerCase().includes(q) ||
        (contact?.name || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const staleInfo = getDealStaleInfo(d);
      if (healthFilter === "stale") return staleInfo.isStale;
      if (healthFilter === "critical") return staleInfo.severity === "critical";
      if (healthFilter === "lost") return d.stage === "lost";
      if (healthFilter === "active")
        return !staleInfo.isStale && d.stage !== "closed" && d.stage !== "lost";
      return true;
    });
  }, [deals, contactsMap, companiesMap, searchQuery, healthFilter]);

  const handleExportDeals = useCallback(() => {
    if (filteredDeals.length === 0) {
      toast.info("Nenhum negócio no funil para exportar com os filtros atuais.");
      return;
    }
    const contactsObj: Record<string, Contact> = {};
    contacts.forEach((c) => {
      if (c.id) contactsObj[c.id] = c;
    });
    exportDealsToCsv(filteredDeals, contactsObj, propertiesMap);
    recordAuditEvent({
      action: "EXPORT_REPORT",
      title: "Exportação do Funil de Vendas",
      content: `${filteredDeals.length} negócios exportados para planilha CSV.`,
      severity: "low",
      category: "export",
      metadata: {
        dealsCount: filteredDeals.length,
        healthFilter,
        searchQuery: searchQuery || undefined,
      },
    });
    toast.success(`Exportados ${filteredDeals.length} negócios para CSV!`);
  }, [filteredDeals, contacts, propertiesMap, healthFilter, searchQuery]);

  // Pré-agrupamento de deals por estágio em passagem única O(N)
  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const stage of STAGES) {
      map[stage.id] = [];
    }
    for (const deal of filteredDeals) {
      if (map[deal.stage]) {
        map[deal.stage].push(deal);
      } else {
        map[deal.stage] = [deal];
      }
    }
    return map;
  }, [filteredDeals]);

  const totalClosed = useMemo(() => {
    return deals
      .filter((d) => d.stage === "closed")
      .reduce((acc, d) => acc + (d.value || 0), 0);
  }, [deals]);

  const progressPercentage = useMemo(() => {
    return goalValue > 0 ? Math.min((totalClosed / goalValue) * 100, 100) : 0;
  }, [goalValue, totalClosed]);

  // Handlers do Drag-and-Drop
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStage = destination.droppableId;
    const deal = deals.find((d) => d.id === draggableId);
    if (!deal) return;

    // Se movido para 'lost', abrir modal de motivo
    if (newStage === "lost" && deal.stage !== "lost") {
      setPendingLostDeal({
        dealId: deal.id,
        previousStage: deal.stage,
        dealTitle: deal.title,
        contactId: deal.contactId,
      });
      setIsLostReasonModalOpen(true);
      return;
    }

    // Atualização otimista
    setDeals((prev) =>
      prev.map((d) => (d.id === draggableId ? { ...d, stage: newStage } : d))
    );

    try {
      await updateDeal(draggableId, { stage: newStage });
      const stageName = STAGES.find((s) => s.id === newStage)?.title || newStage;

      recordAuditEvent({
        action: "UPDATE_DEAL_STAGE",
        title: "Alteração de Etapa do Negócio",
        content: `Negócio "${deal.title}" movido para o estágio "${stageName}".`,
        severity: "low",
        category: "modification",
        relatedId: deal.id,
        entityType: "deal",
        metadata: {
          previousStage: deal.stage,
          newStage,
          stageTitle: stageName,
        },
      });

      await createTimelineEvent({
        type: "system",
        category: "deal",
        relatedId: deal.id,
        content: `Estágio alterado para "${stageName}".`,
        title: "Etapa Atualizada",
        metadata: { previousStage: deal.stage, newStage },
      });

      if (deal.contactId) {
        await createTimelineEvent({
          type: "system",
          category: "contact",
          relatedId: deal.contactId,
          content: `Negócio "${deal.title}" movido para "${stageName}".`,
          title: "Etapa do Negócio Atualizada",
          metadata: { dealId: deal.id, newStage },
        });
      }

      toast.success(`Movido para ${stageName}`);
    } catch {
      // Reverter em caso de falha
      setDeals((prev) =>
        prev.map((d) => (d.id === draggableId ? { ...d, stage: deal.stage } : d))
      );
      toast.error("Erro ao atualizar etapa do negócio.");
    }
  };

  // Confirmação de Perda
  const handleConfirmLost = async (reasonId: string, notes: string) => {
    if (!pendingLostDeal) return;
    const { dealId, dealTitle, contactId } = pendingLostDeal;
    const reasonLabel = LOST_REASONS.find((r) => r.id === reasonId)?.label || reasonId;

    try {
      await updateDeal(dealId, {
        stage: "lost",
        lostReason: reasonId,
        lostNotes: notes || undefined,
        lostAt: new Date().toISOString(),
      });

      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? {
                ...d,
                stage: "lost",
                lostReason: reasonId,
                lostNotes: notes || undefined,
                lostAt: new Date().toISOString(),
              }
            : d
        )
      );

      recordAuditEvent({
        action: "UPDATE_DEAL_STAGE",
        title: "Negócio Marcado como Perdido",
        content: `Negócio "${dealTitle || ""}" arquivado como perdido. Motivo: ${reasonLabel}`,
        severity: "medium",
        category: "modification",
        relatedId: dealId,
        entityType: "deal",
        metadata: {
          newStage: "lost",
          lostReason: reasonId,
          reasonLabel,
          notes,
        },
      });

      await createTimelineEvent({
        type: "system",
        category: "deal",
        relatedId: dealId,
        content: `Negócio arquivado como perdido. Motivo: ${reasonLabel}${notes ? `. Detalhes: "${notes}"` : ""}`,
        title: "Oportunidade Perdida",
        metadata: { type: "deal_lost", lostReason: reasonId, notes },
      });

      if (contactId) {
        await createTimelineEvent({
          type: "system",
          category: "contact",
          relatedId: contactId,
          content: `Negócio "${dealTitle || ""}" arquivado como perdido. Motivo: ${reasonLabel}`,
          title: "Desistência / Perda de Oportunidade",
          metadata: { type: "deal_lost", lostReason: reasonLabel, dealId },
        });
      }

      toast.success("Negócio marcado como perdido e registrado no histórico.");
      setIsLostReasonModalOpen(false);
      setPendingLostDeal(null);
    } catch {
      toast.error("Erro ao registrar perda.");
    }
  };

  const handleCancelLost = () => {
    if (pendingLostDeal) {
      setDeals((prev) =>
        prev.map((d) =>
          d.id === pendingLostDeal.dealId
            ? { ...d, stage: pendingLostDeal.previousStage }
            : d
        )
      );
    }
    setIsLostReasonModalOpen(false);
    setPendingLostDeal(null);
  };

  // Reativação de Negócio
  const handleReactivateDeal = async (deal: Deal) => {
    try {
      await updateDeal(deal.id, { stage: "lead" });
      setDeals((prev) =>
        prev.map((d) => (d.id === deal.id ? { ...d, stage: "lead" } : d))
      );

      recordAuditEvent({
        action: "UPDATE_DEAL",
        title: "Reativação de Oportunidade",
        content: `Negócio "${deal.title}" reativado para o estágio inicial "Novo Lead".`,
        severity: "medium",
        category: "modification",
        relatedId: deal.id,
        entityType: "deal",
        metadata: { previousStage: deal.stage, newStage: "lead" },
      });

      await createTimelineEvent({
        type: "system",
        category: "deal",
        relatedId: deal.id,
        content: `Negócio reativado pelo corretor e retornado para "Novo Lead".`,
        title: "Negócio Reativado",
        metadata: { type: "deal_reactivated", dealId: deal.id },
      });

      if (deal.contactId) {
        await createTimelineEvent({
          type: "system",
          category: "contact",
          relatedId: deal.contactId,
          content: `Negócio "${deal.title}" foi reativado no pipeline.`,
          title: "Lead Reativado",
          metadata: { type: "deal_reactivated", dealId: deal.id },
        });
      }

      toast.success("Negócio reativado e retornado ao funil!");
    } catch {
      toast.error("Erro ao reativar negócio.");
    }
  };

  // Salvar ou Criar Negócio via Modal
  const handleSaveDeal = async (data: Partial<Deal>) => {
    try {
      if (editingDeal?.id) {
        await updateDeal(editingDeal.id, data);
        recordAuditEvent({
          action: "UPDATE_DEAL",
          title: "Edição de Oportunidade / Negócio",
          content: `Negócio "${data.title}" foi atualizado.`,
          severity: "medium",
          category: "modification",
          relatedId: editingDeal.id,
          entityType: "deal",
          metadata: { dealId: editingDeal.id, ...data },
        });
        toast.success("Negócio atualizado com sucesso!");
      } else {
        const docId = await createDeal({
          title: data.title || "Novo Negócio",
          value: data.value || 0,
          stage: data.stage || "lead",
          companyId: data.companyId,
          contactId: data.contactId,
          propertyId: data.propertyId,
          ownerId: data.ownerId || user?.id,
        });

        recordAuditEvent({
          action: "CREATE_DEAL",
          title: "Criação de Oportunidade",
          content: `Nova oportunidade "${data.title}" cadastrada no valor de R$ ${data.value || 0}.`,
          severity: "low",
          category: "creation",
          relatedId: docId,
          entityType: "deal",
          metadata: { dealId: docId, ...data },
        });
        toast.success("Negócio cadastrado com sucesso!");
      }
      setEditingDeal(null);
    } catch {
      toast.error("Erro ao salvar negócio.");
    }
  };

  // Salvar Metas via Modal
  const handleSaveGoals = async (updatedGoals: Record<string, number>) => {
    try {
      const revenueTotal = updatedGoals["closed"] || 0;
      await setGoal(user?.id || "", currentMonth, revenueTotal, updatedGoals);
      setGoals((prev) => {
        const filtered = prev.filter(
          (g) => !(g.month === currentMonth && g.ownerId === user?.id)
        );
        return [
          ...filtered,
          {
            id: currentGoal?.id || "temp",
            ownerId: user?.id || "",
            month: currentMonth,
            revenue: revenueTotal,
            stageGoals: updatedGoals,
            dealsCount: 0,
            createdAt: new Date().toISOString(),
          },
        ];
      });

      recordAuditEvent({
        action: "UPDATE_SETTINGS",
        title: "Atualização de Metas de Venda",
        content: `Metas de venda configuradas para o mês ${currentMonth}.`,
        severity: "low",
        category: "modification",
        metadata: { stageGoals: updatedGoals, month: currentMonth },
      });

      toast.success("Metas salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar metas.");
    }
  };

  // Exclusão de Negócio
  const confirmDeleteDeal = async () => {
    if (!dealToDelete) return;
    try {
      setIsDeletingDeal(true);
      await deleteDeal(dealToDelete.id);
      recordAuditEvent({
        action: "DELETE_DEAL",
        title: "Exclusão de Negócio / Oportunidade",
        content: `Negócio "${dealToDelete.title}" (R$ ${dealToDelete.value}) foi excluído do sistema.`,
        severity: "high",
        category: "deletion",
        relatedId: dealToDelete.id,
        entityType: "deal",
        metadata: {
          dealId: dealToDelete.id,
          title: dealToDelete.title,
          value: dealToDelete.value,
          stage: dealToDelete.stage,
        },
      });
      toast.success("Negócio excluído com sucesso!");
      setDealToDelete(null);
    } catch {
      toast.error("Erro ao excluir o negócio.");
    } finally {
      setIsDeletingDeal(false);
    }
  };

  if (authLoading || (loading && !user)) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header e Barra de Filtros */}
        <PipelineHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          healthFilter={healthFilter}
          onHealthFilterChange={setHealthFilter}
          goalValue={goalValue}
          totalClosed={totalClosed}
          progressPercentage={progressPercentage}
          totalDealsCount={deals.length}
          activeDealsCount={activeDeals.length}
          staleDealsCount={staleDeals.length}
          criticalDealsCount={criticalDeals.length}
          lostDealsCount={lostDeals.length}
          staleDealsValue={staleDealsValue}
          onOpenGoalModal={() => setIsGoalModalOpen(true)}
          onOpenCreateDealModal={() => {
            setEditingDeal(null);
            setIsDealModalOpen(true);
          }}
          onExportDeals={handleExportDeals}
        />

        {/* Quadro Kanban */}
        <div className="flex-1 overflow-x-auto px-2.5 md:px-3.5 py-2.5">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex h-full gap-2 md:gap-2.5 w-full min-w-[950px] pb-1">
              {STAGES.map((stage) => {
                const stageDeals = dealsByStage[stage.id] || [];
                return (
                  <KanbanColumn
                    key={stage.id}
                    stage={stage}
                    deals={stageDeals}
                    contacts={contacts}
                    companies={companies}
                    contactsMap={contactsMap}
                    companiesMap={companiesMap}
                    probability={probabilities[stage.id] ?? 0}
                    goalValue={stageGoals[stage.id] || 0}
                    badgeClass={BADGE_COLORS[stage.id]}
                    onAddDeal={(stageId) => {
                      setEditingDeal({ stage: stageId } as Deal);
                      setIsDealModalOpen(true);
                    }}
                    onEditDeal={(deal) => {
                      setEditingDeal(deal);
                      setIsDealModalOpen(true);
                    }}
                    onDeleteDeal={(deal) => setDealToDelete(deal)}
                    onReactivateDeal={handleReactivateDeal}
                  />
                );
              })}
            </div>
          </DragDropContext>
        </div>
      </main>

      {/* Modal de Criação / Edição de Negócio */}
      <DealModal
        isOpen={isDealModalOpen}
        onClose={() => {
          setIsDealModalOpen(false);
          setEditingDeal(null);
        }}
        editingDeal={editingDeal}
        onSave={handleSaveDeal}
        companies={companies}
        contacts={contacts}
        properties={properties}
        users={users}
        profile={profile}
      />

      {/* Modal de Metas Mensais */}
      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        currentMonth={currentMonth}
        stageGoals={stageGoals}
        onSaveGoals={handleSaveGoals}
      />

      {/* Modal de Motivo da Perda */}
      <LostReasonModal
        isOpen={isLostReasonModalOpen && !!pendingLostDeal}
        dealTitle={pendingLostDeal?.dealTitle}
        onClose={handleCancelLost}
        onConfirm={handleConfirmLost}
      />

      {/* Modal de Confirmação de Exclusão */}
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
