"use client";

import { memo, useState } from "react";
import { 
  Calendar as CalendarIcon, 
  Search, 
  Plus, 
  Filter, 
  Download, 
  ChevronDown,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  onNewEvent: () => void;
  onExportAll: () => void;
  totalEventsCount: number;
}

const TYPE_OPTIONS = [
  { value: "all", label: "Todos os tipos" },
  { value: "Visita", label: "Visitas" },
  { value: "Reunião", label: "Reuniões" },
  { value: "Follow-up", label: "Follow-ups" }
];

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "pending", label: "Pendentes" },
  { value: "completed", label: "Concluídos" }
];

export const CalendarHeader = memo(function CalendarHeader({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedStatus,
  onStatusChange,
  onNewEvent,
  onExportAll,
  totalEventsCount,
}: CalendarHeaderProps) {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const hasActiveFilters = selectedType !== "all" || selectedStatus !== "all";

  return (
    <header className="h-auto md:h-16 bg-card/80 backdrop-blur-md border-b border-border pl-16 md:pl-6 px-3 sm:px-4 md:px-5 py-2.5 md:py-0 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-20 gap-3">
      {/* Title & Badge */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-xl shrink-0">
          <CalendarIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-bold">Calendário</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {totalEventsCount} {totalEventsCount === 1 ? "agendamento" : "agendamentos"}
            </span>
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
            Gestão de Agenda & Visitas Imobiliárias
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar por título ou descrição..." 
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9 pr-7 py-1.5 bg-muted border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 w-44 sm:w-56 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
              title="Limpar busca"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter Dropdown Toggle */}
        <div className="relative">
          <button 
            type="button"
            onClick={() => setShowFilterDropdown(prev => !prev)}
            className={cn(
              "p-2 rounded-xl text-xs font-semibold border transition-all shadow-xs flex items-center gap-1.5 cursor-pointer",
              hasActiveFilters 
                ? "bg-primary/10 text-primary border-primary/30" 
                : "bg-card border-border text-muted-foreground hover:bg-muted"
            )}
            title="Filtros de compromissos"
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Filtros</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </button>

          {showFilterDropdown && (
            <>
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setShowFilterDropdown(false)} 
              />
              <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-2xl shadow-xl p-3 z-40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-bold">Filtros Rápidos</span>
                  {hasActiveFilters && (
                    <button
                      onClick={() => {
                        onTypeChange("all");
                        onStatusChange("all");
                      }}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Filter by Type */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Tipo de Evento
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {TYPE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onTypeChange(opt.value)}
                        className={cn(
                          "px-2 py-1 text-[11px] rounded-lg font-medium border text-left transition-colors",
                          selectedType === opt.value
                            ? "bg-primary text-white border-primary"
                            : "bg-muted/40 border-border text-foreground hover:bg-muted"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter by Status */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Status
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onStatusChange(opt.value)}
                        className={cn(
                          "px-2 py-1 text-[10px] rounded-lg font-medium border text-center transition-colors",
                          selectedStatus === opt.value
                            ? "bg-primary text-white border-primary"
                            : "bg-muted/40 border-border text-foreground hover:bg-muted"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Export to .ics / Google Calendar */}
        <button
          type="button"
          onClick={onExportAll}
          className="bg-card border border-border p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all shadow-xs flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
          title="Exportar agenda para iCal (.ics) / Google Calendar"
        >
          <Download className="w-4 h-4" />
          <span className="hidden lg:inline text-xs">Exportar .ics</span>
        </button>

        {/* Add Event Button */}
        <button 
          onClick={onNewEvent}
          className="bg-primary text-white px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs shadow-md shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Evento</span>
        </button>
      </div>
    </header>
  );
});

export default CalendarHeader;
