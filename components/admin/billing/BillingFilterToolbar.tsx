"use client";

import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from "lucide-react";
import { BillingFilterStatus } from "./types";

interface BillingFilterToolbarProps {
  windowSize: number;
  periodDescription: string;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: BillingFilterStatus;
  setStatusFilter: (status: BillingFilterStatus) => void;
  totalCount: number;
  overdueCount: number;
  regularCount: number;
  blockedCount: number;
  stepMonths: (count: number) => void;
  goToCurrentPeriod: () => void;
  isCurrentMonthView: boolean;
  selectPreset: (year: number, semester: 1 | 2 | 12) => void;
  isPresetActive: (year: number, semester: 1 | 2 | 12) => boolean;
  currentYear: number;
  prevYear: number;
}

export function BillingFilterToolbar({
  windowSize,
  periodDescription,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  totalCount,
  overdueCount,
  regularCount,
  blockedCount,
  stepMonths,
  goToCurrentPeriod,
  isCurrentMonthView,
  selectPreset,
  isPresetActive,
  currentYear,
  prevYear
}: BillingFilterToolbarProps) {
  const curYearShort = String(currentYear).slice(-2);
  const prevYearShort = String(prevYear).slice(-2);

  return (
    <div className="p-3 sm:p-3.5 border-b border-slate-900/60 bg-slate-950/70 flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-xs sm:text-sm font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Lista de Clientes & Histórico de Parcelas
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
              {windowSize === 12 ? "Ano Completo (12M)" : "6 em 6 meses"}
            </span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Período: <span className="text-indigo-400 font-semibold">{periodDescription}</span>. Clique nas parcelas para alterar o status.
          </p>
        </div>
        
        {/* Search Bar & Status Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[170px]">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-500">
              <Search className="w-3 h-3" />
            </span>
            <input
              type="text"
              placeholder="Buscar imobiliária..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs py-1.5 pl-8 pr-2.5 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg focus:outline-none transition-all placeholder:text-slate-500 text-slate-200"
            />
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-2 py-1 rounded-md font-bold transition-all text-[10px] ${statusFilter === "all" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              Todos ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter("overdue")}
              className={`px-2 py-1 rounded-md font-bold transition-all text-[10px] ${statusFilter === "overdue" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              Pendência ({overdueCount})
            </button>
            <button
              onClick={() => setStatusFilter("regular")}
              className={`px-2 py-1 rounded-md font-bold transition-all text-[10px] ${statusFilter === "regular" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              Regulares ({regularCount})
            </button>
            <button
              onClick={() => setStatusFilter("blocked")}
              className={`px-2 py-1 rounded-md font-bold transition-all text-[10px] ${statusFilter === "blocked" ? "bg-rose-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
            >
              Bloqueados ({blockedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Period Selector and 6-Month Navigation */}
      <div className="pt-2 border-t border-slate-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Stepper Navigation */}
        <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => stepMonths(-6)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer flex items-center gap-0.5 font-bold text-[10px]"
            title="Retroceder 6 meses no tempo (-6 Meses)"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
            <span>6 Meses Ant.</span>
          </button>

          <button
            onClick={() => stepMonths(-1)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer flex items-center gap-0.5 font-bold text-[10px]"
            title="Retroceder 1 mês (-1 Mês)"
          >
            <ChevronLeft className="w-3 h-3" />
            <span className="hidden sm:inline">Mês Ant.</span>
          </button>

          <button
            onClick={goToCurrentPeriod}
            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
              isCurrentMonthView
                ? "bg-indigo-600 text-white shadow-xs" 
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
            title="Retornar para o período atual (centralizado no mês de hoje)"
          >
            Mês Atual
          </button>

          <button
            onClick={() => stepMonths(1)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer flex items-center gap-0.5 font-bold text-[10px]"
            title="Avançar 1 mês (+1 Mês)"
          >
            <span className="hidden sm:inline">Próx. Mês</span>
            <ChevronRight className="w-3 h-3" />
          </button>

          <button
            onClick={() => stepMonths(6)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer flex items-center gap-0.5 font-bold text-[10px]"
            title="Avançar 6 meses no tempo (+6 Meses)"
          >
            <span>Próximos 6M</span>
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Period Presets */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-slate-500 font-mono mr-0.5">Período:</span>
          
          <button
            onClick={() => selectPreset(currentYear, 1)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
              isPresetActive(currentYear, 1)
                ? "bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-xs" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
            title={`1º Semestre de ${currentYear}`}
          >
            1º Sem/{curYearShort}
          </button>

          <button
            onClick={() => selectPreset(currentYear, 2)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
              isPresetActive(currentYear, 2)
                ? "bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-xs" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
            title={`2º Semestre de ${currentYear}`}
          >
            2º Sem/{curYearShort}
          </button>

          <button
            onClick={() => selectPreset(currentYear, 12)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
              isPresetActive(currentYear, 12)
                ? "bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-xs" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
            title={`Ano Completo de ${currentYear}`}
          >
            Ano {currentYear}
          </button>

          <button
            onClick={() => selectPreset(prevYear, 2)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
              isPresetActive(prevYear, 2)
                ? "bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-xs" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
            title={`2º Semestre de ${prevYear}`}
          >
            2º Sem/{prevYearShort}
          </button>

          <button
            onClick={() => selectPreset(prevYear, 1)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
              isPresetActive(prevYear, 1)
                ? "bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-xs" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
            title={`1º Semestre de ${prevYear}`}
          >
            1º Sem/{prevYearShort}
          </button>

          <button
            onClick={() => selectPreset(prevYear, 12)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
              isPresetActive(prevYear, 12)
                ? "bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-xs" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
            title={`Ano Completo de ${prevYear}`}
          >
            Ano {prevYear}
          </button>
        </div>
      </div>
    </div>
  );
}
