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
  className
}: PropertyPaginationProps) {
  const [jumpPageInput, setJumpPageInput] = useState("");

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
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-card/80 backdrop-blur-xs p-3 rounded-2xl border border-border shadow-xs",
        className
      )}>
        {/* Results Counter & Filter notice */}
        <div className="flex flex-wrap items-center gap-2 font-medium">
          <span className="text-muted-foreground">
            Exibindo <strong className="text-foreground font-bold">{startItem}–{endItem}</strong> de <strong className="text-foreground font-bold">{totalFiltered}</strong> imóveis
            {totalCatalog !== totalFiltered && (
              <span className="text-muted-foreground/80 font-normal"> (total no acervo: {totalCatalog})</span>
            )}
          </span>
          {activeFiltersCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">
              {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros'}
            </span>
          )}
          {onClearFilters && totalFiltered < totalCatalog && activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer ml-1"
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
            <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-xl border border-border/40">
              <button
                type="button"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                title="Primeira página"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                title="Página anterior"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="px-2 text-[11px] font-semibold text-foreground flex items-center gap-1">
                <span>Pág.</span>
                <span className="font-bold text-primary">{currentPage}</span>
                <span className="text-muted-foreground">/</span>
                <span>{totalPages}</span>
              </div>

              <button
                type="button"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                title="Próxima página"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                title="Última página"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground font-medium">Por pág:</span>
            <div className="inline-flex rounded-xl p-0.5 bg-muted/60 border border-border/50">
              {([24, 48, 96, 'all'] as const).map((size) => (
                <button
                  key={String(size)}
                  type="button"
                  onClick={() => onPageSizeChange(size)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                    pageSize === size 
                      ? "bg-primary text-primary-foreground shadow-2xs" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
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
      "flex flex-col md:flex-row items-center justify-between gap-4 py-5 px-3 border-t border-border/80 bg-card/40 rounded-2xl",
      className
    )}>
      {/* Range Status */}
      <div className="text-xs text-muted-foreground text-center md:text-left">
        Mostrando <strong className="text-foreground">{startItem}</strong> até <strong className="text-foreground">{endItem}</strong> de <strong className="text-foreground">{totalFiltered}</strong> imóveis
        {totalPages > 1 && pageSize !== 'all' && (
          <span className="ml-1 text-muted-foreground/75">
            (Página <strong className="text-foreground">{currentPage}</strong> de <strong className="text-foreground">{totalPages}</strong>)
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
            className="p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          {/* Numbered Pills */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((item, idx) => {
              if (item === 'ellipsis-start' || item === 'ellipsis-end') {
                return (
                  <span key={`${item}-${idx}`} className="px-1.5 text-xs text-muted-foreground select-none">
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
                      ? "bg-primary text-primary-foreground shadow-sm scale-105"
                      : "bg-card text-foreground border border-border hover:bg-muted"
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
            className="px-3 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
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
            className="p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Jump to specific page input */}
      {totalPages > 3 && pageSize !== 'all' && (
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Ir para pág:</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpPageInput}
            onChange={(e) => setJumpPageInput(e.target.value)}
            placeholder={String(currentPage)}
            className="w-14 h-8 px-2 text-center text-xs font-bold rounded-lg border border-border bg-card focus:outline-hidden focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!jumpPageInput || parseInt(jumpPageInput, 10) < 1 || parseInt(jumpPageInput, 10) > totalPages}
            className="h-8 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-30 transition-all flex items-center justify-center cursor-pointer"
            title="Ir para a página"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}
