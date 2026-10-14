"use client";

import { Building2, Hash, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Property, Company } from "@/lib/db";
import { PROPERTY_TYPES_LIST } from "@/lib/property-types";
import { OFFICIAL_PREFIX_MAP } from "@/lib/reference-codes";
import { cn } from "@/lib/utils";

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
  refConflict?: { id: string; title: string; referenceCode: string } | null;
  refError?: string | null;
  refWarning?: string | null;
  refSuggestion?: string | null;
  isCheckingRef?: boolean;
  onApplySuggestion?: (sug: string) => void;
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
  refConflict = null,
  refError = null,
  refWarning = null,
  refSuggestion = null,
  isCheckingRef = false,
  onApplySuggestion,
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
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 h-5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Hash className={cn(
                "w-3 h-3",
                (refError || refConflict) ? "text-rose-500" : (refWarning ? "text-amber-500" : "text-amber-500")
              )} />
              Código de Referência
            </span>
            <div className="flex items-center gap-2">
              {isCheckingRef && (
                <span className="text-[9px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> verificando...
                </span>
              )}
              {refError ? (
                <span className="text-[9px] font-bold text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> formato inválido
                </span>
              ) : refConflict ? (
                <span className="text-[9px] font-bold text-rose-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> duplicado
                </span>
              ) : refWarning ? (
                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> atenção à sigla
                </span>
              ) : referenceCode && !isCheckingRef ? (
                <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> sigla e formato válidos
                </span>
              ) : (
                <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">auto-gerado</span>
              )}
            </div>
          </label>
          <div className="relative flex items-center">
            <input
              name="referenceCode"
              value={referenceCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
                onReferenceCodeChange?.(val);
              }}
              placeholder={isGeneratingRef ? "Calculando..." : "Ex: AP0001"}
              maxLength={20}
              className={cn(
                "w-full pl-6 pr-12 py-4 border-2 rounded-2xl text-sm font-black tracking-wider uppercase transition-all outline-none font-mono",
                (refError || refConflict)
                  ? "bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-300 focus:ring-2 focus:ring-rose-500/30"
                  : (refWarning
                      ? "bg-amber-500/10 border-amber-500 text-amber-800 dark:text-amber-200 focus:ring-2 focus:ring-amber-500/30"
                      : "bg-amber-500/5 border-amber-400/40 text-amber-700 dark:text-amber-300 focus:ring-2 focus:ring-amber-500/30 placeholder:text-muted-foreground")
              )}
            />
            {onAutoGenerateRef && !editingProperty && (
              <button
                type="button"
                onClick={onAutoGenerateRef}
                disabled={isGeneratingRef}
                className="absolute right-3 p-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-800 dark:text-amber-300 transition-all cursor-pointer disabled:opacity-50"
                title="Recalcular próximo código sequencial deste tipo"
              >
                <RefreshCw className={cn("w-4 h-4", isGeneratingRef && "animate-spin text-amber-600")} />
              </button>
            )}
          </div>

          {/* Erro de Formato ou Sigla Desconhecida */}
          {refError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl space-y-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
                <div className="flex-1 leading-relaxed">
                  {refError}
                </div>
              </div>
              {refSuggestion && onApplySuggestion && (
                <div className="pt-1 pl-6">
                  <button
                    type="button"
                    onClick={() => onApplySuggestion(refSuggestion)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    Corrigir automaticamente para: <span className="font-mono">{refSuggestion}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Erro de Código Duplicado */}
          {!refError && refConflict && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-start gap-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400 animate-in fade-in slide-in-from-top-1">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
              <div className="leading-relaxed">
                O código <strong>{referenceCode}</strong> já pertence ao imóvel: <span className="underline italic">&quot;{refConflict.title}&quot;</span>. Digite outro número ou clique no ícone para gerar automaticamente.
              </div>
            </div>
          )}

          {/* Alerta de Divergência Sigla x Tipo Selecionado */}
          {!refError && !refConflict && refWarning && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-start gap-2 text-[11px] font-medium text-amber-700 dark:text-amber-300 animate-in fade-in slide-in-from-top-1">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
              <div className="leading-relaxed">
                {refWarning}
              </div>
            </div>
          )}
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
