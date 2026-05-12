"use client";

import { useMemo } from "react";
import { Activity, Deal } from "@/lib/db";
import { calculateActivityScore, isPriorityActivity } from "@/lib/intelligence";
import { Zap, Clock, ChevronRight, Briefcase, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

interface IntelligenceWidgetProps {
  activities: Activity[];
  deals: Deal[];
  onToggle: (activity: Activity) => void;
}

export function IntelligenceWidget({ activities, deals, onToggle }: IntelligenceWidgetProps) {
  const router = useRouter();

  const rankedActivities = useMemo(() => {
    return activities
      .filter(a => a.status === 'pending')
      .map(a => ({
        ...a,
        score: calculateActivityScore(a, deals),
        isPriority: isPriorityActivity(a, deals)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [activities, deals]);

  return (
    <div className="bg-card rounded-[32px] md:rounded-[40px] border border-border p-6 md:p-10 shadow-sm flex flex-col relative overflow-hidden card-hover">
      <div className="flex justify-between items-center mb-8 md:mb-10">
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Próximos Passos</h3>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-bold">Inteligência Prioritária</p>
        </div>
        <button 
          onClick={() => router.push("/activities")}
          className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-all text-muted-foreground"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4 flex-1">
        {rankedActivities.length > 0 ? rankedActivities.map((activity, index) => (
          <motion.div 
            key={activity.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "group p-4 bg-muted/30 hover:bg-muted/50 rounded-2xl border border-transparent hover:border-border transition-all cursor-pointer flex items-center gap-4",
              activity.isPriority && "bg-primary/5 border-primary/10 hover:border-primary/20"
            )}
            onClick={() => onToggle(activity)}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              activity.isPriority 
                ? "bg-primary text-white shadow-lg shadow-primary/20 animate-pulse" 
                : "bg-background text-muted-foreground"
            )}>
              {activity.isPriority ? <Zap className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {activity.title}
                </h4>
                {activity.isPriority && (
                  <span className="px-1.5 py-0.5 bg-primary text-[8px] font-black uppercase text-white rounded-md tracking-tighter shadow-sm">
                    Zap!
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(activity.date), "dd/MM", { locale: ptBR })} • {format(new Date(activity.date), "HH:mm")}
                </span>
                {activity.dealId && (
                   <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 uppercase">
                    <Briefcase className="w-3 h-3" />
                    Prioritário
                  </span>
                )}
              </div>
            </div>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div 
                className="w-6 h-6 rounded-full border-2 border-primary/30 flex items-center justify-center text-primary"
              >
                <div className="w-2 h-2 rounded-full bg-primary" />
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
            <Zap className="w-12 h-12 mb-4 opacity-10" />
            <p className="text-xs font-bold uppercase tracking-widest text-center">Tudo em dia por aqui!</p>
          </div>
        )}
      </div>

      <button 
        onClick={() => router.push("/activities")}
        className="w-full mt-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all border border-primary/10"
      >
        Ver Todas Atividades
      </button>
    </div>
  );
}
