"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { 
  Globe, 
  X, 
  Building2, 
  Share2, 
  Check, 
  Copy, 
  MessageSquare, 
  ExternalLink, 
  Sparkles 
} from "lucide-react";
import { recordAuditEvent } from "@/lib/audit";
import { toast } from "sonner";

interface VitrineShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
}

export function VitrineShareModal({ isOpen, onClose, profile }: VitrineShareModalProps) {
  const [vitrineShareMode, setVitrineShareMode] = useState<'tenant' | 'broker'>('tenant');

  if (!isOpen) return null;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const currentUrl = vitrineShareMode === 'broker' && profile?.id
    ? (profile?.tenantId ? `${baseUrl}/vitrine?tenant=${profile.tenantId}&broker=${profile.id}` : `${baseUrl}/vitrine?broker=${profile.id}`)
    : (profile?.tenantId ? `${baseUrl}/vitrine?tenant=${profile.tenantId}` : `${baseUrl}/vitrine`);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    toast.success("Link da vitrine copiado!");
    recordAuditEvent({
      action: 'SHARE_PROPERTY_LINK',
      title: 'Link da Vitrine Copiado',
      content: `Link da vitrine pública de imóveis copiado (${vitrineShareMode === 'broker' ? 'modo corretor' : 'modo geral'}).`,
      severity: 'low',
      category: 'modification',
      metadata: {
        type: 'vitrine_url',
        mode: vitrineShareMode,
        url: currentUrl
      }
    });
  };

  const handleSendWhatsapp = () => {
    const msg = vitrineShareMode === 'broker'
      ? `🏡 *Conheça meu Catálogo Exclusivo de Imóveis!*\n\nOlá! Selecionei as melhores opções disponíveis atualizadas em tempo real. Acesse e confira fotos, valores e detalhes:\n👉 ${currentUrl}\n\nFico à total disposição para agendarmos visitas!`
      : `🏡 *Vitrine de Imóveis - Conheça Nossa Carteira!*\n\nConfira todos os imóveis disponíveis atualizados em tempo real com fotos em alta resolução e condições exclusivas:\n👉 ${currentUrl}`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold text-foreground uppercase tracking-tight flex items-center gap-2">
                Vitrine Pública de Imóveis
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                  Ao Vivo
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Compartilhe seu catálogo virtual exclusivo com clientes e compradores
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Selector Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
              Tipo de Compartilhamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVitrineShareMode('tenant')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  vitrineShareMode === 'tenant'
                    ? 'bg-primary/5 border-primary text-foreground shadow-xs'
                    : 'bg-card border-border hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Building2 className={`w-4 h-4 ${vitrineShareMode === 'tenant' ? 'text-primary' : 'text-muted-foreground'}`} />
                  {vitrineShareMode === 'tenant' && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
                <h4 className="text-xs font-bold text-foreground">Imobiliária Geral</h4>
                <p className="text-[10px] text-muted-foreground">Toda a carteira de imóveis da empresa</p>
              </button>

              <button
                type="button"
                onClick={() => setVitrineShareMode('broker')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  vitrineShareMode === 'broker'
                    ? 'bg-primary/5 border-primary text-foreground shadow-xs'
                    : 'bg-card border-border hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Share2 className={`w-4 h-4 ${vitrineShareMode === 'broker' ? 'text-primary' : 'text-muted-foreground'}`} />
                  {vitrineShareMode === 'broker' && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
                <h4 className="text-xs font-bold text-foreground">Meu Link de Corretor</h4>
                <p className="text-[10px] text-muted-foreground">Seu WhatsApp e contato em destaque</p>
              </button>
            </div>
          </div>

          {/* Link Preview and Copy */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
              Link da Vitrine
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs font-mono text-foreground outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3.5 py-2 bg-primary text-white hover:opacity-90 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </button>
            </div>
          </div>

          {/* Direct Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleSendWhatsapp}
              className="p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-2.5 text-left transition-all cursor-pointer"
            >
              <MessageSquare className="w-5 h-5 shrink-0 fill-current" />
              <div>
                <h4 className="text-xs font-bold">Enviar no WhatsApp</h4>
                <p className="text-[10px] text-muted-foreground">Mensagem pronta com link para seus contatos</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => window.open(currentUrl, '_blank')}
              className="p-3 rounded-xl bg-muted/40 hover:bg-muted text-foreground border border-border flex items-center gap-2.5 text-left transition-all cursor-pointer"
            >
              <ExternalLink className="w-5 h-5 shrink-0 text-primary" />
              <div>
                <h4 className="text-xs font-bold">Abrir Vitrine</h4>
                <p className="text-[10px] text-muted-foreground">Ver como o cliente enxerga no navegador</p>
              </div>
            </button>
          </div>

          {/* Best Practice Tip */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-snug text-[11px]">
              <strong>Dica de Alta Conversão:</strong> Adicione esse link na Bio do seu Instagram (ou no seu Linktree) e no status do WhatsApp. Seus clientes consultarão os imóveis sem precisar de site externo e os leads cairão direto no seu pipeline!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/10 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-border cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
