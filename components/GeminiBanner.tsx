"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sparkles, Brain, Loader2, Info, AlertCircle } from "lucide-react";
import { Activity, Deal } from "@/lib/db";
import { safeAiCall } from "@/lib/ai";
import { safeGetJson, safeSetJson } from "@/lib/safe-storage";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface GeminiBannerProps {
  activities: Activity[];
  deals: Deal[];
}

const DEFAULT_INSIGHTS = [
  "Foque nos negócios de maior valor que têm visitas agendadas hoje.",
  "Mantenha o ritmo! Pequenas tarefas concluídas geram grandes resultados.",
  "Dê uma olhada especial nos leads que não recebem contato há mais de 3 dias."
];

export function GeminiBanner({ activities, deals }: GeminiBannerProps) {
  const [insights, setInsights] = useState<string[]>(DEFAULT_INSIGHTS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [quotaError, setQuotaError] = useState(false);
  const rotationInterval = useRef<NodeJS.Timeout | null>(null);
  const hasGeneratedRef = useRef(false);

  const generateInsight = useCallback(async (manual = false) => {
    if (loading) return;

    if (!manual) {
      const cached = safeGetJson<{ list: string[]; timestamp: number }>("activities_ai_insights");
      if (cached) {
        const { list, timestamp } = cached;
        const age = Date.now() - timestamp;
        if (age < 3600000 && Array.isArray(list) && list.length > 0) {
          setInsights(list);
          setCurrentIndex(0);
          hasGeneratedRef.current = true;
          return;
        }
      }
    }

    setLoading(true);
    setQuotaError(false);

    try {
      const pendingActivities = activities.filter(a => a.status === 'pending');
      const criticalDeals = deals.filter(d => d.value > 100000 && d.stage !== 'closed');
      
      const context = {
        pendingTasks: pendingActivities.map(a => ({ 
          title: a.title, 
          type: a.type === 'meeting' ? 'Reunião' : a.type === 'task' ? 'Tarefa' : a.type === 'call' ? 'Ligação' : 'Outro', 
          date: a.date 
        })),
        highValueDeals: criticalDeals.map(d => ({ 
          title: d.title, 
          value: d.value, 
          stage: d.stage === 'lead' ? 'Novo Lead' : d.stage === 'qualification' ? 'Qualificação' : d.stage === 'proposal' ? 'Proposta' : d.stage === 'negotiation' ? 'Análise Jurídica' : d.stage === 'closed' ? 'Vendido/Alugado' : d.stage 
        })),
      };

      const prompt = `
        Analise estas tarefas e negócios de um CRM imobiliário e dê TRÊS dicas estratégicas CURTAS (máximo 120 caracteres cada) e diferentes sobre o que priorizar.
        Retorne apenas as dicas separadas por ponto e vírgula (;).
        Seja direto, profissional e motivador.
        Contexto: ${JSON.stringify(context)}
      `;

      const result = await safeAiCall(prompt, DEFAULT_INSIGHTS.join('; '));

      if (result.isError && result.errorType === 'quota') {
        setQuotaError(true);
      }

      if (result.text) {
        const newInsights = result.text.split(';').map(s => s.trim()).filter(s => s.length > 5);
        if (newInsights.length > 0) {
          const finalInsights = newInsights.slice(0, 3);
          setInsights(finalInsights);
          setCurrentIndex(0);
          hasGeneratedRef.current = true;
          safeSetJson("activities_ai_insights", {
            list: finalInsights,
            timestamp: Date.now()
          });
        }
      }
    } catch (error: any) {
      console.error("Gemini UI Error:", error);
    } finally {
      setLoading(false);
    }
  }, [loading, activities, deals]); 

  useEffect(() => {
    // Only trigger once when data first arrives
    if (activities.length > 0 && !hasGeneratedRef.current && !loading && !quotaError) {
      generateInsight(false);
    }
  }, [activities.length, generateInsight, loading, quotaError]);

  useEffect(() => {
    // Rotation logic - 20 seconds as requested
    rotationInterval.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % insights.length);
    }, 20000);

    return () => {
      if (rotationInterval.current) clearInterval(rotationInterval.current);
    };
  }, [insights.length]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-primary/95 via-indigo-600/95 to-primary px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl shadow-xs text-white relative overflow-hidden group shrink-0 border border-white/10"
    >
      <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
        <Brain className="w-20 h-20" />
      </div>
      
      <div className="relative z-10 flex items-center gap-2.5 sm:gap-3">
        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center shrink-0">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-200" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/80">
              Insight Inteligente
            </span>
            {insights.length > 1 && !quotaError && (
              <span className="bg-white/20 px-1 py-0.2 rounded text-[8px] font-bold">
                {currentIndex + 1}/{insights.length}
              </span>
            )}
            {quotaError && (
              <span className="bg-red-500/80 text-white px-1.5 py-0.2 rounded text-[8px] font-bold flex items-center gap-1">
                <AlertCircle className="w-2.5 h-2.5" />
                Dica Padrão
              </span>
            )}
          </div>
          
          <div className="h-5 sm:h-6 relative overflow-hidden flex items-center">
            <AnimatePresence mode="wait">
              <motion.p 
                key={currentIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="text-xs sm:text-[13px] font-bold truncate leading-tight text-white/95"
                title={insights[currentIndex]}
              >
                {insights[currentIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button 
            type="button"
            onClick={() => setCurrentIndex(prev => (prev - 1 + insights.length) % insights.length)}
            className="p-1 sm:p-1.5 hover:bg-white/15 rounded-lg transition-all text-white/80 hover:text-white cursor-pointer"
            title="Dica anterior"
          >
            <Info className="w-3.5 h-3.5 rotate-180" />
          </button>
          <button 
            type="button"
            onClick={() => generateInsight(true)}
            className="p-1 sm:p-1.5 hover:bg-white/15 rounded-lg transition-all text-white/80 hover:text-white cursor-pointer"
            title="Atualizar insight com IA"
          >
            <Loader2 className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Progress Bar for rotation */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-white/20 w-full overflow-hidden">
        <motion.div 
          key={currentIndex}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 20, ease: "linear" }}
          className="h-full bg-white/60"
        />
      </div>
    </motion.div>
  );
}
