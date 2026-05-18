import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const MODELS_PRIORITY = [
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
];

async function generateWithModel(modelName: string, prompt: string, attempt = 1): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    return response.text || "";
  } catch (err: any) {
    const errorMsg = JSON.stringify(err);
    const isServiceUnavailable = errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE");
    const isQuotaExceeded = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("limit") || errorMsg.includes("Quota");

    // Retrying ONLY on 503 (Unavailable)
    // For 429 (Quota), we throw immediately to move to the next model in MODELS_PRIORITY
    if (attempt < 2 && isServiceUnavailable) {
      console.log(`[API/AI] Retrying ${modelName} (Attempt ${attempt}) due to Service Unavailable`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return generateWithModel(modelName, prompt, attempt + 1);
    }
    
    // If it's a quota error and we have more models to try, throw a specific flag
    if (isQuotaExceeded) {
      (err as any).isQuotaError = true;
    }
    
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "A chave da API Gemini não está configurada no servidor." },
        { status: 500 }
      );
    }

    let lastError: any;
    for (const modelName of MODELS_PRIORITY) {
      try {
        console.log(`[API/AI] Tentando gerar conteúdo com ${modelName}...`);
        const text = await generateWithModel(modelName, prompt);
        return NextResponse.json({ text });
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message || JSON.stringify(error);
        console.warn(`[API/AI] Erro no modelo ${modelName}:`, errorMsg);
        
        const isQuota = error.isQuotaError || errorMsg.includes("429") || errorMsg.includes("limit") || errorMsg.includes("Quota");
        const isUnavailable = errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE");
        const isNotFound = errorMsg.includes("not found");

        const shouldFallback = isQuota || isUnavailable || isNotFound;

        if (!shouldFallback) {
          // If it's a safety error or client error, don't fallback
          console.warn("[API/AI] Non-recoverable error, stopping fallback chain.");
          break;
        }
        
        console.log(`[API/AI] Modelo ${modelName} falhou por Cota/Indisponibilidade. Tentando próximo...`);
        // Optional jitter/delay between models to avoid hitting generic rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // If we reached here, interpret the last error
    const finalErrorMsg = lastError?.message || JSON.stringify(lastError);
    if (finalErrorMsg.includes("429") || finalErrorMsg.includes("RESOURCE_EXHAUSTED")) {
      return NextResponse.json(
        { error: "Limite de cota da IA atingido em todos os modelos disponíveis. Por favor, tente novamente em alguns minutos." },
        { status: 429 }
      );
    }
    
    throw lastError;
  } catch (error: any) {
    console.error("[API/AI] Final Error:", error);
    
    // Extract error details if it's an ApiError or similar
    let message = error.message || "Internal server error";
    let status = 500;

    if (error.status) {
      status = error.status;
    } else if (message.includes("503") || message.includes("UNAVAILABLE")) {
      status = 503;
    }

    return NextResponse.json(
      { error: message },
      { status: status }
    );
  }
}
