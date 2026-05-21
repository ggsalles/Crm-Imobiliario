export interface AISafeResponse {
  text: string;
  isError: boolean;
  errorType?: 'quota' | 'general' | 'missing_key';
}

/**
 * Safely calls Gemini API via server-side route
 */
export async function safeAiCall(prompt: string, fallbackText: string): Promise<AISafeResponse> {
  try {
    let lastFetchError: any;
    let response: Response | null = null;
    
    // Retry logic for the fetch call itself (network/transient issues)
    for (let i = 0; i < 2; i++) {
      try {
        const url = typeof window !== 'undefined' ? `${window.location.origin}/api/ai/generate` : '/api/ai/generate';
        
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        break; // Success
      } catch (err: any) {
        lastFetchError = err;
        console.warn(`[AI/Fetch] Attempt ${i + 1} failed:`, err.message);
        if (i < 1) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!response) {
      throw lastFetchError || new Error("Não foi possível conectar ao servidor de IA.");
    }

    const contentType = response.headers.get("content-type");
    
    if (!response.ok) {
      let errorMessage = `Erro na API de IA (${response.status})`;
      if (contentType && contentType.includes("application/json")) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) { /* ignore */ }
      } else {
        try {
          const errorText = await response.text();
          if (errorText && errorText.length < 500 && !errorText.includes("<!doctype")) {
             errorMessage = errorText;
          }
        } catch (e2) { /* ignore */ }
      }
      throw new Error(errorMessage);
    }

    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("A API de IA retornou um formato inesperado (HTML/Text). Tente novamente.");
    }

    const data = await response.json();
    
    if (!data.text) {
      throw new Error("No text generated");
    }

    return {
      text: data.text,
      isError: false
    };
  } catch (error: any) {
    console.error("Gemini Safe Call Error:", error);
    
    const errorMessage = (error?.message || "").toLowerCase();
    
    const isQuotaError = 
      errorMessage.includes("quota") || 
      errorMessage.includes("429") || 
      errorMessage.includes("resource_exhausted");

    if (isQuotaError) {
      return {
        text: "Capacidade da IA temporariamente excedida. " + fallbackText,
        isError: true,
        errorType: 'quota'
      };
    }

    const isMissingKey = 
      errorMessage.includes("missing") || 
      errorMessage.includes("api key") || 
      errorMessage.includes("não está configurada") || 
      errorMessage.includes("chave") || 
      errorMessage.includes("configurada") ||
      errorMessage.includes("apikey");

    if (isMissingKey) {
      return {
        text: "Chave da API Gemini não configurada no servidor. Por favor, adicione a variável de ambiente GEMINI_API_KEY no painel do seu projeto na Vercel (Configurações > Environment Variables) e reinstale/re-implante para ativar os recursos de IA do SalesScore.",
        isError: true,
        errorType: 'missing_key'
      };
    }

    return {
      text: `Ops! Não foi possível gerar os insights agora. Detalhes: ${error?.message || "Erro desconhecido"}.`,
      isError: true,
      errorType: 'general'
    };
  }
}
