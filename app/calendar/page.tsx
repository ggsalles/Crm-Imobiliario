"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameDay, 
  eachDayOfInterval,
  parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { Sidebar } from "@/components/sidebar";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { DayScheduleView } from "@/components/calendar/DayScheduleView";
import { EventModal } from "@/components/calendar/EventModal";
import { WeeklyReportModal } from "@/components/calendar/WeeklyReportModal";

import { useAuth } from "@/providers/auth-provider";
import { 
  subscribeToActivities, 
  createActivity, 
  updateActivity, 
  deleteActivity 
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { safeAiCall } from "@/lib/ai";
import { CalendarEventItem, exportAllEventsToIcs } from "@/lib/calendar-export";

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <CalendarContent />
    </Suspense>
  );
}

function CalendarContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingRef = useRef(false);

  // Deletion States
  const [eventToDelete, setEventToDelete] = useState<CalendarEventItem | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  // AI Weekly Report States
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [aiReport, setAiReport] = useState<string>("");
  const [aiReportLoading, setAiReportLoading] = useState(false);

  // Helper to compute smart default times
  const getDefaultEventTimes = useCallback((targetDate: Date = new Date()) => {
    const now = new Date();
    const isToday = isSameDay(targetDate, now);

    if (isToday) {
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      const nextHour = currentMinutes >= 45 ? currentHour + 2 : currentHour + 1;
      const safeStartHour = Math.min(Math.max(nextHour, 8), 22);
      const safeEndHour = Math.min(safeStartHour + 1, 23);
      return {
        time: `${String(safeStartHour).padStart(2, "0")}:00`,
        endTime: `${String(safeEndHour).padStart(2, "0")}:00`
      };
    }

    return { time: "10:00", endTime: "11:00" };
  }, []);

  const [newEvent, setNewEvent] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "10:00",
    endTime: "11:00",
    type: "Visita",
    client: "",
    description: ""
  });

  // Subscribe to database activities
  useEffect(() => {
    if (!user || !profile) return;

    const ownerId = profile.role === "Admin" ? undefined : user.id;
    
    const unsub = subscribeToActivities((data) => {
      const mappedEvents: CalendarEventItem[] = data.map(act => {
        const descText = act.description || "";
        const descLines = descText.split("\n");
        const firstLine = descLines[0] || "";
        
        const isTimeFormat = /^\d{2}:\d{2}\s-\s\d{2}:\d{2}/.test(firstLine);
        
        let displayTime = "Agendado";
        let dateObj: Date;
        try {
          dateObj = act.date ? (typeof act.date === "string" ? parseISO(act.date) : new Date(act.date)) : new Date();
          
          if (isTimeFormat) {
            displayTime = firstLine;
          } else if (act.date) {
            displayTime = format(dateObj, "HH:mm");
          }
        } catch (e) {
          console.error("Error formatting date", e);
          dateObj = new Date();
        }

        return {
          id: act.id,
          title: act.title || "Sem título",
          description: isTimeFormat ? descLines.slice(1).join("\n") : descText,
          date: dateObj,
          time: displayTime,
          type: act.type === "meeting" ? "Visita" : act.type === "call" ? "Follow-up" : "Reunião",
          client: "",
          status: act.status
        };
      });
      setEvents(mappedEvents);
    }, ownerId);

    return () => unsub();
  }, [user, profile]);

  // Filtered Events with memoization
  const filteredEvents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return events.filter(event => {
      // Search
      if (query) {
        const matchTitle = event.title.toLowerCase().includes(query);
        const matchDesc = (event.description || "").toLowerCase().includes(query);
        const matchClient = (event.client || "").toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchClient) return false;
      }

      // Type filter
      if (selectedType !== "all" && event.type !== selectedType) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "all") {
        const isCompleted = event.status === "completed";
        if (selectedStatus === "completed" && !isCompleted) return false;
        if (selectedStatus === "pending" && isCompleted) return false;
      }

      return true;
    });
  }, [events, searchQuery, selectedType, selectedStatus]);

  // O(1) indexed events map by date string "YYYY-MM-DD"
  const eventsByDateStr = useMemo(() => {
    const map: Record<string, CalendarEventItem[]> = {};
    for (const e of filteredEvents) {
      const dateObj = e.date instanceof Date ? e.date : parseISO(e.date as string);
      const key = format(dateObj, "yyyy-MM-dd");
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(e);
    }
    return map;
  }, [filteredEvents]);

  // Selected date events
  const selectedDayEvents = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return eventsByDateStr[key] || [];
  }, [eventsByDateStr, selectedDate]);

  // Weekly events calculation
  const weeklyEvents = useMemo(() => {
    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 1 });
    
    return events.filter(e => {
      const eventDate = e.date instanceof Date ? e.date : parseISO(e.date as string);
      return eventDate >= startOfCurrentWeek && eventDate <= endOfCurrentWeek;
    });
  }, [events]);

  const sortedWeeklyEvents = useMemo(() => {
    return [...weeklyEvents].sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : parseISO(a.date as string);
      const dateB = b.date instanceof Date ? b.date : parseISO(b.date as string);
      return dateA.getTime() - dateB.getTime();
    });
  }, [weeklyEvents]);

  // Calendar month dates
  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart]);
  const startDate = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const endDate = useMemo(() => endOfWeek(monthEnd), [monthEnd]);

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  const prevMonth = useCallback(() => setCurrentMonth(prev => subMonths(prev, 1)), []);
  const nextMonth = useCallback(() => setCurrentMonth(prev => addMonths(prev, 1)), []);
  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentMonth(now);
    setSelectedDate(now);
  }, []);

  const openNewEventModal = useCallback((date?: Date) => {
    const targetDate = date || selectedDate || new Date();
    setSelectedDate(targetDate);
    setEditingEvent(null);
    const times = getDefaultEventTimes(targetDate);
    setNewEvent({
      title: "",
      date: format(targetDate, "yyyy-MM-dd"),
      time: times.time,
      endTime: times.endTime,
      type: "Visita",
      client: "",
      description: ""
    });
    setIsModalOpen(true);
  }, [selectedDate, getDefaultEventTimes]);

  const openEditModal = useCallback((event: CalendarEventItem) => {
    setEditingEvent(event);
    const timeParts = event.time.split(" - ");
    const start = timeParts[0] || "10:00";
    const end = timeParts[1] || "11:00";
    const evDate = event.date instanceof Date ? event.date : parseISO(event.date as string);
    
    setNewEvent({
      title: event.title,
      date: format(evDate, "yyyy-MM-dd"),
      time: start,
      endTime: end,
      type: event.type,
      client: event.client || "",
      description: event.description || ""
    });
    setSelectedDate(evDate);
    setIsModalOpen(true);
  }, []);

  const handleFormFieldChange = useCallback(<K extends keyof typeof newEvent>(field: K, value: typeof newEvent[K]) => {
    setNewEvent(prev => {
      const next = { ...prev, [field]: value };
      if (field === "date" && typeof value === "string" && value) {
        const [y, m, d] = value.split("-").map(Number);
        const parsed = new Date(y, m - 1, d);
        setSelectedDate(parsed);
        if (isSameDay(parsed, new Date())) {
          const times = getDefaultEventTimes(parsed);
          next.time = times.time;
          next.endTime = times.endTime;
        }
      }
      return next;
    });
  }, [getDefaultEventTimes]);

  const isPastDateWarning = useMemo(() => {
    if (editingEvent) return false;
    if (!newEvent.time || !newEvent.date) return false;
    const [year, month, day] = newEvent.date.split("-").map(Number);
    const [h, m] = newEvent.time.split(":").map(Number);
    if (!year || !month || !day) return false;
    const candidate = new Date(year, month - 1, day, h || 0, m || 0, 0, 0);
    return candidate.getTime() < Date.now() - 60000;
  }, [editingEvent, newEvent.date, newEvent.time]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSaving) return;

    if (!newEvent.title.trim()) {
      toast.error("Por favor, preencha o título do evento.");
      return;
    }

    if (!newEvent.date) {
      toast.error("Por favor, informe a data do compromisso.");
      return;
    }

    const [year, month, day] = newEvent.date.split("-").map(Number);
    const [hours, minutes] = newEvent.time.split(":").map(Number);
    const activityDate = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
    const now = new Date();

    if (!editingEvent && activityDate.getTime() < (now.getTime() - 60000)) {
      toast.error("Não é possível agendar um compromisso no passado. Escolha uma data e horário futuros.");
      return;
    }

    const [endHours, endMinutes] = newEvent.endTime.split(":").map(Number);
    const endActivityDate = new Date(year, month - 1, day, endHours || 0, endMinutes || 0, 0, 0);

    if (endActivityDate.getTime() <= activityDate.getTime()) {
      toast.error("O horário de término deve ser posterior ao horário de início.");
      return;
    }

    isSubmittingRef.current = true;
    setIsSaving(true);
    const dbType = newEvent.type === "Visita" ? "meeting" : newEvent.type === "Reunião" ? "meeting" : "call";

    const activityData = {
      title: newEvent.title.trim(),
      description: `${newEvent.time} - ${newEvent.endTime}${newEvent.description ? `\n${newEvent.description}` : ""}`,
      date: activityDate.toISOString(),
      type: dbType,
      status: "pending" as const,
    };

    try {
      if (editingEvent) {
        await updateActivity(editingEvent.id, activityData);
        recordAuditEvent({
          action: "UPDATE_ACTIVITY",
          title: "Edição de Agendamento na Agenda",
          content: `Compromisso "${newEvent.title}" (${newEvent.type}) atualizado na agenda.`,
          severity: "medium",
          category: "modification",
          relatedId: editingEvent.id,
          entityType: "activity",
          metadata: {
            title: newEvent.title,
            type: newEvent.type,
            time: `${newEvent.time} - ${newEvent.endTime}`
          }
        });
        toast.success("Compromisso atualizado com sucesso!");
      } else {
        const newActId = await createActivity(activityData);
        recordAuditEvent({
          action: "CREATE_ACTIVITY",
          title: "Novo Agendamento na Agenda",
          content: `Novo compromisso "${newEvent.title}" (${newEvent.type}) agendado para ${format(activityDate, "dd/MM/yyyy")} às ${newEvent.time}.`,
          severity: "info",
          category: "modification",
          relatedId: typeof newActId === "string" ? newActId : undefined,
          entityType: "activity",
          metadata: {
            title: newEvent.title,
            type: newEvent.type,
            date: activityDate.toISOString()
          }
        });
        toast.success("Compromisso agendado com sucesso!");
      }
      setIsModalOpen(false);
      setEditingEvent(null);
      const nextDefaults = getDefaultEventTimes(selectedDate);
      setNewEvent({
        title: "",
        date: format(selectedDate, "yyyy-MM-dd"),
        time: nextDefaults.time,
        endTime: nextDefaults.endTime,
        type: "Visita",
        client: "",
        description: ""
      });
    } catch (err: any) {
      console.error("Error saving activity", err);
      toast.error(err?.message || "Erro ao salvar compromisso. Tente novamente.");
    } finally {
      isSubmittingRef.current = false;
      setIsSaving(false);
    }
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    const targetEvent = eventToDelete;
    const id = targetEvent.id;

    setIsDeletingEvent(true);
    const toastId = toast.loading("Excluindo compromisso...");
    setEvents(prev => prev.filter(e => e.id !== id));

    try {
      await deleteActivity(id);
      recordAuditEvent({
        action: "DELETE_ACTIVITY",
        title: "Cancelamento / Exclusão de Agendamento",
        content: `Compromisso "${targetEvent?.title || id}" foi excluído da agenda.`,
        severity: "high",
        category: "deletion",
        relatedId: id,
        entityType: "activity",
        metadata: {
          title: targetEvent?.title,
          type: targetEvent?.type
        }
      });
      toast.success("Compromisso excluído com sucesso!", { id: toastId });
      setEventToDelete(null);
      if (isModalOpen) setIsModalOpen(false);
      setEditingEvent(null);
    } catch (err: any) {
      console.error("Error deleting activity", err);
      setEvents(prev => [...prev, targetEvent]);
      toast.error(err?.message || "Erro ao excluir compromisso.", { id: toastId });
    } finally {
      setIsDeletingEvent(false);
    }
  };

  const handleToggleStatus = useCallback(async (event: CalendarEventItem) => {
    const newStatus = event.status === "completed" ? "pending" : "completed";
    try {
      await updateActivity(event.id, { status: newStatus as any });
      recordAuditEvent({
        action: "UPDATE_ACTIVITY",
        title: newStatus === "completed" ? "Compromisso Concluído" : "Compromisso Reaberto",
        content: `Agendamento "${event.title}" marcado como ${newStatus === "completed" ? "Realizado/Concluído" : "Pendente"}.`,
        severity: "low",
        category: "modification",
        relatedId: event.id,
        entityType: "activity",
        metadata: {
          title: event.title,
          status: newStatus
        }
      });
      toast.success(newStatus === "completed" ? "Compromisso concluído!" : "Compromisso reaberto!");
    } catch (err) {
      console.error("Error toggling status", err);
      toast.error("Erro ao atualizar status do compromisso.");
    }
  }, []);

  const handleExportAll = useCallback(() => {
    if (filteredEvents.length === 0) {
      toast.info("Não há compromissos para exportar com os filtros atuais.");
      return;
    }
    const currentMonthLabel = format(currentMonth, "yyyy-MM");
    exportAllEventsToIcs(filteredEvents, `agenda-salesscore-${currentMonthLabel}`);
    toast.success(`Exportados ${filteredEvents.length} compromissos no formato iCalendar (.ics)!`);
  }, [filteredEvents, currentMonth]);

  const getFallbackReport = (total: number, completed: number) => {
    return `### 1. FOCO E RITMO DA SEMANA
Você possui **${total}** compromisso(s) agendado(s) esta semana, com **${completed}** já concluído(s) (${total > 0 ? Math.round((completed / total) * 100) : 0}% de aproveitamento). Seu volume de atividades indica um ritmo ${total > 3 ? "dinâmico e favorável a fechamentos" : "tranquilo, propício para prospecção ativa de novos imóveis e leads"}.

### 2. DICAS DE PREPARAÇÃO
- **Estudo de Caso**: Revise as dores de cada cliente e saiba de cor se buscam investimento ou moradia familiar.
- **Preparação e Visita física**: No caso de visitas, ligue com antecedência para portarias ou zeladores garantindo o livre acesso ao imóvel.
- **Dossiê do Imóvel**: Carregue informações sobre taxas condominiais, IPTU e histórico de reajustes.

### 3. PLANO DE AÇÃO ACESSÍVEL
1. Envie uma mensagem rápida de pós-visita detalhando os próximos passos para propostas formais em até 24 horas.
2. Atualize o funil de vendas e registre o status de cada contato após as interações.
3. Reserve ao menos 45 minutos diários para resgatar leads antigos ou parados no funil.`;
  };

  const generateWeeklyReport = useCallback(async (force = false) => {
    if (aiReportLoading) return;
    if (aiReport && !force) return;

    setAiReportLoading(true);
    try {
      const total = weeklyEvents.length;
      const completed = weeklyEvents.filter(e => e.status === "completed").length;
      
      const listStr = weeklyEvents.map((e) => {
        const d = e.date instanceof Date ? e.date : parseISO(e.date as string);
        const dayStr = format(d, "EEEE (dd/MM)", { locale: ptBR });
        return `- ${e.title} na ${dayStr} às ${e.time} [Status: ${e.status === "completed" ? "Concluido" : "Pendente"}, Tipo: ${e.type}]`;
      }).join("\n");

      const prompt = `Você é um correspondente e assessor de alta performance para o corretor imobiliário usuário do CRM "SalesScore".
Prontamente analise a agenda de compromissos desse profissional para a semana atual e gere um relatório dividido estritamente em:

### 1. FOCO E RITMO DA SEMANA
Uma análise sincera baseada no volume de reuniões (${completed} concluídas de um total de ${total} compromissos). Descreva se o ritmo está bom ou se ele precisa ajustar o foco de prospecção.

### 2. DICAS DE PREPARAÇÃO
Dicas acionáveis e refinadas de até 3 frases sobre como ele pode se preparar para as visitas/reuniões cadastradas para o corretor arrasar com os clientes.

### 3. PLANO DE AÇÃO ACESSÍVEL
3 passos sequenciais e práticos para que o corretor mantenha ou eleve o patamar de conversão nesta semana.

Aqui está a lista de compromissos da semana estruturada:
${listStr || "Nenhum compromisso cadastrado para esta semana."}

Seja direto de forma profissional e altamente inspiradora, usando o português do Brasil. Use exclusivamente formatação Markdown limpa e amigável.`;

      const fallbackText = getFallbackReport(total, completed);
      const res = await safeAiCall(prompt, fallbackText);
      setAiReport(res.text);
      if (force) {
        toast.success("Insights atualizados com IA!");
      }
    } catch (err) {
      console.error(err);
      setAiReport(getFallbackReport(weeklyEvents.length, weeklyEvents.filter(e => e.status === "completed").length));
      toast.error("Erro ao comunicar com a IA. Usando orientações locais!");
    } finally {
      setAiReportLoading(false);
    }
  }, [aiReport, aiReportLoading, weeklyEvents]);

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Modular Header with Search, Filter & iCal Export */}
        <CalendarHeader 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          onNewEvent={() => openNewEventModal(selectedDate)}
          onExportAll={handleExportAll}
          totalEventsCount={filteredEvents.length}
        />

        {/* Content Layout */}
        <div className="p-3 sm:p-4 md:p-5 flex flex-col lg:flex-row gap-4 flex-1 max-w-7xl w-full mx-auto">
          {/* Month Grid with O(1) Day Lookups */}
          <MonthGrid
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            calendarDays={calendarDays}
            monthStart={monthStart}
            eventsByDateStr={eventsByDateStr}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onGoToToday={goToToday}
            onSelectDate={setSelectedDate}
            onDoubleClickDate={openNewEventModal}
          />

          {/* Daily Schedule & Weekly Summary */}
          <DayScheduleView
            selectedDate={selectedDate}
            dayEvents={selectedDayEvents}
            weeklyEventsCount={weeklyEvents.length}
            onEditEvent={openEditModal}
            onDeleteEvent={setEventToDelete}
            onToggleStatus={handleToggleStatus}
            onOpenNewEvent={openNewEventModal}
            onOpenWeeklyReport={() => {
              setIsReportOpen(true);
              generateWeeklyReport();
            }}
          />
        </div>
      </main>

      {/* Event Add/Edit Modal */}
      <EventModal
        isOpen={isModalOpen}
        editingEvent={editingEvent}
        formData={newEvent}
        isSaving={isSaving}
        selectedDate={selectedDate}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEvent(null);
        }}
        onChangeField={handleFormFieldChange}
        onSubmit={handleAddEvent}
        onDeleteRequest={setEventToDelete}
        isPastDateWarning={isPastDateWarning}
      />

      {/* Weekly Report & Gemini AI Helper Modal */}
      <WeeklyReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        weeklyEvents={weeklyEvents}
        sortedWeeklyEvents={sortedWeeklyEvents}
        aiReport={aiReport}
        aiReportLoading={aiReportLoading}
        onRegenerateReport={() => generateWeeklyReport(true)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!eventToDelete}
        onClose={() => setEventToDelete(null)}
        onConfirm={confirmDeleteEvent}
        title="Excluir Compromisso"
        itemName={eventToDelete?.title}
        itemType="compromisso da agenda"
        isDeleting={isDeletingEvent}
      />
    </div>
  );
}
