"use client";

import { Contact } from "@/lib/db";
import { 
  Tag, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Edit2, 
  Trash2, 
  MessageSquare 
} from "lucide-react";
import { useRouter } from "next/navigation";

interface ContactHeaderCardProps {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
}

export function ContactHeaderCard({
  contact,
  onEdit,
  onDelete
}: ContactHeaderCardProps) {
  const router = useRouter();

  return (
    <section className="bg-card rounded-[32px] border border-border p-8 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-xl border-4 border-card bg-primary/10 flex items-center justify-center text-4xl font-bold text-primary uppercase">
              {contact.name.charAt(0)}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-card rounded-full shadow-sm" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-foreground tracking-tight">{contact.name}</h1>
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-lg border border-primary/20">
                {contact.type === 'cliente' ? 'CLIENTE' : 'MEMBRO'}
              </span>
              {contact.type === 'cliente' && contact.temperature && (
                contact.temperature === 'quente' ? (
                  <span 
                    title={(contact as any).rawRole ? "Temperatura definida manualmente" : "Temperatura Inteligente: Proposta ou negociação ativa no funil"}
                    className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg relative overflow-hidden shrink-0 select-none shadow-[0_0_12px_rgba(239,68,68,0.15)] animate-pulse"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-0.5 animate-ping" />
                    🔥 Quente
                  </span>
                ) : contact.temperature === 'morno' ? (
                  <span 
                    title={(contact as any).rawRole ? "Temperatura definida manualmente" : "Temperatura Inteligente: Oportunidade em qualificação"}
                    className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg shrink-0 select-none shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                  >
                    ⚡ Morno
                  </span>
                ) : (
                  <span 
                    title={(contact as any).rawRole ? "Temperatura definida manualmente" : "Temperatura Inteligente: Sem oportunidades ativas no funil"}
                    className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg shrink-0 select-none"
                  >
                    ❄️ Frio
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              {contact.type === 'cliente' ? (
                <>
                  <Tag className="w-4 h-4" />
                  <span>Origem: {contact.source || "Não informada"}</span>
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  <span>{contact.role} em {contact.department || "Empresa"}</span>
                </>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-2 text-sm text-foreground bg-muted/30 px-3 py-1.5 rounded-xl border border-border">
                <Mail className="w-4 h-4 text-muted-foreground" />
                {contact.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground bg-muted/30 px-3 py-1.5 rounded-xl border border-border">
                <Phone className="w-4 h-4 text-muted-foreground" />
                {contact.phone}
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground bg-muted/30 px-3 py-1.5 rounded-xl border border-border">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                São Paulo, BR
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 w-full lg:w-auto">
          <button 
            onClick={onEdit}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl font-bold text-foreground hover:bg-muted transition-all cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </button>
          <button 
            onClick={onDelete}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-red-500/20 rounded-xl font-bold text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
          {contact.type === 'equipe' && (
            <button 
              onClick={() => router.push('/messages')}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              Mensagem
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
