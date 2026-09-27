"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PIPELINE_STAGES } from "@/lib/constants";
import { formatCurrencyBRL, parseCurrencyBRLToNumber } from "@/lib/utils";

export interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: string;
  stageGoals: Record<string, number>;
  onSaveGoals: (goals: Record<string, number>) => Promise<void>;
}

export const GoalModal = memo(function GoalModal({
  isOpen,
  onClose,
  currentMonth,
  stageGoals,
  onSaveGoals,
}: GoalModalProps) {
  const [displayGoals, setDisplayGoals] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const formatted: Record<string, string> = {};
    PIPELINE_STAGES.forEach((stage) => {
      formatted[stage.id] = formatCurrencyBRL(stageGoals[stage.id] || 0);
    });
    setDisplayGoals(formatted);
  }, [stageGoals, isOpen]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const updatedGoals: Record<string, number> = {};
    PIPELINE_STAGES.forEach((stage) => {
      updatedGoals[stage.id] = parseCurrencyBRLToNumber(displayGoals[stage.id] || "0");
    });

    try {
      setIsSubmitting(true);
      await onSaveGoals(updatedGoals);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [displayGoals, onSaveGoals, onClose]);

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
            className="bg-card rounded-3xl p-8 w-full max-w-sm relative shadow-2xl border border-border"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-6 top-6 p-2 rounded-full hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
            <h2 className="text-2xl font-bold mb-2 text-foreground text-start">Definir Metas</h2>
            <p className="text-sm text-muted-foreground mb-6 text-start">
              Defina os valores de venda desejados para cada situação em {currentMonth}.
            </p>
            <form
              onSubmit={handleSubmit}
              className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar text-start font-medium leading-none"
            >
              {PIPELINE_STAGES.map((stage) => (
                <div key={stage.id} className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1 flex items-center gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        stage.color === "blue"
                          ? "bg-primary"
                          : stage.color === "purple"
                          ? "bg-purple-500"
                          : stage.color === "orange"
                          ? "bg-orange-500"
                          : stage.color === "yellow"
                          ? "bg-yellow-500"
                          : stage.color === "emerald"
                          ? "bg-emerald-500"
                          : "bg-rose-500"
                      }`}
                    />
                    {stage.title} (R$)
                  </label>
                  <input
                    type="text"
                    required
                    value={displayGoals[stage.id] || "R$ 0,00"}
                    onChange={(e) =>
                      setDisplayGoals((prev) => ({
                        ...prev,
                        [stage.id]: formatCurrencyBRL(e.target.value),
                      }))
                    }
                    placeholder="R$ 0,00"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              ))}
              <div className="pt-4 flex gap-3 sticky bottom-0 bg-card">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 font-bold text-muted-foreground hover:bg-muted rounded-2xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 font-bold bg-primary text-white rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
