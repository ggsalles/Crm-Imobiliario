"use client";

import { useMemo, memo } from "react";
import Image from "next/image";
import { UserProfile, Deal } from "@/lib/db";
import { formatCurrencyBRL } from "@/lib/utils";

export interface TeamViewProps {
  users: UserProfile[];
  deals: Deal[];
}

export const TeamView = memo(function TeamView({ users, deals }: TeamViewProps) {
  // Aggregate deals by ownerId in a single pass O(N)
  const dealsByOwner = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const d of deals) {
      if (!d.ownerId) continue;
      const list = map.get(d.ownerId);
      if (list) {
        list.push(d);
      } else {
        map.set(d.ownerId, [d]);
      }
    }
    return map;
  }, [deals]);

  // Pre-calculate performance stats per broker
  const agents = useMemo(() => {
    return users
      .filter(u => u.role === 'Membro' || u.role === 'Admin')
      .map(u => {
        const agentDeals = dealsByOwner.get(u.id) || [];
        let totalValue = 0;
        let closedCount = 0;
        let activeCount = 0;

        for (const d of agentDeals) {
          if (d.stage === 'closed') {
            totalValue += (d.value || 0);
            closedCount++;
          } else {
            activeCount++;
          }
        }

        const winRate = agentDeals.length > 0 ? (closedCount / agentDeals.length) * 100 : 0;

        return {
          ...u,
          stats: {
            totalValue,
            count: closedCount,
            winRate,
            active: activeCount
          }
        };
      })
      .sort((a, b) => b.stats.totalValue - a.stats.totalValue);
  }, [users, dealsByOwner]);

  // Memoized top-level summary metrics
  const avgSalesPerAgent = useMemo(() => {
    if (agents.length === 0) return 0;
    const total = agents.reduce((acc, a) => acc + a.stats.totalValue, 0);
    return total / agents.length;
  }, [agents]);

  const topAgentName = useMemo(() => {
    return agents[0]?.displayName || '-';
  }, [agents]);

  return (
    <div className="space-y-4 md:space-y-5 pb-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-card p-4 md:p-5 rounded-2xl border border-border shadow-sm card-hover">
          <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Média de Vendas/Agente</p>
          <p className="text-xl md:text-2xl font-light text-foreground tracking-tight">
            {formatCurrencyBRL(avgSalesPerAgent, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-card p-4 md:p-5 rounded-2xl border border-border shadow-sm card-hover">
          <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Melhor Performance</p>
          <p className="text-xl md:text-2xl font-light text-foreground tracking-tight truncate">
            {topAgentName}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-2xl md:rounded-3xl border border-border shadow-sm overflow-hidden card-hover">
        <div className="p-4 md:p-5 border-b border-border">
          <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Performance da Equipe</h3>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-[9.5px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
                <th className="px-4 md:px-5 py-3 border-b border-border">Membro</th>
                <th className="px-4 md:px-5 py-3 border-b border-border">Vendas Totais</th>
                <th className="px-4 md:px-5 py-3 border-b border-border">Negócios Fechados</th>
                <th className="px-4 md:px-5 py-3 border-b border-border">Taxa de Conversão</th>
                <th className="px-4 md:px-5 py-3 border-b border-border">Ativos</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="group hover:bg-muted/50 transition-colors">
                  <td className="px-4 md:px-5 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shadow-xs overflow-hidden relative shrink-0">
                        {agent.photoURL ? (
                          <Image 
                            src={agent.photoURL} 
                            alt={agent.displayName || "Agente"} 
                            fill 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            unoptimized
                          />
                        ) : agent.displayName?.[0]}
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-bold text-foreground group-hover:text-primary transition-colors">{agent.displayName}</p>
                        <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">{agent.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-5 py-3 border-b border-border">
                    <p className="text-xs md:text-sm font-bold text-foreground">
                      {formatCurrencyBRL(agent.stats.totalValue, { maximumFractionDigits: 0 })}
                    </p>
                  </td>
                  <td className="px-4 md:px-5 py-3 border-b border-border text-xs font-medium text-muted-foreground">{agent.stats.count}</td>
                  <td className="px-4 md:px-5 py-3 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-foreground">{agent.stats.winRate.toFixed(1)}%</span>
                      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${agent.stats.winRate}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-5 py-3 border-b border-border">
                    <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-[9.5px] font-bold uppercase tracking-wider ring-1 ring-primary/10">
                      {agent.stats.active} ativos
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default TeamView;
