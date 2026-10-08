"use client";

import { useState, useMemo, useEffect, useRef, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { Search, X, User, Phone, Mail, Check, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Contact } from "@/lib/db";

interface ContactLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  selectedContactId?: string;
  onSelect: (contact: Contact) => void;
}

const PAGE_SIZE = 40;

export function ContactLookupModal({
  isOpen,
  onClose,
  contacts = [],
  selectedContactId,
  onSelect,
}: ContactLookupModalProps) {
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

  // Filter contacts efficiently
  const safeContacts = useMemo(() => contacts || [], [contacts]);
  const filteredContacts = useMemo(() => {
    if (!safeContacts.length) return [];
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return safeContacts;

    const cleanTermPhone = term.replace(/\D/g, "");

    return safeContacts.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const role = (c.role || "").toLowerCase();
      const source = (c.source || "").toLowerCase();
      const phone = (c.phone || "").replace(/\D/g, "");

      return (
        name.includes(term) ||
        email.includes(term) ||
        role.includes(term) ||
        source.includes(term) ||
        (cleanTermPhone.length > 2 && phone.includes(cleanTermPhone))
      );
    });
  }, [safeContacts, deferredSearch]);

  // Pagination calculation
  const totalItems = filteredContacts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedContacts = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredContacts.slice(start, start + PAGE_SIZE);
  }, [filteredContacts, safeCurrentPage]);

  const startRecord = totalItems === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const endRecord = Math.min(safeCurrentPage * PAGE_SIZE, totalItems);

  const handleSelect = (contact: Contact) => {
    onSelect(contact);
    onClose();
  };

  const handleKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && paginatedContacts.length > 0) {
      e.preventDefault();
      handleSelect(paginatedContacts[0]);
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
                  <User className="w-5 h-5 text-primary shrink-0" />
                  <span>Pesquisar e Selecionar Cliente</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  Digite para filtrar instantaneamente no grid ou clique diretamente na linha desejada
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
                  placeholder="Pesquisar por nome, telefone, e-mail, função ou canal..."
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
              {filteredContacts.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Nenhum cliente encontrado</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {search
                      ? `Não encontramos registros correspondentes ao termo "${search}".`
                      : "Nenhum cliente cadastrado no momento."}
                  </p>
                </div>
              ) : (
                <table className="w-full table-fixed text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/60 text-[10px] uppercase font-bold text-muted-foreground tracking-wider sticky top-0 backdrop-blur-md z-20">
                      <th className="py-3 px-3 sm:px-4 w-[36%] sm:w-[30%] md:w-[28%]">Nome do Cliente</th>
                      <th className="py-3 px-3 sm:px-4 w-[34%] sm:w-[26%] md:w-[22%]">Telefone / WhatsApp</th>
                      <th className="py-3 px-3 sm:px-4 hidden sm:table-cell sm:w-[26%] md:w-[24%]">E-mail</th>
                      <th className="py-3 px-3 sm:px-4 hidden md:table-cell md:w-[14%]">Origem / Perfil</th>
                      <th className="py-3 pl-2 pr-4 sm:pr-5 text-right w-[30%] sm:w-[18%] md:w-[12%]">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {paginatedContacts.map((contact) => {
                      const isSelected = selectedContactId === contact.id;
                      return (
                        <tr
                          key={contact.id}
                          onClick={() => handleSelect(contact)}
                          className={`group cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary/10 hover:bg-primary/15 font-semibold"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          {/* Nome & Avatar */}
                          <td className="py-2.5 px-3 sm:px-4">
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                                {contact.name?.charAt(0).toUpperCase() || "?"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-foreground font-bold truncate group-hover:text-primary transition-colors">
                                  {contact.name}
                                </div>
                                {contact.role && (
                                  <div className="text-[11px] text-muted-foreground truncate">
                                    {contact.role}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Telefone */}
                          <td className="py-2.5 px-3 sm:px-4">
                            {contact.phone ? (
                              <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground min-w-0">
                                <Phone className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                <span className="truncate">{contact.phone}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40 italic">Sem telefone</span>
                            )}
                          </td>

                          {/* Email */}
                          <td className="py-2.5 px-3 sm:px-4 hidden sm:table-cell">
                            {contact.email ? (
                              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                <Mail className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                <span className="truncate">{contact.email}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40 italic">Sem e-mail</span>
                            )}
                          </td>

                          {/* Origem / Perfil */}
                          <td className="py-2.5 px-3 sm:px-4 hidden md:table-cell text-muted-foreground">
                            <span className="truncate block capitalize">
                              {contact.temperature || contact.type || contact.source || "Cliente"}
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
                                  handleSelect(contact);
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
                  <strong className="text-foreground">{totalItems}</strong> clientes
                  {deferredSearch && safeContacts.length !== totalItems && (
                    <span className="text-muted-foreground/70"> (filtrados de {safeContacts.length})</span>
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

