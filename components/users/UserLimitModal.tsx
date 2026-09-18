'use client';

import React from 'react';
import { X, ShieldAlert, Shield, Loader2, MessageSquare, ArrowUpRight } from 'lucide-react';
import { Tenant } from '@/lib/db';

interface UserLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTenant: Tenant;
  tenantUserLimit: number;
  activeCount: number;
  visualBlocksString: string;
  isPlatformAdmin: boolean;
  currentTenantId: string;
  isUpdatingLimit: boolean;
  onQuickUpdateLimit: (newLimit: number) => void;
}

export function UserLimitModal({
  isOpen,
  onClose,
  currentTenant,
  tenantUserLimit,
  activeCount,
  visualBlocksString,
  isPlatformAdmin,
  currentTenantId,
  isUpdatingLimit,
  onQuickUpdateLimit
}: UserLimitModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-border animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-amber-500/10 via-card to-card flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground leading-tight">
                Limite de Vagas Atingido
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Capacidade máxima de licenças contratadas
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Status Box */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
            <p className="text-xs text-amber-950 dark:text-amber-200 font-medium leading-relaxed">
              Sua imobiliária <strong>{currentTenant.name}</strong> está utilizando todas as <strong>{tenantUserLimit} de {tenantUserLimit}</strong> licenças ativas contratadas no seu plano atual.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-amber-500/20 text-xs font-mono font-bold">
              <span className="text-amber-800 dark:text-amber-300">Licenças Ocupadas:</span>
              <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[11px]">
                {visualBlocksString} 100%
              </span>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-muted/30 border border-border rounded-lg p-2.5 text-center">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Contratadas</span>
              <span className="text-base font-bold text-foreground">{tenantUserLimit}</span>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-2.5 text-center">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Ativas</span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">{activeCount}</span>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-2.5 text-center">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Disponíveis</span>
              <span className="text-base font-bold text-rose-600 dark:text-rose-400">0</span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              Para adicionar novos corretores ou membros à sua equipe, solicite um upgrade de plano para liberar novas licenças ou desative usuários que não estão mais atuando.
            </p>
            <p className="text-[11px]">
              💡 <em>Dica:</em> Você também pode liberar vagas imediatamente revisando e removendo membros ou corretores inativos na lista abaixo.
            </p>
          </div>

          {/* Admin SaaS inline adjustment */}
          {isPlatformAdmin && (
            <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                  <Shield className="w-3 h-3 text-primary" /> Painel SaaS (Ajuste Rápido)
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">ID: {currentTenantId.slice(0, 8)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Novo Limite:</span>
                <input 
                  type="number" 
                  min={1} 
                  max={500}
                  defaultValue={tenantUserLimit + 5}
                  id="quick-new-limit"
                  className="w-20 px-2 py-1 text-xs bg-card border border-border rounded-md font-mono font-bold text-foreground text-center"
                />
                <button
                  disabled={isUpdatingLimit}
                  onClick={() => {
                    const input = document.getElementById("quick-new-limit") as HTMLInputElement;
                    const val = parseInt(input?.value);
                    if (!isNaN(val) && val >= 1) {
                      onQuickUpdateLimit(val);
                    }
                  }}
                  className="px-3 py-1 bg-primary text-white text-xs font-semibold rounded-md hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer"
                >
                  {isUpdatingLimit ? <Loader2 className="w-3 h-3 animate-spin" /> : "Aumentar Vagas"}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
            <a 
              href={`https://wa.me/5511999999999?text=${encodeURIComponent(`Olá! Gostaria de solicitar a contratação de mais vagas/licenças de corretores para a imobiliária ${currentTenant.name}. Atualmente temos ${tenantUserLimit} vagas contratadas.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Falar no WhatsApp / Solicitar Vagas</span>
              <ArrowUpRight className="w-3 h-3" />
            </a>
            <button
              onClick={onClose}
              className="w-full sm:w-auto py-2 px-3 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Gerenciar Usuários Atuais
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
