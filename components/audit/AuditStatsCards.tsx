"use client";

import { FileText, AlertTriangle, FileSpreadsheet, Key } from "lucide-react";

interface AuditStatsCardsProps {
  stats: {
    total: number;
    criticalCount: number;
    exportCount: number;
    sensitiveCount: number;
    authCount: number;
  };
}

export function AuditStatsCards({ stats }: AuditStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5">
      <div className="p-2.5 sm:p-3 rounded-lg bg-card border border-border shadow-xs flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
          <FileText className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">Total Auditado</p>
          <p className="text-base sm:text-lg font-black text-foreground">{stats.total}</p>
        </div>
      </div>

      <div className="p-2.5 sm:p-3 rounded-lg bg-card border border-border shadow-xs flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">Ações Críticas</p>
          <p className="text-base sm:text-lg font-black text-rose-500">{stats.criticalCount}</p>
        </div>
      </div>

      <div className="p-2.5 sm:p-3 rounded-lg bg-card border border-border shadow-xs flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">Exportações Base</p>
          <p className="text-base sm:text-lg font-black text-amber-500">{stats.exportCount}</p>
        </div>
      </div>

      <div className="p-2.5 sm:p-3 rounded-lg bg-card border border-border shadow-xs flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
          <Key className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">Autenticações</p>
          <p className="text-base sm:text-lg font-black text-emerald-500">{stats.authCount}</p>
        </div>
      </div>
    </div>
  );
}
