'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { UserProfile } from '@/lib/db';
import { UserX, AlertTriangle, ShieldAlert, CheckCircle2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InactivateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onConfirm: (userId: string, reason: string) => Promise<void>;
  isProcessing: boolean;
}

const PRESET_REASONS = [
  'Férias / Licença',
  'Suspensão preventiva',
  'Desligamento da imobiliária',
  'Afastamento temporário',
  'Ajuste operacional de equipe'
];

export function InactivateUserModal({
  isOpen,
  onClose,
  user,
  onConfirm,
  isProcessing
}: InactivateUserModalProps) {
  const [reason, setReason] = useState('');

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(user.id, reason.trim());
    setReason('');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-card border border-rose-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-rose-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">Inativar Usuário</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Bloqueio Individual
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suspenda o acesso ao CRM mantendo o histórico de negócios e contatos intacto
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* User Preview Card */}
          <div className="p-3.5 bg-muted/40 border border-border rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border">
              {user.photoURL ? (
                <Image 
                  src={user.photoURL} 
                  alt={user.displayName} 
                  width={40} 
                  height={40} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="font-bold text-sm text-muted-foreground">
                  {user.displayName ? user.displayName[0] : "?"}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm font-bold text-foreground truncate">{user.displayName}</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border uppercase">
                  {user.role}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          {/* Guarantees Box */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>O que acontece ao inativar este usuário?</span>
            </div>
            <ul className="text-[11.5px] text-muted-foreground space-y-1.5 pl-6 list-disc">
              <li>
                <strong className="text-foreground">Bloqueio Imediato:</strong> O usuário não conseguirá mais efetuar login ou acessar nenhuma tela do sistema.
              </li>
              <li>
                <strong className="text-foreground">Histórico Preservado:</strong> Todos os negócios, contatos, atividades, histórico de chat e imóveis cadastrados por ele continuam salvos no CRM.
              </li>
              <li>
                <strong className="text-foreground">Liberação de Vaga:</strong> A licença contratada deste usuário é liberada para outro corretor da imobiliária.
              </li>
              <li>
                <strong className="text-foreground">Reversível:</strong> Você poderá reativar o usuário a qualquer momento com apenas 1 clique.
              </li>
            </ul>
          </div>

          {/* Quick presets */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Motivo da Inativação (opcional)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_REASONS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setReason(preset)}
                  className={cn(
                    "text-[10.5px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer",
                    reason === preset
                      ? "bg-rose-500 text-white border-rose-600 font-bold shadow-xs"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo (ex: Afastamento temporário ou aguardando regularização documental)..."
              rows={2}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Inativando...</span>
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5" />
                  <span>Confirmar Inativação</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
