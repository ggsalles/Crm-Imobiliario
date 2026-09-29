"use client";

import { X, CheckCircle2, Unlock } from "lucide-react";
import { TenantItem } from "./types";

interface BillingUnlockModalProps {
  tenant: TenantItem | null;
  isUnlocking: boolean;
  onClose: () => void;
  onConfirmPaymentAndUnlock: (tenant: TenantItem) => void;
  onGrantGracePeriodAndUnlock: (tenant: TenantItem) => void;
}

export function BillingUnlockModal({
  tenant,
  isUnlocking,
  onClose,
  onConfirmPaymentAndUnlock,
  onGrantGracePeriodAndUnlock
}: BillingUnlockModalProps) {
  if (!tenant) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-950 border border-slate-800 w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 relative text-slate-100">
        <button
          onClick={() => !isUnlocking && onClose()}
          disabled={isUnlocking}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono uppercase tracking-widest bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded border border-rose-500/30 font-bold">
              Desbloqueio de Acesso
            </span>
            <span className="text-[9px] font-mono text-slate-500">
              {tenant.slug || tenant.id.slice(0, 8)}
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-1.5">
            Liberar Acesso: {tenant.name}
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Esta imobiliária possui fatura em atraso há <strong className="text-rose-400">{tenant.diffDays || 8} dias</strong> (vencimento todo dia {tenant.dueDay || 10}). Como deseja proceder?
          </p>
        </div>

        <div className="space-y-3 pt-1">
          {/* Option 1: Confirm Payment and Unlock */}
          <button
            onClick={() => onConfirmPaymentAndUnlock(tenant)}
            disabled={isUnlocking}
            className="w-full text-left p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200">
                    Marcar Fatura como PAGA e Liberar
                  </span>
                  <span className="text-[8px] uppercase tracking-wider bg-emerald-500/20 text-emerald-300 font-mono px-1 py-0.5 rounded font-bold">
                    Recomendado
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/70 mt-0.5 leading-snug">
                  Quita o histórico de mensalidades pendentes, altera o status para <strong>Regular</strong> e restaura o acesso sem pendências.
                </p>
              </div>
            </div>
          </button>

          {/* Option 2: Grant Grace Period / Provisional Unlock */}
          <button
            onClick={() => onGrantGracePeriodAndUnlock(tenant)}
            disabled={isUnlocking}
            className="w-full text-left p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30 mt-0.5">
                <Unlock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-300 group-hover:text-blue-200">
                    Liberar Acesso Provisório (Carência)
                  </span>
                </div>
                <p className="text-[11px] text-blue-200/70 mt-0.5 leading-snug">
                  Mantém a fatura como <strong>PENDENTE</strong> para cobrança administrativa, mas desbloqueia os usuários para utilizarem o CRM normalmente.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-900">
          <button
            type="button"
            onClick={onClose}
            disabled={isUnlocking}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
