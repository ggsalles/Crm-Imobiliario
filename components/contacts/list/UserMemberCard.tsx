"use client";

import { memo } from "react";
import Image from "next/image";
import { Mail, ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfile } from "@/lib/db";

interface UserMemberCardProps {
  user: UserProfile;
  isCurrentUser?: boolean;
  onMessage: (target: any, type: 'cliente' | 'equipe') => void;
  isMessaging: boolean;
}

export const UserMemberCard = memo(function UserMemberCard({ 
  user, 
  isCurrentUser = false,
  onMessage, 
  isMessaging 
}: UserMemberCardProps) {
  const isAdmin = user.role === 'Admin' || user.isAdmin === true;
  return (
    <div className={cn(
      "bg-card p-4 rounded-xl border shadow-xs hover:shadow-md transition-all group h-full flex flex-col justify-between",
      isCurrentUser ? "border-primary/40 bg-primary/[0.02]" : "border-border"
    )}>
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center overflow-hidden border border-border relative">
              {user.photoURL ? (
                <Image src={user.photoURL} alt="Avatar" fill className="w-full h-full object-cover" referrerPolicy="no-referrer" unoptimized />
              ) : (
                <span className="font-bold text-base text-primary">{user.displayName?.charAt(0) || 'U'}</span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm md:text-base flex items-center gap-1.5 text-foreground">
                {user.displayName}
                {isCurrentUser && (
                  <span className="bg-muted text-muted-foreground text-[8px] uppercase px-1.5 py-0.5 rounded font-black">Você</span>
                )}
                <span className={cn(
                  "text-[8px] uppercase px-1.5 py-0.5 rounded font-black",
                  isAdmin ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-primary/10 text-primary"
                )}>
                  {isAdmin ? 'Admin' : 'Membro'}
                </span>
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium">Membro da Organização</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-primary font-bold">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Conta Vinculada</span>
          </div>
        </div>

        {isCurrentUser ? (
          <div className="w-full text-xs font-semibold py-1.5 bg-muted/60 text-muted-foreground rounded-lg flex items-center justify-center gap-1.5 mt-auto border border-border/50 select-none">
            Sua Conta
          </div>
        ) : (
          <button 
            onClick={() => onMessage(user, 'equipe')}
            disabled={isMessaging}
            className="w-full text-xs font-bold py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 mt-auto cursor-pointer"
          >
            {isMessaging && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Enviar Mensagem
          </button>
        )}
      </div>
    </div>
  );
});
