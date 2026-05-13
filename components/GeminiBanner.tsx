"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GoogleGenAI } from "@google/genai";
import { Sparkles, Brain, Loader2, Info } from "lucide-react";
import { Activity, Deal } from "@/lib/db";
import { motion, AnimatePresence } from "framer-motion";
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
  const rotationInterval = useRef<NodeJS.Timeout | null>(null);

  const generateInsight = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! });
      
      const pendingActivities = activities.filter(a => a.status === 'pending');
      const criticalDeals = deals.filter(d => d.value > 100000 && d.stage !== 'closed');
      
      const context = {
        pendingTasks: pendingActivities.map(a => ({ title: a.title, type: a.type, date: a.date })),
        highValueDeals: criticalDeals.map(d => ({ title: d.title, value: d.value, stage: d.stage })),
      };

      const prompt = `
        Analise estas tarefas e negócios de um CRM imobiliário e dê TRÊS dicas estratégicas CURTAS (máximo 120 caracteres cada) e diferentes sobre o que priorizar.
        Retorne apenas as dicas separadas por ponto e vírgula (;).
        Seja direto, profissional e motivador.
        Contexto: ${JSON.stringify(context)}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      const text = response.text || "";
      const newInsights = text.split(';').map(s => s.trim()).filter(s => s.length > 10);
      
      if (newInsights.length > 0) {
        setInsights(newInsights);
        setCurrentIndex(0);
      }
    } catch (error: any) {
      console.error("Gemini Error:", error);
      if (error?.message?.includes("quota") || error?.message?.includes("429") || error?.status === 429 || error?.message?.includes("RESOURCE_EXHAUSTED")) {
        setInsights(["A IA está descansando um pouco. Volte em breve para novos insights!"]);
      }
    } finally {
      setLoading(false);
    }
  }, [activities, deals, loading]); // Added back missing dependencies

  useEffect(() => {
    if (activities.length > 0) {
      generateInsight();
    }
  }, [activities.length, generateInsight]);

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
            {insights.length > 1 && (
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">
                {currentIndex + 1}/{insights.length}
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
            onClick={generateInsight}
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
