"use client";

import Image from "next/image";
import { Search, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  items: any[];
  activeTab: "client" | "team";
  onSelectContact: (contact: any) => void;
  onSelectProfile: (profile: any) => void;
}

export function NewChatModal({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  items,
  activeTab,
  onSelectContact,
  onSelectProfile,
}: NewChatModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-5 border-b border-border">
              <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">
                Nova Conversa
              </h3>
              <p className="text-muted-foreground text-xs mt-0.5 font-medium">
                Selecione um contato para iniciar o chat.
              </p>
            </div>

            <div className="p-4 md:p-5">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Pesquisar contatos..."
                  className="w-full bg-background border border-border rounded-xl py-2 pl-9 pr-3 text-xs md:text-sm focus:ring-2 focus:ring-primary/20 text-foreground font-medium outline-none"
                />
              </div>

              <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
                {items.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-xs italic font-medium">
                      Nenhum {activeTab === "client" ? "contato" : "membro da equipe"} encontrado.
                    </p>
                  </div>
                ) : (
                  items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        activeTab === "client"
                          ? onSelectContact(item)
                          : onSelectProfile(item)
                      }
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-all text-left group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden relative shadow-xs bg-muted border border-border shrink-0">
                        <Image
                          src={
                            item.photoURL ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              activeTab === "client" ? item.name : item.displayName
                            )}&background=0D8ABC&color=fff`
                          }
                          alt={activeTab === "client" ? item.name : item.displayName}
                          fill
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-foreground text-xs md:text-sm group-hover:text-primary transition-colors uppercase tracking-tight truncate">
                          {activeTab === "client" ? item.name : item.displayName}
                        </h4>
                        <p className="text-[11px] text-muted-foreground truncate font-medium">
                          {item.email}
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 bg-muted/30 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
