"use client";

import { motion, AnimatePresence } from "motion/react";
import { Compass, X, Check, Loader2 } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/utils";

interface ContactInterestModalProps {
  isOpen: boolean;
  onClose: () => void;
  formMaxPrice: string;
  setFormMaxPrice: (val: string) => void;
  formMinBedrooms: string;
  setFormMinBedrooms: (val: string) => void;
  formPropertyType: string;
  setFormPropertyType: (val: string) => void;
  formTemperature: 'auto' | 'quente' | 'morno' | 'frio';
  setFormTemperature: (val: 'auto' | 'quente' | 'morno' | 'frio') => void;
  formNeighborhoodsText: string;
  setFormNeighborhoodsText: (val: string) => void;
  isUpdatingProfile: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function ContactInterestModal({
  isOpen,
  onClose,
  formMaxPrice,
  setFormMaxPrice,
  formMinBedrooms,
  setFormMinBedrooms,
  formPropertyType,
  setFormPropertyType,
  formTemperature,
  setFormTemperature,
  formNeighborhoodsText,
  setFormNeighborhoodsText,
  isUpdatingProfile,
  onSubmit
}: ContactInterestModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-card w-full max-w-xl rounded-[32px] border border-border shadow-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-border flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Filtros de Perfil de Interesse</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-all border border-border cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 block mb-1.5">Orçamento Máximo (R$)</label>
                <input
                  type="text"
                  placeholder="R$ 0,00"
                  value={formMaxPrice}
                  onChange={(e) => setFormMaxPrice(formatCurrencyBRL(e.target.value))}
                  className="w-full px-5 py-4 rounded-2xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 block mb-1.5">Mínimo de Quartos</label>
                <input
                  type="number"
                  placeholder="Ex: 3"
                  value={formMinBedrooms}
                  onChange={(e) => setFormMinBedrooms(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 block mb-1.5">Tipo de Imóvel</label>
                <select
                  value={formPropertyType}
                  onChange={(e) => setFormPropertyType(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold font-sans"
                >
                  <option value="todos">Todos os Tipos</option>
                  <option value="casa">Casa</option>
                  <option value="apartamento">Apartamento</option>
                  <option value="terreno">Terreno</option>
                  <option value="comercial">Comercial</option>
                  <option value="sobrado">Sobrado</option>
                  <option value="cobertura">Cobertura</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 block mb-1.5">Temperatura do Lead</label>
                <select
                  value={formTemperature}
                  onChange={(e) => setFormTemperature(e.target.value as any)}
                  className="w-full px-5 py-4 rounded-2xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold font-sans"
                >
                  <option value="auto">🤖 Inteligente (Calculado pelo Funil)</option>
                  <option value="quente">🔥 Forçar Quente</option>
                  <option value="morno">⚡ Forçar Morno</option>
                  <option value="frio">❄️ Forçar Frio</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 block mb-1.5">Bairros de Interesse (Separados por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: Icaraí, Centro, Cambuí"
                  value={formNeighborhoodsText}
                  onChange={(e) => setFormNeighborhoodsText(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold"
                />
                <p className="text-[9px] text-muted-foreground font-medium mt-1.5 pl-1 leading-normal">O cruzamento vai buscar imóveis cujo bairro contenha alguma dessas palavras-chave.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border bg-muted/5 -mx-8 -mb-8 p-6">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-muted hover:bg-muted/80 border border-border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
              >
                Descartar
              </button>
              <button
                type="submit"
                disabled={isUpdatingProfile}
                className="px-6 py-3 bg-primary text-primary-foreground hover:opacity-95 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isUpdatingProfile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Salvar Perfil
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
