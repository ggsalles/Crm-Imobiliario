"use client";

import { useState } from "react";
import { X, Clock, AlertTriangle, Lock } from "lucide-react";

interface BillingPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BillingPreviewModal({ isOpen, onClose }: BillingPreviewModalProps) {
  const [previewType, setPreviewType] = useState<"sutil" | "critico" | "bloqueado">("sutil");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-950 border border-slate-800 w-full max-w-xl rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono uppercase tracking-widest bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
              Simulador de Alertas
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-1">
            Pré-visualização dos Alertas Vistos pelo Cliente
          </h3>
          <p className="text-[11px] text-slate-400">
            Veja como cada nível de alerta aparece para corretores e gestores da imobiliária.
          </p>
        </div>

        {/* Switch preview tabs */}
        <div className="flex items-center gap-1.5 border-b border-slate-900 pb-2.5">
          <button
            onClick={() => setPreviewType("sutil")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              previewType === "sutil" 
                ? "bg-amber-500 text-slate-950 font-black" 
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            1. Aviso Sutil
          </button>
          <button
            onClick={() => setPreviewType("critico")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              previewType === "critico" 
                ? "bg-orange-500 text-slate-950 font-black" 
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            2. Aviso Crítico
          </button>
          <button
            onClick={() => setPreviewType("bloqueado")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              previewType === "bloqueado" 
                ? "bg-rose-600 text-white font-black" 
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            3. Bloqueio Total
          </button>
        </div>

        {/* Preview Body */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 min-h-[160px] flex flex-col justify-center">
          {previewType === "sutil" && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-slate-400">
                O cliente vê este card persistente no rodapé da barra lateral:
              </p>
              <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 rounded-xl p-2.5 flex items-start gap-2.5 shadow-sm">
                <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 shrink-0">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono">
                      Aviso de Vencimento
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-amber-200 mt-0.5">
                    Mensalidade com pendência em aberto
                  </p>
                  <p className="text-[10px] text-amber-300/80 mt-0.5 leading-tight">
                    Regularize até <strong>21/09/2026</strong> para evitar a suspensão automática das operações.
                  </p>
                </div>
              </div>
            </div>
          )}

          {previewType === "critico" && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-slate-400">
                Ao fazer login no CRM, este diálogo modal centralizado é apresentado:
              </p>
              <div className="bg-slate-950 border border-orange-500/40 rounded-xl p-3 shadow-xl space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-orange-500/20 text-orange-400 rounded-lg border border-orange-500/30">
                    <AlertTriangle className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-orange-200">
                      Aviso Importante: Suspensão Iminente de Acesso
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Consta fatura pendente com tolerância prestes a expirar.
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Sua mensalidade está em aberto. O acesso da imobiliária será bloqueado caso a confirmação não ocorra.
                </p>
                <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-900">
                  <button className="px-2.5 py-1 text-[10px] font-bold text-slate-300 bg-slate-900 rounded-md hover:bg-slate-800">
                    Ciente
                  </button>
                  <button className="px-2.5 py-1 text-[10px] font-bold text-slate-950 bg-orange-500 rounded-md hover:bg-orange-400">
                    Contatar Financeiro
                  </button>
                </div>
              </div>
            </div>
          )}

          {previewType === "bloqueado" && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-slate-400">
                Quando o prazo expira ou o bloqueio manual é acionado:
              </p>
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3.5 text-center space-y-2">
                <div className="w-8 h-8 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-rose-300">
                    Acesso Suspenso Temporariamente
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                    O acesso ao CRM para <strong>Nando Imobiliária</strong> foi suspenso por pendência financeira.
                  </p>
                </div>
                <div className="pt-1">
                  <span className="inline-block px-2.5 py-1 text-[10px] font-bold bg-rose-600 text-white rounded-lg shadow-xs">
                    Fale com o Administrador da Plataforma
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
          >
            Fechar Simulador
          </button>
        </div>
      </div>
    </div>
  );
}
