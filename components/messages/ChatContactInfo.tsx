"use client";

import Image from "next/image";
import { Mail, Copy, Target } from "lucide-react";
import { toast } from "sonner";
import { ChatPartner } from "./ChatConversationList";

export interface ChatContactInfoProps {
  partner: ChatPartner | null;
}

export function ChatContactInfo({ partner }: ChatContactInfoProps) {
  if (!partner) {
    return (
      <section className="w-72 md:w-80 bg-card border-l border-border shrink-0 hidden xl:flex flex-col overflow-y-auto transition-colors">
        <div className="p-8 text-center text-muted-foreground mt-12">
          <Target className="w-8 h-8 mx-auto mb-3 opacity-10" />
          <p className="text-xs font-medium">Selecione uma conversa para ver os detalhes</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-72 md:w-80 bg-card border-l border-border shrink-0 hidden xl:flex flex-col overflow-y-auto transition-colors">
      <div className="p-5 space-y-6">
        {/* Profile Header */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/20 p-0.5 mx-auto shadow-xs mb-3 relative group">
            <Image
              src={partner.photoURL || ""}
              fill
              className="w-full h-full object-cover rounded-xl transition-transform group-hover:scale-105"
              alt="Profile"
              referrerPolicy="no-referrer"
              unoptimized
            />
          </div>
          <h3 className="text-base font-bold text-foreground tracking-tight">{partner.name}</h3>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
            {partner.type === "team" ? partner.role || "Equipe" : "Contato Cadastrado"}
          </p>

          <div className="flex justify-center gap-1.5 mt-2.5">
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase rounded-md border border-emerald-500/20">
              ATIVO
            </span>
            {partner.type === "team" ? (
              <span className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-[9px] font-bold uppercase rounded-md border border-purple-500/20">
                EQUIPE
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-bold uppercase rounded-md border border-primary/20">
                CLIENTE
              </span>
            )}
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-3">
          <h4 className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-1.5">
            Informações de Contato
          </h4>
          <div className="p-3 bg-muted/40 rounded-xl border border-border/60 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0 text-muted-foreground">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block tracking-wider">
                  E-mail
                </span>
                <span className="text-xs font-bold truncate block text-foreground">
                  {partner.email || "Sem e-mail"}
                </span>
              </div>
            </div>
            {partner.email && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(partner.email);
                  toast.success("E-mail copiado!");
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-lg transition-colors shrink-0 cursor-pointer"
                title="Copiar e-mail"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
