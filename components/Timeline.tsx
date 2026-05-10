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
}

export function Timeline({ category, relatedId }: TimelineProps) {
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Note Input Area */}
      <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleAddNote} className="relative">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Adicione uma nota ou comentário sobre este registro..."
            className="w-full bg-slate-50 border-none rounded-3xl p-6 pr-20 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all resize-none h-32"
          />
          <button 
            type="submit"
            disabled={!note.trim() || isSubmitting}
            className="absolute bottom-4 right-4 p-4 bg-blue-600 text-white rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>

      {/* Events List */}
      <div className="relative space-y-12">
        {events.length > 0 && (
          <div className="absolute left-[59px] top-8 bottom-8 w-px bg-slate-100" />
        )}

        <AnimatePresence mode="popLayout">
          {events.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="font-bold text-slate-700">Sem atividades registradas</h3>
              <p className="text-slate-400 text-sm mt-1">Interações e notas automáticas aparecerão aqui.</p>
            </motion.div>
          ) : (
            events.map((event, index) => (
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
    if (event.metadata?.type === 'stage_change') return "bg-green-50 text-green-600";
    if (event.metadata?.type === 'creation') return "bg-blue-50 text-blue-600";
    return isSystem ? "bg-slate-50 text-slate-600" : "bg-purple-50 text-purple-600";
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
            <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              {event.title || (isSystem ? 'Evento de Sistema' : 'Nota')}
            </h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Por <span className="text-slate-600">{event.authorName || 'Desconhecido'}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {event.createdAt ? formatDistanceToNow(new Date(event.createdAt), { addSuffix: true, locale: ptBR }) : 'Agora'}
          </div>
        </div>

        <div className={cn(
          "rounded-3xl p-6 text-sm leading-relaxed border transition-all",
          isSystem 
            ? "bg-slate-50/50 text-slate-500 border-slate-100 italic" 
            : "bg-white text-slate-700 border-slate-200 shadow-sm group-hover:shadow-md group-hover:border-blue-100"
        )}>
          {event.content}
          
          {event.metadata?.newStage && (
            <div className="mt-4 flex items-center gap-2 not-italic">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Novo Estágio:</span>
              <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-lg border border-green-100 uppercase">
                {event.metadata.newStage}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
