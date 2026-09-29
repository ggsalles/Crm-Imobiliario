"use client";

import { X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Activity, Contact, Deal } from "@/lib/db";

interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingActivity: Activity | null;
  formData: {
    title: string;
    type: Activity['type'];
    date: string;
    contactId: string;
    dealId: string;
    description: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    title: string;
    type: Activity['type'];
    date: string;
    contactId: string;
    dealId: string;
    description: string;
  }>>;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onDeleteRequest: (activity: Activity) => void;
  isSaving: boolean;
  contacts: Contact[];
  deals: Deal[];
}

export function ActivityFormModal({
  isOpen,
  onClose,
  editingActivity,
  formData,
  setFormData,
  onSubmit,
  onDeleteRequest,
  isSaving,
  contacts,
  deals
}: ActivityFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-card w-full max-w-xl rounded-2xl overflow-hidden shadow-xl animate-in fade-in zoom-in duration-300 border border-border"
      >
        <div className="p-5 md:p-6 border-b border-border flex justify-between items-center bg-muted/30">
          <h2 className="text-xl font-black tracking-tight">
            {editingActivity ? 'Editar Atividade' : 'Nova Atividade'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-all cursor-pointer">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 md:p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Título</label>
            <input 
              autoFocus
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Ligar para prospecto..."
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-bold focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Tipo</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-bold focus:border-primary outline-none transition-all"
              >
                <option value="task">Tarefa</option>
                <option value="call">Chamada</option>
                <option value="meeting">Reunião</option>
                <option value="email">E-mail</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Data/Hora</label>
              <input 
                type="datetime-local"
                required
                min={!editingActivity ? format(new Date(), "yyyy-MM-dd'T'HH:mm") : undefined}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-bold focus:border-primary outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Lead/Contato</label>
              <select 
                value={formData.contactId}
                onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-bold focus:border-primary outline-none transition-all"
              >
                <option value="">Nenhum</option>
                {contacts.filter(c => c.type === 'cliente').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Negócio</label>
              <select 
                value={formData.dealId}
                onChange={(e) => setFormData({ ...formData, dealId: e.target.value })}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-bold focus:border-primary outline-none transition-all"
              >
                <option value="">Nenhum</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Observações</label>
            <textarea 
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-foreground text-xs md:text-sm font-medium focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="flex gap-2 pt-2">
            {editingActivity && (
              <button 
                type="button" 
                onClick={() => onDeleteRequest(editingActivity)}
                className="px-3.5 py-2 rounded-xl transition-all border border-red-500/20 text-red-500 hover:bg-red-500/10 flex items-center justify-center cursor-pointer"
                title="Excluir atividade"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2 border border-border rounded-xl font-bold text-xs md:text-sm text-muted-foreground hover:bg-muted transition-all font-sans cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-primary text-white py-2 rounded-xl font-bold text-xs md:text-sm shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-sans flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSaving ? 'Salvando...' : editingActivity ? 'Salvar Alterações' : 'Salvar Atividade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
