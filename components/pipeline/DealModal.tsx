"use client";

import { useState, useEffect } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Deal, Company, Contact, Property, UserProfile } from "@/lib/db";
import { PIPELINE_STAGES } from "@/lib/constants";
import { formatCurrencyBRL, parseCurrencyBRLToNumber, formatCurrencyInput } from "@/lib/utils";
import { ContactLookupModal } from "./ContactLookupModal";
import { PropertyLookupModal } from "./PropertyLookupModal";

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
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [isContactLookupOpen, setIsContactLookupOpen] = useState(false);
  const [isPropertyLookupOpen, setIsPropertyLookupOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingDeal) {
      if (editingDeal.value !== undefined && editingDeal.value !== null && editingDeal.value > 0) {
        setDisplayValue(formatCurrencyBRL(editingDeal.value));
      } else {
        setDisplayValue("");
      }
      setSelectedPropertyId(editingDeal.propertyId || "");
      setSelectedContactId(editingDeal.contactId || "");
    } else {
      setDisplayValue("");
      setSelectedPropertyId("");
      setSelectedContactId("");
    }
  }, [editingDeal, isOpen]);

  // Fecha modais de busca quando o DealModal fecha
  useEffect(() => {
    if (!isOpen) {
      setIsContactLookupOpen(false);
      setIsPropertyLookupOpen(false);
    }
  }, [isOpen]);

  const handleSelectProperty = (prop: Property) => {
    setSelectedPropertyId(prop.id);
    if (prop.price && (!displayValue || displayValue === "R$ 0,00")) {
      setDisplayValue(formatCurrencyBRL(prop.price));
    }
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContactId(contact.id);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") || "").trim();
    if (!title) {
      toast.error("O título do negócio é obrigatório");
      return;
    }

    const selectedPropId = selectedPropertyId || (formData.get("propertyId") as string) || undefined;
    const selectedContId = selectedContactId || (formData.get("contactId") as string) || undefined;
    const selectedProp = properties.find((p) => p.id === selectedPropId);
    const autoCompanyId = selectedProp?.companyId || editingDeal?.companyId || undefined;

    const data: Partial<Deal> = {
      title,
      value: parseCurrencyBRLToNumber(displayValue || (formData.get("value") as string)),
      stage: formData.get("stage") as string,
      companyId: autoCompanyId,
      contactId: selectedContId,
      propertyId: selectedPropId,
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
    <>
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
            className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 w-full max-w-lg relative shadow-2xl border border-border z-10 flex flex-col max-h-[min(94vh,720px)] my-auto"
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
            <form
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
                  e.preventDefault();
                }
              }}
              className="overflow-y-auto pr-1 -mr-1 space-y-3 font-medium text-start flex-1"
            >
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
                    onChange={(e) => setDisplayValue(formatCurrencyInput(e.target.value))}
                    onFocus={(e) => {
                      if (!displayValue || displayValue === "R$ 0,00") {
                        setDisplayValue("");
                      } else {
                        e.target.select();
                      }
                    }}
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

              {/* Cliente (Contato) com Lupa e Modal Grid */}
              <div>
                <div className="flex items-center justify-between mb-1 ml-0.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Cliente (Contato)
                  </label>
                  {contacts.find((c) => c.id === selectedContactId) && (
                    <span className="text-[10px] text-primary font-semibold">Cliente vinculado</span>
                  )}
                </div>
                <div className="relative flex items-center gap-1.5">
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsContactLookupOpen(true);
                    }}
                    className="relative flex-1 cursor-pointer group"
                  >
                    <input
                      type="text"
                      readOnly
                      value={(() => {
                        const c = contacts.find((item) => item.id === selectedContactId);
                        if (!c) return selectedContactId ? `Cliente ID: ${selectedContactId}` : "";
                        return `${c.name || "Sem nome"}${c.phone ? ` - ${c.phone}` : ""}`;
                      })()}
                      placeholder="Clique na lupa para pesquisar cliente..."
                      className="w-full pl-3.5 pr-8 py-2 sm:py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs sm:text-sm cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60 font-medium group-hover:border-primary/40"
                    />
                    {selectedContactId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedContactId("");
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Desvincular cliente"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsContactLookupOpen(true);
                    }}
                    className="px-3 py-2 sm:py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 flex items-center gap-1.5 text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                    title="Abrir pesquisa de clientes no grid"
                  >
                    <Search className="w-4 h-4" />
                    <span className="hidden sm:inline">Buscar</span>
                  </button>
                </div>
              </div>

              {/* Imóvel de Interesse com Lupa e Modal Grid */}
              <div>
                <div className="flex items-center justify-between mb-1 ml-0.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Imóvel de Interesse
                  </label>
                  {properties.find((p) => p.id === selectedPropertyId) && (
                    <span className="text-[10px] text-primary font-semibold">Imóvel vinculado</span>
                  )}
                </div>
                <div className="relative flex items-center gap-1.5">
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsPropertyLookupOpen(true);
                    }}
                    className="relative flex-1 cursor-pointer group"
                  >
                    <input
                      type="text"
                      readOnly
                      value={(() => {
                        const p = properties.find((item) => item.id === selectedPropertyId);
                        if (!p) return "";
                        const ref = p.referenceCode || p.reference_code ? `[${p.referenceCode || p.reference_code}] ` : "";
                        const price = p.price ? ` - ${formatCurrencyBRL(p.price)}` : "";
                        return `${ref}${p.title}${price}`;
                      })()}
                      placeholder="Clique na lupa para pesquisar imóvel..."
                      className="w-full pl-3.5 pr-8 py-2 sm:py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs sm:text-sm cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60 font-medium group-hover:border-primary/40"
                    />
                    {selectedPropertyId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedPropertyId("");
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Desvincular imóvel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsPropertyLookupOpen(true);
                    }}
                    className="px-3 py-2 sm:py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 flex items-center gap-1.5 text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 active:scale-95"
                    title="Abrir pesquisa de imóveis no grid"
                  >
                    <Search className="w-4 h-4" />
                    <span className="hidden sm:inline">Buscar</span>
                  </button>
                </div>
              </div>

              {/* Corretor Responsável (Disponível para Admin) */}
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
                  className="flex-1 py-2.5 px-4 font-bold text-xs sm:text-sm bg-primary text-white rounded-xl hover:opacity-90 transition-all shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Gravando no Banco...</span>
                    </>
                  ) : (
                    editingDeal?.id ? "Salvar Alterações" : "Salvar Negócio"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

      {/* Modais de Pesquisa com Grid & Lupa */}
      <ContactLookupModal
        isOpen={isContactLookupOpen}
        onClose={() => setIsContactLookupOpen(false)}
        contacts={contacts}
        selectedContactId={selectedContactId}
        onSelect={handleSelectContact}
      />

      <PropertyLookupModal
        isOpen={isPropertyLookupOpen}
        onClose={() => setIsPropertyLookupOpen(false)}
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        onSelect={handleSelectProperty}
      />
    </>
  );
}
