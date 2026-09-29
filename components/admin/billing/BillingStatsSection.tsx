"use client";

import { Building2, CalendarCheck, AlertTriangle, Lock, Info } from "lucide-react";

interface BillingStatsSectionProps {
  totalImobiliarias: number;
  activeCount: number;
  overdueAlertCount: number;
  blockedCount: number;
  estimatedRevenue: number;
  suttleStart: number;
  criticalStart: number;
  blockStart: number;
}

export function BillingStatsSection({
  totalImobiliarias,
  activeCount,
  overdueAlertCount,
  blockedCount,
  estimatedRevenue,
  suttleStart,
  criticalStart,
  blockStart
}: BillingStatsSectionProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Bento Statistics Section */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 sm:p-3.5 relative overflow-hidden backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#717d96]">Total Imobiliárias</p>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight mt-1 text-slate-100">{totalImobiliarias}</h3>
            </div>
            <div className="p-1.5 sm:p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/15">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[9px] font-medium text-[#717d96] mt-2 font-mono truncate">
            Empresas no SaaS
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 sm:p-3.5 relative overflow-hidden backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#717d96]">Contratos Regulares</p>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight mt-1 text-emerald-400">{activeCount - overdueAlertCount}</h3>
            </div>
            <div className="p-1.5 sm:p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/15">
              <CalendarCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[9px] font-medium text-emerald-500/80 mt-2 font-mono truncate">
            Em dia (sem avisos)
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 sm:p-3.5 relative overflow-hidden backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#717d96]">Em Régua de Alerta</p>
              <h3 className={`text-lg sm:text-xl font-bold tracking-tight mt-1 ${overdueAlertCount > 0 ? "text-amber-400" : "text-slate-100"}`}>
                {overdueAlertCount}
              </h3>
            </div>
            <div className="p-1.5 sm:p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/15">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[9px] font-medium text-amber-500/80 mt-2 font-mono truncate">
            Aviso Sutil ou Crítico
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 sm:p-3.5 relative overflow-hidden backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#717d96]">Acessos Suspensos</p>
              <h3 className={`text-lg sm:text-xl font-bold tracking-tight mt-1 ${blockedCount > 0 ? "text-rose-500" : "text-slate-100"}`}>
                {blockedCount}
              </h3>
            </div>
            <div className="p-1.5 sm:p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/15">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[9px] font-medium text-rose-500/80 mt-2 font-mono truncate">
            Bloqueados por atraso
          </div>
        </div>
      </section>

      {/* Validation & Explanation Banner */}
      <div className="bg-slate-950/60 border border-indigo-500/20 rounded-xl p-3 sm:p-3.5 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 sm:p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 shrink-0 mt-0.5">
            <Info className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-200">
              Validação Automática de Parcelas & Régua Financeira
            </h4>
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-3xl">
              <strong>1. Meses Automáticos:</strong> Linha do tempo contínua projetada. 
              <strong className="ml-2">2. Status Padrão PENDENTE:</strong> Parcelas nascem pendentes até marcação. 
              <strong className="ml-2">3. Régua:</strong> Alertas em D+{suttleStart}, D+{criticalStart} e Bloqueio em D+{blockStart}.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
            R$ {estimatedRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
          </span>
        </div>
      </div>
    </div>
  );
}
