"use client";

import { Activity } from "@/lib/db";
import { Zap, Calendar, CheckSquare, FileText, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactActivitiesSidebarProps {
  tasks: Activity[];
  onQuickAction: (type: 'call' | 'meeting' | 'task' | 'other') => void;
}

export function ContactActivitiesSidebar({
  tasks,
  onQuickAction
}: ContactActivitiesSidebarProps) {
  return (
    <div className="space-y-8">
      {/* Quick Actions Card */}
      <div className="bg-primary rounded-[32px] p-8 text-white shadow-xl shadow-primary/10">
        <div className="flex items-center gap-3 mb-8">
          <Zap className="w-5 h-5 text-white/70" />
          <h3 className="text-lg font-bold">Ações Rápidas</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Reunião", icon: Calendar, type: 'meeting' },
            { label: "Tarefa", icon: CheckSquare, type: 'task' },
            { label: "Documento", icon: FileText, type: 'other' },
            { label: "Ligação", icon: Phone, type: 'call' },
          ].map((action, i) => (
            <button 
              key={i} 
              onClick={() => onQuickAction(action.type as any)}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <action.icon className="w-5 h-5 text-white/80" />
              </div>
              <span className="text-xs font-semibold text-white/90">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tasks & Reminders */}
      <div className="bg-card rounded-[32px] border border-border p-8 shadow-sm">
        <h3 className="text-lg font-bold text-foreground mb-6">Tarefas & Lembretes</h3>
        {tasks.length > 0 ? (
          <div className="space-y-4">
            {tasks.slice(0, 3).map(task => (
              <div key={task.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-2xl border border-border">
                <div className={cn("w-5 h-5 rounded-md border-2 mt-0.5", task.status === 'completed' ? "bg-primary border-primary flex items-center justify-center" : "border-border")}>
                  {task.status === 'completed' && <CheckSquare className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <p className={cn("text-xs font-bold", task.status === 'completed' ? "text-muted-foreground line-through" : "text-foreground")}>{task.title}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(task.date).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center bg-muted/50 rounded-3xl border border-dashed border-border">
            <CheckSquare className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sem tarefas</p>
          </div>
        )}
      </div>
    </div>
  );
}
