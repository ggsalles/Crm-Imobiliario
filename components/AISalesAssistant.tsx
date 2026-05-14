"use client";

import { useState } from "react";
import { Sparkles, Brain, Loader2, Target, TrendingUp, Lightbulb } from "lucide-react";
import { Deal, Contact, Company } from "@/lib/db";
import { safeAiCall } from "@/lib/ai";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AISalesAssistantProps {
  deal: Deal;
  contact?: Contact | null;
  company?: Company | null;
}

export function AISalesAssistant({ deal, contact, company }: AISalesAssistantProps) {
  const [strategy, setStrategy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateStrategy = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const context = {
        deal: {
          title: deal.title,
          value: deal.value,
          stage: deal.stage === 'lead' ? 'Novo Lead' :
                 deal.stage === 'qualification' ? 'Qualificação' :
                 deal.stage === 'proposal' ? 'Proposta' :
                 deal.stage === 'negotiation' ? 'Análise Jurídica' :
                 deal.stage === 'closed' ? 'Vendido/Alugado' : deal.stage,
          probability: deal.probability
        },
        contact: contact ? { name: contact.name, role: contact.role } : "N/A",
        company: company ? { name: company.name, industry: company.industry } : "N/A"
      };

      const prompt = `
        Aja como um Senior Sales Coach especializado no mercado imobiliário brasileiro.
        Analise este negócio e crie uma estratégia de fechamento "matadora".
        Forneça:
        1. "O Gancho": Uma frase de abertura ou abordagem baseada no valor.
        2. "Ação Sugerida": O próximo passo técnico/estratégico.
        3. "Objeção Provável": Que barreira este cliente pode colocar e como contornar.
        
        Mantenha o tom profissional, direto e agressivo (focado em vendas).
        Negócio: ${JSON.stringify(context)}
        
        Formate a resposta em Markdown curto.
      `;

      const result = await safeAiCall(prompt, "Foque na construção de valor e no agendamento de uma visita presencial para acelerar o fechamento.");
      
      if (result.isError && result.errorType === 'quota') {
        toast.error("Capacidade da IA temporariamente excedida.");
      }
      
      setStrategy(result.text);
    } catch (error: any) {
      console.error("Gemini Assistant Error:", error);
      setStrategy("Foque no relacionamento e na demonstração técnica do imóvel.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-[32px] border border-border overflow-hidden shadow-md transition-colors">
      <div className="p-8 border-b border-border flex items-center justify-between bg-indigo-500/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Vendas Inteligentes</h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Coaching de Vendas by AI</p>
          </div>
        </div>
        <button 
          onClick={generateStrategy}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {strategy ? "Atualizar Estratégia" : "Gerar Estratégia"}
        </button>
      </div>

      <div className="p-8">
        <AnimatePresence mode="wait">
          {!strategy && !loading ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 space-y-4"
            >
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto opacity-50">
                <Target className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-muted-foreground font-bold">Pronto para acelerar este fechamento?</p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px] mx-auto">
                  Deixe nossa IA analisar os dados e sugerir o melhor caminho.
                </p>
              </div>
            </motion.div>
          ) : loading ? (
            <div className="space-y-4">
              <div className="h-4 bg-muted rounded-lg w-3/4 animate-pulse" />
              <div className="h-4 bg-muted rounded-lg w-full animate-pulse" />
              <div className="h-4 bg-muted rounded-lg w-5/6 animate-pulse" />
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="prose prose-sm prose-invert max-w-none prose-p:text-muted-foreground prose-strong:text-foreground prose-h4:text-foreground prose-h4:text-base prose-h4:font-black prose-h4:uppercase prose-h4:tracking-tight"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="p-4 bg-muted rounded-2xl border border-border">
                  <TrendingUp className="w-5 h-5 text-indigo-500 mb-2" />
                  <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Potencial</p>
                  <p className="text-sm font-bold">Alta Conversão</p>
                </div>
                <div className="p-4 bg-muted rounded-2xl border border-border">
                  <Lightbulb className="w-5 h-5 text-amber-500 mb-2" />
                  <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Foco</p>
                  <p className="text-sm font-bold">Construção de Valor</p>
                </div>
                <div className="p-4 bg-muted rounded-2xl border border-border">
                  <Target className="w-5 h-5 text-emerald-500 mb-2" />
                  <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Status</p>
                  <p className="text-sm font-bold">Fase de Persuasão</p>
                </div>
              </div>
              
              <div className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {strategy}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
