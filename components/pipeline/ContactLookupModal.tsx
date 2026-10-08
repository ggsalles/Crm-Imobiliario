"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, X, User, Phone, Mail, Check, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Contact } from "@/lib/db";

interface ContactLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  selectedContactId?: string;
  onSelect: (contact: Contact) => void;
}

export function ContactLookupModal({
  isOpen,
  onClose,
  contacts = [],
  selectedContactId,
  onSelect,
}: ContactLookupModalProps) {
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

  // Filter contacts
  const safeContacts = contacts || [];
  const filteredContacts = useMemo(() => {
    if (!safeContacts.length) return [];
    const term = search.trim().toLowerCase();
    if (!term) return safeContacts;

    return safeContacts.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "").replace(/\D/g, "");
      const cleanTermPhone = term.replace(/\D/g, "");
      const role = (c.role || "").toLowerCase();
      const source = (c.source || "").toLowerCase();

      return (
        name.includes(term) ||
        email.includes(term) ||
        role.includes(term) ||
        source.includes(term) ||
        (cleanTermPhone && phone.includes(cleanTermPhone))
      );
    });
  }, [safeContacts, search]);

  const handleSelect = (contact: Contact) => {
    onSelect(contact);
    onClose();
  };

  const handleKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredContacts.length > 0) {
      e.preventDefault();
      handleSelect(filteredContacts[0]);
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
            className="bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xl relative z-10 w-full max-w-4xl flex flex-col max-h-[min(90vh,680px)] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between gap-3 bg-muted/20 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Pesquisar e Selecionar Cliente
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Digite para localizar rapidamente no grid ou clique diretamente na linha desejada
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
                  placeholder="Pesquisar por nome, telefone, e-mail, função ou canal..."
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
              {filteredContacts.length === 0 ? (
                <div className="py-14 px-4 text-center">
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
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground tracking-wider sticky top-0 backdrop-blur-md">
                        <th className="py-2.5 px-3 sm:px-4">Nome do Cliente</th>
                        <th className="py-2.5 px-3 sm:px-4">Telefone / WhatsApp</th>
                        <th className="py-2.5 px-3 sm:px-4 hidden sm:table-cell">E-mail</th>
                        <th className="py-2.5 px-3 sm:px-4 hidden md:table-cell">Perfil / Temperatura</th>
                        <th className="py-2.5 px-3 sm:px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredContacts.map((contact) => {
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
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                                  {contact.name?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div className="min-w-0">
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
                            <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                              {contact.phone ? (
                                <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground">
                                  <Phone className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                  <span>{contact.phone}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40 italic">Sem telefone</span>
                              )}
                            </td>

                            {/* Email */}
                            <td className="py-2.5 px-3 sm:px-4 hidden sm:table-cell truncate max-w-[200px]">
                              {contact.email ? (
                                <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                                  <Mail className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                  <span className="truncate">{contact.email}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40 italic">Sem e-mail</span>
                              )}
                            </td>

                            {/* Temperatura / Perfil */}
                            <td className="py-2.5 px-3 sm:px-4 hidden md:table-cell whitespace-nowrap text-muted-foreground">
                              {contact.temperature ? (
                                <span className="capitalize">{contact.temperature}</span>
                              ) : (
                                <span className="capitalize">{contact.type || "Cliente"}</span>
                              )}
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
                                    handleSelect(contact);
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
                Exibindo <strong className="text-foreground">{filteredContacts.length}</strong> de{" "}
                {safeContacts.length} clientes
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

