"use client";

import { memo } from "react";
import { 
  X, 
  Check, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  AlertCircle, 
  Loader2, 
  ExternalLink 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarEventItem, getGoogleCalendarUrl } from "@/lib/calendar-export";

interface EventFormData {
  title: string;
  date: string;
  time: string;
  endTime: string;
  type: string;
  client: string;
  description: string;
}

interface EventModalProps {
  isOpen: boolean;
  editingEvent: CalendarEventItem | null;
  formData: EventFormData;
  isSaving: boolean;
  selectedDate: Date;
  onClose: () => void;
  onChangeField: <K extends keyof EventFormData>(field: K, value: EventFormData[K]) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDeleteRequest: (event: CalendarEventItem) => void;
  isPastDateWarning: boolean;
}

const EVENT_TYPES = ["Visita", "Reunião", "Follow-up"];

export const EventModal = memo(function EventModal({
  isOpen,
  editingEvent,
  formData,
  isSaving,
  selectedDate,
  onClose,
  onChangeField,
  onSubmit,
  onDeleteRequest,
  isPastDateWarning,
}: EventModalProps) {
  if (!isOpen) return null;

  const displayDateStr = formData.date 
    ? format(parseISO(formData.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : format(selectedDate, "dd 'de' MMMM", { locale: ptBR });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-card rounded-2xl shadow-xl overflow-hidden border border-border z-10"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
            <div>
              <h3 className="text-base font-bold text-foreground">
                {editingEvent ? "Editar Compromisso" : "Novo Compromisso"}
              </h3>
              <p className="text-[11px] font-medium text-muted-foreground">
                Agendando para {displayDateStr}
              </p>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Form */}
          <form onSubmit={onSubmit} className="p-5 space-y-4">
            {/* Title */}
            <div className="space-y-1.5 font-medium text-start">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Título do Evento *
              </label>
              <input 
                required
                type="text" 
                value={formData.title}
                onChange={e => onChangeField("title", e.target.value)}
                placeholder="Ex: Visita ao Edifício Garden"
                className="w-full px-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5 font-medium text-start">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Data do Compromisso *
              </label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input 
                  required
                  type="date" 
                  min={!editingEvent ? format(new Date(), "yyyy-MM-dd") : undefined}
                  value={formData.date}
                  onChange={e => onChangeField("date", e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Time Slot */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                  Horário Início *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input 
                    required
                    type="time" 
                    value={formData.time}
                    onChange={e => onChangeField("time", e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                  Horário Término *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input 
                    required
                    type="time" 
                    value={formData.endTime}
                    onChange={e => onChangeField("endTime", e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Past Date Warning */}
            {isPastDateWarning && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2.5 text-amber-500 text-xs font-semibold animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>O horário selecionado já passou. Selecione uma data e horário futuros para agendar o compromisso.</span>
              </div>
            )}

            {/* Type selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Tipo de Atividade
              </label>
              <div className="grid grid-cols-3 gap-2">
                {EVENT_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onChangeField("type", type)}
                    className={cn(
                      "py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                      formData.type === type 
                        ? "bg-primary text-white border-primary shadow-xs shadow-primary/20" 
                        : "bg-muted/30 text-muted-foreground border-border hover:border-primary hover:text-foreground"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Client (Optional) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Cliente ou Imóvel (Opcional)
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input 
                  type="text" 
                  value={formData.client}
                  onChange={e => onChangeField("client", e.target.value)}
                  placeholder="Nome do cliente ou código do imóvel..."
                  className="w-full pl-9 pr-3.5 py-2 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Description (Optional) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Observações Adicionais (Opcional)
              </label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={e => onChangeField("description", e.target.value)}
                placeholder="Endereço, chaves na portaria, detalhes da proposta..."
                className="w-full p-2.5 bg-muted/30 rounded-xl text-xs md:text-sm border border-border text-foreground focus:border-primary focus:outline-none transition-all resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 mt-5">
              {editingEvent && (
                <button 
                  type="button"
                  disabled={isSaving}
                  onClick={() => onDeleteRequest(editingEvent)}
                  className="flex-1 py-2.5 bg-red-500/10 text-red-500 rounded-xl font-bold text-xs md:text-sm hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  Excluir
                </button>
              )}
              <button 
                type="submit"
                disabled={isSaving || isPastDateWarning}
                className="flex-[2] py-2.5 bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-xs md:text-sm shadow-md shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingEvent ? "Salvar Alterações" : "Salvar Compromisso"}
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

export default EventModal;
