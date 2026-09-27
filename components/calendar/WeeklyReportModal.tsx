"use client";

import { memo } from "react";
import { 
  X, 
  TrendingUp, 
  Sparkles, 
  RefreshCw, 
  Loader2, 
  Calendar as CalendarIcon, 
  Clock, 
  Check 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarEventItem } from "@/lib/calendar-export";

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  weeklyEvents: CalendarEventItem[];
  sortedWeeklyEvents: CalendarEventItem[];
  aiReport: string;
  aiReportLoading: boolean;
  onRegenerateReport: () => void;
}

export const WeeklyReportModal = memo(function WeeklyReportModal({
  isOpen,
  onClose,
  weeklyEvents,
  sortedWeeklyEvents,
  aiReport,
  aiReportLoading,
  onRegenerateReport,
}: WeeklyReportModalProps) {
  if (!isOpen) return null;

  const total = weeklyEvents.length;
  const completed = weeklyEvents.filter(e => e.status === "completed").length;
  const pending = total - completed;
  const performancePct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const renderBoldText = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    if (parts.length === 1) return text;
    
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <strong key={i} className="font-semibold text-white bg-white/10 px-1 py-0.5 rounded text-[11px]">
            {part}
          </strong>
        );
      }
      return part;
    });
  };

  const renderFormattedReport = (text: string) => {
    if (!text) return null;
    
    const lines = text.split("\n");
    return (
      <div className="space-y-4 text-xs leading-relaxed text-slate-300">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;
          
          if (trimmed.startsWith("###") || trimmed.startsWith("##") || trimmed.startsWith("#")) {
            const headingText = trimmed.replace(/^[#\s]+/, "");
            return (
              <h4 key={idx} className="text-xs font-black text-white uppercase tracking-wider font-mono pt-4 pb-1 border-b border-white/5 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-primary rounded-full animate-pulse" />
                {headingText}
              </h4>
            );
          }
          
          if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            const itemText = trimmed.replace(/^[-*]\s*/, "");
            return (
              <li key={idx} className="list-none pl-6 relative text-slate-300 py-0.5">
                <span className="absolute left-1.5 top-2.5 w-1.5 h-1.5 rounded-full bg-primary" />
                {renderBoldText(itemText)}
              </li>
            );
          }
          
          if (/^\d+\.\s/.test(trimmed)) {
            const itemText = trimmed.replace(/^\d+\.\s*/, "");
            const number = trimmed.match(/^\d+/)?.[0];
            return (
              <div key={idx} className="flex gap-3 text-slate-300 py-1">
                <span className="shrink-0 w-5 h-5 rounded-md bg-white/10 text-white text-[10px] font-black flex items-center justify-center font-mono border border-white/10">
                  {number}
                </span>
                <p className="flex-1 mt-0.5 leading-normal">{renderBoldText(itemText)}</p>
              </div>
            );
          }
          
          return <p key={idx} className="text-slate-300">{renderBoldText(trimmed)}</p>;
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Dark blur backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        />
        
        {/* Modal Box */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="relative w-full max-w-4xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden z-10 flex flex-col max-h-[90vh] text-white"
        >
          {/* Header Gradient Glow */}
          <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Modal Title Bar */}
          <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40 relative z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <TrendingUp className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black uppercase tracking-tight font-sans">
                  Relatório de Desempenho Semanal
                </h3>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">
                  Análise de Produtividade & IA Prep
                </p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-slate-800/40 hover:bg-slate-800 rounded-xl transition-all border border-slate-800/60 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 relative z-10">
            {/* PRODUCTIVITY GRID METRICS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Compromissos</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-black">{total}</span>
                  <span className="text-xs text-slate-500 font-mono">Agendas</span>
                </div>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-emerald-800/40 transition-colors">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Compromissos Concluídos</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-black text-emerald-400">{completed}</span>
                  <span className="text-xs text-emerald-500 font-semibold font-mono">Sim</span>
                </div>
              </div>

              <div className="bg-amber-950/15 border border-amber-900/25 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-amber-800/30 transition-colors">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Atividades Pendentes</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-black text-amber-400">{pending}</span>
                  <span className="text-xs text-amber-500 font-mono">Em aberto</span>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-primary/20 transition-colors">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Aproveitamento Geral</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-black text-primary">{performancePct}%</span>
                  <span className="text-xs text-primary/70 font-bold font-mono">Meta: 80%</span>
                </div>
              </div>
            </div>

            {/* TWO-COLUMN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left panel: Gemini Advisor */}
              <div className="lg:col-span-7 bg-slate-950/60 border border-slate-800 rounded-3xl p-5 md:p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Sparkles className="w-32 h-32 text-white" />
                </div>

                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-white font-mono">
                      Orientador Imobiliário IA (Gemini)
                    </h4>
                  </div>
                  
                  <button
                    type="button"
                    onClick={onRegenerateReport}
                    disabled={aiReportLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-[10px] rounded-xl font-bold uppercase tracking-wider transition-colors cursor-pointer border border-slate-700"
                  >
                    <RefreshCw className={cn("w-3 h-3", aiReportLoading && "animate-spin")} />
                    Refazer com IA
                  </button>
                </div>

                {/* Report Text Content Area */}
                <div className="min-h-[220px] relative">
                  {aiReportLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 space-y-4">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-[11px] font-mono uppercase tracking-widest text-slate-400 animate-pulse">
                        IA analisando agendas de vendas...
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {renderFormattedReport(aiReport)}
                    </div>
                  )}
                </div>
              </div>

              {/* Right panel: Weekly Schedule Summary */}
              <div className="lg:col-span-5 bg-slate-950/40 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 font-mono">
                      Agenda Semanal Simplificada
                    </h4>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase font-mono tracking-widest">
                    Compromissos
                  </span>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                  {sortedWeeklyEvents.length > 0 ? (
                    sortedWeeklyEvents.map((e, idx) => {
                      const dateObj = e.date instanceof Date ? e.date : parseISO(e.date as string);
                      const dayName = format(dateObj, "eee", { locale: ptBR });
                      
                      return (
                        <div 
                          key={e.id || idx}
                          className={cn(
                            "p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all",
                            e.status === "completed"
                              ? "bg-slate-900/30 border-slate-850 opacity-60"
                              : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 w-10 bg-slate-800 rounded-lg text-center flex flex-col items-center justify-center border border-slate-700 shrink-0 select-none">
                              <span className="text-[9px] text-primary font-black uppercase tracking-wider font-mono">{dayName}</span>
                              <span className="text-xs font-extrabold mt-0.5">{format(dateObj, "d")}</span>
                            </div>
                            
                            <div className="min-w-0">
                              <p className={cn(
                                "text-xs font-bold leading-tight truncate text-slate-200",
                                e.status === "completed" && "line-through text-slate-400"
                              )}>
                                {e.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-semibold">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <span>{e.time}</span>
                                <span>&bull;</span>
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                                  e.type === "Visita" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                  e.type === "Reunião" ? "bg-primary/10 text-primary border-primary/20" :
                                  "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                )}>
                                  {e.type}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {e.status === "completed" ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-slate-500">
                      <p className="text-xs font-semibold">Sem compromissos nesta semana.</p>
                      <p className="text-[10px] text-slate-600 mt-1">Sua rotina está livre de obrigações agendadas.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-slate-500 shrink-0 relative z-10">
            <span className="text-[9px] font-mono tracking-widest uppercase font-black">
              SalesScore Intelligence &copy; 2026
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-[10px] uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer shadow-lg shadow-primary/20"
            >
              Concluir Leitura
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});
