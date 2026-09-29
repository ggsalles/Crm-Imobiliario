"use client";

import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";

interface AuditClearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isClearing: boolean;
  totalLogsCount: number;
}

export function AuditClearModal({
  isOpen,
  onClose,
  onConfirm,
  isClearing,
  totalLogsCount
}: AuditClearModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="text-center space-y-1.5">
          <h3 className="text-base font-bold text-foreground">Limpar Histórico de Auditoria?</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Esta ação apagará permanentemente todos os registros de log da tabela de auditoria ({totalLogsCount} registros no total).
            <br /><br />
            <span className="font-semibold text-foreground">Nota:</span> Seus contatos, negócios no funil, imóveis e notas de clientes não serão afetados — apenas o histórico de acessos e operações será limpo.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isClearing}
            className="flex-1 px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isClearing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isClearing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Limpando...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Sim, Limpar Tudo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
