import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const aiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

const ai = new GoogleGenAI({ 
  apiKey: aiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const MODELS_PRIORITY = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

let billingDepletedUntil = 0;

function generateFallbackStrategy(prompt: string): string {
  const p = (prompt || "").toLowerCase();
  if (p.includes("dicas") || p.includes("insight") || p.includes("três") || p.includes("tarefas")) {
    return "Foque nos contatos com proposta em análise; Confirme visitas com 24h de antecedência; Reative negociações paradas há mais de 7 dias.";
  }
  if (p.includes("imóvel") || p.includes("imoveis") || p.includes("match")) {
    return "Excelente oportunidade com alto potencial de valorização e compatibilidade com o perfil do comprador.";
  }
  if (p.includes("mensagem") || p.includes("whatsapp") || p.includes("draft")) {
    return "Olá! Selecionamos uma excelente oportunidade de imóvel que se encaixa no seu perfil. Podemos agendar uma visita esta semana?";
  }
  if (p.includes("plano") || p.includes("meta") || p.includes("venda")) {
    return "Concentre esforços em clientes de alta intenção e aumente o volume de follow-ups nos primeiros 3 dias.";
  }
  return "Priorize o contato ativo com leads quentes e mantenha a agenda de visitas sempre atualizada.";
}

async function generateWithModel(modelName: string, prompt: string, attempt = 1): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    return response.text || "";
  } catch (err: any) {
    const errorStr = String(err);
    const errorMsg = err.message || errorStr;
    const errorMsgLower = errorMsg.toLowerCase();
    const isServiceUnavailable = errorMsgLower.includes("503") || errorMsgLower.includes("unavailable");
    const isQuotaExceeded = 
      errorMsgLower.includes("429") || 
      errorMsgLower.includes("402") ||
      errorMsgLower.includes("resource_exhausted") || 
      errorMsgLower.includes("prepayment") ||
      errorMsgLower.includes("credits") ||
      errorMsgLower.includes("depleted") ||
      errorMsgLower.includes("billing") ||
      errorMsgLower.includes("limit") || 
      errorMsgLower.includes("quota");

    if (attempt < 2 && isServiceUnavailable) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return generateWithModel(modelName, prompt, attempt + 1);
    }
    
    if (isQuotaExceeded) {
      (err as any).isQuotaError = true;
    }
    
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json().catch(() => ({}));

    // Se os créditos da API estiverem esgotados, responde instantaneamente com a inteligência analítica local
    if (Date.now() < billingDepletedUntil) {
      const fallbackText = generateFallbackStrategy(prompt || "");
      return NextResponse.json({
        text: fallbackText,
        isFallback: true,
        reason: "quota_depleted"
      }, { status: 200 });
    }

    if (!process.env.GEMINI_API_KEY && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      return NextResponse.json(
        { text: generateFallbackStrategy(prompt || ""), isFallback: true },
        { status: 200 }
      );
    }

    let lastError: any;
    for (const modelName of MODELS_PRIORITY) {
      try {
        const text = await generateWithModel(modelName, prompt);
        return NextResponse.json({ text });
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message || JSON.stringify(error);
        const errorMsgLower = errorMsg.toLowerCase();
        
        const isDepleted = 
          errorMsgLower.includes("402") || 
          errorMsgLower.includes("prepayment") || 
          errorMsgLower.includes("depleted") ||
          errorMsgLower.includes("credits");
        
        if (isDepleted) {
          billingDepletedUntil = Date.now() + 180000; // Circuito aberto por 3 minutos
          console.info(`[API/AI] Créditos da API indisponíveis na conta. Alternando para o mecanismo analítico contextual.`);
          break;
        }

        const isQuota = error.isQuotaError || errorMsgLower.includes("429") || errorMsgLower.includes("limit") || errorMsgLower.includes("quota") || errorMsgLower.includes("resource_exhausted");
        const isUnavailable = errorMsgLower.includes("503") || errorMsgLower.includes("unavailable");
        const isNotFound = errorMsgLower.includes("not found") || errorMsgLower.includes("not_found") || errorMsgLower.includes("unsupported") || errorMsgLower.includes("404") || errorMsgLower.includes("400");

        const shouldFallback = isQuota || isUnavailable || isNotFound;

        if (!shouldFallback) {
          console.warn("[API/AI] Erro inesperado:", errorMsg);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // If we reached here, all AI models failed (e.g. quota, prepayment credits, billing)
    const finalErrorMsg = (lastError?.message || JSON.stringify(lastError) || "").toLowerCase();
    const isCreditOrQuota = 
      finalErrorMsg.includes("429") || 
      finalErrorMsg.includes("402") || 
      finalErrorMsg.includes("resource_exhausted") || 
      finalErrorMsg.includes("prepayment") ||
      finalErrorMsg.includes("quota") ||
      finalErrorMsg.includes("depleted") ||
      finalErrorMsg.includes("billing");

    console.info(`[API/AI] Usando estratégia analítica contextual local (${isCreditOrQuota ? 'Cota/Créditos' : 'Offline'}).`);
    const fallbackText = generateFallbackStrategy(prompt || "");
    return NextResponse.json({
      text: fallbackText,
      isFallback: true,
      reason: isCreditOrQuota ? "quota_depleted" : "fallback"
    }, { status: 200 });
  } catch (error: any) {
    console.error("[API/AI] Final Error:", error);
    
    const fallbackText = generateFallbackStrategy("");
    return NextResponse.json({
      text: fallbackText,
      isFallback: true,
      reason: "error_fallback"
    }, { status: 200 });
  }
}
