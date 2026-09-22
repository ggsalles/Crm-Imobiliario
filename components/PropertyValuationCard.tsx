"use client";

import React, { useState } from "react";
import { 
  Sparkles, 
  TrendingUp, 
  Building2, 
  Coins, 
  Check, 
  Copy, 
  X, 
  ShieldCheck, 
  Lightbulb, 
  BarChart2, 
  ArrowUpRight 
} from "lucide-react";
import { formatCurrencyBRL } from "@/lib/utils";
import { toast } from "sonner";

export interface ValuationResult {
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  pricePerM2: number;
  rentalEstimated: number;
  marketLiquidity: string;
  confidence: string;
  rationale: string;
  negotiationTips: string[];
  portfolioAvgM2?: number | null;
  matchingPropertiesCount?: number;
}

interface PropertyValuationCardProps {
  valuation: ValuationResult;
  currentPrice: number;
  onApplyPrice: (val: number) => void;
  onClose: () => void;
  propertyTitle?: string;
}

export function PropertyValuationCard({
  valuation,
  currentPrice,
  onApplyPrice,
  onClose,
  propertyTitle = "Imóvel"
}: PropertyValuationCardProps) {
  const [copied, setCopied] = useState(false);

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const handleCopySummary = () => {
    const text = `📊 *AVALIAÇÃO DE MERCADO (CMA)*
🏠 *Imóvel:* ${propertyTitle}

💰 *Preço Recomendado:* ${formatPrice(valuation.suggestedPrice)}
📉 *Faixa de Negociação:* ${formatPrice(valuation.minPrice)} a ${formatPrice(valuation.maxPrice)}
📐 *Valor Estimado do m²:* ${formatPrice(valuation.pricePerM2)}/m²
🔑 *Potencial de Locação:* ${formatPrice(valuation.rentalEstimated)}/mês

💡 *Parecer Técnico:*
${valuation.rationale}

🎯 *Dicas de Precificação:*
${valuation.negotiationTips.map(tip => `• ${tip}`).join("\n")}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Resumo da avaliação copiado para o WhatsApp!");
    setTimeout(() => setCopied(false), 2500);
  };

  // Comparação com o preço atual digitado pelo usuário (se houver)
  const priceDifference = currentPrice > 0 ? currentPrice - valuation.suggestedPrice : 0;
  const percentageDifference = currentPrice > 0 && valuation.suggestedPrice > 0
    ? Math.round((priceDifference / valuation.suggestedPrice) * 100)
    : 0;

  return (
    <div className="bg-card/95 border border-primary/30 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-6 relative overflow-hidden transition-all">
      {/* Decorative gradient background glow */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center border border-primary/20 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                Sugestão Inteligente de Preço de Mercado
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                Liquidez {valuation.marketLiquidity || "Média"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                {valuation.confidence || "Estimativa Realista"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Calculado com base em dados de mercado por m² e características do imóvel.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
          title="Fechar avaliação"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Suggested Price Spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/25 flex flex-col justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Valor Central Recomendado (CMA)
            </span>
            <div className="flex flex-wrap items-baseline gap-3 mt-1.5">
              <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {formatPrice(valuation.suggestedPrice)}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                ({formatPrice(valuation.pricePerM2)} / m²)
              </span>
            </div>

            {currentPrice > 0 && currentPrice !== valuation.suggestedPrice && (
              <div className="mt-2 text-xs font-medium flex items-center gap-1.5">
                <span className="text-muted-foreground">Preço digitado atualmente:</span>
                <span className="font-bold">{formatPrice(currentPrice)}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  priceDifference > 0 
                    ? "bg-amber-500/15 text-amber-500" 
                    : "bg-emerald-500/15 text-emerald-500"
                }`}>
                  {priceDifference > 0 ? `+${percentageDifference}% acima da média` : `${percentageDifference}% abaixo da média`}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-primary/20">
            <button
              type="button"
              onClick={() => {
                onApplyPrice(valuation.suggestedPrice);
                toast.success(`Preço sugerido de ${formatPrice(valuation.suggestedPrice)} aplicado!`);
              }}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" /> Aplicar Este Preço no Formulário
            </button>
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3.5 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs transition-colors flex items-center gap-1.5 border border-border cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado!" : "Copiar p/ WhatsApp"}
            </button>
          </div>
        </div>

        {/* Quick Range Selector */}
        <div className="p-5 rounded-2xl bg-muted/30 border border-border flex flex-col justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <BarChart2 className="w-3.5 h-3.5" /> Faixa de Negociação
            </span>
            
            <div className="space-y-2.5 mt-3">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/80">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Mínimo (Venda Rápida)</p>
                  <p className="text-xs sm:text-sm font-black text-foreground">{formatPrice(valuation.minPrice)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onApplyPrice(valuation.minPrice);
                    toast.success(`Preço mínimo de ${formatPrice(valuation.minPrice)} aplicado.`);
                  }}
                  className="px-2 py-1 rounded-lg bg-muted text-[10px] font-bold hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
                >
                  Usar
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/80">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Teto (Margem Máxima)</p>
                  <p className="text-xs sm:text-sm font-black text-foreground">{formatPrice(valuation.maxPrice)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onApplyPrice(valuation.maxPrice);
                    toast.success(`Preço teto de ${formatPrice(valuation.maxPrice)} aplicado.`);
                  }}
                  className="px-2 py-1 rounded-lg bg-muted text-[10px] font-bold hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
                >
                  Usar
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
            <span>Estimativa de Aluguel:</span>
            <span className="font-black text-foreground flex items-center gap-1">
              <Coins className="w-3 h-3 text-emerald-500" /> {formatPrice(valuation.rentalEstimated)}/mês
            </span>
          </div>
        </div>
      </div>

      {/* Internal Portfolio comparison if available */}
      {valuation.portfolioAvgM2 && valuation.portfolioAvgM2 > 0 && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Comparativo da sua Imobiliária:</strong> Na sua carteira, imóveis similares estão com média de <strong>{formatPrice(valuation.portfolioAvgM2)}/m²</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Rationale and Negotiation Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 text-xs">
        <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2">
          <span className="font-bold text-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Parecer Técnico do Mercado
          </span>
          <p className="text-muted-foreground leading-relaxed">
            {valuation.rationale}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2">
          <span className="font-bold text-foreground flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Dicas para o Corretor / Captação
          </span>
          <ul className="space-y-1.5 text-muted-foreground">
            {valuation.negotiationTips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                <span className="text-primary font-bold shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
