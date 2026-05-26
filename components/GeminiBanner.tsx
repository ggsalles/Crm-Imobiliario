"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sparkles, Brain, Loader2, Info, AlertCircle } from "lucide-react";
import { Activity, Deal } from "@/lib/db";
import { safeAiCall } from "@/lib/ai";
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
      const cached = localStorage.getItem("activities_ai_insights");
      if (cached) {
        try {
          const { list, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < 3600000 && Array.isArray(list) && list.length > 0) {
            setInsights(list);
            setCurrentIndex(0);
            hasGeneratedRef.current = true;
            return;
          }
        } catch (e) {
          // ignore
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
          try {
            localStorage.setItem("activities_ai_insights", JSON.stringify({
              list: finalInsights,
              timestamp: Date.now()
            }));
          } catch (e) {
            // ignore
          }
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
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-primary to-indigo-600 p-6 rounded-[24px] shadow-lg shadow-primary/20 text-white mb-8 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
        <Brain className="w-32 h-32" />
      </div>
      
      <div className="relative z-10 flex items-center gap-4 min-h-[4rem] py-1">
        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Sparkles className="w-6 h-6" />
          )}
        </div>
        
        <div className="flex-1 overflow-hidden">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1 flex items-center gap-2">
            Insight Inteligente
            {insights.length > 1 && !quotaError && (
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">
                {currentIndex + 1}/{insights.length}
              </span>
            )}
            {quotaError && (
              <span className="bg-red-200 text-red-700 px-1.5 py-0.5 rounded text-[8px] flex items-center gap-1">
                <AlertCircle className="w-2 h-2" />
                Limite da IA atingido - Dicas Padrão
              </span>
            )}
          </h3>
          
          <div className="relative min-h-[6rem]">
            <AnimatePresence mode="wait">
              <motion.p 
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="text-lg font-bold leading-snug max-w-2xl absolute inset-0 flex items-center pr-12 pb-2"
              >
                {insights[currentIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex gap-1 ml-auto">
          <button 
            onClick={() => setCurrentIndex(prev => (prev - 1 + insights.length) % insights.length)}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
            title="Anterior"
          >
            <Info className="w-4 h-4 opacity-50 rotate-180" />
          </button>
          <button 
            onClick={() => generateInsight(true)}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
            title="Gerar novos insights"
          >
            <Loader2 className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Progress Bar for rotation */}
      <div className="absolute bottom-0 left-0 h-1 bg-white/20 w-full overflow-hidden">
        <motion.div 
          key={currentIndex}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 20, ease: "linear" }}
          className="h-full bg-white/40"
        />
      </div>
    </motion.div>
  );
}
