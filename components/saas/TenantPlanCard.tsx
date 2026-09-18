'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Edit3, 
  Check, 
  Loader2, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle,
  Users,
  UserCheck,
  UserPlus
} from 'lucide-react';
import { Tenant } from '@/lib/db';
import { EditTenantModal } from './EditTenantModal';
import { toast } from 'sonner';

interface TenantPlanCardProps {
  tenant: Tenant;
  activeBrokers: number;
  activeAdmins: number;
  totalContacts: number;
  isPlatformAdmin: boolean;
  onRefresh?: () => void;
}

export function TenantPlanCard({
  tenant,
  activeBrokers,
  activeAdmins,
  totalContacts,
  isPlatformAdmin,
  onRefresh
}: TenantPlanCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Local state for plan fields
  const [basePrice, setBasePrice] = useState<number>(tenant.basePrice ?? 499.00);
  const [brokerLimit, setBrokerLimit] = useState<number>(tenant.brokerLimit ?? tenant.userLimit ?? 2);
  const [adminLimit, setAdminLimit] = useState<number>(tenant.adminLimit ?? 1);
  const [extraBrokerPrice, setExtraBrokerPrice] = useState<number>(tenant.extraBrokerPrice ?? 29.90);
  const [extraAdminPrice, setExtraAdminPrice] = useState<number>(tenant.extraAdminPrice ?? 49.90);

  // Sync state when tenant prop updates
  useEffect(() => {
    setBasePrice(tenant.basePrice ?? 499.00);
    setBrokerLimit(tenant.brokerLimit ?? tenant.userLimit ?? 2);
    setAdminLimit(tenant.adminLimit ?? 1);
    setExtraBrokerPrice(tenant.extraBrokerPrice ?? 29.90);
    setExtraAdminPrice(tenant.extraAdminPrice ?? 49.90);
  }, [tenant]);

  // Calculations for extras & total bill
  const extraBrokers = Math.max(0, activeBrokers - brokerLimit);
  const extraAdmins = Math.max(0, activeAdmins - adminLimit);
  const extraBrokersCost = extraBrokers * extraBrokerPrice;
  const extraAdminsCost = extraAdmins * extraAdminPrice;
  const totalMonthly = basePrice + extraBrokersCost + extraAdminsCost;

  // Formatting helpers
  const formatBrl = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSavePlan = async () => {
    setIsSavingPlan(true);
    try {
      const bLimit = Number(brokerLimit) || 1;
      const aLimit = Number(adminLimit) || 1;
      const currentExtraBrokers = Math.max(0, activeBrokers - bLimit);
      const currentExtraAdmins = Math.max(0, activeAdmins - aLimit);
      const syncedUserLimit = bLimit + aLimit + currentExtraBrokers + currentExtraAdmins;

      const payload = {
        basePrice: Number(basePrice) || 0,
        brokerLimit: bLimit,
        adminLimit: aLimit,
        extraBrokerPrice: Number(extraBrokerPrice) || 0,
        extraAdminPrice: Number(extraAdminPrice) || 0,
        userLimit: syncedUserLimit
      };

      const res = await fetch(`/api/tenants?id=${tenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar valores do plano');
      }

      toast.success(`Valores do plano salvos! Capacidade sincronizada para ${syncedUserLimit} vagas.`);
      try {
        if (onRefresh) onRefresh();
      } catch (cbErr) {
        console.warn('[TenantPlanCard] Refresh callback notice:', cbErr);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao comunicar com o servidor');
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Status badge logic
  const isBlocked = tenant.isBlocked || tenant.billingStatus === 'bloqueado';
  const isOverdue = tenant.billingStatus === 'aviso_critico' || tenant.billingStatus === 'aviso_sutil';

  return (
    <div className="bg-[#0b1329] text-white border border-[#1e293b] rounded-2xl shadow-xl overflow-hidden max-w-md w-full mx-auto animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="p-4 sm:p-5 space-y-3.5">
        
        {/* Title row with icon & status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white leading-tight">
                {tenant.name}
              </h3>
              <div className="flex items-center gap-1 text-xs text-indigo-300/80 mt-0.5 font-medium">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {tenant.city ? `${tenant.city}${tenant.state ? `/${tenant.state}` : ''}` : 'Localização não informada'}
                </span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          {isBlocked ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 uppercase">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Bloqueado
            </span>
          ) : isOverdue ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 uppercase">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Em Atraso
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Plano Ativo
            </span>
          )}
        </div>

        {/* CNPJ & Edit Button Row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="px-3 py-1.5 bg-[#111c3a] border border-[#1e293b] rounded-lg text-xs font-mono font-medium text-slate-300 truncate">
            <span className="text-slate-400">CNPJ: </span>
            <span>{tenant.cnpj || 'Não cadastrado'}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="px-3 py-1.5 bg-[#162244] hover:bg-[#1c2c58] text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Editar Cadastro</span>
          </button>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* Corretores */}
          <div className="bg-[#111c3a] border border-[#1e293b] rounded-xl p-3 text-center">
            <span className="text-[11px] font-medium text-slate-400 block mb-1 truncate">
              Corretores
            </span>
            <span className="text-base font-bold text-white tracking-tight">
              {activeBrokers}/{brokerLimit}
            </span>
          </div>

          {/* Admins ERP */}
          <div className="bg-[#111c3a] border border-[#1e293b] rounded-xl p-3 text-center">
            <span className="text-[11px] font-medium text-slate-400 block mb-1 truncate">
              Admins ERP
            </span>
            <span className="text-base font-bold text-white tracking-tight">
              {activeAdmins}/{adminLimit}
            </span>
          </div>

          {/* Clientes / Leads */}
          <div className="bg-[#111c3a] border border-[#1e293b] rounded-xl p-3 text-center">
            <span className="text-[11px] font-medium text-slate-400 block mb-1 truncate">
              Clientes
            </span>
            <span className="text-base font-bold text-emerald-400 tracking-tight">
              {totalContacts}
            </span>
          </div>
        </div>

        {/* Total Monthly Highlight Card */}
        <div className="bg-[#111c3a] border border-[#1e293b] rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-200">
              Fatura Mensal Total:
            </span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono tracking-tight">
              R$ {formatBrl(totalMonthly)}/mês
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1.5 border-t border-[#1e293b]">
            <span className="flex items-center gap-1 text-slate-400">
              Capacidade do Plano:
            </span>
            <span className="font-bold text-white font-mono bg-[#0b1329] px-2 py-0.5 rounded border border-[#1e293b]">
              {brokerLimit + adminLimit + extraBrokers + extraAdmins} vagas ({brokerLimit + adminLimit} base{extraBrokers + extraAdmins > 0 ? ` + ${extraBrokers + extraAdmins} extra(s)` : ''})
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            {extraBrokers === 0 && extraAdmins === 0 ? (
              'Dentro do limite contratado (sem extras)'
            ) : (
              <span className="text-amber-400 font-medium">
                {extraBrokers > 0 && `${extraBrokers} corretor(es) extra(s) (+R$ ${formatBrl(extraBrokersCost)}) `}
                {extraAdmins > 0 && `${extraAdmins} admin(s) extra(s) (+R$ ${formatBrl(extraAdminsCost)})`}
              </span>
            )}
          </p>
        </div>

        {/* Plan Configuration Form */}
        <div className="space-y-2 pt-1 text-xs">
          
          {/* Plano Base */}
          <div className="flex items-center justify-between bg-[#111c3a] px-3 py-2 rounded-xl border border-[#1e293b]">
            <span className="font-bold text-slate-200">Plano Base Mensal:</span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-emerald-400 font-bold">R$</span>
              <input 
                type="number"
                step="0.01"
                min="0"
                value={basePrice}
                disabled={!isPlatformAdmin || isSavingPlan}
                onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                className="w-24 px-2 py-1 bg-[#0b1329] border border-[#1e293b] rounded text-emerald-400 font-extrabold text-right focus:outline-none focus:border-emerald-500"
              />
              <span className="text-slate-400 text-[11px]">/mês</span>
            </div>
          </div>

          {/* Vagas Corretores */}
          <div className="flex items-center justify-between px-1 py-1">
            <span className="text-slate-300 font-medium">Vagas Corretores (Plano):</span>
            <input 
              type="number"
              min="1"
              max="500"
              value={brokerLimit}
              disabled={!isPlatformAdmin || isSavingPlan}
              onChange={(e) => setBrokerLimit(parseInt(e.target.value) || 1)}
              className="w-20 px-2 py-1 bg-[#111c3a] border border-[#1e293b] rounded-lg text-white font-bold font-mono text-center focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Vagas Admins ERP */}
          <div className="flex items-center justify-between px-1 py-1">
            <span className="text-slate-300 font-medium">Vagas Admins ERP (Plano):</span>
            <input 
              type="number"
              min="1"
              max="50"
              value={adminLimit}
              disabled={!isPlatformAdmin || isSavingPlan}
              onChange={(e) => setAdminLimit(parseInt(e.target.value) || 1)}
              className="w-20 px-2 py-1 bg-[#111c3a] border border-[#1e293b] rounded-lg text-white font-bold font-mono text-center focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Preço por Corretor Extra */}
          <div className="flex items-center justify-between px-1 py-1">
            <span className="text-slate-300 font-medium">Preço p/ Corretor Extra:</span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-amber-400 font-bold">R$</span>
              <input 
                type="number"
                step="0.01"
                min="0"
                value={extraBrokerPrice}
                disabled={!isPlatformAdmin || isSavingPlan}
                onChange={(e) => setExtraBrokerPrice(parseFloat(e.target.value) || 0)}
                className="w-20 px-2 py-1 bg-[#111c3a] border border-[#1e293b] rounded-lg text-amber-400 font-bold text-right focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Preço por Admin Extra */}
          <div className="flex items-center justify-between px-1 py-1">
            <span className="text-slate-300 font-medium">Preço p/ Admin Extra:</span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-amber-400 font-bold">R$</span>
              <input 
                type="number"
                step="0.01"
                min="0"
                value={extraAdminPrice}
                disabled={!isPlatformAdmin || isSavingPlan}
                onChange={(e) => setExtraAdminPrice(parseFloat(e.target.value) || 0)}
                className="w-20 px-2 py-1 bg-[#111c3a] border border-[#1e293b] rounded-lg text-amber-400 font-bold text-right focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        {isPlatformAdmin && (
          <button
            type="button"
            disabled={isSavingPlan}
            onClick={handleSavePlan}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {isSavingPlan ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gravando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Gravar Valores do Plano</span>
              </>
            )}
          </button>
        )}

      </div>

      {/* Edit Company Modal */}
      <EditTenantModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        tenant={tenant}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}
