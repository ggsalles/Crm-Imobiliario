"use client";

import { X, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { formatPhone } from "@/lib/utils";
import { Contact } from "@/lib/db";

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingContact: Contact | null;
  activeTab: 'cliente' | 'equipe';
  displayPhone: string;
  setDisplayPhone: (val: string) => void;
  onSave: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteRequest: (contact: Contact) => void;
}

export function ContactFormModal({
  isOpen,
  onClose,
  editingContact,
  activeTab,
  displayPhone,
  setDisplayPhone,
  onSave,
  onDeleteRequest
}: ContactFormModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-2xl p-5 md:p-6 w-full max-w-lg relative shadow-xl overflow-hidden border border-border"
          >
            <button 
              onClick={onClose}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            
            <h2 className="text-xl font-black tracking-tight mb-4">
              {editingContact ? 'Editar Contato' : `Novo ${activeTab === 'cliente' ? 'Cliente' : 'Membro'}`}
            </h2>

            <form onSubmit={onSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Nome Completo</label>
                  <input 
                    name="name"
                    required
                    defaultValue={editingContact?.name}
                    placeholder="Ex: Maria Oliveira"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">E-mail</label>
                  <input 
                    name="email"
                    type="email"
                    required
                    defaultValue={editingContact?.email}
                    placeholder="maria@exemplo.com"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Telefone</label>
                  <input 
                    name="phone"
                    value={displayPhone}
                    onChange={(e) => setDisplayPhone(formatPhone(e.target.value))}
                    placeholder="55 11 99999-9999"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  />
                </div>
                {activeTab === 'cliente' ? (
                  <>
                    <div className="col-span-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Origem (Como chegou?)</label>
                      <select 
                        name="source"
                        defaultValue={editingContact?.source} 
                        className="w-full pl-3 pr-8 py-2 rounded-xl border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em] text-xs font-medium"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                      >
                        <option value="" className="bg-card">Selecione uma origem</option>
                        <option value="Instagram" className="bg-card">Instagram</option>
                        <option value="WhatsApp" className="bg-card">WhatsApp</option>
                        <option value="Facebook" className="bg-card">Facebook</option>
                        <option value="Site" className="bg-card">Site / Landing Page</option>
                        <option value="Indicação" className="bg-card">Indicação</option>
                        <option value="Portal Imobiliário" className="bg-card">Portal Imobiliário</option>
                        <option value="Telefone" className="bg-card">Ligação Direta</option>
                        <option value="Outro" className="bg-card">Outro</option>
                      </select>
                    </div>

                    <div className="col-span-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Temperatura do Lead</label>
                      <select 
                        name="temperature"
                        defaultValue={
                          (editingContact as any)?.rawRole === 'manual_quente' ? 'quente' :
                          (editingContact as any)?.rawRole === 'manual_morno' ? 'morno' :
                          (editingContact as any)?.rawRole === 'manual_frio' ? 'frio' : 'auto'
                        } 
                        className="w-full pl-3 pr-8 py-2 rounded-xl border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em] text-xs font-medium"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                      >
                        <option value="auto" className="bg-card">🤖 Inteligente (Baseado no Funil)</option>
                        <option value="quente" className="bg-card">🔥 Forçar Quente</option>
                        <option value="morno" className="bg-card">⚡ Forçar Morno</option>
                        <option value="frio" className="bg-card">❄️ Forçar Frio</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Cargo / Função</label>
                      <input 
                        name="role"
                        defaultValue={editingContact?.role}
                        placeholder="Ex: Corretor Sênior"
                        className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Departamento</label>
                      <input 
                        name="department"
                        defaultValue={editingContact?.department}
                        placeholder="Ex: Vendas / Aluguel"
                        className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-2 flex gap-2">
                {editingContact && (
                  <button 
                    type="button"
                    onClick={() => onDeleteRequest(editingContact)}
                    className="px-3 py-2 rounded-xl transition-all border text-red-500 hover:bg-red-500/10 border-red-500/20 flex items-center justify-center cursor-pointer"
                    title="Excluir este contato"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 font-bold text-xs md:text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors border border-border cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 font-bold text-xs md:text-sm bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all shadow-md shadow-primary/20 cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
