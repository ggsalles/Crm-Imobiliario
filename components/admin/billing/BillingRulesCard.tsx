"use client";

import { Clock, AlertTriangle, ShieldAlert } from "lucide-react";

interface BillingRulesCardProps {
  suttleStart: number;
  setSuttleStart: (val: number) => void;
  criticalStart: number;
  setCriticalStart: (val: number) => void;
  blockStart: number;
  setBlockStart: (val: number) => void;
  savingSettings: boolean;
  onSave: () => void;
}

export function BillingRulesCard({
  suttleStart,
  setSuttleStart,
  criticalStart,
  setCriticalStart,
  blockStart,
  setBlockStart,
  savingSettings,
  onSave
}: BillingRulesCardProps) {
  return (
    <section className="bg-slate-950/40 border border-slate-900/60 rounded-xl backdrop-blur-xl overflow-hidden shadow-xs p-3.5 sm:p-4 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900/60 pb-3 mb-3">
        <div>
          <h2 className="text-xs font-bold tracking-tight text-white uppercase font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Régua de Cobrança Automática & Tolerância
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Defina os prazos em dias após o vencimento (Dia D) para acionar cada alerta visual e o bloqueio automático.
          </p>
        </div>
        
        <button
          onClick={onSave}
          disabled={savingSettings}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs shrink-0 self-start sm:self-auto"
        >
          {savingSettings ? "Salvando..." : "Salvar Prazos Globais"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* Suttle Warning Card */}
        <div className="bg-slate-950/30 border border-slate-900/50 rounded-xl p-3 hover:border-slate-800 transition-all">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <Clock className="w-3 h-3" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-200">1. Aviso Sutil</h3>
              <span className="text-[9px] font-mono text-amber-400 font-bold uppercase tracking-wider">Banner no Menu Lateral</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
            Exibe um alerta discreto no menu lateral informando que o boleto do mês venceu.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-400">A partir de D+</span>
            <input
              type="number"
              min={1}
              max={15}
              value={suttleStart}
              onChange={(e) => setSuttleStart(parseInt(e.target.value) || 1)}
              className="w-12 text-center font-mono font-bold text-xs py-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-md focus:outline-none text-slate-100"
            />
            <span className="text-[10px] text-slate-500">dia(s) de atraso</span>
          </div>
        </div>

        {/* Critical Warning Card */}
        <div className="bg-slate-950/30 border border-slate-900/50 rounded-xl p-3 hover:border-slate-800 transition-all">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-orange-500/10 text-orange-400 rounded-lg border border-orange-500/20">
              <AlertTriangle className="w-3 h-3" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-200">2. Aviso Crítico</h3>
              <span className="text-[9px] font-mono text-orange-400 font-bold uppercase tracking-wider">Pop-up ao fazer Login</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
            Exibe uma barra em destaque no topo da tela com contagem regressiva para suspensão.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-400">A partir de D+</span>
            <input
              type="number"
              min={2}
              max={30}
              value={criticalStart}
              onChange={(e) => setCriticalStart(parseInt(e.target.value) || 5)}
              className="w-12 text-center font-mono font-bold text-xs py-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-md focus:outline-none text-slate-100"
            />
            <span className="text-[10px] text-slate-500">dia(s) de atraso</span>
          </div>
        </div>

        {/* Total Block Card */}
        <div className="bg-slate-950/30 border border-slate-900/50 rounded-xl p-3 hover:border-slate-800 transition-all">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
              <ShieldAlert className="w-3 h-3" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-200">3. Bloqueio Total</h3>
              <span className="text-[9px] font-mono text-rose-400 font-bold uppercase tracking-wider">Acesso Suspenso</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
            Bloqueia totalmente o acesso de todos os corretores e administradores da imobiliária.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-400">A partir de D+</span>
            <input
              type="number"
              min={3}
              max={45}
              value={blockStart}
              onChange={(e) => setBlockStart(parseInt(e.target.value) || 7)}
              className="w-12 text-center font-mono font-bold text-xs py-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-md focus:outline-none text-slate-100"
            />
            <span className="text-[10px] text-slate-500">dia(s) de atraso</span>
          </div>
        </div>
      </div>
    </section>
  );
}
