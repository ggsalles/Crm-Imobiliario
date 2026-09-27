"use client";

import { useState } from "react";
import { X, AlertOctagon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LOST_REASONS } from "@/lib/lead-health";
import { cn } from "@/lib/utils";

export interface LostReasonModalProps {
  isOpen: boolean;
  dealTitle?: string;
  onClose: () => void;
  onConfirm: (reasonId: string, notes: string) => Promise<void>;
}

export function LostReasonModal({
  isOpen,
  dealTitle,
  onClose,
  onConfirm,
}: LostReasonModalProps) {
  const [selectedLostReason, setSelectedLostReason] = useState<string>(LOST_REASONS[0].id);
  const [lostNotes, setLostNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm(selectedLostReason, lostNotes);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-3xl p-6 md:p-8 w-full max-w-lg relative shadow-2xl border border-rose-500/30"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-6 top-6 p-2 rounded-full hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Registrar Motivo da Perda</h2>
                <p className="text-xs text-muted-foreground">
                  Oportunidade: &quot;{dealTitle || "Negócio"}&quot;
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Identificar a causa da perda gera inteligência de mercado para calibrar o portfólio de imóveis e os preços da imobiliária.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 ml-1 block">
                  Motivo Principal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {LOST_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => setSelectedLostReason(reason.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between cursor-pointer",
                        selectedLostReason === reason.id
                          ? "bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 shadow-xs"
                          : "bg-muted/30 border-border text-foreground/80 hover:bg-muted"
                      )}
                    >
                      <span className="truncate">{reason.label}</span>
                      {selectedLostReason === reason.id && (
                        <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 ml-1.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 ml-1 block">
                  Observações Adicionais (Opcional)
                </label>
                <textarea
                  value={lostNotes}
                  onChange={(e) => setLostNotes(e.target.value)}
                  placeholder="Ex: O cliente optou por apartamento de 3 quartos no Bairro Jardins com taxa condominial mais baixa..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 font-bold text-xs text-muted-foreground hover:bg-muted rounded-xl transition-all border border-border cursor-pointer"
                >
                  Cancelar (Manter no Funil)
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Registrando..." : "Confirmar Perda"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
