"use client";

import { memo } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon 
} from "lucide-react";
import { 
  format, 
  isSameMonth, 
  isSameDay 
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarEventItem } from "@/lib/calendar-export";

interface MonthGridProps {
  currentMonth: Date;
  selectedDate: Date;
  calendarDays: Date[];
  monthStart: Date;
  eventsByDateStr: Record<string, CalendarEventItem[]>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
  onSelectDate: (date: Date) => void;
  onDoubleClickDate: (date: Date) => void;
}

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const MonthGrid = memo(function MonthGrid({
  currentMonth,
  selectedDate,
  calendarDays,
  monthStart,
  eventsByDateStr,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
  onSelectDate,
  onDoubleClickDate,
}: MonthGridProps) {
  const today = new Date();

  return (
    <div className="flex-[2] bg-card rounded-2xl border border-border shadow-xs p-4 md:p-5 flex flex-col transition-colors">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base md:text-lg font-bold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-1.5">
          <button 
            type="button"
            onClick={onPrevMonth}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors border border-border cursor-pointer"
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <button 
            type="button"
            onClick={onGoToToday}
            className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
          >
            Hoje
          </button>
          <button 
            type="button"
            onClick={onNextMonth}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors border border-border cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {/* Weekday headers */}
        {WEEK_DAYS.map((day) => (
          <div key={day} className="bg-muted/30 py-2 text-center">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
              {day}
            </span>
          </div>
        ))}

        {/* Days */}
        {calendarDays.map((date, i) => {
          const dateKey = format(date, "yyyy-MM-dd");
          const dayEvents = eventsByDateStr[dateKey] || [];
          const isCurrentMonth = isSameMonth(date, monthStart);
          const isDateToday = isSameDay(date, today);
          const isDateSelected = isSameDay(date, selectedDate);

          return (
            <div 
              key={i} 
              onClick={() => onSelectDate(date)}
              onDoubleClick={() => onDoubleClickDate(date)}
              className={cn(
                "bg-card min-h-[75px] md:min-h-[85px] p-1.5 md:p-2 cursor-pointer hover:bg-muted/10 transition-colors group relative select-none",
                !isCurrentMonth && "bg-muted/5 opacity-40",
                isDateSelected && !isDateToday && "bg-primary/5"
              )}
            >
              {/* Day Number */}
              <div className="flex items-center justify-between">
                <span className={cn(
                  "inline-flex items-center justify-center w-6 h-6 text-[11px] font-bold rounded-md transition-all",
                  isDateToday 
                    ? "bg-primary text-white shadow-xs shadow-primary/20" 
                    : "text-muted-foreground group-hover:text-primary",
                  isDateSelected && !isDateToday && "ring-2 ring-primary ring-offset-1 z-10 ring-offset-background"
                )}>
                  {format(date, "d")}
                </span>

                {dayEvents.length > 0 && (
                  <span className="text-[8px] font-mono font-bold text-muted-foreground/60 hidden sm:inline">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Event indicators */}
              <div className="mt-1 flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((e, idx) => (
                  <div 
                    key={e.id || idx} 
                    className={cn(
                      "px-1 py-0.5 rounded text-[8px] md:text-[9px] font-bold truncate flex items-center gap-1",
                      e.type === "Visita" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : 
                      e.type === "Reunião" ? "bg-primary/10 text-primary border border-primary/20" : 
                      "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
                      e.status === "completed" && "opacity-60 line-through"
                    )} 
                    title={`${e.time} - ${e.title}`}
                  >
                    <div className={cn(
                      "w-1 h-1 rounded-full shrink-0",
                      e.type === "Visita" ? "bg-amber-400" : 
                      e.type === "Reunião" ? "bg-primary" : "bg-emerald-400"
                    )} />
                    <span className="truncate">{e.title}</span>
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
  );
});

export default MonthGrid;
