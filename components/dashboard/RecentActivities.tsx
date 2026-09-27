"use client";

import { useMemo, useState, useCallback, memo } from "react";
import { Activity, Deal } from "@/lib/db";
import { calculateActivityScore, isPriorityActivity } from "@/lib/intelligence";
import { 
  Zap, 
  Clock, 
  ChevronRight, 
  Briefcase, 
  Calendar, 
  CheckCircle2, 
  ListFilter 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";

export interface RecentActivitiesProps {
  activities: Activity[];
  deals: Deal[];
  onToggle: (activity: Activity) => void;
  variants?: any;
  className?: string;
}

interface ScoredActivity extends Activity {
  score: number;
  isPriority: boolean;
}

export const RecentActivities = memo(function RecentActivities({ 
  activities, 
  deals, 
  onToggle,
  variants,
  className
}: RecentActivitiesProps) {
  const router = useRouter();
  const [filterMode, setFilterMode] = useState<'priority' | 'all'>('priority');

  // Pre-calculate score and priority once per activity/deals dependency change
  const scoredActivities = useMemo<ScoredActivity[]>(() => {
    return activities.map(a => ({
      ...a,
      score: calculateActivityScore(a, deals),
      isPriority: isPriorityActivity(a, deals)
    }));
  }, [activities, deals]);

  // Atividades classificadas por prioridade inteligente (apenas pendentes)
  const prioritizedActivities = useMemo(() => {
    return scoredActivities
      .filter(a => a.status === 'pending')
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [scoredActivities]);

  // Lista cronológica recente (pendentes primeiro, depois concluídas)
  const chronologicalActivities = useMemo(() => {
    return [...scoredActivities]
      .sort((a, b) => {
        if (a.status === 'pending' && b.status === 'completed') return -1;
        if (a.status === 'completed' && b.status === 'pending') return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, 5);
  }, [scoredActivities]);

  const displayedList = filterMode === 'priority' ? prioritizedActivities : chronologicalActivities;

  const handleToggleFilter = useCallback(() => {
    setFilterMode(prev => prev === 'priority' ? 'all' : 'priority');
  }, []);

  const handleNavigateActivities = useCallback(() => {
    router.push("/activities");
  }, [router]);

  return (
    <motion.div 
      variants={variants}
      className={cn(
        "bg-card rounded-2xl md:rounded-3xl border border-border p-4 sm:p-5 md:p-6 shadow-sm flex flex-col relative overflow-hidden card-hover h-full",
        className
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 md:mb-5">
        <div>
          <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">Próximos Passos</h3>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 uppercase tracking-widest font-bold">
            {filterMode === 'priority' ? 'Inteligência Prioritária' : 'Atividades Recentes'}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleFilter}
            className={cn(
              "p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
              filterMode === 'priority' 
                ? "bg-primary/10 text-primary hover:bg-primary/20" 
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            title={filterMode === 'priority' ? "Ver todas recentes" : "Filtrar por prioridade de IA"}
          >
            <ListFilter className="w-3.5 h-3.5" />
          </button>

          <button 
            type="button"
            onClick={handleNavigateActivities}
            className="w-8 h-8 md:w-9 md:h-9 bg-muted rounded-xl flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-all text-muted-foreground cursor-pointer"
            title="Abrir agenda completa"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Activities List */}
      <div className="space-y-2.5 flex-1">
        {displayedList.length > 0 ? (
          displayedList.map((activity, index) => {
            const isPriority = activity.isPriority;
            const isCompleted = activity.status === 'completed';

            return (
              <motion.div 
                key={activity.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className={cn(
                  "group p-2.5 sm:p-3 bg-muted/30 hover:bg-muted/50 rounded-xl border border-transparent hover:border-border transition-all cursor-pointer flex items-center gap-3",
                  isPriority && !isCompleted && "bg-primary/5 border-primary/10 hover:border-primary/20",
                  isCompleted && "opacity-60"
                )}
                onClick={() => onToggle(activity)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(activity);
                  }}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer",
                    isCompleted
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : isPriority 
                        ? "bg-primary text-white shadow-md shadow-primary/20" 
                        : "bg-background text-muted-foreground"
                  )}
                  title={isCompleted ? "Marcar como pendente" : "Marcar como concluída"}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isPriority ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h4 className={cn(
                      "text-xs sm:text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors",
                      isCompleted && "line-through text-muted-foreground"
                    )}>
                      {activity.title}
                    </h4>
                    {isPriority && !isCompleted && (
                      <span className="px-1.5 py-0.5 bg-primary text-[8px] font-black uppercase text-white rounded tracking-wider shadow-xs">
                        Zap!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase">
                      <Calendar className="w-3 h-3" />
                      {(() => {
                        try {
                          const d = new Date(activity.date);
                          if (isNaN(d.getTime())) return "Data não definida";
                          return `${format(d, "dd/MM", { locale: ptBR })} • ${format(d, "HH:mm")}`;
                        } catch {
                          return "Data não definida";
                        }
                      })()}
                    </span>
                    {activity.dealId && (
                      <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 uppercase">
                        <Briefcase className="w-3 h-3" />
                        Negócio
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mb-2 opacity-30 text-primary" />
            <p className="text-xs font-bold text-foreground">Tudo em dia!</p>
            <p className="text-[11px] mt-0.5">Nenhuma tarefa pendente para agora.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default RecentActivities;
