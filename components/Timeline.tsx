"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  MessageSquare, 
  History, 
  Plus, 
  Clock, 
  TrendingUp, 
  Send,
  Loader2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { TimelineEvent, subscribeToTimeline, createTimelineEvent } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/providers/auth-provider";

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
    if (!relatedId || !user || !profile) return;
    
    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsub = subscribeToTimeline(category, relatedId, (data) => {
      setEvents(data);
      setLoading(false);
    }, ownerId);
    return unsub;
  }, [category, relatedId, user, profile]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || !profile || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createTimelineEvent({
        type: 'note',
        category,
        relatedId,
        content: note,
        title: 'Nota manual',
        author_name: profile.displayName || profile.email
      });
      setNote("");
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Note Input Area */}
      <div className="bg-card rounded-[32px] border border-border p-6 shadow-sm">
        <form onSubmit={handleAddNote} className="relative">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Adicione uma nota ou comentário sobre este registro..."
            className="w-full bg-muted/50 border-none rounded-3xl p-6 pr-20 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 transition-all resize-none h-32"
          />
          <button 
            type="submit"
            disabled={!note.trim() || isSubmitting}
            className="absolute bottom-4 right-4 p-4 bg-primary text-white rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>

      {/* Events List */}
      <div className="relative space-y-12">
        {events.length > 0 && (
          <div className="absolute left-[59px] top-8 bottom-8 w-px bg-border" />
        )}

        <AnimatePresence mode="popLayout">
          {events.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-foreground">Sem atividades registradas</h3>
              <p className="text-muted-foreground text-sm mt-1">Interações e notas automáticas aparecerão aqui.</p>
            </motion.div>
          ) : (
            events
              .filter(e => 
                !searchQuery || 
                e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (e.title && e.title.toLowerCase().includes(searchQuery.toLowerCase()))
              )
              .map((event, index) => (
                <TimelineItem key={event.id} event={event} index={index} />
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
    if (event.metadata?.type === 'stage_change') return <TrendingUp className="w-5 h-5" />;
    if (event.metadata?.type === 'creation') return <Plus className="w-5 h-5" />;
    return isSystem ? <History className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />;
  };

  const getIconColor = () => {
    if (event.metadata?.type === 'stage_change') return "bg-green-500/10 text-green-500";
    if (event.metadata?.type === 'creation') return "bg-primary/10 text-primary";
    return isSystem ? "bg-muted text-muted-foreground" : "bg-purple-500/10 text-purple-500";
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative z-10 flex gap-6 group"
    >
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-110", getIconColor())}>
        {getIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-2 pt-1">
          <div>
            <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
              {event.title || (isSystem ? 'Evento de Sistema' : 'Nota')}
            </h4>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              Por <span className="text-foreground">{event.authorName || 'Desconhecido'}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {event.createdAt ? formatDistanceToNow(new Date(event.createdAt), { addSuffix: true, locale: ptBR }) : 'Agora'}
          </div>
        </div>

        <div className={cn(
          "rounded-3xl p-6 text-sm leading-relaxed border transition-all",
          isSystem 
            ? "bg-muted/50 text-muted-foreground border-border italic" 
            : "bg-card text-foreground border-border shadow-sm group-hover:shadow-md group-hover:border-primary/20"
        )}>
          {event.content}
          
          {event.metadata?.newStage && (
            <div className="mt-4 flex items-center gap-2 not-italic">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Novo Estágio:</span>
              <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded-lg border border-green-500/20 uppercase">
                {event.metadata.newStage}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
