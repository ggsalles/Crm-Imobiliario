"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, AlertTriangle, ShieldAlert, ArrowRight, X, CreditCard } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { isPlatformAdmin, PLATFORM_ADMIN_EMAIL } from "@/lib/constants";

export function BillingAlertBanner() {
  const { billingStatus, billingSuspensionDate, dueDay, diffDays, tenantName, profile, isTenantBlocked } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  const isPublicPath = pathname === '/login' || pathname === '/register' || pathname === '/reset-password';

  if (!billingStatus || billingStatus === 'regular' || dismissed || isPublicPath) {
    return null;
  }

  // Se o usuário comum já estiver diante da tela cheia de bloqueio, não duplicar
  if (isTenantBlocked && !isPlatformAdmin(profile?.email)) {
    return null;
  }

  const isMaster = isPlatformAdmin(profile?.email);
  const isBlocked = billingStatus === 'bloqueado';
  const isCritical = billingStatus === 'aviso_critico';
  const isSuttle = billingStatus === 'aviso_sutil';

  if (isBlocked) {
    return (
      <aside
        id="billing-alert-banner-blocked"
        aria-label="Alerta de faturamento bloqueado"
        className="bg-gradient-to-r from-rose-950/95 via-rose-900/90 to-rose-950/95 border-b border-rose-500/40 text-rose-100 px-4 py-2.5 sm:px-6 relative z-40 backdrop-blur-md shadow-lg shadow-rose-950/30 animate-in fade-in slide-in-from-top-2 duration-300"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 mt-0.5 md:mt-0 flex-shrink-0 shadow-inner">
              <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  Acesso Bloqueado (D+{diffDays !== undefined && diffDays !== null ? diffDays : 7})
                </span>
                <span className="font-bold text-sm text-white">
                  {isMaster
                    ? `Aviso Master: A imobiliária "${tenantName || 'SalesScore'}" está BLOQUEADA por inadimplência`
                    : `Acesso Suspenso por Pendência Financeira - ${tenantName || 'Sua Imobiliária'}`}
                </span>
              </div>
              <p className="text-xs text-rose-200/90 mt-0.5 leading-relaxed">
                {isMaster ? (
                  <>
                    A fatura com vencimento no dia <strong>{dueDay || 10}</strong> está em atraso há <strong>{diffDays !== undefined && diffDays !== null ? diffDays : 7} dias</strong>. Os corretores e administradores comuns desta empresa estão bloqueados. Seu acesso está liberado por ser Administrador da Plataforma.
                  </>
                ) : (
                  <>
                    A mensalidade com vencimento no dia <strong>{dueDay || 10}</strong> não foi identificada. O acesso aos recursos foi bloqueado. Por favor, regularize o pagamento para restaurar o sistema.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
            {isMaster ? (
              <Link
                href="/admin/billing"
                id="banner-btn-manage-billing"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-950/40 active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Painel de Cobrança SaaS</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            ) : (
              <a
                href={`mailto:${PLATFORM_ADMIN_EMAIL}?subject=Desbloqueio%20de%20Acesso%20CRM%20SalesScore`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-950/40 active:scale-95 whitespace-nowrap"
              >
                <span>Solicitar Segunda Via / PIX</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            )}

            <button
              onClick={() => setDismissed(true)}
              id="banner-btn-dismiss"
              className="p-1.5 rounded-lg text-rose-300/70 hover:text-white hover:bg-rose-500/20 transition-colors ml-1 cursor-pointer"
              title="Ocultar aviso temporariamente"
              aria-label="Ocultar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (isCritical) {
    return (
      <aside
        id="billing-alert-banner-critical"
        aria-label="Alerta crítico de faturamento"
        className="bg-gradient-to-r from-amber-950/95 via-amber-900/90 to-amber-950/95 border-b border-amber-500/40 text-amber-100 px-4 py-2.5 sm:px-6 relative z-40 backdrop-blur-md shadow-lg shadow-amber-950/30 animate-in fade-in slide-in-from-top-2 duration-300"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mt-0.5 md:mt-0 flex-shrink-0 shadow-inner">
              <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Vencimento em Aberto (D+{diffDays !== undefined && diffDays !== null ? diffDays : 5})
                </span>
                <span className="font-bold text-sm text-white">
                  {`Atenção: Mensalidade da imobiliária "${tenantName || 'SalesScore'}" vencida`}
                </span>
              </div>
              <p className="text-xs text-amber-200/90 mt-0.5 leading-relaxed">
                Fatura com vencimento no dia <strong>{dueDay || 10}</strong> está pendente. A suspensão total dos serviços ocorrerá às <strong className="text-amber-300 underline">{billingSuspensionDate}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
            {isMaster ? (
              <Link
                href="/admin/billing"
                id="banner-btn-view-billing"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-md active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Ver Cobrança SaaS</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            ) : (
              <a
                href={`mailto:${PLATFORM_ADMIN_EMAIL}?subject=Segunda%20Via%20CRM%20SalesScore`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-md active:scale-95 whitespace-nowrap"
              >
                <span>Obter Boleto / PIX</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            )}

            <button
              onClick={() => setDismissed(true)}
              id="banner-btn-dismiss-critical"
              className="p-1.5 rounded-lg text-amber-300/70 hover:text-white hover:bg-amber-500/20 transition-colors ml-1 cursor-pointer"
              title="Ocultar aviso temporariamente"
              aria-label="Ocultar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (isSuttle) {
    return (
      <aside
        id="billing-alert-banner-suttle"
        aria-label="Lembrete de vencimento financeiro"
        className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2 sm:px-6 relative z-40 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-200/90 leading-snug">
              <span className="font-semibold text-white">Lembrete Financeiro {diffDays ? `(D+${diffDays})` : ''}:</span> Mensalidade da imobiliária &quot;{tenantName || 'SalesScore'}&quot; com vencimento no dia <strong>{dueDay || 10}</strong> em aberto ({diffDays} dia{diffDays === 1 ? '' : 's'} de atraso). Regularize até <strong>{billingSuspensionDate}</strong> para evitar interrupções.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {isMaster && (
              <Link
                href="/admin/billing"
                className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline transition-colors"
              >
                Painel Financeiro →
              </Link>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-amber-400/60 hover:text-amber-200 transition-colors cursor-pointer"
              title="Fechar"
              aria-label="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return null;
}
