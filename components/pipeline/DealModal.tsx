"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Deal, Company, Contact, Property, UserProfile } from "@/lib/db";
import { PIPELINE_STAGES } from "@/lib/constants";
import { formatCurrencyBRL, parseCurrencyBRLToNumber } from "@/lib/utils";

export interface DealModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingDeal: Deal | null;
  onSave: (data: Partial<Deal>) => Promise<void>;
  companies: Company[];
  contacts: Contact[];
  properties: Property[];
  users: UserProfile[];
  profile: UserProfile | null;
}

export function DealModal({
  isOpen,
  onClose,
  editingDeal,
  onSave,
  companies,
  contacts,
  properties,
  users,
  profile,
}: DealModalProps) {
  const [displayValue, setDisplayValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingDeal?.value !== undefined && editingDeal?.value !== null) {
      setDisplayValue(formatCurrencyBRL(editingDeal.value));
    } else {
      setDisplayValue("");
    }
  }, [editingDeal]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Partial<Deal> = {
      title: formData.get("title") as string,
      value: parseCurrencyBRLToNumber(formData.get("value") as string),
      stage: formData.get("stage") as string,
      companyId: (formData.get("companyId") as string) || undefined,
      contactId: (formData.get("contactId") as string) || undefined,
      propertyId: (formData.get("propertyId") as string) || undefined,
      ownerId: (formData.get("ownerId") as string) || undefined,
    };

    try {
      setIsSubmitting(true);
      await onSave(data);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop: clicking outside does NOT close accidentally to prevent data loss */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal Card with compact proportional sizing */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 w-full max-w-lg relative shadow-2xl border border-border z-10 flex flex-col max-h-[min(92vh,640px)] my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-border/60 shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                  {editingDeal?.id ? "Editar Negócio" : "Novo Negócio"}
                </h2>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {editingDeal?.id
                    ? "Atualize as informações e vínculos da oportunidade"
                    : "Preencha os dados para cadastrar uma nova oportunidade no funil"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="overflow-y-auto pr-1 -mr-1 space-y-3 font-medium text-start flex-1">
              {/* Título */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 ml-0.5 block">
                  Título do Negócio *
                </label>
                <input
                  name="title"
                  required
                  defaultValue={editingDeal?.title}
                  placeholder="Ex: Apartamento 3Q Jardins"
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
                />
              </div>

              {/* Valor & Etapa Inicial (2 colunas) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 ml-0.5 block">
                    Valor Estimado (R$) *
                  </label>
                  <input
                    name="value"
                    type="text"
                    required
                    value={displayValue}
                    onChange={(e) => setDisplayValue(formatCurrencyBRL(e.target.value))}
                    placeholder="R$ 0,00"
                    className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 ml-0.5 block">
                    Etapa no Funil
                  </label>
                  <select
                    name="stage"
                    defaultValue={editingDeal?.stage || "lead"}
                    className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s.id} value={s.id} className="bg-card text-foreground">
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cliente (Contato) */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 ml-0.5 block">
                  Cliente (Contato)
                </label>
                <select
                  name="contactId"
                  defaultValue={editingDeal?.contactId || ""}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="" className="bg-card text-foreground">
                    Selecione um cliente (opcional)
                  </option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id} className="bg-card text-foreground">
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Imóvel de Interesse */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 ml-0.5 block">
                  Imóvel de Interesse
                </label>
                <select
                  name="propertyId"
                  defaultValue={editingDeal?.propertyId || ""}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="" className="bg-card text-foreground">
                    Selecione um imóvel (opcional)
                  </option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id} className="bg-card text-foreground">
                      {p.title} {p.price ? `- ${formatCurrencyBRL(p.price)}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Empresa & Corretor (Grid responsivo) */}
              <div className={`grid grid-cols-1 ${profile?.role === "Admin" ? "sm:grid-cols-2" : ""} gap-2.5 sm:gap-3`}>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 ml-0.5 block">
                    Empresa / Construtora
                  </label>
                  <select
                    name="companyId"
                    defaultValue={editingDeal?.companyId || ""}
                    className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  >
                    <option value="" className="bg-card text-foreground">
                      Selecione uma empresa (opcional)
                    </option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id} className="bg-card text-foreground">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {profile?.role === "Admin" && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 ml-0.5 block">
                      Corretor Responsável
                    </label>
                    <select
                      name="ownerId"
                      defaultValue={editingDeal?.ownerId || ""}
                      className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                    >
                      <option value="" className="bg-card text-foreground">
                        Atribuir corretor (opcional)
                      </option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id} className="bg-card text-foreground">
                          {u.displayName || (u as any).name || u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border/60 flex items-center gap-2.5 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 font-bold text-xs sm:text-sm text-muted-foreground hover:bg-muted rounded-xl transition-all cursor-pointer border border-border/70"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 font-bold text-xs sm:text-sm bg-primary text-white rounded-xl hover:opacity-90 transition-all shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : editingDeal?.id ? "Salvar Alterações" : "Salvar Negócio"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
