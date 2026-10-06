"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error?.message?.includes("Loading chunk") ||
    error?.message?.includes("ChunkLoadError") ||
    error?.message?.includes("Failed to fetch dynamically imported module");

  useEffect(() => {
    // Se for erro de chunk desatualizado do cache do navegador após nova compilação, recarrega limpo
    if (isChunkError) {
      console.warn("[ErrorBoundary] Chunk desatualizado detectado no navegador. Recarregando para sincronizar...");
      const reloadKey = "last_chunk_reload_ts";
      const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
      const now = Date.now();
      // Evita loops infinitos (permite 1 recarregamento automático a cada 10 segundos)
      if (now - lastReload > 10000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
        return;
      }
    }
    console.error("Layout/Routing boundary caught an error:", error);
  }, [error, isChunkError]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white px-4 text-center">
      <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-2xl font-bold mb-4">
          {isChunkError ? "Nova Atualização do Sistema" : "Algo deu errado"}
        </h2>
        <p className="text-sm text-slate-400 mb-6 text-left whitespace-pre-wrap max-h-40 overflow-y-auto bg-slate-950 p-3 rounded-lg font-mono">
          {isChunkError
            ? "O sistema foi atualizado com novas melhorias. Clique no botão abaixo para recarregar com a versão mais recente."
            : error?.message || "Ocorreu um erro inesperado no aplicativo."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => {
              if (isChunkError) {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/95 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-sm"
          >
            {isChunkError ? "Recarregar Página" : "Tentar Novamente"}
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 hover:scale-[1.02] active:scale-[0.98] transition-all text-slate-200 rounded-xl font-medium text-sm block"
          >
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  );
}
