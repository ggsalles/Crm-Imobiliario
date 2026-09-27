"use client";

import { memo } from "react";
import Link from "next/link";
import { 
  Building2, 
  ExternalLink, 
  Edit2, 
  Trash2, 
  Clock, 
  AlertTriangle, 
  AlertOctagon, 
  MessageCircle, 
  RotateCcw, 
  X 
} from "lucide-react";
import { Draggable } from "@hello-pangea/dnd";
import { Deal, Company, Contact } from "@/lib/db";
import { getDealStaleInfo, getWhatsAppRescueUrl } from "@/lib/lead-health";
import { formatCurrencyBRL, cn } from "@/lib/utils";

export interface KanbanCardProps {
  deal: Deal;
  index: number;
  contact?: Contact;
  company?: Company;
  onEdit: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
  onReactivate: (deal: Deal) => void;
}

export const KanbanCard = memo(function KanbanCard({
  deal,
  index,
  contact,
  company,
  onEdit,
  onDelete,
  onReactivate,
}: KanbanCardProps) {
  const staleInfo = getDealStaleInfo(deal);
  const rescueUrl = contact?.phone 
    ? getWhatsAppRescueUrl(contact.phone, contact.name, deal.title)
    : null;

  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "bg-card p-2.5 rounded-xl border shadow-sm group hover:shadow-md transition-all active:scale-[0.98]",
            staleInfo.cardBorderClass || "border-border hover:border-primary/30",
            deal.stage === "lost" && "opacity-85 hover:opacity-100 border-rose-500/30"
          )}
        >
          {/* Alerta de Inatividade / Estagnação */}
          {staleInfo.isStale && (
            <div
              className={cn(
                "mb-2 px-2 py-1 rounded-lg text-[9.5px] font-bold flex items-center justify-between gap-1 border",
                staleInfo.severity === "critical"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
              )}
            >
              <div className="flex items-center gap-1 min-w-0">
                {staleInfo.severity === "critical" ? (
                  <AlertOctagon className="w-3 h-3 text-rose-500 animate-pulse shrink-0" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                )}
                <span className="truncate">{staleInfo.label}</span>
              </div>
              {rescueUrl && (
                <a
                  href={rescueUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 shrink-0"
                  title="Enviar WhatsApp de resgate para o cliente"
                >
                  <MessageCircle className="w-2.5 h-2.5" />
                  Resgatar
                </a>
              )}
            </div>
          )}

          {/* Cabeçalho de Ações do Cartão */}
          <div className="flex justify-between items-start mb-1.5">
            <div className="flex gap-1">
              <Link
                href={`/deals/${deal.id}`}
                className="p-0.5 text-muted-foreground hover:text-indigo-500 transition-all"
                title="Ver detalhes"
              >
                <ExternalLink className="w-3 h-3" />
              </Link>
              <button
                type="button"
                onClick={() => onEdit(deal)}
                className="p-0.5 text-muted-foreground hover:text-primary transition-all cursor-pointer"
                title="Editar"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(deal)}
                className="p-0.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                title="Excluir negócio"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="flex -space-x-1.5">
              <div
                className="w-5 h-5 rounded-full border border-card bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary uppercase"
                title={contact?.name || "Cliente não atribuído"}
              >
                {contact?.name?.charAt(0) || "?"}
              </div>
            </div>
          </div>

          <Link href={`/deals/${deal.id}`} className="block hover:text-primary transition-colors">
            <h4
              className="font-bold text-foreground text-xs mb-0.5 line-clamp-2 leading-tight"
              title={deal.title}
            >
              {deal.title}
            </h4>
          </Link>

          {contact && (
            <div className="flex items-center justify-between text-[10.5px] text-muted-foreground mb-1">
              <span className="truncate font-semibold text-foreground/80">{contact.name}</span>
              {rescueUrl && (
                <a
                  href={rescueUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 p-0.5 rounded hover:bg-emerald-500/10 transition-colors shrink-0"
                  title={`Conversar com ${contact.name} no WhatsApp`}
                >
                  <MessageCircle className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground mb-2 truncate flex items-center gap-1">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{company?.name || "Empresa não vinculada"}</span>
          </p>

          <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-border/50">
            <span className="text-xs font-bold text-foreground">
              {formatCurrencyBRL(deal.value)}
            </span>
            <div className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
              <Clock className="w-2.5 h-2.5 shrink-0" />
              <span>{deal.updatedAt ? new Date(deal.updatedAt).toLocaleDateString() : "-"}</span>
            </div>
          </div>

          {/* Botão de reativação para oportunidades perdidas */}
          {deal.stage === "lost" && (
            <div className="mt-2 pt-1.5 border-t border-rose-500/20 flex items-center justify-between gap-1">
              <span className="text-[9.5px] font-bold text-rose-500 flex items-center gap-1">
                <X className="w-3 h-3" /> Arquivado
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReactivate(deal);
                }}
                className="px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[9.5px] font-bold flex items-center gap-1 transition-all"
                title="Reativar oportunidade para Novo Lead"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Reativar
              </button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
});
