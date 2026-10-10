"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  X, 
  Copy, 
  Check, 
  MessageSquare, 
  ExternalLink, 
  User, 
  Phone, 
  Building2, 
  Share2,
  Trash2,
  ChevronRight
} from "lucide-react";
import { Property } from "@/lib/db";
import { formatCurrencyBRL } from "@/lib/utils";
import { recordAuditEvent } from "@/lib/audit";
import { toast } from "sonner";

interface CustomShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProperties: Property[];
  onRemoveProperty: (propertyId: string) => void;
  profile: any;
}

export function CustomShowcaseModal({
  isOpen,
  onClose,
  selectedProperties,
  onRemoveProperty,
  profile
}: CustomShowcaseModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Generate the curated showcase link
  const generatedUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const baseUrl = window.location.origin;
    const ids = selectedProperties.map(p => p.id).join(",");
    const params = new URLSearchParams();
    
    params.set("ids", ids);
    if (clientName.trim()) {
      params.set("cliente", clientName.trim());
    }
    if (profile?.id) {
      params.set("broker", profile.id);
    }
    if (profile?.tenantId) {
      params.set("tenant", profile.tenantId);
    }
    params.set("mode", "client");

    return `${baseUrl}/vitrine?${params.toString()}`;
  }, [selectedProperties, clientName, profile]);

  // Generate customized WhatsApp message
  const whatsappMessage = useMemo(() => {
    const greeting = clientName.trim() ? `Olá, *${clientName.trim()}*!` : "Olá!";
    const count = selectedProperties.length;
    const countText = count === 1 ? "1 imóvel exclusivo" : `${count} imóveis selecionados`;
    
    const itemsText = selectedProperties.slice(0, 5).map((p, idx) => {
      const ref = p.referenceCode || (p as any).reference_code;
      const refTxt = ref ? `[#${ref}] ` : "";
      const priceTxt = formatCurrencyBRL(p.price);
      return `${idx + 1}️⃣ ${refTxt}*${p.title}* - ${priceTxt}`;
    }).join("\n");

    const moreText = count > 5 ? `\n...e mais ${count - 5} opções na sua vitrine.` : "";

    return `✨ *SELEÇÃO EXCLUSIVA DE IMÓVEIS* ✨\n\n${greeting}\nPreparei com muito carinho uma curadoria especial com ${countText} que combinam perfeitamente com o seu perfil:\n\n${itemsText}${moreText}\n\n👉 *Acesse sua vitrine personalizada com fotos e detalhes:*\n${generatedUrl}\n\nFico à total disposição para tirar dúvidas ou agendarmos visitas! 🚀`;
  }, [clientName, selectedProperties, generatedUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopiedLink(true);
    toast.success("Link da vitrine personalizada copiado!");
    setTimeout(() => setCopiedLink(false), 2000);

    recordAuditEvent({
      action: "SHARE_PROPERTY_LINK",
      title: "Vitrine Personalizada Copiada",
      content: `Link da seleção de ${selectedProperties.length} imóveis copiado${clientName ? ` para ${clientName}` : ""}.`,
      severity: "low",
      category: "modification",
      metadata: {
        type: "curated_showcase",
        clientName,
        propertyCount: selectedProperties.length
      }
    });
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopiedMessage(true);
    toast.success("Mensagem formatada copiada!");
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleSendWhatsApp = () => {
    let cleanPhone = clientPhone.replace(/\D/g, "");
    if (cleanPhone && !cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(whatsappMessage)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

    window.open(waUrl, "_blank");

    recordAuditEvent({
      action: "SHARE_PROPERTY_LINK",
      title: "Vitrine Personalizada Enviada via WhatsApp",
      content: `Envio de seleção de ${selectedProperties.length} imóveis via WhatsApp${clientName ? ` para ${clientName}` : ""}.`,
      severity: "low",
      category: "modification",
      metadata: {
        type: "curated_showcase_whatsapp",
        clientName,
        propertyCount: selectedProperties.length
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-border bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-amber-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 fill-amber-950" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                Vitrine Personalizada para Cliente
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Gere uma curadoria VIP com os imóveis selecionados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Cliente Info Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-2xl bg-accent/40 border border-border">
            <div>
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                Nome do Cliente (Opcional)
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Roberto Silva"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-background border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Aparecerá como saudação VIP no topo da vitrine.
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                <Phone className="w-3.5 h-3.5 text-primary" />
                WhatsApp do Cliente (Opcional)
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Ex: (11) 98765-4321"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-background border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Para disparar a mensagem direto no WhatsApp.
              </span>
            </div>
          </div>

          {/* Imóveis Selecionados (Lista Visual) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                Imóveis na Curadoria ({selectedProperties.length})
              </span>
              <span className="text-[11px] text-muted-foreground">
                Clique no &quot;X&quot; para remover da seleção
              </span>
            </div>

            {selectedProperties.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-border rounded-2xl text-muted-foreground text-xs">
                Nenhum imóvel selecionado. Feche esta janela e marque os imóveis desejados na listagem.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedProperties.map((p) => {
                  const ref = p.referenceCode || (p as any).reference_code;
                  const thumb = p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls[0] : "https://picsum.photos/seed/realestate/200/200";

                  return (
                    <div 
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border hover:border-primary/40 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-lg relative overflow-hidden shrink-0 border border-border">
                          <Image
                            src={thumb}
                            alt={p.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {ref && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-amber-950 font-mono font-bold text-[10px]">
                                #{ref}
                              </span>
                            )}
                            <span className="text-xs font-bold text-foreground truncate">
                              {p.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {p.neighborhood ? `${p.neighborhood}, ` : ''}{p.city || p.location} • <strong className="text-emerald-500 font-semibold">{formatCurrencyBRL(p.price)}</strong>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveProperty(p.id)}
                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                        title="Remover este imóvel da seleção"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Link Preview Box */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/60 dark:bg-black/60 border border-border space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Link Exclusivo Gerado
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedUrl}
                className="w-full text-xs font-mono bg-background/50 border border-border/60 rounded-xl px-3 py-2 text-foreground truncate"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 rounded-xl bg-secondary hover:bg-accent text-foreground text-xs font-bold shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-4 sm:p-6 border-t border-border bg-accent/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <a
            href={generatedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Visualizar como o cliente verá
          </a>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyMessage}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border border-border hover:bg-accent text-foreground text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              title="Copiar texto completo para colar no WhatsApp"
            >
              {copiedMessage ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedMessage ? "Mensagem Copiada!" : "Copiar Mensagem"}
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={selectedProperties.length === 0}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              Enviar no WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
