"use client";

import { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { Search, X, Home, Building2, MapPin, Check, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Property } from "@/lib/db";
import { formatCurrencyBRL } from "@/lib/utils";

interface PropertyLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  selectedPropertyId?: string;
  onSelect: (property: Property) => void;
}

const PAGE_SIZE = 40;

export function PropertyLookupModal({
  isOpen,
  onClose,
  properties = [],
  selectedPropertyId,
  onSelect,
}: PropertyLookupModalProps) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [currentPage, setCurrentPage] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto focus on open & clear search
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setCurrentPage(1);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset to page 1 whenever search query changes
  useEffect(() => {
    setCurrentPage(1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [deferredSearch]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filter properties efficiently
  const safeProperties = useMemo(() => properties || [], [properties]);
  const filteredProperties = useMemo(() => {
    if (!safeProperties.length) return [];
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return safeProperties;

    return safeProperties.filter((p) => {
      const ref = ((p.referenceCode || p.reference_code) || "").toLowerCase();
      const title = (p.title || "").toLowerCase();
      const type = (p.type || "").toLowerCase();
      const neighborhood = (p.neighborhood || "").toLowerCase();
      const city = (p.city || "").toLowerCase();
      const location = (p.location || "").toLowerCase();
      const priceStr = p.price ? p.price.toString() : "";

      return (
        ref.includes(term) ||
        title.includes(term) ||
        type.includes(term) ||
        neighborhood.includes(term) ||
        city.includes(term) ||
        location.includes(term) ||
        priceStr.includes(term)
      );
    });
  }, [safeProperties, deferredSearch]);

  // Pagination calculation
  const totalItems = filteredProperties.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedProperties = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredProperties.slice(start, start + PAGE_SIZE);
  }, [filteredProperties, safeCurrentPage]);

  const startRecord = totalItems === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const endRecord = Math.min(safeCurrentPage * PAGE_SIZE, totalItems);

  const handleSelect = (property: Property) => {
    onSelect(property);
    onClose();
  };

  const handleKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && paginatedProperties.length > 0) {
      e.preventDefault();
      handleSelect(paginatedProperties[0]);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          style={{ zIndex: 99999 }}
          className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 md:p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ scale: 0.97, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xl relative z-10 w-full max-w-5xl xl:max-w-6xl flex flex-col h-[90vh] max-h-[720px] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between gap-3 bg-muted/20 shrink-0">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2 truncate">
                  <Building2 className="w-5 h-5 text-primary shrink-0" />
                  <span>Pesquisar e Selecionar Imóvel</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  Pesquise por REF, título, tipo, bairro ou valor para vincular à oportunidade
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 sm:p-4 border-b border-border/50 bg-background shrink-0">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDownSearch}
                  placeholder="Pesquisar por REF, título, tipo de imóvel, bairro, cidade ou preço..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      inputRef.current?.focus();
                    }}
                    className="absolute right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                    title="Limpar pesquisa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Results Grid / Table */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden discrete-scrollbar bg-card">
              {filteredProperties.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Nenhum imóvel encontrado</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {search
                      ? `Não encontramos imóveis correspondentes ao termo "${search}".`
                      : "Nenhum imóvel cadastrado no momento."}
                  </p>
                </div>
              ) : (
                <table className="w-full table-fixed text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/60 text-[10px] uppercase font-bold text-muted-foreground tracking-wider sticky top-0 backdrop-blur-md z-20">
                      <th className="py-3 px-3 sm:px-4 w-[42%] sm:w-[34%] md:w-[28%] lg:w-[28%]">Código / Imóvel</th>
                      <th className="py-3 px-3 sm:px-4 hidden sm:table-cell sm:w-[16%] md:w-[13%]">Tipo</th>
                      <th className="py-3 px-3 sm:px-4 hidden md:table-cell md:w-[21%] lg:w-[21%]">Localização</th>
                      <th className="py-3 px-3 sm:px-4 w-[28%] sm:w-[24%] md:w-[18%] lg:w-[16%]">Valor</th>
                      <th className="py-3 px-3 sm:px-4 hidden lg:table-cell lg:w-[11%]">Status</th>
                      <th className="py-3 pl-2 pr-4 sm:pr-5 text-right w-[30%] sm:w-[26%] md:w-[20%] lg:w-[11%]">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {paginatedProperties.map((prop) => {
                      const isSelected = selectedPropertyId === prop.id;
                      const refCode = prop.referenceCode || prop.reference_code || "";
                      const photoUrl = prop.imageUrls && prop.imageUrls.length > 0 ? prop.imageUrls[0] : null;

                      return (
                        <tr
                          key={prop.id}
                          onClick={() => handleSelect(prop)}
                          className={`group cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary/10 hover:bg-primary/15 font-semibold"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          {/* Código / Imóvel com foto */}
                          <td className="py-2.5 px-3 sm:px-4">
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border/60">
                                {photoUrl ? (
                                  <img
                                    src={photoUrl}
                                    alt={prop.title || "Imóvel"}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Home className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/60" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1 min-w-0">
                                  {refCode && (
                                    <span className="font-mono text-[10px] font-bold text-primary shrink-0">
                                      [{refCode}]
                                    </span>
                                  )}
                                  <span className="text-foreground font-bold truncate group-hover:text-primary transition-colors">
                                    {prop.title}
                                  </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 sm:hidden mt-0.5">
                                  <span className="capitalize">{prop.type}</span>
                                  {(prop.neighborhood || prop.city) && (
                                    <>
                                      <span>·</span>
                                      <span className="truncate">{prop.neighborhood || prop.city}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Tipo */}
                          <td className="py-2.5 px-3 sm:px-4 hidden sm:table-cell text-muted-foreground">
                            <span className="truncate block capitalize">{prop.type || "Geral"}</span>
                          </td>

                          {/* Localização */}
                          <td className="py-2.5 px-3 sm:px-4 hidden md:table-cell text-muted-foreground">
                            <div className="flex items-center gap-1 min-w-0">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                              <span className="truncate">
                                {prop.neighborhood
                                  ? `${prop.neighborhood}${prop.city ? `, ${prop.city}` : ""}`
                                  : prop.city || prop.location || "Não informada"}
                              </span>
                            </div>
                          </td>

                          {/* Valor */}
                          <td className="py-2.5 px-3 sm:px-4">
                            <span className="font-mono font-bold text-foreground truncate block">
                              {prop.price ? formatCurrencyBRL(prop.price) : "A consultar"}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 sm:px-4 hidden lg:table-cell">
                            <span
                              className={`text-[11px] font-medium capitalize truncate block ${
                                prop.status === "disponível"
                                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                  : prop.status === "reservado"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {prop.status || "disponível"}
                            </span>
                          </td>

                          {/* Ação */}
                          <td className="py-2.5 pl-2 pr-4 sm:pr-5 text-right">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                                <Check className="w-3.5 h-3.5" />
                                Selecionado
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelect(prop);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all cursor-pointer shrink-0"
                              >
                                <span>Selecionar</span>
                                <ArrowRight className="w-3 h-3 shrink-0" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer com Paginação Rápida */}
            <div className="p-3 sm:p-3.5 border-t border-border/70 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground shrink-0">
              <div className="flex items-center gap-1.5">
                <span>
                  Exibindo <strong className="text-foreground">{startRecord}–{endRecord}</strong> de{" "}
                  <strong className="text-foreground">{totalItems}</strong> imóveis
                  {deferredSearch && safeProperties.length !== totalItems && (
                    <span className="text-muted-foreground/70"> (filtrados de {safeProperties.length})</span>
                  )}
                </span>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center gap-2 ml-auto">
                {totalPages > 1 && (
                  <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => handlePageChange(safeCurrentPage - 1)}
                      disabled={safeCurrentPage <= 1}
                      className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-foreground"
                      title="Página Anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-[11px] font-semibold text-foreground whitespace-nowrap">
                      Pág. {safeCurrentPage} de {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePageChange(safeCurrentPage + 1)}
                      disabled={safeCurrentPage >= totalPages}
                      className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer text-foreground"
                      title="Próxima Página"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted font-medium transition-colors cursor-pointer text-foreground text-xs"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

