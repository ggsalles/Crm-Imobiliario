"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { 
  Share2, 
  X, 
  ExternalLink, 
  Copy, 
  MessageCircle, 
  Printer, 
  Phone 
} from "lucide-react";
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
  const [recipientPhone, setRecipientPhone] = useState("");

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
      entityType: 'property',
      metadata: {
        propertyTitle: property.title,
        type: 'whatsapp'
      }
    });
  };

  const handleSendWhatsapp = () => {
    const encoded = encodeURIComponent(sharingText);
    const cleanPhone = recipientPhone.replace(/\D/g, "");
    
    let url: string;
    if (cleanPhone.length >= 10) {
      const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      url = `https://wa.me/${fullPhone}?text=${encoded}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encoded}`;
    }

    window.open(url, "_blank", "noopener,noreferrer");

    recordAuditEvent({
      action: 'SHARE_PROPERTY_LINK',
      title: 'Ficha Enviada via WhatsApp',
      content: `Ficha do imóvel "${property.title}" enviada diretamente via WhatsApp${cleanPhone ? ` para ${cleanPhone}` : ''}.`,
      severity: 'low',
      category: 'modification',
      relatedId: property.id,
      entityType: 'property',
      metadata: {
        propertyTitle: property.title,
        recipient: cleanPhone || 'geral'
      }
    });
  };

  const handlePrintTechnicalSheet = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Por favor, permita pop-ups para imprimir a ficha.");
      return;
    }

    const priceFormatted = new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL', 
      maximumFractionDigits: 0 
    }).format(property.price);

    const publicUrl = `${window.location.origin}/p/${property.id}`;
    const coverPhoto = property.imageUrls && property.imageUrls[0] 
      ? property.imageUrls[0] 
      : 'https://picsum.photos/seed/realestate/800/600';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Ficha Técnica - ${property.title}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 30px; background: #fff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px; }
          .logo { font-size: 20px; font-weight: 900; color: #1e293b; }
          .badge { background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
          .title-area { margin-bottom: 15px; }
          .title { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
          .location { font-size: 13px; color: #64748b; }
          .cover { width: 100%; height: 260px; object-fit: cover; border-radius: 12px; margin-bottom: 20px; }
          .grid { display: grid; grid-cols: repeat(4, 1fr); display: flex; gap: 15px; margin-bottom: 20px; background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; }
          .metric { flex: 1; text-align: center; }
          .metric-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .metric-val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px; }
          .price-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .price-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #1e40af; }
          .price-val { font-size: 24px; font-weight: 900; color: #1d4ed8; }
          .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; color: #334155; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          .desc { font-size: 12px; color: #475569; white-space: pre-line; margin-bottom: 20px; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">SalesScore CRM</div>
          <span class="badge">${property.referenceCode || (property as any).reference_code ? `Ref: ${property.referenceCode || (property as any).reference_code} • ` : ''}${property.type}</span>
        </div>
        <div class="title-area">
          ${property.referenceCode || (property as any).reference_code ? `<div style="font-size: 12px; font-weight: 800; color: #2563eb; font-family: monospace; text-transform: uppercase; margin-bottom: 2px;">CÓDIGO DE REFERÊNCIA: ${property.referenceCode || (property as any).reference_code}</div>` : ''}
          <h1 class="title">${property.title}</h1>
          <p class="location">📍 ${property.location || "Localização sob consulta"}</p>
        </div>
        <img src="${coverPhoto}" class="cover" alt="${property.title}" />
        <div class="grid">
          <div class="metric"><div class="metric-label">Quartos</div><div class="metric-val">${property.bedrooms || 0}</div></div>
          <div class="metric"><div class="metric-label">Banheiros</div><div class="metric-val">${property.bathrooms || 0}</div></div>
          <div class="metric"><div class="metric-label">Vagas</div><div class="metric-val">${property.parkingSpots || 0}</div></div>
          <div class="metric"><div class="metric-label">Área Útil</div><div class="metric-val">${property.area || 0} m²</div></div>
        </div>
        <div class="price-box">
          <div>
            <div class="price-title">Valor de Venda</div>
            <div class="price-val">${priceFormatted}</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #1e40af;">
            ${property.acceptsFinancing ? '✓ Aceita Financiamento Bancário' : ''}
          </div>
        </div>
        <div class="section-title">Descrição & Detalhes</div>
        <p class="desc">${property.description || "Entre em contato conosco para agendar uma visita e obter o dossiê detalhado deste imóvel."}</p>
        <div class="footer">
          <span>Gerado por SalesScore CRM</span>
          <span>Acesse a vitrine digital: ${publicUrl}</span>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
                Envio direto via WhatsApp ou Ficha Técnica em PDF
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
          {/* Direct WhatsApp recipient field */}
          <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/15 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                WhatsApp do Cliente (Opcional para envio direto)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="Ex: (11) 98765-4321 ou deixe vazio para escolher o contato no WhatsApp"
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/40 text-xs outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                type="button"
                onClick={handleSendWhatsapp}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Abrir WhatsApp diretamente com esta mensagem"
              >
                <MessageCircle className="w-3.5 h-3.5 fill-white" />
                <span>Enviar</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pl-0.5">
                Visualização e Edição da Ficha
              </label>
              <span className="text-[10px] text-muted-foreground">
                Edite livremente antes de enviar ou copiar
              </span>
            </div>
            <textarea
              value={sharingText}
              onChange={(e) => setSharingText(e.target.value)}
              rows={8}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-mono leading-relaxed resize-y"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/10 border-t border-border flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintTechnicalSheet}
              className="px-3 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Visualizar e imprimir ficha técnica limpa em PDF"
            >
              <Printer className="w-3.5 h-3.5 text-primary" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Copiar link da página de captura"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              <span>Copiar Link</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyWhatsapp}
              className="px-3 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Copiar Texto</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsapp}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-white" />
              <span>Abrir WhatsApp</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
