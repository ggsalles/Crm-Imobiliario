"use client";

import { memo } from "react";
import { 
  Check, 
  Clock, 
  Users, 
  X, 
  Calendar as CalendarIcon, 
  ExternalLink 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarEventItem, getGoogleCalendarUrl, exportEventToIcs } from "@/lib/calendar-export";

interface EventCardProps {
  event: CalendarEventItem;
  onEdit: (event: CalendarEventItem) => void;
  onDelete: (event: CalendarEventItem) => void;
  onToggleStatus: (event: CalendarEventItem) => void;
}

export const EventCard = memo(function EventCard({
  event,
  onEdit,
  onDelete,
  onToggleStatus,
}: EventCardProps) {
  const isCompleted = event.status === "completed";

  const handleGoogleCalendarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getGoogleCalendarUrl(event);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleExportIcsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    exportEventToIcs(event);
  };

  return (
    <div 
      className={cn(
        "group p-3 rounded-xl border transition-all relative overflow-hidden",
        isCompleted 
          ? "bg-muted/10 opacity-70 border-border" 
          : "bg-muted/20 border-border hover:border-primary/50 hover:bg-primary/5"
      )}
    >
      {/* Clickable Area for Editing */}
      <div 
        className="absolute inset-0 z-10 cursor-pointer" 
        onClick={() => onEdit(event)}
        title="Clique para editar este compromisso"
      />
      
      {/* Top right actions */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        {/* Google Calendar quick link */}
        <button
          type="button"
          onClick={handleGoogleCalendarClick}
          className="p-1 text-muted-foreground/60 hover:text-primary hover:bg-primary/10 rounded-md transition-colors bg-card/60"
          title="Adicionar ao Google Agenda"
        >
          <ExternalLink className="w-3 h-3" />
        </button>

        {/* Delete Button */}
        <button 
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(event);
          }}
          className="p-1 hover:bg-red-500/10 rounded-md text-muted-foreground/60 hover:text-red-500 transition-colors bg-card/60"
          title="Excluir compromisso"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {isCompleted && (
        <div className="absolute top-0 right-0 p-1 bg-emerald-500 rounded-bl-lg shadow-xs border-l border-b border-emerald-400 z-10 text-white">
          <Check className="w-2.5 h-2.5" />
        </div>
      )}
      
      {/* Header with Type & Status Toggle */}
      <div className="flex items-start justify-between mb-2 relative z-20 pointer-events-none">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(event);
            }}
            className={cn(
              "w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer",
              isCompleted 
                ? "bg-emerald-500 border-emerald-500 text-white" 
                : "bg-card border-border text-transparent hover:border-primary"
            )}
            title={isCompleted ? "Marcar como pendente" : "Marcar como concluído"}
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

      {/* Event Title */}
      <h4 className={cn(
        "font-bold text-xs md:text-sm mb-1 leading-tight",
        isCompleted && "line-through text-muted-foreground"
      )}>
        {event.title}
      </h4>

      {/* Event Details */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3 h-3 text-muted-foreground/70" />
          <span className="text-[10px] font-medium">{event.time}</span>
        </div>
        {event.client && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="w-3 h-3 text-muted-foreground/70" />
            <span className="text-[10px] font-medium truncate max-w-[200px]">{event.client}</span>
          </div>
        )}
      </div>
    </div>
  );
});
