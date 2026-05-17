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
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
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

    if (errorMessage.includes("missing") || errorMessage.includes("api key")) {
      return {
        text: fallbackText,
        isError: true,
        errorType: 'missing_key'
      };
    }

    return {
      text: fallbackText,
      isError: true,
      errorType: 'general'
    };
  }
}
