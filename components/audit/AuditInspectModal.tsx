"use client";

import { ShieldCheck, X } from "lucide-react";
import { AuditLogItem } from "./types";

interface AuditInspectModalProps {
  log: AuditLogItem | null;
  onClose: () => void;
}

export function AuditInspectModal({ log, onClose }: AuditInspectModalProps) {
  if (!log) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-foreground">Registro Forense de Auditoria</h3>
              <p className="text-[9px] font-mono text-muted-foreground">ID: {log.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-6 h-6 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border">
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Ação Registrada</p>
              <p className="text-xs font-bold text-foreground mt-0.5">{log.metadata?.action || log.title}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Data e Hora Exata</p>
              <p className="text-xs font-mono font-medium text-foreground mt-0.5">
                {new Date(log.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Usuário Responsável</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">{log.author_name || "Sistema"}</p>
              <p className="text-[9px] text-muted-foreground">{log.metadata?.userEmail || ""}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Endereço IP Origem</p>
              <p className="text-xs font-mono font-medium text-foreground mt-0.5">{log.metadata?.ip || "127.0.0.1"}</p>
            </div>
          </div>

          <div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Descrição Completa</p>
            <div className="p-2.5 rounded-xl bg-background border border-border text-foreground leading-relaxed text-xs">
              {log.content || log.title}
            </div>
          </div>

          <div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">User-Agent / Navegador</p>
            <div className="p-2 rounded-xl bg-background border border-border font-mono text-[9px] text-muted-foreground break-all">
              {log.metadata?.userAgent || "Não informado"}
            </div>
          </div>

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Payload de Metadados / Diff</p>
              <pre className="p-2.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[10px] overflow-x-auto border border-border/50">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
