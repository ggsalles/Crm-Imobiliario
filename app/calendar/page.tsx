"use client";

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
  Check
} from "lucide-react";
import { useState, useEffect } from "react";
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
import { useAuth } from "@/providers/auth-provider";
import { 
  subscribeToActivities, 
  createActivity, 
  Activity,
  updateActivity,
  deleteActivity 
} from "@/lib/db";

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
  const { user, profile } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  
  // New event form state
  const [newEvent, setNewEvent] = useState({
    title: "",
    time: "10:00",
    endTime: "11:00",
    type: "Visita",
    client: "",
    description: ""
  });

  const [events, setEvents] = useState<Event[]>([]);
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
    
    const dbType = newEvent.type === "Visita" ? "meeting" : newEvent.type === "Reunião" ? "meeting" : "call";
    
    // Parse time and set it to the selected date
    const [hours, minutes] = newEvent.time.split(':').map(Number);
    const activityDate = new Date(selectedDate);
    activityDate.setHours(hours, minutes, 0, 0);

    const activityData = {
      title: newEvent.title,
      description: `${newEvent.time} - ${newEvent.endTime}${newEvent.description ? `\n${newEvent.description}` : ''}`,
      date: activityDate.toISOString(),
      type: dbType,
      status: 'pending' as const,
    };

    try {
      if (editingEvent) {
        await updateActivity(editingEvent.id, activityData);
      } else {
        await createActivity(activityData);
      }
      setIsModalOpen(false);
      setEditingEvent(null);
      setNewEvent({
        title: "",
        time: "10:00",
        endTime: "11:00",
        type: "Visita",
        client: "",
        description: ""
      });
    } catch (err) {
      console.error("Error saving activity", err);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteActivity(id);
      if (isModalOpen) setIsModalOpen(false);
      setEditingEvent(null);
    } catch (err) {
      console.error("Error deleting activity", err);
      alert("Erro ao excluir compromisso: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleToggleStatus = async (event: Event) => {
    const newStatus = event.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateActivity(event.id, { status: newStatus as any });
    } catch (err) {
      console.error("Error toggling status", err);
    }
  };

  const openEditModal = (event: Event) => {
    setEditingEvent(event);
    const timeParts = event.time.split(" - ");
    const start = timeParts[0] || "10:00";
    const end = timeParts[1] || "11:00";
    
    setNewEvent({
      title: event.title,
      time: start,
      endTime: end,
      type: event.type,
      client: event.client || "",
      description: event.description || ""
    });
    setSelectedDate(event.date instanceof Date ? event.date : parseISO(event.date));
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
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-24 bg-card/80 backdrop-blur-md border-b border-border px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-2xl">
              <CalendarIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Calendário</h1>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">Gestão de Agenda</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Buscar eventos..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-11 pr-6 py-3 bg-muted border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-64 transition-all"
              />
            </div>
            <button className="bg-card border border-border p-3 rounded-2xl text-muted-foreground hover:bg-muted transition-all shadow-sm">
              <Filter className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-primary text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Evento
            </button>
          </div>
        </header>

        <div className="p-8 flex flex-col lg:flex-row gap-8 flex-1">
          {/* Calendar Grid */}
          <div className="flex-[2] bg-card rounded-[32px] border border-border shadow-sm p-6 md:p-8 flex flex-col transition-colors">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={prevMonth}
                  className="p-2 hover:bg-muted rounded-xl transition-colors border border-border"
                >
                  <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                </button>
                <button 
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setSelectedDate(new Date());
                  }}
                  className="px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 rounded-xl transition-colors"
                >
                  Hoje
                </button>
                <button 
                  onClick={nextMonth}
                  className="p-2 hover:bg-muted rounded-xl transition-colors border border-border"
                >
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-border rounded-2xl overflow-hidden border border-border">
              {weekDays.map((day) => (
                <div key={day} className="bg-muted/30 py-4 text-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{day}</span>
                </div>
              ))}
              {calendarDays.map((date, i) => {
                const dayEvents = getEventsForDay(date);
                return (
                  <div 
                    key={i} 
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "bg-card min-h-[100px] p-3 cursor-pointer hover:bg-muted/10 transition-colors group relative",
                      !isSameMonth(date, monthStart) && "bg-muted/5 opacity-40",
                      isSameDay(date, selectedDate) && !isSameDay(date, new Date()) && "bg-primary/5"
                    )}
                  >
                    <span className={cn(
                      "inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded-lg transition-all",
                      isSameDay(date, new Date()) ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground group-hover:text-primary",
                      isSameDay(date, selectedDate) && "ring-2 ring-primary ring-offset-2 z-10 ring-offset-background"
                    )}>
                      {format(date, "d")}
                    </span>

                    <div className="mt-2 flex flex-col gap-1 overflow-hidden">
                      {dayEvents.slice(0, 3).map((e, idx) => (
                        <div 
                          key={idx} 
                          className={cn(
                            "px-1.5 py-0.5 rounded-md text-[9px] font-bold truncate flex items-center gap-1",
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
                        <div className="text-[9px] font-bold text-muted-foreground pl-1 mt-0.5">
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
          <div className="lg:w-[380px] flex flex-col gap-6">
            <div className="bg-card rounded-[32px] border border-border shadow-sm p-8 transition-colors">
              <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
                <span>Agenda do Dia</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 px-3 py-1 rounded-full border border-border">
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </span>
              </h3>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                {getEventsForDay(selectedDate).length > 0 ? (
                  getEventsForDay(selectedDate).map((event) => (
                    <div 
                      key={event.id} 
                      className={cn(
                        "group p-4 rounded-2xl border transition-all relative overflow-hidden",
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
                          handleDeleteEvent(event.id);
                        }}
                        className="absolute top-3 right-3 z-50 p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors bg-card/80 backdrop-blur-sm border border-transparent hover:border-red-500/20 shadow-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {event.status === 'completed' && (
                        <div className="absolute top-0 right-0 p-1 bg-emerald-500 rounded-bl-xl shadow-lg border-l border-b border-emerald-400 z-20 text-white">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                      
                      <div className="flex items-start justify-between mb-3 relative z-20 pointer-events-none">
                        <div className="flex items-center gap-2 pointer-events-auto">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(event);
                            }}
                            className={cn(
                              "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                              event.status === 'completed' 
                                ? "bg-emerald-500 border-emerald-500 text-white" 
                                : "bg-card border-border text-transparent hover:border-primary"
                            )}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
                            event.type === "Visita" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                            event.type === "Reunião" ? "bg-primary/10 text-primary border-primary/20" :
                            "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          )}>
                            {event.type}
                          </span>
                        </div>
                      </div>
                      <h4 className={cn(
                        "font-bold mb-2 leading-tight",
                        event.status === 'completed' && "line-through text-muted-foreground"
                      )}>
                        {event.title}
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-medium">{event.time}</span>
                        </div>
                        {event.client && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-medium">{event.client}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center">
                    <div className="bg-muted w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhum evento agendado para este dia.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900 dark:bg-slate-950 rounded-[32px] p-8 text-white relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Resumo da Semana</h3>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                  Você tem {filteredEvents.filter(e => {
                    const d = e.date instanceof Date ? e.date : parseISO(e.date);
                    return d >= startOfWeek(new Date(), { locale: ptBR }) && d <= endOfWeek(new Date(), { locale: ptBR });
                  }).length} compromissos agendados nesta semana.
                </p>
                <button className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-6 py-3 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 border border-white/10">
                  Ver Relatório Completo
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
              <CalendarIcon className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 -rotate-12 transition-transform group-hover:scale-110" />
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
              className="relative w-full max-w-lg bg-card rounded-[32px] shadow-2xl overflow-hidden border border-border"
            >
              <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-muted/30">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{editingEvent ? 'Editar Compromisso' : 'Novo Compromisso'}</h3>
                  <p className="text-xs font-medium text-muted-foreground">Agendando para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
                </div>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingEvent(null);
                    setNewEvent({ title: "", time: "10:00", endTime: "11:00", type: "Visita", client: "", description: "" });
                  }}
                  className="p-2 hover:bg-muted rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              
              <form onSubmit={handleAddEvent} className="p-8 space-y-6">
                <div className="space-y-2 font-medium text-start">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Título do Evento</label>
                  <input 
                    required
                    type="text" 
                    value={newEvent.title}
                    onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                    placeholder="Ex: Visita ao Edifício Garden"
                    className="w-full px-5 py-4 bg-muted/30 rounded-2xl text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Horário Início</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input 
                        required
                        type="time" 
                        value={newEvent.time}
                        onChange={e => setNewEvent({...newEvent, time: e.target.value})}
                        className="w-full pl-11 pr-5 py-4 bg-muted/30 rounded-2xl text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Horário Término</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input 
                        required
                        type="time" 
                        value={newEvent.endTime}
                        onChange={e => setNewEvent({...newEvent, endTime: e.target.value})}
                        className="w-full pl-11 pr-5 py-4 bg-muted/30 rounded-2xl text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Tipo de Atividade</label>
                  <div className="grid grid-cols-3 gap-3">
                    {["Visita", "Reunião", "Follow-up"].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewEvent({...newEvent, type})}
                        className={cn(
                          "py-3 rounded-xl text-xs font-bold transition-all border",
                          newEvent.type === type 
                            ? "bg-primary text-white border-primary shadow-md shadow-primary/20" 
                            : "bg-muted/30 text-muted-foreground border-border hover:border-primary"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Cliente (Opcional)</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      type="text" 
                      value={newEvent.client}
                      onChange={e => setNewEvent({...newEvent, client: e.target.value})}
                      placeholder="Nome do cliente..."
                      className="w-full pl-11 pr-5 py-4 bg-muted/30 rounded-2xl text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  {editingEvent && (
                    <button 
                      type="button"
                      onClick={() => {
                        handleDeleteEvent(editingEvent.id);
                      }}
                      className="flex-1 py-5 bg-red-500/10 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Excluir
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="flex-[2] py-5 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    {editingEvent ? 'Salvar Alterações' : 'Salvar Compromisso'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
