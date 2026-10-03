"use client";

import { Sparkles, Loader2, Building2, Hash } from "lucide-react";
import { Property, Company } from "@/lib/db";
import { formatCurrencyBRL, parseCurrencyBRLToNumber } from "@/lib/utils";

export interface PropertyBasicFieldsProps {
  editingProperty: Property | null;
  title: string;
  onTitleChange: (value: string) => void;
  buildingName: string;
  onBuildingNameChange: (value: string) => void;
  companyId?: string;
  onCompanyIdChange?: (value: string) => void;
  companies?: Company[];
  referenceCode?: string;
  onReferenceCodeChange?: (value: string) => void;
  selectedType?: string;
  onTypeChange?: (value: string) => void;
  isGeneratingRef?: boolean;
  onAutoGenerateRef?: () => void;
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

export function PropertyBasicFields({
  editingProperty,
  title,
  onTitleChange,
  buildingName,
  onBuildingNameChange,
  companyId = "",
  onCompanyIdChange,
  companies = [],
  referenceCode = "",
  onReferenceCodeChange,
  selectedType = "apartamento",
  onTypeChange,
  isGeneratingRef = false,
  onAutoGenerateRef,
  displayPrice,
  onDisplayPriceChange,
  displayCondoFee,
  onDisplayCondoFeeChange,
  displayIptu,
  onDisplayIptuChange,
  areaInput,
  isEstimatingPrice,
  onSuggestPrice,
}: PropertyBasicFieldsProps) {
  const currentPriceNum = parseCurrencyBRLToNumber(displayPrice);
  const areaNum = parseFloat(areaInput || "0");
  const m2Avg = areaNum > 0 && currentPriceNum > 0 ? Math.round(currentPriceNum / areaNum) : 0;

  return (
    <>
      {/* Título do Imóvel */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 h-5 flex items-center">
          Identificação / Título do Imóvel *
        </label>
        <input
          name="title"
          required
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Ex: Apartamento Vista Mar Premium"
          className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Nome do Edifício ou Condomínio */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 h-5 flex items-center justify-between">
          <span>Nome do Edifício ou Condomínio</span>
          <span className="text-[9px] font-semibold text-muted-foreground lowercase">opcional</span>
        </label>
        <input
          name="buildingName"
          value={buildingName}
          onChange={(e) => onBuildingNameChange(e.target.value)}
          placeholder="Ex: Edifício Solar das Acácias / Cond. Alphaville"
          className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Construtora / Incorporadora Parceira */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 h-5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            Construtora / Incorporadora Parceira
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground lowercase">opcional (lançamentos)</span>
        </label>
        <select
          name="companyId"
          value={companyId}
          onChange={(e) => onCompanyIdChange?.(e.target.value)}
          className="w-full px-6 py-4 bg-muted/40 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground cursor-pointer"
        >
          <option value="" className="bg-card text-foreground py-2">
            Nenhuma / Imóvel de Terceiro (Avulso)
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id} className="bg-card text-foreground py-2">
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Grid: Tipo de Unidade + Código de Referência */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tipo de Unidade */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 h-5 flex items-center">
            Tipo de Unidade
          </label>
          <select
            name="type"
            value={selectedType}
            onChange={(e) => onTypeChange?.(e.target.value)}
            className="w-full px-6 py-4 bg-muted/40 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground cursor-pointer"
          >
            <option value="apartamento" className="bg-card text-foreground py-2">Apartamento</option>
            <option value="casa" className="bg-card text-foreground py-2">Casa</option>
            <option value="condomínio" className="bg-card text-foreground py-2">Condomínio</option>
            <option value="sobrado" className="bg-card text-foreground py-2">Sobrado</option>
            <option value="cobertura" className="bg-card text-foreground py-2">Cobertura</option>
            <option value="studio" className="bg-card text-foreground py-2">Studio / Kitnet</option>
            <option value="sala" className="bg-card text-foreground py-2">Sala Comercial</option>
            <option value="comercial" className="bg-card text-foreground py-2">Comercial</option>
            <option value="galpão" className="bg-card text-foreground py-2">Galpão / Depósito</option>
            <option value="prédio" className="bg-card text-foreground py-2">Prédio Inteiro</option>
            <option value="terreno" className="bg-card text-foreground py-2">Terreno / Lote</option>
            <option value="chácara" className="bg-card text-foreground py-2">Chácara</option>
            <option value="sítio" className="bg-card text-foreground py-2">Sítio</option>
            <option value="fazenda" className="bg-card text-foreground py-2">Fazenda</option>
            <option value="outros" className="bg-card text-foreground py-2">Outros</option>
          </select>
        </div>

        {/* Código de Referência */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 h-5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-primary" />
              Código de Referência
            </span>
            <span className="text-[9px] font-semibold text-primary/80 lowercase">auto / editável</span>
          </label>
          <div className="relative">
            <input
              name="referenceCode"
              value={referenceCode}
              onChange={(e) => onReferenceCodeChange?.(e.target.value.toUpperCase())}
              placeholder="Ex: AP0001, CA0014, CD0035"
              className="w-full pl-5 pr-11 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-mono font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground uppercase placeholder:normal-case placeholder:font-sans placeholder:text-muted-foreground"
            />
            {onAutoGenerateRef && (
              <button
                type="button"
                onClick={onAutoGenerateRef}
                disabled={isGeneratingRef}
                title="Recalcular próximo código sequencial deste tipo"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-muted/80 rounded-xl text-primary transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingRef ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Comercial */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 h-5 flex items-center">
          Status Comercial
        </label>
        <select
          name="status"
          defaultValue={editingProperty?.status || "disponível"}
          className="w-full px-6 py-4 bg-muted/40 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground cursor-pointer"
        >
          <option value="disponível" className="bg-card text-foreground py-2">Disponível</option>
          <option value="reservado" className="bg-card text-foreground py-2">Reservado</option>
          <option value="vendido" className="bg-card text-foreground py-2">Vendido</option>
          <option value="alugado" className="bg-card text-foreground py-2">Alugado</option>
        </select>
      </div>

      {/* Valores & Encargos Financeiros */}
      <div className="md:col-span-2 p-6 sm:p-7 bg-muted/20 border border-border/70 rounded-3xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
          <div>
            <h4 className="text-sm font-bold text-foreground">Valores & Encargos Financeiros</h4>
            <p className="text-xs text-muted-foreground">
              Preço de venda e despesas periódicas do imóvel (formatação monetária automática)
            </p>
          </div>
          <button
            type="button"
            onClick={onSuggestPrice}
            disabled={isEstimatingPrice}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all border border-primary/25 disabled:opacity-50 cursor-pointer shadow-xs self-start sm:self-auto"
            title="Calcular estimativa de preço de mercado com base em dados imobiliários e IA"
          >
            {isEstimatingPrice ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>Analisando mercado...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-primary" />
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
              onChange={(e) => onDisplayPriceChange(formatCurrencyBRL(e.target.value))}
              onFocus={(e) => e.target.select()}
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
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                onDisplayCondoFeeChange(raw ? formatCurrencyBRL(raw) : "");
              }}
              onFocus={(e) => e.target.select()}
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
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                onDisplayIptuChange(raw ? formatCurrencyBRL(raw) : "");
              }}
              onFocus={(e) => e.target.select()}
              placeholder="R$ 0,00"
              className="w-full px-5 py-3.5 bg-background border border-border rounded-2xl text-base font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
            <p className="text-[11px] font-medium text-muted-foreground pl-1">
              Valor total anual ou cota única
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
