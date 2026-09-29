"use client";

import { Plus, Search, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityFilterToolbarProps {
  activityCounts: { total: number; pending: number; completed: number };
  filter: 'all' | 'pending' | 'completed';
  setFilter: (val: 'all' | 'pending' | 'completed') => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onExport: () => void;
  onOpenAddModal: () => void;
}

export function ActivityFilterToolbar({
  activityCounts,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  onExport,
  onOpenAddModal
}: ActivityFilterToolbarProps) {
  return (
    <div className="space-y-2.5 shrink-0">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-black tracking-tight text-foreground">Atividades</h1>
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-bold">
              {activityCounts.total} total
            </span>
          </div>
          <p className="text-muted-foreground font-medium text-[11px] md:text-xs">
            Gerencie tarefas, chamadas, reuniões e follow-ups.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onExport}
            className="bg-card border border-border px-3 py-1.5 rounded-xl font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer flex-1 sm:flex-initial"
            title="Exportar todas as atividades cadastradas para CSV"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>Exportar .CSV</span>
          </button>
          <button 
            type="button"
            onClick={onOpenAddModal}
            className="bg-primary text-white px-3.5 py-1.5 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 active:scale-95 transition-all text-xs cursor-pointer flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4" />
            Nova Atividade
          </button>
        </div>
      </div>

      {/* Filters & Search Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Status Tabs */}
        <div className="flex gap-1 bg-card p-1 rounded-xl border border-border w-fit shrink-0 shadow-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
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
              "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
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
              "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
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
    </div>
  );
}
