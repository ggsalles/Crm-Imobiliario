import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! });
const MODEL_NAME = "gemini-3-flash-preview";

export interface AISafeResponse {
  text: string;
  isError: boolean;
  errorType?: 'quota' | 'general';
}

/**
 * Safely calls Gemini API with quota awareness and friendly fallbacks
 * Follows modern @google/genai patterns
 */
export async function safeAiCall(prompt: string, fallbackText: string): Promise<AISafeResponse> {
  try {
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

    return {
      text: fallbackText,
      isError: true,
      errorType: 'general'
    };
  }
}
