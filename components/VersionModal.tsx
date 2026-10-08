"use client";

import { useState } from "react";
import { 
  CheckCircle2, 
  Sparkles, 
  Wrench, 
  Zap, 
  ShieldCheck, 
  X, 
  Tag, 
  Calendar,
  Info
} from "lucide-react";
import { APP_VERSION, APP_VERSION_DATE, APP_VERSION_TITLE, VERSION_HISTORY } from "@/lib/version";

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VersionModal({ isOpen, onClose }: VersionModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<string>(APP_VERSION);

  if (!isOpen) return null;

  const activeRelease = VERSION_HISTORY.find(v => v.version === selectedVersion) || VERSION_HISTORY[0];

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] z-10 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Totalmente opaco e com alto contraste */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">SalesScore CRM</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white font-mono tracking-wide shadow-xs">
                  {APP_VERSION}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Ativa
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                Atualizado em {APP_VERSION_DATE} • {APP_VERSION_TITLE}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas de Navegação de Histórico de Versões */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 overflow-x-auto text-xs font-medium shrink-0">
          <span className="text-slate-500 dark:text-slate-400 mr-1 text-[11px] uppercase tracking-wider font-bold">Histórico:</span>
          {VERSION_HISTORY.map((rel) => {
            const isSelected = selectedVersion === rel.version;
            return (
              <button
                key={rel.version}
                onClick={() => setSelectedVersion(rel.version)}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-mono text-xs ${
                  isSelected
                    ? "bg-blue-600 text-white font-bold shadow-xs border border-blue-600"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <span>{rel.version}</span>
                {rel.version === APP_VERSION && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-emerald-500"}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Corpo do Conteúdo - Fundo 100% Sólido */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm bg-white dark:bg-slate-900">
          {/* Banner da Versão Selecionada */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                {activeRelease.title}
              </h3>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 font-mono">
                {activeRelease.releaseDate}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Versão <strong className="font-mono text-slate-700 dark:text-slate-300">{activeRelease.version}</strong> ({activeRelease.type === 'major' ? 'Versão Principal' : activeRelease.type === 'minor' ? 'Melhorias e Recursos' : 'Correções e Ajustes'})
            </p>
          </div>

          {/* Destaques (Highlights) */}
          {activeRelease.highlights && activeRelease.highlights.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Principais Destaques
              </h4>
              <ul className="space-y-2">
                {activeRelease.highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Melhorias (Improvements) */}
          {activeRelease.improvements && activeRelease.improvements.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-blue-500" />
                Otimizações & Desempenho
              </h4>
              <ul className="space-y-2">
                {activeRelease.improvements.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed shadow-xs">
                    <Zap className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Correções (Bug Fixes) */}
          {activeRelease.fixes && activeRelease.fixes.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-500" />
                Correções de Bugs
              </h4>
              <ul className="space-y-2">
                {activeRelease.fixes.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed shadow-xs">
                    <Wrench className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Info Box */}
          <div className="p-3.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <p>
              O SalesScore é atualizado continuamente. Cada correção de bug ou nova funcionalidade gera um incremento de versão com histórico preservado.
            </p>
          </div>
        </div>

        {/* Rodapé - Totalmente Opaco */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Ambiente Seguro • Supabase Cloud</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
