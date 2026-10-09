"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    if (isChunkError) {
      console.warn("[GlobalErrorBoundary] Chunk desatualizado detectado. Recarregando...");
      const reloadKey = "last_global_chunk_reload_ts";
      const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
      const now = Date.now();
      if (now - lastReload > 8000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
      }
    }
  }, [isChunkError]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white px-4 text-center font-sans">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold mb-4">
            {isChunkError ? "Atualizando Aplicativo..." : "Algo deu errado"}
          </h2>
          <p className="text-sm text-slate-400 mb-6 text-left whitespace-pre-wrap max-h-40 overflow-y-auto bg-slate-950 p-3 rounded-lg font-mono">
            {isChunkError
              ? "Uma nova versão dos módulos foi disponibilizada pelo servidor. Recarregando a página..."
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
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all cursor-pointer text-sm"
            >
              {isChunkError ? "Recarregar" : "Tentar Novamente"}
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 transition-all text-slate-200 rounded-xl font-medium text-sm block"
            >
              Voltar ao Início
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
