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
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-latest",
];

async function generateWithModel(modelName: string, prompt: string, attempt = 1): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    return response.text || "";
  } catch (err: any) {
    const errorMsgLower = (err.message || String(err)).toLowerCase();
    const isServiceUnavailable = errorMsgLower.includes("503") || errorMsgLower.includes("unavailable");
    const isQuotaExceeded = 
      errorMsgLower.includes("429") || 
      errorMsgLower.includes("resource_exhausted") || 
      errorMsgLower.includes("limit") || 
      errorMsgLower.includes("quota");

    if (attempt < 2 && isServiceUnavailable) {
      await new Promise(resolve => setTimeout(resolve, 1500));
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
    const body = await req.json();
    const {
      type = "apartamento",
      neighborhood = "",
      city = "",
      state = "",
      area = 0,
      bedrooms = 0,
      bathrooms = 0,
      parkingSpots = 0,
      acceptsFinancing = true,
      currentPrice = 0,
      portfolioAverageM2 = null
    } = body;

    const areaNum = Number(area) || 0;
    const bedroomsNum = Number(bedrooms) || 0;
    const bathroomsNum = Number(bathrooms) || 0;
    const parkingSpotsNum = Number(parkingSpots) || 0;

    // Prompt estruturado em formato JSON rigoroso para o mercado imobiliário brasileiro
    const prompt = `Você é um Perito Avaliador de Imóveis (CNAI) e Engenheiro de Avaliações experiente no mercado imobiliário brasileiro, seguindo os princípios do Método Comparativo Direto de Dados de Mercado (ABNT NBR 14653).

Avalie o seguinte imóvel para VENDA no Brasil:
- Tipo: ${type}
- Localização: Bairro ${neighborhood || "Central"}, Cidade ${city || "Não especificada"} - UF ${state || "BR"}
- Área Privativa/Útil: ${areaNum > 0 ? `${areaNum} m²` : "Padrão de mercado para a tipologia"}
- Quartos: ${bedroomsNum}
- Banheiros: ${bathroomsNum}
- Vagas de Garagem: ${parkingSpotsNum}
- Aceita Financiamento: ${acceptsFinancing ? "Sim" : "Não"}
${portfolioAverageM2 ? `- Média de m² de imóveis similares na carteira interna desta imobiliária: R$ ${portfolioAverageM2}/m²` : ""}
${currentPrice > 0 ? `- Preço inicial cogitado pelo proprietário: R$ ${currentPrice}` : ""}

Com base nos valores praticados no mercado imobiliário real para esta cidade e bairro (ou na média brasileira correspondente se bairro desconhecido):
Calcule a estimativa realista de mercado e responda EXCLUSIVAMENTE em formato JSON VÁLIDO sem markdown, sem delimitadores como \`\`\`json ou texto introdutório:

{
  "suggestedPrice": number (valor médio recomendado em reais, inteiro, ex: 450000),
  "minPrice": number (valor mínimo para captação agressiva ou liquidez rápida, inteiro),
  "maxPrice": number (valor teto para margem de negociação sem travar a venda, inteiro),
  "pricePerM2": number (valor médio estimado por metro quadrado em reais, inteiro),
  "rentalEstimated": number (estimativa média de locação mensal em reais, inteiro, aprox. 0.4% a 0.6% do valor de venda),
  "marketLiquidity": "Alta" | "Média" | "Moderada",
  "confidence": "Alta" | "Média" | "Estimativa Geral",
  "rationale": "Breve explicação técnica em 2 frases sobre a precificação da região e impacto dos atributos (como vagas e metragem)",
  "negotiationTips": [
    "Dica 1 para o corretor argumentar com o proprietário na hora da captação",
    "Dica 2 para negociação com compradores interessados"
  ]
}`;

    let rawText = "";
    let lastError: any = null;

    for (const model of MODELS_PRIORITY) {
      try {
        rawText = await generateWithModel(model, prompt);
        if (rawText) break;
      } catch (err) {
        lastError = err;
        await new Promise(r => setTimeout(r, 400));
      }
    }

    if (!rawText) {
      // Fallback algorítmico matemático de mercado caso todos os modelos falhem temporariamente
      const baseM2 = portfolioAverageM2 || (city.toLowerCase().includes("rio") || city.toLowerCase().includes("são paulo") ? 8500 : 5500);
      const effectiveArea = areaNum > 0 ? areaNum : 70;
      const parkingBonus = parkingSpotsNum * 35000;
      const estimatedPrice = Math.round(effectiveArea * baseM2 + parkingBonus);

      return NextResponse.json({
        suggestedPrice: estimatedPrice,
        minPrice: Math.round(estimatedPrice * 0.92),
        maxPrice: Math.round(estimatedPrice * 1.08),
        pricePerM2: Math.round(estimatedPrice / effectiveArea),
        rentalEstimated: Math.round(estimatedPrice * 0.005),
        marketLiquidity: "Média",
        confidence: "Estimativa Base",
        rationale: `Estimativa calculada com base na média regional de R$ ${baseM2.toLocaleString('pt-BR')}/m² para ${type} com ${effectiveArea}m².`,
        negotiationTips: [
          "Apresente ao proprietário o valor por m² comparado com imóveis vizinhos recentes.",
          "Use a margem de 8% a 10% para fechar negociações à vista ou financiadas rapidamente."
        ]
      });
    }

    // Limpeza de blocos de código se o modelo incluir
    let cleanedJson = rawText.trim();
    if (cleanedJson.startsWith("```json")) {
      cleanedJson = cleanedJson.replace(/^```json\s*/, "").replace(/```$/, "").trim();
    } else if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```\s*/, "").replace(/```$/, "").trim();
    }

    try {
      const parsed = JSON.parse(cleanedJson);
      return NextResponse.json(parsed);
    } catch (parseErr) {
      // Extrair o primeiro objeto JSON compatível
      const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json(parsed);
      }
      throw parseErr;
    }
  } catch (error: any) {
    console.error("[API/Properties/Valuation] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao calcular sugestão de preço." },
      { status: 500 }
    );
  }
}
