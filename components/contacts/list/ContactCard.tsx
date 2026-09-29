"use client";

import { memo } from "react";
import Link from "next/link";
import { Mail, Phone, Tag, Edit2, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Contact } from "@/lib/db";

interface ContactCardProps {
  contact: Contact;
  companyName?: string;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  isActiveTabEquipe: boolean;
  onMessage: (target: any, type: 'cliente' | 'equipe') => void;
  isMessaging: boolean;
}

export const ContactCard = memo(function ContactCard({ 
  contact, 
  companyName, 
  onEdit, 
  onDelete, 
  isActiveTabEquipe, 
  onMessage, 
  isMessaging
}: ContactCardProps) {
  return (
    <div className="bg-card p-4 rounded-xl border border-border shadow-xs hover:shadow-md transition-all group h-full flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-3 gap-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base uppercase shrink-0",
              isActiveTabEquipe ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-500"
            )}>
              {contact.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <h3 className="font-bold text-sm md:text-base truncate text-foreground" title={contact.name}>{contact.name}</h3>
                {!isActiveTabEquipe && contact.temperature && (
                  contact.temperature === 'quente' ? (
                    <span 
                      title={(contact as any).rawRole ? "Temperatura definida manualmente" : "Temperatura Inteligente: Negociação ou proposta ativa no funil"}
                      className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded relative select-none animate-pulse"
                    >
                      <span className="w-1 h-1 rounded-full bg-red-500 animate-ping inline-block" />
                      Quente
                    </span>
                  ) : contact.temperature === 'morno' ? (
                    <span 
                      title={(contact as any).rawRole ? "Temperatura definida manualmente" : "Temperatura Inteligente: Oportunidade em qualificação"}
                      className="inline-flex items-center gap-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded select-none"
                    >
                      Morno
                    </span>
                  ) : (
                    <span 
                      title={(contact as any).rawRole ? "Temperatura definida manualmente" : "Temperatura Inteligente: Sem oportunidades ativas no funil"}
                      className="inline-flex items-center gap-0.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded select-none"
                    >
                      Frio
                    </span>
                  )
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate font-medium">
                {isActiveTabEquipe ? contact.role : (contact.source ? `Origem: ${contact.source}` : (companyName ? `Empresa: ${companyName}` : 'Sem origem'))}
              </p>
            </div>
          </div>
          <div className="flex gap-0.5 shrink-0 items-center">
            <button 
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation();
                onEdit(contact); 
              }} 
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer" 
              title="Editar"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation();
                onDelete(contact); 
              }} 
              className="p-1.5 rounded-lg transition-all text-muted-foreground hover:text-red-500 hover:bg-red-500/10 cursor-pointer" 
              title="Excluir contato"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{contact.email}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span>{contact.phone}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium border-t border-border pt-2">
            <Tag className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isActiveTabEquipe ? contact.department : (contact.source || 'Não informado')}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5">
        <Link 
          href={`/contacts/${contact.id}`}
          className={cn(
            "text-center text-xs font-bold py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-primary-foreground transition-all shadow-xs",
            isActiveTabEquipe ? "flex-1" : "w-full"
          )}
        >
          {isActiveTabEquipe ? 'Ver Detalhes' : 'Visão 360°'}
        </Link>
        {isActiveTabEquipe && (
          <button 
            onClick={() => onMessage(contact, 'equipe')}
            disabled={isMessaging}
            className="flex-1 text-center text-xs font-bold py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-primary hover:text-primary-foreground transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isMessaging && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Mensagem
          </button>
        )}
      </div>
    </div>
  );
});
