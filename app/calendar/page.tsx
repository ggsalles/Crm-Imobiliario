"use client";

export const dynamic = 'force-dynamic';

import { Sidebar } from "@/components/sidebar";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  MoreHorizontal,
  Filter,
  Users,
  X,
  Check,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { safeAiCall } from "@/lib/ai";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useAuth } from "@/providers/auth-provider";
import { 
  subscribeToActivities, 
  createActivity, 
  Activity,
  updateActivity,
  deleteActivity 
} from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";

interface Event {
  id: string;
  title: string;
  time: string;
  type: string;
  client: string;
  date: Date | string;
  description?: string;
  status?: string;
}

export default function CalendarPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingRef = useRef(false);
  const [eventToDelete, setEventToDelete] = useState<any | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  // Helper to compute smart default times (never in the past for today)
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
        time: `${String(safeStartHour).padStart(2, '0')}:00`,
        endTime: `${String(safeEndHour).padStart(2, '0')}:00`
      };
    }

    return { time: "10:00", endTime: "11:00" };
  }, []);

  // New event form state
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "10:00",
    endTime: "11:00",
    type: "Visita",
    client: "",
    description: ""
  });

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

  const isPastDateTimeSelected = useCallback(() => {
    if (editingEvent) return false;
    if (!newEvent.time || !newEvent.date) return false;
    const [year, month, day] = newEvent.date.split('-').map(Number);
    const [h, m] = newEvent.time.split(':').map(Number);
    if (!year || !month || !day) return false;
    const candidate = new Date(year, month - 1, day, h || 0, m || 0, 0, 0);
    // Allow 60 seconds grace so choosing current minute doesn't immediately block
    return candidate.getTime() < Date.now() - 60000;
  }, [editingEvent, newEvent.date, newEvent.time]);

  const [events, setEvents] = useState<Event[]>([]);
  
  // Weekly Performance and Preparation Modal State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [aiReport, setAiReport] = useState<string>("");
  const [aiReportLoading, setAiReportLoading] = useState(false);

  // Filter appointments for the current week (Monday to Sunday)
  const getWeeklyEvents = useCallback(() => {
    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // Segunda-feira
    const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 1 });     // Domingo
    
    return events.filter(e => {
      const eventDate = e.date instanceof Date ? e.date : parseISO(e.date as string);
      return eventDate >= startOfCurrentWeek && eventDate <= endOfCurrentWeek;
    });
  }, [events]);

  const getSortedWeeklyEvents = useCallback(() => {
    return [...getWeeklyEvents()].sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : parseISO(a.date as string);
      const dateB = b.date instanceof Date ? b.date : parseISO(b.date as string);
      return dateA.getTime() - dateB.getTime();
    });
  }, [getWeeklyEvents]);

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
      const weeklyEvents = getWeeklyEvents();
      const total = weeklyEvents.length;
      const completed = weeklyEvents.filter(e => e.status === 'completed').length;
      
      const listStr = weeklyEvents.map((e) => {
        const d = e.date instanceof Date ? e.date : parseISO(e.date as string);
        const dayStr = format(d, "EEEE (dd/MM)", { locale: ptBR });
        return `- ${e.title} na ${dayStr} às ${e.time} [Status: ${e.status === 'completed' ? 'Concluido' : 'Pendente'}, Tipo: ${e.type}]`;
      }).join("\n");

      const prompt = `Você é um correspondente e assessor de alta performance para o corretor imobiliário usuário do corretor de CRM "SalesScore".
Prontamente analise a agenda de compromissos desse profissional para a semana atual e gere um relatório brilhante dividido estritamente em:

### 1. FOCO E RITMO DA SEMANA
Uma análise sincera baseada no volume de reuniões (${completed} concluídas de um total de ${total} compromissos). Descreva se o ritmo está bom ou se ele precisa ajustar o foco de prospecção.

### 2. DICAS DE PREPARAÇÃO
Dicas acionáveis e refinadas de até 3 frases sobre como ele pode se preparar para as visitas/reuniões cadastradas para o corretor arrasar com os clientes (ex: estudar certidões, revisar o perfil socioeconômico do cliente).

### 3. PLANO DE AÇÃO ACESSÍVEL
3 passos sequenciais e práticos para que o corretor mantenha ou eleve o patamar de conversão nesta semana.

Caso não haja nenhum compromisso cadastrado para esta semana (total = 0), forneça um guia inspirador de prospecção diária específico para corretores de imóveis.

Aqui está a lista de compromissos da semana estruturada:
${listStr || "Nenhum compromisso cadastrado para esta semana."}

Seja direto de forma humilde, elegante, profissional e altamente inspiradora, usando o português do Brasil. Não use tags HTML (como <p>, <h3>), use exclusivamente formatação Markdown limpa e amigável.`;

      const fallbackText = getFallbackReport(total, completed);
      const res = await safeAiCall(prompt, fallbackText);
      setAiReport(res.text);
      if (force) {
        toast.success("Insights atualizados com IA!");
      }
    } catch (err) {
      console.error(err);
      const we = getWeeklyEvents();
      setAiReport(getFallbackReport(we.length, we.filter(e => e.status === 'completed').length));
      toast.error("Erro ao falar com a IA. Usando insights otimizados offline!");
    } finally {
      setAiReportLoading(false);
    }
  }, [aiReport, aiReportLoading, getWeeklyEvents]);

  const renderBoldText = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    if (parts.length === 1) return text;
    
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-semibold text-white bg-white/10 px-1 py-0.5 rounded text-[11px]">{part}</strong>;
      }
      return part;
    });
  };

  const renderFormattedReport = (text: string) => {
    if (!text) return null;
    
    // Split paragraphs safely
    const lines = text.split('\n');
    return (
      <div className="space-y-4 text-xs leading-relaxed text-slate-300">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;
          
          // Heading Level 3 (###) or Level 1/2 (#)
          if (trimmed.startsWith('###') || trimmed.startsWith('##') || trimmed.startsWith('#')) {
            const headingText = trimmed.replace(/^[#\s]+/, '');
            return (
              <h4 key={idx} className="text-xs font-black text-white uppercase tracking-wider font-mono pt-4 pb-1 border-b border-white/5 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-primary rounded-full animate-pulse" />
                {headingText}
              </h4>
            );
          }
          
          // Bullet points
          if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
            const itemText = trimmed.replace(/^[-*]\s*/, '');
            return (
              <li key={idx} className="list-none pl-6 relative text-slate-300 py-0.5">
                <span className="absolute left-1.5 top-2.5 w-1.5 h-1.5 rounded-full bg-primary" />
                {renderBoldText(itemText)}
              </li>
            );
          }
          
          // Numbered lists (1., 2.)
          if (/^\d+\.\s/.test(trimmed)) {
            const itemText = trimmed.replace(/^\d+\.\s*/, '');
            const number = trimmed.match(/^\d+/)?.[0];
            return (
              <div key={idx} className="flex gap-3 text-slate-300 py-1">
                <span className="shrink-0 w-5 h-5 rounded-md bg-white/10 text-white text-[10px] font-black flex items-center justify-center font-mono border border-white/10">
                  {number}
                </span>
                <p className="flex-1 mt-0.5 leading-normal">{renderBoldText(itemText)}</p>
              </div>
            );
          }
          
          // Standard Paragraph
          return <p key={idx} className="text-slate-300">{renderBoldText(trimmed)}</p>;
        })}
      </div>
    );
  };

  const [searchQuery, setSearchQuery] = useState("");

  // Load events from database on mount
  useEffect(() => {
    if (!user || !profile) return;

    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    
    const unsub = subscribeToActivities((data) => {
      // Map DB activities to local Event shape
      const mappedEvents: Event[] = data.map(act => {
        const descText = act.description || "";
        const descLines = descText.split("\n");
        const firstLine = descLines[0] || "";
        
        // Match format like "10:00 - 11:00"
        const isTimeFormat = /^\d{2}:\d{2}\s-\s\d{2}:\d{2}/.test(firstLine);
        
        let displayTime = "Agendado";
        let dateObj: Date;
        try {
          dateObj = act.date ? (typeof act.date === 'string' ? parseISO(act.date) : new Date(act.date)) : new Date();
          
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
          type: act.type === 'meeting' ? "Visita" : act.type === 'call' ? "Follow-up" : "Reunião",
          client: "",
          status: act.status
        };
      });
      setEvents(mappedEvents);
    }, ownerId);

    return () => unsub();
  }, [user, profile]);

  const filteredEvents = events.filter(event => 
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (event.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

    // Parse date and time in local components
    const [year, month, day] = newEvent.date.split('-').map(Number);
    const [hours, minutes] = newEvent.time.split(':').map(Number);
    const activityDate = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);

    const now = new Date();

    // Past date/time validation: block creating appointments in the past (allowing 60s grace)
    if (!editingEvent && activityDate.getTime() < (now.getTime() - 60000)) {
      toast.error("Não é possível agendar um compromisso no passado. Escolha uma data e horário futuros.");
      return;
    }

    const [endHours, endMinutes] = newEvent.endTime.split(':').map(Number);
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
      description: `${newEvent.time} - ${newEvent.endTime}${newEvent.description ? `\n${newEvent.description}` : ''}`,
      date: activityDate.toISOString(),
      type: dbType,
      status: 'pending' as const,
    };

    try {
      if (editingEvent) {
        await updateActivity(editingEvent.id, activityData);
        recordAuditEvent({
          action: 'UPDATE_ACTIVITY',
          title: 'Edição de Agendamento na Agenda',
          content: `Compromisso "${newEvent.title}" (${newEvent.type}) atualizado na agenda.`,
          severity: 'medium',
          category: 'modification',
          relatedId: editingEvent.id,
          entityType: 'activity',
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
          action: 'CREATE_ACTIVITY',
          title: 'Novo Agendamento na Agenda',
          content: `Novo compromisso "${newEvent.title}" (${newEvent.type}) agendado para ${format(activityDate, "dd/MM/yyyy")} às ${newEvent.time}.`,
          severity: 'info',
          category: 'modification',
          relatedId: typeof newActId === 'string' ? newActId : undefined,
          entityType: 'activity',
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
        action: 'DELETE_ACTIVITY',
        title: 'Cancelamento / Exclusão de Agendamento',
        content: `Compromisso "${targetEvent?.title || id}" foi excluído da agenda.`,
        severity: 'high',
        category: 'deletion',
        relatedId: id,
        entityType: 'activity',
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

  const handleToggleStatus = async (event: Event) => {
    const newStatus = event.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateActivity(event.id, { status: newStatus as any });
      recordAuditEvent({
        action: 'UPDATE_ACTIVITY',
        title: newStatus === 'completed' ? 'Compromisso Concluído' : 'Compromisso Reaberto',
        content: `Agendamento "${event.title}" marcado como ${newStatus === 'completed' ? 'Realizado/Concluído' : 'Pendente'}.`,
        severity: 'low',
        category: 'modification',
        relatedId: event.id,
        entityType: 'activity',
        metadata: {
          title: event.title,
          status: newStatus
        }
      });
    } catch (err) {
      console.error("Error toggling status", err);
    }
  };

  const openEditModal = (event: Event) => {
    setEditingEvent(event);
    const timeParts = event.time.split(" - ");
    const start = timeParts[0] || "10:00";
    const end = timeParts[1] || "11:00";
    const evDate = event.date instanceof Date ? event.date : parseISO(event.date);
    
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
  };

  const getEventsForDay = (date: Date) => {
    return filteredEvents.filter(event => {
      const eventDate = event.date instanceof Date ? event.date : parseISO(event.date);
      return isSameDay(eventDate, date);
    });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <header className="h-auto md:h-16 bg-card/80 backdrop-blur-md border-b border-border pl-16 md:pl-6 px-3 sm:px-4 md:px-5 py-2.5 md:py-0 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-20 gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl shrink-0">
              <CalendarIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold">Calendário</h1>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">Gestão de Agenda</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Buscar eventos..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-muted border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 w-52 transition-all"
              />
            </div>
            <button className="bg-card border border-border p-2 rounded-xl text-muted-foreground hover:bg-muted transition-all shadow-xs">
              <Filter className="w-4 h-4" />
            </button>
            <button 
              onClick={() => openNewEventModal(selectedDate)}
              className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Evento
            </button>
          </div>
        </header>

        <div className="p-3 sm:p-4 md:p-5 flex flex-col lg:flex-row gap-4 flex-1 max-w-7xl w-full mx-auto">
          {/* Calendar Grid */}
          <div className="flex-[2] bg-card rounded-2xl border border-border shadow-xs p-4 md:p-5 flex flex-col transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base md:text-lg font-bold capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </h2>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={prevMonth}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors border border-border"
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <button 
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setSelectedDate(new Date());
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  Hoje
                </button>
                <button 
                  onClick={nextMonth}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors border border-border"
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
              {weekDays.map((day) => (
                <div key={day} className="bg-muted/30 py-2.5 text-center">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{day}</span>
                </div>
              ))}
              {calendarDays.map((date, i) => {
                const dayEvents = getEventsForDay(date);
                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      setSelectedDate(date);
                      setNewEvent(prev => ({
                        ...prev,
                        date: format(date, "yyyy-MM-dd")
                      }));
                    }}
                    onDoubleClick={() => openNewEventModal(date)}
                    className={cn(
                      "bg-card min-h-[75px] md:min-h-[85px] p-2 cursor-pointer hover:bg-muted/10 transition-colors group relative",
                      !isSameMonth(date, monthStart) && "bg-muted/5 opacity-40",
                      isSameDay(date, selectedDate) && !isSameDay(date, new Date()) && "bg-primary/5"
                    )}
                  >
                    <span className={cn(
                      "inline-flex items-center justify-center w-6 h-6 text-[11px] font-bold rounded-md transition-all",
                      isSameDay(date, new Date()) ? "bg-primary text-white shadow-xs shadow-primary/20" : "text-muted-foreground group-hover:text-primary",
                      isSameDay(date, selectedDate) && "ring-2 ring-primary ring-offset-1 z-10 ring-offset-background"
                    )}>
                      {format(date, "d")}
                    </span>

                    <div className="mt-1 flex flex-col gap-0.5 overflow-hidden">
                      {dayEvents.slice(0, 3).map((e, idx) => (
                        <div 
                          key={idx} 
                          className={cn(
                            "px-1 py-0.5 rounded text-[8px] md:text-[9px] font-bold truncate flex items-center gap-1",
                            e.type === "Visita" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : 
                            e.type === "Reunião" ? "bg-primary/10 text-primary border border-primary/20" : 
                            "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          )} 
                        >
                          <div className={cn(
                            "w-1 h-1 rounded-full shrink-0",
                            e.type === "Visita" ? "bg-amber-400" : 
                            e.type === "Reunião" ? "bg-primary" : "bg-emerald-400"
                          )} />
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[8px] font-bold text-muted-foreground pl-1 mt-0.5">
                          + {dayEvents.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side Panel: Daily Agenda */}
          <div className="lg:w-[320px] flex flex-col gap-4">
            <div className="bg-card rounded-2xl border border-border shadow-xs p-4 md:p-5 transition-colors">
              <h3 className="text-sm md:text-base font-bold mb-4 flex items-center justify-between">
                <span>Agenda do Dia</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 px-2 py-0.5 rounded-full border border-border">
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </span>
              </h3>

              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-hide">
                {getEventsForDay(selectedDate).length > 0 ? (
                  getEventsForDay(selectedDate).map((event) => (
                    <div 
                      key={event.id} 
                      className={cn(
                        "group p-3 rounded-xl border transition-all relative overflow-hidden",
                        event.status === 'completed' 
                          ? "bg-muted/10 opacity-60 border-border" 
                          : "bg-muted/20 border-border hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      {/* Interactive Layer for the card click - covers the whole card */}
                      <div 
                        className="absolute inset-0 z-10 cursor-pointer" 
                        onClick={() => openEditModal(event)}
                      />
                      
                      {/* Delete Button - absolute on top right to avoid overlap issues */}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEventToDelete(event);
                        }}
                        className="absolute top-2 right-2 z-50 p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors bg-card/80 backdrop-blur-sm border border-transparent hover:border-red-500/20 shadow-xs"
                        title="Excluir compromisso"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {event.status === 'completed' && (
                        <div className="absolute top-0 right-0 p-1 bg-emerald-500 rounded-bl-lg shadow-xs border-l border-b border-emerald-400 z-20 text-white">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                      
                      <div className="flex items-start justify-between mb-2 relative z-20 pointer-events-none">
                        <div className="flex items-center gap-1.5 pointer-events-auto">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(event);
                            }}
                            className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center transition-all",
                              event.status === 'completed' 
                                ? "bg-emerald-500 border-emerald-500 text-white" 
                                : "bg-card border-border text-transparent hover:border-primary"
                            )}
                          >
                            <Check className="w-2.5 h-2.5" />
                          </button>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] md:text-[9px] font-bold uppercase tracking-wider border",
                            event.type === "Visita" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                            event.type === "Reunião" ? "bg-primary/10 text-primary border-primary/20" :
                            "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          )}>
                            {event.type}
                          </span>
                        </div>
                      </div>
                      <h4 className={cn(
                        "font-bold text-xs md:text-sm mb-1 leading-tight",
                        event.status === 'completed' && "line-through text-muted-foreground"
                      )}>
                        {event.title}
                      </h4>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span className="text-[10px] font-medium">{event.time}</span>
                        </div>
                        {event.client && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="w-3 h-3" />
                            <span className="text-[10px] font-medium">{event.client}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <div className="bg-muted w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2.5">
                      <Clock className="w-4 h-4 text-muted-foreground/30" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">Nenhum evento agendado para este dia.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 text-white relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-base font-bold mb-1">Resumo da Semana</h3>
                <p className="text-slate-400 text-xs mb-3.5 leading-relaxed">
                  Você tem {getWeeklyEvents().length} compromissos agendados nesta semana.
                </p>
                <button 
                  onClick={() => {
                    setIsReportOpen(true);
                    generateWeeklyReport();
                  }}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 border border-white/10 cursor-pointer"
                >
                  Ver Relatório Completo
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
              <CalendarIcon className="absolute -right-3 -bottom-3 w-24 h-24 text-white/5 -rotate-12 transition-transform group-hover:scale-110" />
            </div>
          </div>
        </div>
      </main>

      {/* New Event Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card rounded-2xl shadow-xl overflow-hidden border border-border"
            >
              <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                <div>
                  <h3 className="text-base font-bold text-foreground">{editingEvent ? 'Editar Compromisso' : 'Novo Compromisso'}</h3>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Agendando para {newEvent.date ? format(parseISO(newEvent.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingEvent(null);
                    setNewEvent({ 
                      title: "", 
                      date: format(new Date(), "yyyy-MM-dd"), 
                      time: "10:00", 
                      endTime: "11:00", 
                      type: "Visita", 
                      client: "", 
                      description: "" 
                    });
                  }}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              
              <form onSubmit={handleAddEvent} className="p-5 space-y-4">
                <div className="space-y-1.5 font-medium text-start">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Título do Evento</label>
                  <input 
                    required
                    type="text" 
                    value={newEvent.title}
                    onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                    placeholder="Ex: Visita ao Edifício Garden"
                    className="w-full px-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5 font-medium text-start">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Data do Compromisso</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input 
                      required
                      type="date" 
                      min={!editingEvent ? format(new Date(), "yyyy-MM-dd") : undefined}
                      value={newEvent.date}
                      onChange={e => {
                        const newD = e.target.value;
                        if (!newD) return;
                        const [y, m, d] = newD.split('-').map(Number);
                        const parsed = new Date(y, m - 1, d);
                        setSelectedDate(parsed);
                        const times = getDefaultEventTimes(parsed);
                        setNewEvent(prev => ({
                          ...prev,
                          date: newD,
                          time: isSameDay(parsed, new Date()) ? times.time : prev.time,
                          endTime: isSameDay(parsed, new Date()) ? times.endTime : prev.endTime
                        }));
                      }}
                      className="w-full pl-9 pr-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Horário Início</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input 
                        required
                        type="time" 
                        value={newEvent.time}
                        onChange={e => setNewEvent({...newEvent, time: e.target.value})}
                        className="w-full pl-9 pr-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Horário Término</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input 
                        required
                        type="time" 
                        value={newEvent.endTime}
                        onChange={e => setNewEvent({...newEvent, endTime: e.target.value})}
                        className="w-full pl-9 pr-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {isPastDateTimeSelected() && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2.5 text-amber-500 text-xs font-semibold animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>O horário selecionado já passou. Selecione uma data e horário futuros para agendar o compromisso.</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Tipo de Atividade</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Visita", "Reunião", "Follow-up"].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewEvent({...newEvent, type})}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold transition-all border",
                          newEvent.type === type 
                            ? "bg-primary text-white border-primary shadow-xs shadow-primary/20" 
                            : "bg-muted/30 text-muted-foreground border-border hover:border-primary"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Cliente (Opcional)</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input 
                      type="text" 
                      value={newEvent.client}
                      onChange={e => setNewEvent({...newEvent, client: e.target.value})}
                      placeholder="Nome do cliente..."
                      className="w-full pl-9 pr-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 mt-4">
                  {editingEvent && (
                    <button 
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        setEventToDelete(editingEvent);
                      }}
                      className="flex-1 py-2.5 bg-red-500/10 text-red-500 rounded-xl font-bold text-xs md:text-sm hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="w-4 h-4" />
                      Excluir
                    </button>
                  )}
                  <button 
                    type="submit"
                    disabled={isSaving || isPastDateTimeSelected()}
                    className="flex-[2] py-2.5 bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-xs md:text-sm shadow-md shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {editingEvent ? 'Salvar Alterações' : 'Salvar Compromisso'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Weekly Performance and Preparation Modal */}
      <AnimatePresence>
        {isReportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark blur backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReportOpen(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            />
            
            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-4xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden z-10 flex flex-col max-h-[90vh] text-white"
            >
              {/* Header Gradient Glow */}
              <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

              {/* Modal Title Bar */}
              <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40 relative z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <TrendingUp className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-black uppercase tracking-tight font-sans">Relatório de Desempenho Semanal</h3>
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Análise de Produtividade & IA Prep</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setIsReportOpen(false)}
                  className="p-1.5 bg-slate-800/40 hover:bg-slate-800 rounded-xl transition-all border border-slate-800/60 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Container */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 relative z-10">
                
                {/* 1. PRODUCTIVITY GRID METRICS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Total */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Compromissos</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black">{getWeeklyEvents().length}</span>
                      <span className="text-xs text-slate-500 font-mono">Agendas</span>
                    </div>
                  </div>

                  {/* Completed */}
                  <div className="bg-emerald-950/20 border border-emerald-955/20 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-800/40 transition-colors">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Compromissos Concluídos</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-emerald-400">
                        {getWeeklyEvents().filter(e => e.status === 'completed').length}
                      </span>
                      <span className="text-xs text-emerald-500 font-semibold font-mono">Sim</span>
                    </div>
                  </div>

                  {/* Pending */}
                  <div className="bg-amber-955/10 border border-amber-900/20 rounded-2xl p-5 flex flex-col justify-between hover:border-amber-800/30 transition-colors">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Atividades Pendentes</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-amber-400">
                        {getWeeklyEvents().filter(e => e.status !== 'completed').length}
                      </span>
                      <span className="text-xs text-amber-500 font-mono">Em aberto</span>
                    </div>
                  </div>

                  {/* Aproveitamento */}
                  <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex flex-col justify-between hover:border-primary/20 transition-colors">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Aproveitamento Geral</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-primary">
                        {getWeeklyEvents().length > 0 
                          ? Math.round((getWeeklyEvents().filter(e => e.status === 'completed').length / getWeeklyEvents().length) * 100)
                          : 0}%
                      </span>
                      <span className="text-xs text-primary/70 font-bold font-mono">Meta: 80%</span>
                    </div>
                  </div>
                </div>

                {/* TWO-COLUMN GRID: Gemini AI Prep Helper vs Weekly Schedule */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left panel: Gemini Advisor */}
                  <div className="lg:col-span-7 bg-slate-950/60 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <Sparkles className="w-32 h-32 text-white" />
                    </div>

                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-white font-mono">Orientador Imobiliário IA (Parceiro Gemini)</h4>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => generateWeeklyReport(true)}
                        disabled={aiReportLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-[10px] rounded-xl font-bold uppercase tracking-wider transition-colors cursor-pointer border border-slate-750"
                      >
                        <RefreshCw className={cn("w-3 h-3", aiReportLoading && "animate-spin")} />
                        Refazer com IA
                      </button>
                    </div>

                    {/* Report Text Content Area */}
                    <div className="min-h-[250px] relative">
                      {aiReportLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 space-y-4">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <p className="text-[11px] font-mono uppercase tracking-widest text-slate-400 animate-pulse">
                            IA analisando agendas de vendas...
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {renderFormattedReport(aiReport)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right panel: Weekly Schedule Summary */}
                  <div className="lg:col-span-5 bg-slate-950/40 border border-slate-800 rounded-3xl p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-slate-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 font-mono">Agenda Semanal Simplificada</h4>
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase font-mono tracking-widest">Compromissos</span>
                    </div>

                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                      {getSortedWeeklyEvents().length > 0 ? (
                        getSortedWeeklyEvents().map((e, idx) => {
                          const dateObj = e.date instanceof Date ? e.date : parseISO(e.date as string);
                          const dayName = format(dateObj, "eee", { locale: ptBR });
                          
                          return (
                            <div 
                              key={e.id || idx}
                              className={cn(
                                "p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all",
                                e.status === 'completed'
                                  ? "bg-slate-900/30 border-slate-850 opacity-60"
                                  : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                {/* Day Display block */}
                                <div className="p-2 w-10 bg-slate-800 rounded-lg text-center flex flex-col items-center justify-center border border-slate-750 shrink-0 select-none">
                                  <span className="text-[9px] text-primary font-black uppercase tracking-wider font-mono">{dayName}</span>
                                  <span className="text-xs font-extrabold mt-0.5">{format(dateObj, "d")}</span>
                                </div>
                                
                                <div className="min-w-0">
                                  <p className={cn(
                                    "text-xs font-bold leading-tight truncate text-slate-200",
                                    e.status === 'completed' && "line-through text-slate-400"
                                  )}>
                                    {e.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-semibold">
                                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                                    <span>{e.time}</span>
                                    <span>&bull;</span>
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                                      e.type === "Visita" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                      e.type === "Reunião" ? "bg-primary/10 text-primary border-primary/20" :
                                      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    )}>
                                      {e.type}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <div className="shrink-0">
                                {e.status === 'completed' ? (
                                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 flex items-center justify-center">
                                    <Check className="w-3 h-3" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700" />
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-12 text-center text-slate-500">
                          <p className="text-xs font-semibold">Sem compromissos nesta semana.</p>
                          <p className="text-[10px] text-slate-600 mt-1">Sua rotina está livre de obrigações agendadas.</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
              
              {/* Footer */}
              <div className="px-8 py-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-slate-500 shrink-0 relative z-10">
                <span className="text-[9px] font-mono tracking-widest uppercase font-black">
                  SalesScore Intelligence &copy; 2026
                </span>
                <button
                  type="button"
                  onClick={() => setIsReportOpen(false)}
                  className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-[10px] uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer shadow-lg shadow-primary/20"
                >
                  Concluir Leitura
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal de Confirmação de Exclusão de Compromisso */}
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
