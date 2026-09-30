"use client";

import { useState, useEffect } from "react";
import { 
  MessageSquare, 
  History, 
  Plus, 
  Clock, 
  TrendingUp, 
  Send,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { TimelineEvent, subscribeToTimeline, createTimelineEvent } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";

interface TimelineProps {
  category: 'contact' | 'deal' | 'company';
  relatedId: string;
  searchQuery?: string;
}

export function Timeline({ category, relatedId, searchQuery }: TimelineProps) {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!relatedId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);

    const unsub = subscribeToTimeline(category, relatedId, (data) => {
      setEvents(data || []);
      setLoading(false);
    });

    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, [category, relatedId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const authorName = profile?.displayName || user?.email || "Usuário";
    const noteContent = note.trim();

    // Optimistic item
    const optimisticEvent: TimelineEvent = {
      id: `temp-${Date.now()}`,
      type: 'note',
      category,
      relatedId,
      content: noteContent,
      title: 'Nota manual',
      authorName,
      ownerId: user?.id || '',
      createdBy: user?.id || '',
      createdAt: new Date().toISOString()
    };

    setEvents(prev => [optimisticEvent, ...prev]);
    setNote("");

    try {
      await createTimelineEvent({
        type: 'note',
        category,
        relatedId,
        content: noteContent,
        title: 'Nota manual',
        authorName
      });
      toast.success("Nota registrada na linha do tempo!");
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Erro ao salvar nota na linha do tempo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">Carregando histórico e notas...</p>
      </div>
    );
  }

  const filteredEvents = events.filter(e => 
    !searchQuery || 
    (e.content && e.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.title && e.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Note Input Area */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-xs">
        <form onSubmit={handleAddNote} className="relative">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Adicione uma nota, observação ou comentário sobre este registro..."
            className="w-full bg-muted/40 border border-border/60 rounded-xl p-3.5 pr-14 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none min-h-[90px]"
          />
          <button 
            type="submit"
            disabled={!note.trim() || isSubmitting}
            className="absolute bottom-3 right-3 p-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-40 transition-all shadow-xs flex items-center justify-center cursor-pointer"
            title="Enviar nota"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {/* Events List */}
      <div className="relative space-y-6">
        {filteredEvents.length > 0 && (
          <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-border/60" />
        )}

        <AnimatePresence mode="popLayout">
          {filteredEvents.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 px-4 border border-dashed border-border rounded-xl"
            >
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <History className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Sem atividades registradas</h3>
              <p className="text-muted-foreground text-xs mt-1">Interações, mudanças de etapas e notas aparecerão aqui.</p>
            </motion.div>
          ) : (
            filteredEvents.map((event, index) => (
              <TimelineItem key={event.id || index} event={event} index={index} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TimelineItem({ event, index }: { event: TimelineEvent, index: number }) {
  const isSystem = event.type === 'system';
  
  const getIcon = () => {
    if (event.metadata?.type === 'stage_change' || event.metadata?.action === 'UPDATE_DEAL_STAGE') {
      return <TrendingUp className="w-4 h-4" />;
    }
    if (event.metadata?.type === 'creation' || event.metadata?.action === 'CREATE_DEAL') {
      return <Plus className="w-4 h-4" />;
    }
    return isSystem ? <History className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />;
  };

  const getIconColor = () => {
    if (event.metadata?.type === 'stage_change' || event.metadata?.action === 'UPDATE_DEAL_STAGE') {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    }
    if (event.metadata?.type === 'creation' || event.metadata?.action === 'CREATE_DEAL') {
      return "bg-primary/10 text-primary border border-primary/20";
    }
    return isSystem 
      ? "bg-muted text-muted-foreground border border-border" 
      : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20";
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Recentemente';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Recentemente';
      return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
    } catch {
      return 'Recentemente';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className="relative z-10 flex gap-4 group"
    >
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-all", getIconColor())}>
        {getIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap justify-between items-center gap-1.5 mb-1.5">
          <div>
            <h4 className="font-semibold text-xs sm:text-sm text-foreground">
              {event.title || (isSystem ? 'Evento do Sistema' : 'Nota')}
            </h4>
            <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
              Por <span className="font-semibold text-foreground/80">{event.authorName || 'Sistema'}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
            <Clock className="w-3 h-3 text-muted-foreground/70" />
            {formatDate(event.createdAt)}
          </div>
        </div>

        <div className={cn(
          "rounded-xl p-3.5 text-xs leading-relaxed border transition-all",
          isSystem 
            ? "bg-muted/30 text-muted-foreground border-border/60" 
            : "bg-card text-foreground border-border shadow-xs group-hover:border-primary/30"
        )}>
          {event.content}
          
          {(event.metadata?.newStage || event.metadata?.stageTitle) && (
            <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Novo Estágio:</span>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/20 uppercase">
                {event.metadata?.stageTitle || event.metadata?.newStage}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
