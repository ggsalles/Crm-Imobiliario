"use client";

import { useMemo, memo } from "react";
import { Plus } from "lucide-react";
import { Droppable } from "@hello-pangea/dnd";
import { Deal, Company, Contact } from "@/lib/db";
import { KanbanCard } from "./KanbanCard";
import { formatCurrencyBRL, cn } from "@/lib/utils";

export interface KanbanStageInfo {
  id: string;
  title: string;
  color: string;
}

export interface KanbanColumnProps {
  stage: KanbanStageInfo;
  deals: Deal[];
  contacts?: Contact[];
  companies?: Company[];
  contactsMap?: Map<string, Contact>;
  companiesMap?: Map<string, Company>;
  probability: number;
  goalValue: number;
  badgeClass?: string;
  onAddDeal: (stageId: string) => void;
  onEditDeal: (deal: Deal) => void;
  onDeleteDeal: (deal: Deal) => void;
  onReactivateDeal: (deal: Deal) => void;
}

export const KanbanColumn = memo(function KanbanColumn({
  stage,
  deals,
  contacts,
  companies,
  contactsMap,
  companiesMap,
  probability,
  goalValue,
  badgeClass,
  onAddDeal,
  onEditDeal,
  onDeleteDeal,
  onReactivateDeal,
}: KanbanColumnProps) {
  const stageTotal = useMemo(() => deals.reduce((acc, d) => acc + (d.value || 0), 0), [deals]);
  const stageProgress = goalValue > 0 ? Math.min((stageTotal / goalValue) * 100, 100) : 0;

  return (
    <div className="flex-1 min-w-[170px] flex flex-col">
      <div className="mb-2 px-1 space-y-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${stage.color}`} />
            <h3
              className="font-bold text-foreground text-[11px] uppercase tracking-wider truncate"
              title={stage.title}
            >
              {stage.title}
            </h3>
            <span className="text-[9px] bg-muted px-1.5 py-0.2 rounded font-bold text-muted-foreground shrink-0">
              {deals.length}
            </span>
          </div>
          <span
            className={cn(
              "text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-full border shadow-sm tracking-wider uppercase backdrop-blur-sm shrink-0",
              badgeClass || "bg-muted text-muted-foreground border-border"
            )}
          >
            {probability}%
          </span>
        </div>

        {/* Mini Barra de Progresso da Etapa */}
        <div className="space-y-0.5">
          <div className="flex justify-between items-center text-[8.5px] font-bold">
            <span className="text-muted-foreground uppercase truncate">
              Meta: {formatCurrencyBRL(goalValue)}
            </span>
            <span
              className={cn(
                "shrink-0",
                stageProgress >= 100 ? "text-emerald-500" : "text-primary"
              )}
            >
              {Math.round(stageProgress)}%
            </span>
          </div>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-1000",
                stageProgress >= 100 ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${stageProgress}%` }}
            />
          </div>
        </div>
      </div>

      <Droppable droppableId={stage.id}>
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={cn(
              "flex-1 rounded-xl p-2 space-y-2 border border-dashed transition-colors",
              stage.id === "lost"
                ? "bg-rose-500/[0.04] border-rose-500/20"
                : "bg-muted/20 border-border"
            )}
          >
            {deals.map((deal, index) => {
              const contact = contactsMap 
                ? (deal.contactId ? contactsMap.get(deal.contactId) : undefined)
                : contacts?.find((c) => c.id === deal.contactId);
              const company = companiesMap
                ? (deal.companyId ? companiesMap.get(deal.companyId) : undefined)
                : companies?.find((c) => c.id === deal.companyId);

              return (
                <KanbanCard
                  key={deal.id}
                  deal={deal}
                  index={index}
                  contact={contact}
                  company={company}
                  onEdit={onEditDeal}
                  onDelete={onDeleteDeal}
                  onReactivate={onReactivateDeal}
                />
              );
            })}
            {provided.placeholder}
            <button
              type="button"
              onClick={() => onAddDeal(stage.id)}
              className="w-full py-1.5 border border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-all group cursor-pointer"
              title="Adicionar negócio nesta etapa"
            >
              <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}
      </Droppable>
    </div>
  );
});
