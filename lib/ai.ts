import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;
const MODEL_NAME = "gemini-3-flash-preview";

function getAi() {
  if (!aiInstance) {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is missing. Please set it in your environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface AISafeResponse {
  text: string;
  isError: boolean;
  errorType?: 'quota' | 'general' | 'missing_key';
}

/**
 * Safely calls Gemini API with quota awareness and friendly fallbacks
 * Follows modern @google/genai patterns
 */
export async function safeAiCall(prompt: string, fallbackText: string): Promise<AISafeResponse> {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    
    // .text is a getter property in modern SDK
    const text = response.text;
    
    if (!text) {
      throw new Error("No text generated");
    }

    return {
      text,
      isError: false
    };
  } catch (error: any) {
    console.error("Gemini Safe Call Error:", error);
    
    const errorMessage = (error?.message || error?.error?.message || "").toLowerCase();
    const errorStatus = error?.status || error?.error?.code || 0;
    
    const isQuotaError = 
      errorMessage.includes("quota") || 
      errorMessage.includes("429") || 
      errorMessage.includes("resource_exhausted") ||
      errorStatus === 429 ||
      (error?.error?.status === "RESOURCE_EXHAUSTED");

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
