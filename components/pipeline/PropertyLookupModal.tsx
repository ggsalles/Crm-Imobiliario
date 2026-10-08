"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, X, Home, Building2, MapPin, Check, ArrowRight } from "lucide-react";
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

export function PropertyLookupModal({
  isOpen,
  onClose,
  properties = [],
  selectedPropertyId,
  onSelect,
}: PropertyLookupModalProps) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto focus on open & clear search
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  // Filter properties
  const safeProperties = properties || [];
  const filteredProperties = useMemo(() => {
    if (!safeProperties.length) return [];
    const term = search.trim().toLowerCase();
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
  }, [safeProperties, search]);

  const handleSelect = (property: Property) => {
    onSelect(property);
    onClose();
  };

  const handleKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredProperties.length > 0) {
      e.preventDefault();
      handleSelect(filteredProperties[0]);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          style={{ zIndex: 99999 }}
          className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xl relative z-10 w-full max-w-5xl flex flex-col max-h-[min(90vh,720px)] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between gap-3 bg-muted/20 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Pesquisar e Selecionar Imóvel
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pesquise por código REF, título, tipo, bairro ou valor para vincular à oportunidade
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      inputRef.current?.focus();
                    }}
                    className="absolute right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Limpar pesquisa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Results Grid / Table */}
            <div className="flex-1 overflow-y-auto">
              {filteredProperties.length === 0 ? (
                <div className="py-14 px-4 text-center">
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
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground tracking-wider sticky top-0 backdrop-blur-md">
                        <th className="py-2.5 px-3 sm:px-4">Código / Imóvel</th>
                        <th className="py-2.5 px-3 sm:px-4 hidden sm:table-cell">Tipo</th>
                        <th className="py-2.5 px-3 sm:px-4 hidden md:table-cell">Localização</th>
                        <th className="py-2.5 px-3 sm:px-4">Valor</th>
                        <th className="py-2.5 px-3 sm:px-4 hidden sm:table-cell">Status</th>
                        <th className="py-2.5 px-3 sm:px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredProperties.map((prop) => {
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
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border/60">
                                  {photoUrl ? (
                                    <img
                                      src={photoUrl}
                                      alt={prop.title}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <Home className="w-5 h-5 text-muted-foreground/60" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {refCode && (
                                      <span className="font-mono text-[10px] font-bold text-primary">
                                        [{refCode}]
                                      </span>
                                    )}
                                    <span className="text-foreground font-bold truncate group-hover:text-primary transition-colors max-w-[240px] sm:max-w-[280px]">
                                      {prop.title}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 sm:hidden mt-0.5">
                                    <span className="capitalize">{prop.type}</span>
                                    {(prop.neighborhood || prop.city) && (
                                      <>
                                        <span>·</span>
                                        <span>{prop.neighborhood || prop.city}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Tipo */}
                            <td className="py-2.5 px-3 sm:px-4 hidden sm:table-cell whitespace-nowrap capitalize text-muted-foreground">
                              {prop.type || "Geral"}
                            </td>

                            {/* Localização */}
                            <td className="py-2.5 px-3 sm:px-4 hidden md:table-cell text-muted-foreground max-w-[180px] truncate">
                              <div className="flex items-center gap-1 truncate">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                <span className="truncate">
                                  {prop.neighborhood
                                    ? `${prop.neighborhood}${prop.city ? `, ${prop.city}` : ""}`
                                    : prop.city || prop.location || "Não informada"}
                                </span>
                              </div>
                            </td>

                            {/* Valor */}
                            <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                              <span className="font-mono font-bold text-foreground">
                                {prop.price ? formatCurrencyBRL(prop.price) : "A consultar"}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3 sm:px-4 hidden sm:table-cell whitespace-nowrap">
                              <span
                                className={`text-[11px] font-medium capitalize ${
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
                            <td className="py-2.5 px-3 sm:px-4 text-right whitespace-nowrap">
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-primary hover:text-white transition-all cursor-pointer"
                                >
                                  Selecionar
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-3.5 border-t border-border/70 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
              <span>
                Exibindo <strong className="text-foreground">{filteredProperties.length}</strong> de{" "}
                {safeProperties.length} imóveis
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted font-medium transition-colors cursor-pointer"
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

