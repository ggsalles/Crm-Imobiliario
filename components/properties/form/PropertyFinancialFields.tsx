"use client";

import { Sparkles, Loader2 } from "lucide-react";
import { formatCurrencyBRL, parseCurrencyBRLToNumber, formatCurrencyInput } from "@/lib/utils";

export interface PropertyFinancialFieldsProps {
  displayPrice: string;
  onDisplayPriceChange: (value: string) => void;
  displayCondoFee: string;
  onDisplayCondoFeeChange: (value: string) => void;
  displayIptu: string;
  onDisplayIptuChange: (value: string) => void;
  areaInput: string;
  isEstimatingPrice: boolean;
  onSuggestPrice: () => void;
}

export function PropertyFinancialFields({
  displayPrice,
  onDisplayPriceChange,
  displayCondoFee,
  onDisplayCondoFeeChange,
  displayIptu,
  onDisplayIptuChange,
  areaInput,
  isEstimatingPrice,
  onSuggestPrice,
}: PropertyFinancialFieldsProps) {
  const currentPriceNum = parseCurrencyBRLToNumber(displayPrice);
  const areaNum = parseFloat(areaInput || "0");
  const m2Avg = areaNum > 0 && currentPriceNum > 0 ? Math.round(currentPriceNum / areaNum) : 0;

  return (
    <div className="md:col-span-2 p-6 sm:p-7 bg-muted/20 border border-border/70 rounded-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-foreground">Valores & Encargos Financeiros</h4>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">
              Passo 4
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Preço de venda e despesas periódicas do imóvel com suporte à estimativa inteligente por IA
          </p>
        </div>

        <button
          type="button"
          onClick={onSuggestPrice}
          disabled={isEstimatingPrice}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-primary/20 self-start sm:self-auto hover:scale-[1.02] active:scale-[0.98]"
          title="Calcular estimativa de preço com base no bairro, cidade, tipo e área preenchidos acima"
        >
          {isEstimatingPrice ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Analisando mercado...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sugerir Preço (IA)</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
            Preço de Venda (R$) *
          </label>
          <input
            name="price"
            required
            value={displayPrice}
            onChange={(e) => onDisplayPriceChange(formatCurrencyInput(e.target.value))}
            onFocus={(e) => {
              if (!displayPrice || displayPrice === "R$ 0,00") {
                onDisplayPriceChange("");
              } else {
                e.target.select();
              }
            }}
            placeholder="R$ 0,00"
            className="w-full px-5 py-3.5 bg-background border border-border rounded-2xl text-base font-black text-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
          {m2Avg > 0 ? (
            <p className="text-[11px] font-medium text-muted-foreground pl-1 flex items-center gap-1.5">
              <span>Média m²:</span>
              <span className="font-bold text-foreground font-mono">
                {formatCurrencyBRL(m2Avg, { maximumFractionDigits: 0 })} / m²
              </span>
            </p>
          ) : (
            <p className="text-[11px] font-medium text-muted-foreground pl-1">
              Valor de avaliação / venda
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center justify-between">
            <span>Valor Condomínio (R$)</span>
            <span className="text-[9px] font-semibold text-muted-foreground lowercase">mensal</span>
          </label>
          <input
            name="condoFee"
            value={displayCondoFee}
            onChange={(e) => onDisplayCondoFeeChange(formatCurrencyInput(e.target.value))}
            onFocus={(e) => {
              if (!displayCondoFee || displayCondoFee === "R$ 0,00") {
                onDisplayCondoFeeChange("");
              } else {
                e.target.select();
              }
            }}
            placeholder="R$ 0,00"
            className="w-full px-5 py-3.5 bg-background border border-border rounded-2xl text-base font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
          <p className="text-[11px] font-medium text-muted-foreground pl-1">
            Taxa mensal do condomínio
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center justify-between">
            <span>IPTU (R$)</span>
            <span className="text-[9px] font-semibold text-muted-foreground lowercase">anual / total</span>
          </label>
          <input
            name="iptu"
            value={displayIptu}
            onChange={(e) => onDisplayIptuChange(formatCurrencyInput(e.target.value))}
            onFocus={(e) => {
              if (!displayIptu || displayIptu === "R$ 0,00") {
                onDisplayIptuChange("");
              } else {
                e.target.select();
              }
            }}
            placeholder="R$ 0,00"
            className="w-full px-5 py-3.5 bg-background border border-border rounded-2xl text-base font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
          <p className="text-[11px] font-medium text-muted-foreground pl-1">
            Valor total anual ou cota única
          </p>
        </div>
      </div>
    </div>
  );
}

export default PropertyFinancialFields;
