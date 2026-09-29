"use client";

import { CheckCircle2, Lock, Unlock, AlertTriangle, Clock } from "lucide-react";
import { SaaSAdminConfig } from "@/lib/billing-types";
import { TenantItem, MonthColumn } from "./types";

interface BillingMatrixTableProps {
  tenants: TenantItem[];
  config: SaaSAdminConfig | null;
  displayedMonths: MonthColumn[];
  onCyclePayment: (tenantId: string, monthKey: string) => void;
  onUpdateDueDay: (tenantId: string, newDay: number) => void;
  onUpdateUserLimit: (tenantId: string, limit: number) => void;
  onToggleAccess: (tenant: TenantItem, isBlockedOnSaaS: boolean) => void;
}

export function BillingMatrixTable({
  tenants,
  config,
  displayedMonths,
  onCyclePayment,
  onUpdateDueDay,
  onUpdateUserLimit,
  onToggleAccess
}: BillingMatrixTableProps) {
  return (
    <div className="overflow-x-auto min-w-full">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-900 bg-slate-950/40 text-[9px] font-black uppercase text-[#717d96] tracking-wider font-mono">
            <th className="px-3.5 py-2.5">Imobiliária</th>
            <th className="px-2.5 py-2.5 text-center">Status</th>
            <th className="px-2.5 py-2.5 text-center">Vencimento</th>
            <th className="px-2.5 py-2.5 text-center" title="Limite contratado de usuários/corretores">Vagas</th>
            {displayedMonths.map(month => (
              <th 
                key={month.key} 
                className={`px-2 py-2.5 text-center select-none font-bold ${
                  month.isCurrent ? "bg-indigo-950/40 text-indigo-300 border-b-2 border-indigo-500" : ""
                }`}
              >
                <div className="flex flex-col items-center">
                  <span>{month.label}</span>
                  {month.isCurrent && (
                    <span className="text-[7px] tracking-normal font-sans text-indigo-400 uppercase font-black">
                      (Atual)
                    </span>
                  )}
                </div>
              </th>
            ))}
            <th className="px-3 py-2.5 text-center">Acesso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-900 text-slate-300">
          {tenants.length === 0 ? (
            <tr>
              <td colSpan={5 + displayedMonths.length} className="px-4 py-8 text-center text-xs text-slate-500 font-medium">
                Nenhuma imobiliária encontrada para os filtros selecionados.
              </td>
            </tr>
          ) : (
            tenants.map(tenant => {
              const isManuallyUnlocked = Boolean(tenant.isManuallyUnlocked || config?.unlockedTenantIds?.includes(tenant.id));
              const isBlockedOnSaaS = !isManuallyUnlocked && (tenant.isBlocked || tenant.billingStatus === 'bloqueado');
              const tenantPayments = config?.payments?.[tenant.id] || {};

              // Visual badge for the live billing evaluation
              let statusBadge = (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Regular
                </span>
              );

              if (isBlockedOnSaaS) {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30" title={`Suspensão (${tenant.diffDays || 0} dias de atraso)`}>
                    <Lock className="w-2.5 h-2.5" />
                    Bloqueado {tenant.diffDays ? `(D+${tenant.diffDays})` : ""}
                  </span>
                );
              } else if (isManuallyUnlocked && (tenant.overdueCount || 0) > 0) {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30" title={`Acesso liberado sob carência administrativa (${tenant.diffDays || 0} dias de pendência)`}>
                    <Unlock className="w-2.5 h-2.5" />
                    Carência (D+{tenant.diffDays || 0})
                  </span>
                );
              } else if (tenant.billingStatus === 'aviso_critico') {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-orange-500/15 text-orange-400 border border-orange-500/30" title={`Pop-up crítico (${tenant.diffDays || 0} dias de atraso)`}>
                    <AlertTriangle className="w-2.5 h-2.5" />
                    Crítico (D+{tenant.diffDays || 0})
                  </span>
                );
              } else if (tenant.billingStatus === 'aviso_sutil') {
                statusBadge = (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30" title={`Banner sutil (${tenant.diffDays || 0} dias de atraso)`}>
                    <Clock className="w-2.5 h-2.5" />
                    Sutil (D+{tenant.diffDays || 0})
                  </span>
                );
              }

              return (
                <tr key={tenant.id} className="hover:bg-slate-900/20 transition-colors">
                  <td className="px-3.5 py-2.5 min-w-[170px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] border shrink-0 ${
                        isBlockedOnSaaS 
                          ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                      }`}>
                        {tenant.name?.[0]?.toUpperCase() || "I"}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-semibold text-slate-100 block truncate">{tenant.name}</span>
                        <span className="text-[8px] font-mono text-slate-500 block truncate">
                          {tenant.slug || tenant.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Calculated Billing Status Badge */}
                  <td className="px-2.5 py-2.5 text-center min-w-[120px]">
                    {statusBadge}
                  </td>

                  {/* Custom Due Day Select Column */}
                  <td className="px-2.5 py-2.5 text-center min-w-[95px]">
                    <select
                      value={config?.dueDays?.[tenant.id] ?? 10}
                      onChange={(e) => onUpdateDueDay(tenant.id, parseInt(e.target.value))}
                      className="bg-slate-950 border border-slate-800 text-[11px] text-slate-100 rounded-md px-1.5 py-0.5 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer font-bold select-none font-mono text-center mx-auto block hover:bg-slate-900"
                      title="Dia do vencimento mensal desta imobiliária"
                    >
                      {[1, 5, 10, 15, 20, 25].map((day) => (
                        <option key={day} value={day}>
                          Dia {day}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Custom User Limit (Vagas) Column */}
                  <td className="px-2.5 py-2.5 text-center min-w-[85px]">
                    <div className="flex items-center justify-center gap-1">
                      <input 
                        type="number"
                        min={1}
                        max={500}
                        defaultValue={config?.userLimits?.[tenant.id] ?? tenant.userLimit ?? 5}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1) {
                            onUpdateUserLimit(tenant.id, val);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt((e.target as HTMLInputElement).value);
                            if (!isNaN(val) && val >= 1) {
                              onUpdateUserLimit(tenant.id, val);
                            }
                          }
                        }}
                        className="w-12 bg-slate-950 border border-slate-800 text-[11px] text-slate-100 rounded-md px-1 py-0.5 text-center font-mono font-bold focus:border-indigo-500 focus:outline-none"
                        title="Limite de vagas ativas (pressione Enter ou saia do campo para salvar)"
                      />
                      <span className="text-[9px] text-slate-500 font-mono">vagas</span>
                    </div>
                  </td>

                  {/* Dynamic Month Columns */}
                  {displayedMonths.map(month => {
                    const status = tenantPayments[month.key] || "pendente";
                    let badgeBg = "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:border-amber-500/40";
                    let label = "PENDENTE";
                    
                    if (status === "pago") {
                      badgeBg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40";
                      label = "PAGO";
                    } else if (status === "atrasado") {
                      badgeBg = "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:border-rose-500/40";
                      label = "ATRASADO";
                    }

                    return (
                      <td 
                        key={month.key} 
                        className={`px-1.5 py-2 text-center min-w-[80px] ${
                          month.isCurrent ? "bg-indigo-950/15" : ""
                        }`}
                      >
                        <button
                          onClick={() => onCyclePayment(tenant.id, month.key)}
                          className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border cursor-pointer hover:filter hover:brightness-125 transition-all w-16 mx-auto block text-center font-mono ${badgeBg}`}
                          title="Clique para alternar: PAGO -> PENDENTE -> ATRASADO"
                        >
                          {label}
                        </button>
                      </td>
                    );
                  })}

                  {/* Lock / Unlock Toggle Action Button */}
                  <td className="px-3 py-2 text-center min-w-[105px]">
                    <button
                      onClick={() => onToggleAccess(tenant, isBlockedOnSaaS)}
                      className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider font-mono border select-none transition-all cursor-pointer ${
                        isBlockedOnSaaS
                          ? "bg-rose-600 border-rose-600 text-white hover:bg-rose-500 shadow-xs"
                          : isManuallyUnlocked && (tenant.overdueCount || 0) > 0
                          ? "bg-blue-900/50 border-blue-500/50 text-blue-300 hover:bg-blue-800/60"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                      title={isBlockedOnSaaS ? "Clique para liberar o acesso desta imobiliária" : "Clique para suspender o acesso manualmente"}
                    >
                      {isBlockedOnSaaS ? (
                        <>
                          <Lock className="w-2.5 h-2.5 text-white" />
                          Bloqueado
                        </>
                      ) : isManuallyUnlocked && (tenant.overdueCount || 0) > 0 ? (
                        <>
                          <Unlock className="w-2.5 h-2.5 text-blue-300" />
                          Carência
                        </>
                      ) : (
                        <>
                          <Unlock className="w-2.5 h-2.5 text-slate-400" />
                          Liberado
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
