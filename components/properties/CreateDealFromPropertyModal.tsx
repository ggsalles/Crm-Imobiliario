"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Briefcase, 
  Check, 
  Home, 
  User, 
  Coins, 
  Layers, 
  ArrowRight, 
  Loader2,
  AlertCircle
} from "lucide-react";
import { Property, Contact, createDeal } from "@/lib/db";
import { STAGES } from "@/lib/constants";
import { formatCurrencyBRL, parseCurrencyBRLToNumber } from "@/lib/utils";
import { recordAuditEvent } from "@/lib/audit";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CreateDealFromPropertyModalProps {
  isOpen: boolean;
  property: Property | null;
  contacts: Contact[];
  onClose: () => void;
  onSuccess?: (dealId: string) => void;
}

export const CreateDealFromPropertyModal = memo(function CreateDealFromPropertyModal({
  isOpen,
  property,
  contacts,
  onClose,
  onSuccess,
}: CreateDealFromPropertyModalProps) {
  const router = useRouter();

  const [selectedContactId, setSelectedContactId] = useState("");
  const [dealTitle, setDealTitle] = useState("");
  const [dealValueDisplay, setDealValueDisplay] = useState("");
  const [selectedStage, setSelectedStage] = useState("lead");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clients list (filters out internal team members)
  const clientContacts = useMemo(() => {
    return contacts.filter(c => c.type !== "equipe");
  }, [contacts]);

  // Initial populate when property opens
  useEffect(() => {
    if (property) {
      const formattedPrice = formatCurrencyBRL(property.price || 0);
      setDealValueDisplay(formattedPrice);
      setSelectedStage("lead");
      setSelectedContactId("");
      setDealTitle(`Interesse: ${property.title}`);
    }
  }, [property]);

  // Auto-update deal title when contact changes
  const handleContactChange = (contactId: string) => {
    setSelectedContactId(contactId);
    if (!property) return;

    if (contactId) {
      const contact = contacts.find(c => c.id === contactId);
      const contactName = contact ? contact.name : "";
      setDealTitle(`Negociação - ${property.title} - ${contactName}`);
    } else {
      setDealTitle(`Interesse: ${property.title}`);
    }
  };

  if (!isOpen || !property) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!dealTitle.trim()) {
      toast.error("Por favor, insira um título para a negociação.");
      return;
    }

    const numericValue = parseCurrencyBRLToNumber(dealValueDisplay);
    if (numericValue <= 0) {
      toast.error("Por favor, insira um valor válido para a negociação.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Criando negociação no funil...");

    try {
      const newDealId = await createDeal({
        title: dealTitle.trim(),
        value: numericValue,
        stage: selectedStage,
        propertyId: property.id,
        contactId: selectedContactId || null,
      });

      recordAuditEvent({
        action: "CREATE_DEAL",
        title: "Negociação Criada a partir de Imóvel",
        content: `Oportunidade "${dealTitle.trim()}" criada diretamente a partir do imóvel "${property.title}" no valor de ${formatCurrencyBRL(numericValue)}.`,
        severity: "medium",
        category: "modification",
        relatedId: typeof newDealId === "string" ? newDealId : property.id,
        entityType: "deal",
        metadata: {
          propertyId: property.id,
          propertyTitle: property.title,
          value: numericValue,
          stage: selectedStage,
          contactId: selectedContactId || null
        }
      });

      toast.success("Negociação criada com sucesso no funil!", {
        id: toastId,
        action: {
          label: "Ver Funil",
          onClick: () => router.push("/pipeline")
        }
      });

      if (onSuccess && typeof newDealId === "string") {
        onSuccess(newDealId);
      }
      onClose();
    } catch (err: any) {
      console.error("Erro ao criar negociação a partir do imóvel:", err);
      toast.error(err?.message || "Erro ao criar negociação. Tente novamente.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop - no accidental click close */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg bg-card rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-border z-10 flex flex-col max-h-[min(92vh,640px)] my-auto"
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-foreground">
                  Iniciar Negociação no Funil
                </h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Vincular imóvel a um cliente e oportunidade de venda
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Property Summary Pill */}
          <div className="p-3 sm:p-3.5 bg-muted/40 border-b border-border/60 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Home className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-foreground truncate">{property.title}</h4>
              <p className="text-[10px] text-muted-foreground truncate">
                {property.location || "Sem localização"} • {property.bedrooms} qtos • {property.area} m²
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[9px] font-bold text-muted-foreground uppercase block">Valor Imóvel</span>
              <span className="text-xs font-bold text-primary font-mono">{formatCurrencyBRL(property.price || 0)}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 font-medium">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                Título da Negociação *
              </label>
              <input
                required
                type="text"
                value={dealTitle}
                onChange={(e) => setDealTitle(e.target.value)}
                placeholder="Ex: Proposta de Compra - Edifício Garden"
                className="w-full px-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
              />
            </div>

            {/* Client selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                  Cliente Comprador (Opcional)
                </label>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {clientContacts.length} clientes na carteira
                </span>
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={selectedContactId}
                  onChange={(e) => handleContactChange(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all cursor-pointer"
                >
                  <option value="">Selecione um cliente ou deixe em aberto...</option>
                  {clientContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} {contact.phone ? `(${contact.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Deal Value */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                Valor da Proposta / Negociação *
              </label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  required
                  type="text"
                  value={dealValueDisplay}
                  onChange={(e) => setDealValueDisplay(e.target.value)}
                  placeholder="R$ 0,00"
                  className="w-full pl-9 pr-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none font-mono transition-all"
                />
              </div>
              <p className="text-[10px] text-muted-foreground ml-1">
                Inicialmente definido com o valor de tabela do imóvel. Você pode ajustar para o valor da proposta.
              </p>
            </div>

            {/* Initial Stage */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                Etapa Inicial no Funil *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {STAGES.slice(0, 4).map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setSelectedStage(stage.id)}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      selectedStage === stage.id
                        ? "bg-primary text-white border-primary shadow-xs"
                        : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <span className="block truncate">{stage.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-muted text-muted-foreground hover:bg-muted/80 rounded-xl font-bold text-xs md:text-sm transition-all border border-border cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-[2] py-2.5 bg-primary text-white rounded-xl font-bold text-xs md:text-sm shadow-md shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Criar Negociação no Funil
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});
