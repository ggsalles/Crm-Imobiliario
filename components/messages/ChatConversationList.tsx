"use client";

import Image from "next/image";
import { format } from "date-fns";
import { Loader2, Edit3, Trash2 } from "lucide-react";
import { Conversation } from "@/lib/db";
import { cn } from "@/lib/utils";

export interface ChatPartner {
  id: string;
  name: string;
  email: string;
  photoURL: string;
  type: "team" | "client";
  role?: string | null;
}

export interface ChatConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  selectedConv: Conversation | null;
  onSelectConv: (conv: Conversation) => void;
  onOpenNewChat: () => void;
  onDeleteConv: (conv: Conversation) => void;
  getPartner: (conv: Conversation) => ChatPartner | null;
  searchQuery: string;
  userId?: string;
}

export function ChatConversationList({
  conversations,
  loading,
  selectedConv,
  onSelectConv,
  onOpenNewChat,
  onDeleteConv,
  getPartner,
  searchQuery,
  userId,
}: ChatConversationListProps) {
  const filteredConversations = conversations.filter((conv) => {
    const partner = getPartner(conv);
    return (
      (partner?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.lastMessage || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <section
      className={cn(
        "w-full md:w-80 bg-card border-r border-border flex flex-col shrink-0 transition-colors",
        selectedConv ? "hidden md:flex" : "flex"
      )}
    >
      <div className="p-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base md:text-lg font-bold tracking-tight">Centro de Mensagens</h2>
          <button
            type="button"
            onClick={onOpenNewChat}
            className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors cursor-pointer"
            title="Nova conversa"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex p-0.5 bg-muted/50 rounded-xl">
          <button
            type="button"
            className="flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg bg-background text-primary shadow-xs"
          >
            Equipe
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-20 px-8">
            <p className="text-sm text-muted-foreground italic">
              Nenhuma conversa encontrada nesta categoria.
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const partner = getPartner(conv);
            const isActive = selectedConv?.id === conv.id;
            const unread = userId && conv.unreadCount ? conv.unreadCount[userId] || 0 : 0;

            return (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectConv(conv)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectConv(conv);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all mb-1 text-left group cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/20 relative",
                  isActive ? "bg-primary/10" : "hover:bg-muted/50"
                )}
              >
                <div className="relative shrink-0">
                  <Image
                    src={
                      partner?.photoURL ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        partner?.name || "U"
                      )}`
                    }
                    alt={partner?.name || "Partner"}
                    width={44}
                    height={44}
                    className="w-11 h-11 rounded-xl object-cover shadow-xs bg-muted"
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background shadow-xs" />
                </div>

                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex justify-between items-start mb-0.5">
                    <h4
                      className={cn(
                        "font-bold truncate text-xs md:text-sm transition-colors",
                        isActive ? "text-primary" : "text-foreground"
                      )}
                    >
                      {partner?.name}
                    </h4>
                  </div>
                  <p
                    className={cn(
                      "text-xs truncate transition-colors",
                      isActive
                        ? "text-primary/70"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {conv.lastMessage || "Nenhuma mensagem ainda"}
                  </p>
                </div>

                <div className="flex flex-col items-end justify-between self-stretch py-0.5 shrink-0">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                    {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), "HH:mm") : ""}
                  </span>

                  <div className="flex items-center gap-1 mt-auto">
                    {unread > 0 && (
                      <span className="w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 shadow-xs shadow-primary/20">
                        {unread}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConv(conv);
                      }}
                      className="p-1 rounded-md transition-all text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-40 group-hover:opacity-100 hover:opacity-100 cursor-pointer"
                      title="Excluir conversa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
