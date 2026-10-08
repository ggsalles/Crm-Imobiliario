"use client";

import { useState } from "react";
import { 
  CheckCircle2, 
  Sparkles, 
  Wrench, 
  Zap, 
  ShieldCheck, 
  RotateCw, 
  X, 
  Tag, 
  Calendar,
  Layers,
  Info
} from "lucide-react";
import { APP_VERSION, APP_VERSION_DATE, APP_VERSION_TITLE, VERSION_HISTORY, VersionRelease } from "@/lib/version";

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border bg-muted/30 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">SalesScore CRM</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground tracking-wide">
                  {APP_VERSION}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Ativa
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Atualizado em {APP_VERSION_DATE} • {APP_VERSION_TITLE}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/80 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs for Versions */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border bg-muted/10 overflow-x-auto text-xs font-medium">
          <span className="text-muted-foreground mr-1 text-[11px] uppercase tracking-wider font-semibold">Histórico:</span>
          {VERSION_HISTORY.map((rel) => (
            <button
              key={rel.version}
              onClick={() => setSelectedVersion(rel.version)}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedVersion === rel.version
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span>{rel.version}</span>
              {rel.version === APP_VERSION && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Release Title Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                {activeRelease.title}
              </h3>
              <span className="text-xs text-muted-foreground font-medium">
                {activeRelease.releaseDate}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Versão {activeRelease.version} ({activeRelease.type === 'major' ? 'Versão Principal' : activeRelease.type === 'minor' ? 'Melhorias e Recursos' : 'Correções e Ajustes'})
            </p>
          </div>

          {/* Destaques (Highlights) */}
          {activeRelease.highlights && activeRelease.highlights.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Principais Destaques
              </h4>
              <ul className="space-y-2">
                {activeRelease.highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground/90 bg-muted/20 p-2.5 rounded-xl border border-border/50">
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
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-blue-500" />
                Otimizações & Desempenho
              </h4>
              <ul className="space-y-2">
                {activeRelease.improvements.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground/90 bg-muted/20 p-2.5 rounded-xl border border-border/50">
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
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-orange-500" />
                Correções de Bugs
              </h4>
              <ul className="space-y-2">
                {activeRelease.fixes.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground/90 bg-muted/20 p-2.5 rounded-xl border border-border/50">
                    <Wrench className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Info Box */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-start gap-2.5 text-xs text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <p>
              O SalesScore é atualizado continuamente. Cada correção de bug ou nova funcionalidade gera um incremento de versão com histórico preservado.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Ambiente Seguro • Supabase Cloud</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
