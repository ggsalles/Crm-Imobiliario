"use client";

import { Building2, Hash } from "lucide-react";
import { Property, Company } from "@/lib/db";
import { PROPERTY_TYPES_LIST } from "@/lib/property-types";

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
}: PropertyBasicFieldsProps) {
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
          <span className="text-[9px] font-semibold text-muted-foreground lowercase">opcional</span>
        </label>
        <select
          name="companyId"
          value={companyId}
          onChange={(e) => onCompanyIdChange?.(e.target.value)}
          className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground cursor-pointer"
        >
          <option value="" className="bg-card text-muted-foreground">
            -- Nenhuma construtora associada (Imóvel Avulso / Terceiros) --
          </option>
          {companies.map((comp) => (
            <option key={comp.id} value={comp.id} className="bg-card text-foreground font-medium py-2">
              🏢 {comp.name} {comp.industry ? `(${comp.industry})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Tipo do Imóvel & Código Sequencial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tipo */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 h-5 flex items-center">
            Tipo de Imóvel *
          </label>
          <select
            name="type"
            value={selectedType}
            onChange={(e) => onTypeChange?.(e.target.value)}
            className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground cursor-pointer"
          >
            {PROPERTY_TYPES_LIST.map((t) => (
              <option key={t.id} value={t.id} className="bg-card text-foreground py-2">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Código de Referência Sequencial */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 h-5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Hash className="w-3 h-3 text-amber-500" />
              Código de Referência
            </span>
            <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">auto-gerado</span>
          </label>
          <div className="relative flex items-center">
            <input
              name="referenceCode"
              value={referenceCode}
              onChange={(e) => onReferenceCodeChange?.(e.target.value.toUpperCase())}
              placeholder="Ex: AP0001"
              maxLength={20}
              className="w-full pl-6 pr-12 py-4 bg-amber-500/5 border-2 border-amber-400/40 rounded-2xl text-sm font-black tracking-wider uppercase focus:ring-2 focus:ring-amber-500/30 transition-all outline-none text-amber-700 dark:text-amber-300 placeholder:text-muted-foreground font-mono"
            />
            {onAutoGenerateRef && !editingProperty && (
              <button
                type="button"
                onClick={onAutoGenerateRef}
                disabled={isGeneratingRef}
                className="absolute right-3 p-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-800 dark:text-amber-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                title="Recalcular próximo código sequencial deste tipo"
              >
                {isGeneratingRef ? "..." : "🔄"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Comercial */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 h-5 flex items-center">
          Status Comercial *
        </label>
        <select
          name="status"
          defaultValue={editingProperty?.status || "disponível"}
          className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground cursor-pointer"
        >
          <option value="disponível" className="bg-card text-foreground py-2">Disponível (Ativo no Catálogo)</option>
          <option value="reservado" className="bg-card text-foreground py-2">Reservado / Em Negociação</option>
          <option value="inativo" className="bg-card text-foreground py-2">Inativo (Pausado pelo Cliente / Fora de Venda)</option>
          <option value="vendido" className="bg-card text-foreground py-2">Vendido</option>
          <option value="alugado" className="bg-card text-foreground py-2">Alugado</option>
        </select>
      </div>
    </>
  );
}

export default PropertyBasicFields;
