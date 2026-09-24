'use client';

import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  itemName?: string;
  itemType?: string; // e.g. "atividade", "contato", "imóvel", "negócio", "empresa", "usuário", "mensagem"
  description?: string;
  warningNote?: string;
  isDeleting?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar Exclusão",
  itemName,
  itemType,
  description,
  warningNote = "Esta ação é irreversível e será registrada na Central de Auditoria da imobiliária.",
  isDeleting = false
}: ConfirmDeleteModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  const defaultDescription = itemType
    ? `Tem certeza que deseja excluir ${itemType.startsWith('a') || itemType.startsWith('m') || itemType.startsWith('e') ? 'esta' : 'este'} ${itemType}?`
    : "Tem certeza de que deseja prosseguir com a exclusão deste registro?";

  return (
    <div 
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
    >
      <div 
        className="w-full max-w-md bg-card border border-rose-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-rose-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground leading-tight">{title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {description || defaultDescription}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {itemName && (
            <div className="p-3 bg-muted/40 border border-border rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Item selecionado:
              </span>
              <p className="text-xs sm:text-sm font-bold text-foreground break-words">
                {itemName}
              </p>
            </div>
          )}

          {warningNote && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-amber-700 dark:text-amber-300 leading-relaxed">
                {warningNote}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 pt-0 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm();
            }}
            disabled={isDeleting}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50",
              "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20 active:scale-95"
            )}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Excluindo...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmar Exclusão</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
