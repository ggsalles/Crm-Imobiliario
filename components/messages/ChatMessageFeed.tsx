"use client";

import { RefObject } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { motion } from "motion/react";
import { FileText, Clock, CheckCheck, Trash2 } from "lucide-react";
import { ChatMessage, Conversation, downloadFile } from "@/lib/db";
import { ChatPartner } from "./ChatConversationList";
import { cn } from "@/lib/utils";

export interface ChatMessageFeedProps {
  messages: ChatMessage[];
  selectedConv: Conversation | null;
  partner: ChatPartner | null;
  userId?: string;
  userRole?: string;
  userName?: string;
  userPhoto?: string | null;
  onDeleteMessage: (msg: ChatMessage) => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function ChatMessageFeed({
  messages,
  selectedConv,
  partner,
  userId,
  userRole,
  userName = "Você",
  userPhoto,
  onDeleteMessage,
  messagesEndRef,
}: ChatMessageFeedProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-muted/5 transition-colors">
      {/* Date Separator */}
      <div className="flex items-center justify-center">
        <span className="px-3 py-0.5 bg-card text-[9px] font-bold text-muted-foreground uppercase tracking-widest rounded-full border border-border shadow-xs">
          Hoje
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {messages.map((msg) => {
          const isOwn = msg.senderId === userId;
          const senderName = isOwn ? userName : partner?.name || "Usuário";
          const senderPhoto = isOwn
            ? userPhoto ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                senderName
              )}&background=0D8ABC&color=fff`
            : partner?.photoURL ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                senderName
              )}&background=0D8ABC&color=fff`;

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "flex gap-2.5 max-w-[85%]",
                isOwn ? "self-end flex-row-reverse" : "self-start"
              )}
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden relative shrink-0 mt-0.5 shadow-xs bg-muted">
                <Image
                  src={senderPhoto || ""}
                  alt={senderName}
                  fill
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  unoptimized
                />
              </div>

              <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "relative group/msg",
                    isOwn ? "items-end text-right" : "items-start text-left"
                  )}
                >
                  {(isOwn || userRole === "Admin") && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteMessage(msg);
                      }}
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center z-10 border border-border bg-card shadow-xs cursor-pointer",
                        isOwn ? "-left-10" : "-right-10",
                        "opacity-0 group-hover/msg:opacity-100 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      )}
                      title="Apagar mensagem"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                  <div
                    className={cn(
                      "rounded-2xl p-3 text-xs md:text-sm shadow-xs transition-all group-hover:shadow-md",
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-card text-foreground rounded-tl-none border border-border/50"
                    )}
                  >
                    <p
                      className={cn(
                        "font-bold text-[9px] uppercase tracking-wider mb-0.5",
                        isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
                      )}
                    >
                      {senderName}
                    </p>
                    {msg.type === "text" ? (
                      <span className="font-medium whitespace-pre-wrap">{msg.content}</span>
                    ) : msg.type === "image" ? (
                      <div className="space-y-1.5">
                        <div className="relative w-full aspect-square min-w-[180px] rounded-lg overflow-hidden bg-muted">
                          <Image
                            src={msg.fileUrl || ""}
                            alt={msg.fileName || "Imagem"}
                            fill
                            className="object-cover cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => window.open(msg.fileUrl, "_blank")}
                            unoptimized
                          />
                        </div>
                        <p className="text-[9px] opacity-70 italic font-medium">Imagem enviada</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-1.5 bg-black/10 rounded-lg">
                        <div className="w-8 h-8 bg-white/10 rounded-md flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate text-xs">{msg.fileName}</p>
                          <button
                            type="button"
                            onClick={() =>
                              msg.fileUrl && downloadFile(msg.fileUrl, msg.fileName || "arquivo")
                            }
                            className="text-[9px] font-bold underline hover:opacity-80 uppercase tracking-wider block cursor-pointer"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      "mt-1 flex items-center gap-1.5 px-0.5",
                      isOwn ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                      {msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : ""}
                    </span>
                    {isOwn &&
                      (() => {
                        if (msg.id.startsWith("temp-")) {
                          return (
                            <Clock
                              className="w-3 h-3 text-muted-foreground animate-pulse"
                              title="Enviando..."
                            />
                          );
                        }
                        const partnerId = selectedConv?.participants?.find((p) => p !== userId);
                        const partnerUnread =
                          partnerId && selectedConv?.unreadCount
                            ? selectedConv.unreadCount[partnerId] || 0
                            : 0;
                        const isRead = partnerUnread === 0;

                        if (isRead) {
                          return <CheckCheck className="w-3 h-3 text-primary" title="Lida" />;
                        }
                        return (
                          <CheckCheck
                            className="w-3 h-3 text-muted-foreground/60"
                            title="Entregue (Ainda não lida)"
                          />
                        );
                      })()}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
}
