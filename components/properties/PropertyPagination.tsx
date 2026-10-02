"use client";

import React, { useState } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  RotateCcw,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PropertyPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number | 'all';
  totalFiltered: number;
  totalCatalog: number;
  activeFiltersCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number | 'all') => void;
  onClearFilters?: () => void;
  variant?: 'top' | 'bottom';
  className?: string;
  itemLabel?: string;
  theme?: 'default' | 'dark';
}

export function PropertyPagination({
  currentPage,
  totalPages,
  pageSize,
  totalFiltered,
  totalCatalog,
  activeFiltersCount = 0,
  onPageChange,
  onPageSizeChange,
  onClearFilters,
  variant = 'bottom',
  className,
  itemLabel = 'imóveis',
  theme = 'default'
}: PropertyPaginationProps) {
  const [jumpPageInput, setJumpPageInput] = useState("");
  const isDark = theme === 'dark';

  const startItem = pageSize === 'all' 
    ? (totalFiltered > 0 ? 1 : 0)
    : Math.min((currentPage - 1) * (Number(pageSize) || 24) + 1, totalFiltered);
    
  const endItem = pageSize === 'all'
    ? totalFiltered
    : Math.min(currentPage * (Number(pageSize) || 24), totalFiltered);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPageInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target);
      setJumpPageInput("");
    }
  };

  // Generate intelligent page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
    
    // Always include page 1
    pages.push(1);

    if (currentPage > 3) {
      pages.push('ellipsis-start');
    }

    // Pages around current
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis-end');
    }

    // Always include last page
    pages.push(totalPages);

    return pages;
  };

  // Top Bar Variant: Compact, ultra clean & fast
  if (variant === 'top') {
    return (
      <div className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs p-3 rounded-2xl",
        isDark 
          ? "bg-slate-900/90 backdrop-blur-md border border-slate-800 text-slate-300 shadow-xl"
          : "bg-card/80 backdrop-blur-xs border border-border text-foreground shadow-xs",
        className
      )}>
        {/* Results Counter & Filter notice */}
        <div className="flex flex-wrap items-center gap-2 font-medium">
          <span className={isDark ? "text-slate-400" : "text-muted-foreground"}>
            Exibindo <strong className={cn("font-bold", isDark ? "text-white" : "text-foreground")}>{startItem}–{endItem}</strong> de <strong className={cn("font-bold", isDark ? "text-white" : "text-foreground")}>{totalFiltered}</strong> {itemLabel}
            {totalCatalog !== totalFiltered && (
              <span className={cn("font-normal", isDark ? "text-slate-500" : "text-muted-foreground/80")}> (total no acervo: {totalCatalog})</span>
            )}
          </span>
          {activeFiltersCount > 0 && (
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-bold",
              isDark 
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                : "bg-primary/10 text-primary"
            )}>
              {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros'}
            </span>
          )}
          {onClearFilters && totalFiltered < totalCatalog && activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className={cn(
                "text-[11px] font-bold hover:underline flex items-center gap-1 cursor-pointer ml-1",
                isDark ? "text-blue-400 hover:text-blue-300" : "text-primary"
              )}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>

        {/* Navigation & Page Size Controls */}
        <div className="flex flex-wrap items-center gap-3 justify-between sm:justify-end">
          {/* Quick Page Nav if multiple pages */}
          {totalPages > 1 && pageSize !== 'all' && (
            <div className={cn(
              "flex items-center gap-1 p-0.5 rounded-xl border",
              isDark 
                ? "bg-slate-800/90 border-slate-700/80 shadow-xs" 
                : "bg-muted/50 border-border/40"
            )}>
              <button
                type="button"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                title="Primeira página"
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer",
                  isDark 
                    ? "text-slate-300 hover:text-white hover:bg-slate-700/70 disabled:text-slate-600" 
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                )}
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                title="Página anterior"
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer",
                  isDark 
                    ? "text-slate-300 hover:text-white hover:bg-slate-700/70 disabled:text-slate-600" 
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                )}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className={cn(
                "px-2 text-[11px] font-semibold flex items-center gap-1",
                isDark ? "text-slate-300" : "text-foreground"
              )}>
                <span>Pág.</span>
                <span className={cn("font-bold", isDark ? "text-blue-400" : "text-primary")}>{currentPage}</span>
                <span className={isDark ? "text-slate-500" : "text-muted-foreground"}>/</span>
                <span className={isDark ? "text-slate-300" : "text-foreground"}>{totalPages}</span>
              </div>

              <button
                type="button"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                title="Próxima página"
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer",
                  isDark 
                    ? "text-slate-300 hover:text-white hover:bg-slate-700/70 disabled:text-slate-600" 
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                )}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                title="Última página"
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer",
                  isDark 
                    ? "text-slate-300 hover:text-white hover:bg-slate-700/70 disabled:text-slate-600" 
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                )}
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className={cn("font-medium", isDark ? "text-slate-400" : "text-muted-foreground")}>Por pág:</span>
            <div className={cn(
              "inline-flex rounded-xl p-0.5 border shadow-xs",
              isDark ? "bg-slate-800/90 border-slate-700/80" : "bg-muted/60 border-border/50"
            )}>
              {([24, 48, 96, 'all'] as const).map((size) => (
                <button
                  key={String(size)}
                  type="button"
                  onClick={() => onPageSizeChange(size)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                    pageSize === size 
                      ? (isDark 
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" 
                          : "bg-primary text-primary-foreground shadow-2xs")
                      : (isDark 
                          ? "text-slate-300 hover:text-white hover:bg-slate-700/70" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/80")
                  )}
                >
                  {size === 'all' ? 'Todos' : size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Bottom Variant: Complete suite with direct jump input and smart ellipses
  return (
    <div className={cn(
      "flex flex-col md:flex-row items-center justify-between gap-4 py-5 px-4 rounded-2xl",
      isDark 
        ? "bg-slate-900/90 border border-slate-800 text-slate-300 shadow-xl"
        : "border-t border-border/80 bg-card/40 text-foreground",
      className
    )}>
      {/* Range Status */}
      <div className={cn("text-xs text-center md:text-left", isDark ? "text-slate-400" : "text-muted-foreground")}>
        Mostrando <strong className={cn("font-bold", isDark ? "text-white" : "text-foreground")}>{startItem}</strong> até <strong className={cn("font-bold", isDark ? "text-white" : "text-foreground")}>{endItem}</strong> de <strong className={cn("font-bold", isDark ? "text-white" : "text-foreground")}>{totalFiltered}</strong> {itemLabel}
        {totalPages > 1 && pageSize !== 'all' && (
          <span className={cn("ml-1", isDark ? "text-slate-400" : "text-muted-foreground/75")}>
            (Página <strong className={cn("font-bold", isDark ? "text-white" : "text-foreground")}>{currentPage}</strong> de <strong className={cn("font-bold", isDark ? "text-white" : "text-foreground")}>{totalPages}</strong>)
          </span>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && pageSize !== 'all' && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="Primeira página"
            className={cn(
              "p-2 rounded-xl border disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer",
              isDark 
                ? "bg-slate-800 border-slate-700/80 text-slate-200 hover:bg-slate-700 hover:text-white" 
                : "border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={cn(
              "px-3 py-2 rounded-xl border disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1 text-xs font-bold",
              isDark 
                ? "bg-slate-800 border-slate-700/80 text-slate-200 hover:bg-slate-700 hover:text-white" 
                : "border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          {/* Numbered Pills */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((item, idx) => {
              if (item === 'ellipsis-start' || item === 'ellipsis-end') {
                return (
                  <span key={`${item}-${idx}`} className={cn("px-1.5 text-xs select-none", isDark ? "text-slate-500" : "text-muted-foreground")}>
                    ...
                  </span>
                );
              }

              const pageNum = item as number;
              const isActive = currentPage === pageNum;

              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    "w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    isActive
                      ? (isDark 
                          ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30 scale-105" 
                          : "bg-primary text-primary-foreground shadow-sm scale-105")
                      : (isDark 
                          ? "bg-slate-800 text-slate-300 border border-slate-700/80 hover:bg-slate-700 hover:text-white" 
                          : "bg-card text-foreground border border-border hover:bg-muted")
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={cn(
              "px-3 py-2 rounded-xl border disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1 text-xs font-bold",
              isDark 
                ? "bg-slate-800 border-slate-700/80 text-slate-200 hover:bg-slate-700 hover:text-white" 
                : "border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            title="Última página"
            className={cn(
              "p-2 rounded-xl border disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer",
              isDark 
                ? "bg-slate-800 border-slate-700/80 text-slate-200 hover:bg-slate-700 hover:text-white" 
                : "border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Jump to specific page input */}
      {totalPages > 3 && pageSize !== 'all' && (
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
          <span className={cn("text-xs whitespace-nowrap", isDark ? "text-slate-400" : "text-muted-foreground")}>Ir para pág:</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpPageInput}
            onChange={(e) => setJumpPageInput(e.target.value)}
            placeholder={String(currentPage)}
            className={cn(
              "w-14 h-8 px-2 text-center text-xs font-bold rounded-lg border focus:outline-hidden",
              isDark 
                ? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" 
                : "border-border bg-card text-foreground focus:ring-2 focus:ring-primary"
            )}
          />
          <button
            type="submit"
            disabled={!jumpPageInput || parseInt(jumpPageInput, 10) < 1 || parseInt(jumpPageInput, 10) > totalPages}
            className={cn(
              "h-8 px-2.5 rounded-lg text-xs font-bold disabled:opacity-30 transition-all flex items-center justify-center cursor-pointer",
              isDark 
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20" 
                : "bg-primary text-primary-foreground hover:opacity-90"
            )}
            title="Ir para a página"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}

export const UniversalPagination = PropertyPagination;

