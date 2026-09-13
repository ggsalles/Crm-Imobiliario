"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Database, ExternalLink, RefreshCw, X } from "lucide-react";
import { forceDataResync } from "@/lib/db";

interface DatabaseStatusDetail {
  isPaused: boolean;
  message?: string;
}

export function DatabaseStatusBanner() {
  const [isPaused, setIsPaused] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleStatus = (e: Event) => {
      const customEvent = e as CustomEvent<DatabaseStatusDetail>;
      if (customEvent.detail?.isPaused) {
        setIsPaused(true);
        setDismissed(false);
      } else {
        setIsPaused(false);
      }
    };

    window.addEventListener("supabase-status-change", handleStatus);
    return () => {
      window.removeEventListener("supabase-status-change", handleStatus);
    };
  }, []);

  if (!isPaused || dismissed) return null;

  const handleRetry = async () => {
    setIsChecking(true);
    forceDataResync();
    setTimeout(() => {
      setIsChecking(false);
    }, 2500);
  };

  return (
    <div
      id="supabase-pause-notification-banner"
      role="alert"
      className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-3 sm:px-6 relative z-50 backdrop-blur-md transition-all shadow-sm"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5 sm:mt-0 flex-shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-amber-100">
                Banco de Dados Supabase em Hibernação / Pausado
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/30 text-amber-300">
                Plano Free
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
              No plano gratuito do Supabase, projetos sem acessos recentes entram em pausa automática.
              <strong> Seus dados continuam 100% seguros!</strong> Para retomar o funcionamento imediatamente, acesse o painel do Supabase e clique no botão <em>&quot;Restore Project&quot;</em>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0 mt-2 sm:mt-0">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-sm"
          >
            <span>Ir ao Supabase</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
            <span>{isChecking ? "Verificando..." : "Reconectar"}</span>
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-amber-300/70 hover:text-amber-100 hover:bg-amber-500/20 transition-colors ml-1"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
