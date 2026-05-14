"use client";

import { useState } from "react";
import { Sparkles, Loader2, Wand2, X } from "lucide-react";
import { safeAiCall } from "@/lib/ai";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { toast } from "sonner";

interface AIMessageDrafterProps {
  partnerName: string;
  onSelect: (draft: string) => void;
  onClose: () => void;
}

export function AIMessageDrafter({ partnerName, onSelect, onClose }: AIMessageDrafterProps) {
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("follow-up");
  const [tone, setTone] = useState("professional");

  const generateDraft = async () => {
    setLoading(true);
    try {
      const prompt = `
        Aja como um corretor imobiliário de luxo. 
        Escreva uma mensagem de WhatsApp para o cliente ${partnerName}.
        Tópico: ${topic === 'follow-up' ? 'Acompanhamento de interesse' : topic === 'scheduling' ? 'Agendamento de visita' : 'Parabéns pelo novo imóvel'}
        Tom: ${tone === 'professional' ? 'Elegante e polido' : tone === 'friendly' ? 'Próximo e caloroso' : 'Direto e urgente'}
        
        A mensagem deve ser CURTA, ENGANJADORA e terminar com um CTA (Chamada para ação).
        Não use placeholders como [Nome], use o nome ${partnerName} diretamente.
        Mantenha em português brasileiro.
      `;

      const result = await safeAiCall(prompt, "");

      if (result.isError && result.errorType === 'quota') {
        toast.error("Limite de uso da IA atingido. Tente novamente mais tarde.");
      }

      if (result.text) {
        onSelect(result.text);
      } else {
        toast.error("Não foi possível gerar a mensagem. Tente novamente.");
      }
    } catch (error: any) {
      console.error("Gemini Drafter Error:", error);
      toast.error("Erro na inteligência artificial. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-full mb-4 right-0 w-80 bg-card border border-border rounded-[32px] shadow-2xl overflow-hidden z-50 transition-colors"
    >
      <div className="p-6 border-b border-border bg-primary/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-black uppercase tracking-widest">Redator IA</h4>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-3">Tópico</label>
          <div className="flex flex-wrap gap-2">
            {['follow-up', 'scheduling', 'congrats'].map(t => (
              <button 
                key={t}
                onClick={() => setTopic(t)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all border",
                  topic === t ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-transparent hover:border-border"
                )}
              >
                {t === 'follow-up' ? 'Follow-up' : t === 'scheduling' ? 'Agendamento' : 'Sucesso'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-3">Tom de Voz</label>
          <div className="flex flex-wrap gap-2">
            {['professional', 'friendly', 'urgent'].map(t => (
              <button 
                key={t}
                onClick={() => setTone(t)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all border",
                  tone === t ? "bg-indigo-500 text-white border-indigo-500" : "bg-muted text-muted-foreground border-transparent hover:border-border"
                )}
              >
                {t === 'professional' ? 'Profissional' : t === 'friendly' ? 'Amigável' : 'Direto'}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={generateDraft}
          disabled={loading}
          className="w-full py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Gerar Mensagem
        </button>
      </div>
    </motion.div>
  );
}
