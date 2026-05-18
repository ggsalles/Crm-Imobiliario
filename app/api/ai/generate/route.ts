import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const MODELS_PRIORITY = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-1.5-flash-latest", // Unified alias for stabilized 1.5 flash
  "gemini-1.5-flash-8b-latest"
];

async function generateWithModel(modelName: string, prompt: string, attempt = 1): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    return response.text || "";
  } catch (err: any) {
    const errorMsg = err.message || "";
    const isServiceUnavailable = errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE");

    // Somente repetimos o MESMO modelo se for erro temporário de serviço (503)
    if (attempt < 2 && isServiceUnavailable) {
      console.log(`[API/AI] Retrying ${modelName} after service unavailable (Attempt ${attempt})...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return generateWithModel(modelName, prompt, attempt + 1);
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
        const errorMsg = error.message || "";
        console.warn(`[API/AI] Erro no modelo ${modelName}:`, errorMsg);
        
        const shouldFallback = errorMsg.includes("429") || 
                             errorMsg.includes("limit") || 
                             errorMsg.includes("Quota") ||
                             errorMsg.includes("503") ||
                             errorMsg.includes("UNAVAILABLE") ||
                             errorMsg.includes("not found");

        if (!shouldFallback) {
          // Se for um erro de segurança (safety) ou algo não relacionado a cota/serviço, não adianta trocar de modelo
          break;
        }
        
        console.log(`[API/AI] Modelo ${modelName} falhou, tentando próximo da lista...`);
      }
    }

    // Se chegou aqui, todos os modelos falharam ou o último erro não era recuperável
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
