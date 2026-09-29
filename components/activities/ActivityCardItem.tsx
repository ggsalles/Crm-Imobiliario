"use client";

import { memo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Users, 
  Briefcase,
  Trash2,
  Pencil,
  Zap
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Activity, Contact, Deal } from "@/lib/db";
import { isPriorityActivity } from "@/lib/intelligence";

interface ActivityCardItemProps {
  activity: Activity;
  contact?: Contact;
  deal?: Deal;
  deals: Deal[];
  onToggleStatus: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
}

export const ActivityCardItem = memo(function ActivityCardItem({
  activity,
  contact,
  deal,
  deals,
  onToggleStatus,
  onEdit,
  onDelete
}: ActivityCardItemProps) {
  const isPriority = isPriorityActivity(activity, deals);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group bg-card p-3.5 md:p-4 rounded-xl border border-border shadow-xs flex items-center gap-3 md:gap-4 transition-all hover:bg-muted/10 relative overflow-hidden",
        activity.status === 'completed' && "opacity-60",
        isPriority && "ring-1 ring-primary/20 bg-primary/[0.02]"
      )}
    >
      {isPriority && (
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
      )}

      <button 
        type="button"
        onClick={() => onToggleStatus(activity)}
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer",
          activity.status === 'completed' 
            ? "bg-emerald-500 text-white" 
            : "border-2 border-border text-muted-foreground/30 group-hover:border-primary/50 group-hover:text-primary/50"
        )}
      >
        {activity.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-1.5 mb-1">
          <h3 className={cn(
            "text-sm md:text-base font-bold text-foreground truncate",
            activity.status === 'completed' && "line-through text-muted-foreground"
          )}>
            {activity.title}
          </h3>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0",
              activity.type === 'call' ? "bg-primary/10 text-primary" :
              activity.type === 'meeting' ? "bg-purple-500/10 text-purple-500" :
              activity.type === 'email' ? "bg-orange-500/10 text-orange-500" :
              "bg-muted text-muted-foreground"
            )}>
              {activity.type === 'meeting' ? 'Reunião' : 
               activity.type === 'task' ? 'Tarefa' : 
               activity.type === 'call' ? 'Chamada' : 
               activity.type === 'email' ? 'E-mail' : 
               activity.type}
            </span>
            {isPriority && (
              <span className="px-2 py-0.5 bg-primary text-white rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs shadow-primary/20 animate-pulse">
                <Zap className="w-2.5 h-2.5" />
                Prioridade
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3">
          <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {format(new Date(activity.date), "dd MMM, yyyy", { locale: ptBR })}
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground md:border-l md:border-border md:pl-3">
            <Clock className="w-3 h-3" />
            {format(new Date(activity.date), "HH:mm")}
          </div>
          {contact && (
            <div className="flex items-center gap-1 text-xs font-bold text-primary md:border-l md:border-border md:pl-3">
              <Users className="w-3 h-3" />
              {contact.name}
            </div>
          )}
          {deal && (
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-500 md:border-l md:border-border md:pl-3">
              <Briefcase className="w-3 h-3" />
              {deal.title}
            </div>
          )}
        </div>
        {activity.description && (
          <p className="text-xs text-muted-foreground mt-2 font-medium line-clamp-2">{activity.description}</p>
        )}
      </div>

      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          type="button"
          onClick={() => onEdit(activity)}
          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button 
          type="button"
          onClick={() => onDelete(activity)} 
          className="p-2 rounded-lg transition-all shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
          title="Excluir atividade"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
});
