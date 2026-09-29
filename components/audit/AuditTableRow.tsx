"use client";

import { memo } from "react";
import { Clock, Globe, Laptop } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActionMeta } from "@/lib/audit";
import { AuditLogItem } from "./types";

interface AuditTableRowProps {
  log: AuditLogItem;
  isMaster: boolean;
  tenantName?: string;
  onInspect: (log: AuditLogItem) => void;
}

export const AuditTableRow = memo(function AuditTableRow({
  log,
  isMaster,
  tenantName,
  onInspect
}: AuditTableRowProps) {
  const action = log.metadata?.action || "GENERAL_AUDIT";
  const meta = getActionMeta(action);
  const formattedDate = new Date(log.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const ip = log.metadata?.ip || "127.0.0.1";
  const userAgent = log.metadata?.userAgent || "Navegador";
  const isMobile = /mobile|android|iphone/i.test(userAgent);

  return (
    <tr className="hover:bg-muted/30 transition-colors group">
      {/* Date & Time */}
      <td className="py-2 sm:py-2.5 px-3 whitespace-nowrap">
        <div className="flex items-center gap-1 font-mono text-[10px] sm:text-[11px] text-foreground">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span>{formattedDate}</span>
        </div>
      </td>

      {/* User */}
      <td className="py-2 sm:py-2.5 px-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px]">
            {log.author_name?.slice(0, 1).toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate max-w-[130px] text-xs">{log.author_name || "Sistema"}</p>
            <p className="text-[9px] text-muted-foreground truncate max-w-[130px]">{log.metadata?.userEmail || ""}</p>
            {isMaster && log.tenant_id && tenantName && (
              <span className="inline-block text-[8px] font-semibold px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border mt-0.5 max-w-[130px] truncate">
                {tenantName}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Action Badge */}
      <td className="py-2 sm:py-2.5 px-3 whitespace-nowrap">
        <span className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border",
          meta.bg,
          meta.color
        )}>
          {meta.label}
        </span>
      </td>

      {/* Content / Description */}
      <td className="py-2 sm:py-2.5 px-3">
        <p className="text-foreground font-medium line-clamp-1 max-w-[280px] text-xs" title={log.content}>
          {log.content || log.title}
        </p>
      </td>

      {/* IP & Device */}
      <td className="py-2 sm:py-2.5 px-3 whitespace-nowrap">
        <div className="flex flex-col text-[9px] font-mono">
          <span className="text-foreground flex items-center gap-1">
            <Globe className="w-2.5 h-2.5 text-muted-foreground" />
            {ip}
          </span>
          <span className="text-muted-foreground text-[8px] flex items-center gap-1 mt-0.5">
            <Laptop className="w-2.5 h-2.5 text-muted-foreground" />
            {isMobile ? "Dispositivo Móvel" : "Desktop / Web"}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td className="py-2 sm:py-2.5 px-3 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => onInspect(log)}
          className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border cursor-pointer"
        >
          Inspecionar
        </button>
      </td>
    </tr>
  );
});
