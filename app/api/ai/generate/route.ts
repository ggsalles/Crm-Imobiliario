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

const PRIMARY_MODEL = "gemini-3-flash-preview";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

async function generateWithModel(modelName: string, prompt: string, attempt = 1): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    return response.text || "";
  } catch (err: any) {
    if (attempt < 2 && (err.message.includes("503") || err.message.includes("UNAVAILABLE"))) {
      console.log(`[API/AI] Retrying ${modelName} after 503 error...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
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

    try {
      // Tenta o modelo primário (Flash - mais rápido)
      const text = await generateWithModel(PRIMARY_MODEL, prompt);
      return NextResponse.json({ text });
    } catch (primaryError: any) {
      console.warn(`[API/AI] Erro no modelo primário (${PRIMARY_MODEL}):`, primaryError.message);
      
      const isRecoverable = primaryError.message.includes("503") || 
                           primaryError.message.includes("UNAVAILABLE") || 
                           primaryError.message.includes("high demand") ||
                           primaryError.message.includes("limit") ||
                           primaryError.message.includes("Quota") ||
                           primaryError.message.includes("429");

      if (isRecoverable) {
        try {
          console.log(`[API/AI] Tentando fallback para ${FALLBACK_MODEL}...`);
          const text = await generateWithModel(FALLBACK_MODEL, prompt);
          return NextResponse.json({ text });
        } catch (fallbackError: any) {
          console.error(`[API/AI] Erro no modelo de fallback (${FALLBACK_MODEL}):`, fallbackError.message);
          throw fallbackError;
        }
      }
      throw primaryError;
    }
  } catch (error: any) {
    console.error("[API/AI] Error:", error);
    
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
