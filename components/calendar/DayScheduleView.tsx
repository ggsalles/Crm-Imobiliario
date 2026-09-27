"use client";

import { memo } from "react";
import { 
  Clock, 
  Calendar as CalendarIcon, 
  ChevronRight, 
  Plus, 
  Download 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEventItem, exportAllEventsToIcs } from "@/lib/calendar-export";
import { EventCard } from "./EventCard";

interface DayScheduleViewProps {
  selectedDate: Date;
  dayEvents: CalendarEventItem[];
  weeklyEventsCount: number;
  onEditEvent: (event: CalendarEventItem) => void;
  onDeleteEvent: (event: CalendarEventItem) => void;
  onToggleStatus: (event: CalendarEventItem) => void;
  onOpenNewEvent: (date: Date) => void;
  onOpenWeeklyReport: () => void;
}

export const DayScheduleView = memo(function DayScheduleView({
  selectedDate,
  dayEvents,
  weeklyEventsCount,
  onEditEvent,
  onDeleteEvent,
  onToggleStatus,
  onOpenNewEvent,
  onOpenWeeklyReport,
}: DayScheduleViewProps) {
  const formattedDay = format(selectedDate, "dd 'de' MMMM", { locale: ptBR });

  const handleExportDayIcs = () => {
    if (dayEvents.length === 0) return;
    const safeDate = format(selectedDate, "yyyy-MM-dd");
    exportAllEventsToIcs(dayEvents, `agenda-${safeDate}`);
  };

  return (
    <div className="lg:w-[320px] flex flex-col gap-4">
      {/* Daily Agenda Box */}
      <div className="bg-card rounded-2xl border border-border shadow-xs p-4 md:p-5 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm md:text-base font-bold">Agenda do Dia</h3>
            <span className="text-[10px] font-semibold text-muted-foreground capitalize">
              {formattedDay}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {dayEvents.length > 0 && (
              <button
                type="button"
                onClick={handleExportDayIcs}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors border border-border"
                title="Exportar compromissos do dia em .ics"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenNewEvent(selectedDate)}
              className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors border border-primary/20"
              title="Adicionar evento neste dia"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Events list */}
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-hide">
          {dayEvents.length > 0 ? (
            dayEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onEdit={onEditEvent}
                onDelete={onDeleteEvent}
                onToggleStatus={onToggleStatus}
              />
            ))
          ) : (
            <div className="py-8 text-center">
              <div className="bg-muted w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2.5">
                <Clock className="w-4 h-4 text-muted-foreground/30" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                Nenhum evento agendado para este dia.
              </p>
              <button
                type="button"
                onClick={() => onOpenNewEvent(selectedDate)}
                className="mt-3 text-[11px] font-bold text-primary hover:underline"
              >
                + Agendar agora
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Weekly Summary Card */}
      <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 text-white relative overflow-hidden group">
        <div className="relative z-10">
          <h3 className="text-base font-bold mb-1">Resumo da Semana</h3>
          <p className="text-slate-400 text-xs mb-3.5 leading-relaxed">
            Você tem {weeklyEventsCount} {weeklyEventsCount === 1 ? "compromisso agendado" : "compromissos agendados"} nesta semana.
          </p>
          <button 
            type="button"
            onClick={onOpenWeeklyReport}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 border border-white/10 cursor-pointer"
          >
            Ver Relatório Completo
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
        <CalendarIcon className="absolute -right-3 -bottom-3 w-24 h-24 text-white/5 -rotate-12 transition-transform group-hover:scale-110 pointer-events-none" />
      </div>
    </div>
  );
});
