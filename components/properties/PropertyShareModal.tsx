"use client";

import { motion } from "motion/react";
import { Share2, X, ExternalLink, Copy } from "lucide-react";
import { Property } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { toast } from "sonner";

interface PropertyShareModalProps {
  property: Property | null;
  sharingText: string;
  setSharingText: (val: string) => void;
  onClose: () => void;
}

export function PropertyShareModal({
  property,
  sharingText,
  setSharingText,
  onClose
}: PropertyShareModalProps) {
  if (!property) return null;

  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}/p/${property.id}`;
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link público de captura copiado!");
    recordAuditEvent({
      action: 'SHARE_PROPERTY_LINK',
      title: 'Link Público Copiado',
      content: `Link público da vitrine do imóvel "${property.title}" copiado para divulgação.`,
      severity: 'low',
      category: 'modification',
      relatedId: property.id,
      entityId: property.id,
      entityType: 'property',
      metadata: {
        propertyTitle: property.title,
        publicUrl
      }
    });
  };

  const handleCopyWhatsapp = () => {
    navigator.clipboard.writeText(sharingText);
    toast.success("Ficha do imóvel copiada!");
    recordAuditEvent({
      action: 'SHARE_PROPERTY_LINK',
      title: 'Ficha WhatsApp Gerada',
      content: `Ficha para WhatsApp do imóvel "${property.title}" gerada e copiada.`,
      severity: 'low',
      category: 'modification',
      relatedId: property.id,
      entityId: property.id,
      entityType: 'property',
      metadata: {
        propertyTitle: property.title,
        type: 'whatsapp'
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold text-foreground uppercase tracking-tight">
                Gerador de Ficha de Imóvel
              </h3>
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                Prepare ofertas personalizadas para WhatsApp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors border border-border shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[55vh]">
          <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex items-start gap-2.5">
            <span className="text-base">💡</span>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-emerald-500 font-bold block mb-0.5">Dica do sistema:</strong>
              Você pode alterar livremente o texto abaixo antes de copiar ou enviar. Adicione seu nome, dados de contato ou mensagens personalizadas.
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pl-0.5">
              Visualização e Edição da Ficha
            </label>
            <textarea
              value={sharingText}
              onChange={(e) => setSharingText(e.target.value)}
              rows={8}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-mono leading-relaxed resize-y"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/10 border-t border-border flex flex-col sm:flex-row justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-border cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="px-4 py-2 bg-primary hover:bg-opacity-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-white" />
            Copiar Link
          </button>
          
          <button
            type="button"
            onClick={handleCopyWhatsapp}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-white fill-white" />
            Copiar Ficha WhatsApp
          </button>
        </div>
      </motion.div>
    </div>
  );
}
