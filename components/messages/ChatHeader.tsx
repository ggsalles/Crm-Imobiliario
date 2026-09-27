"use client";

import Image from "next/image";
import { Video, Phone, MoreVertical, ArrowLeft } from "lucide-react";
import { ChatPartner } from "./ChatConversationList";

export interface ChatHeaderProps {
  partner: ChatPartner | null;
  onBack: () => void;
}

export function ChatHeader({ partner, onBack }: ChatHeaderProps) {
  return (
    <header className="h-14 md:h-16 border-b border-border px-3 md:px-5 flex items-center justify-between shrink-0 bg-card/30 backdrop-blur-md transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all cursor-pointer"
          title="Voltar para a lista de conversas"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg overflow-hidden relative shadow-xs border border-border shrink-0">
          <Image
            src={partner?.photoURL || ""}
            alt={partner?.name || "Partner"}
            fill
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            unoptimized
          />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-foreground text-xs md:text-sm leading-none truncate">
            {partner?.name || "Conversa"}
          </h3>
          <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Online agora
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors cursor-pointer"
          title="Chamada de Vídeo"
        >
          <Video className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors cursor-pointer"
          title="Chamada de Áudio"
        >
          <Phone className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button
          type="button"
          className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors cursor-pointer"
          title="Mais opções"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
