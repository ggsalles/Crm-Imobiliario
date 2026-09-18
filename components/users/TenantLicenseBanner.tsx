'use client';

import React from 'react';
import { Shield, AlertTriangle, Settings2, Sparkles, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tenant, UserProfile } from '@/lib/db';

interface TenantLicenseBannerProps {
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  isLimitReached: boolean;
  activeCount: number;
  tenantUserLimit: number;
  visualBlocksString: string;
  currentTenant: Tenant;
  remainingSlots: number;
  currentTenantId: string;
  isUpdatingLimit: boolean;
  tenants: Tenant[];
  usagePercentage: number;
  tenantUsers: UserProfile[];
  onQuickUpdateLimit: (val: number, targetTenantId?: string) => void;
  onSelectTenantFilter: (id: string) => void;
  onOpenLimitModal: () => void;
  onOpenAddModal: () => void;
}

export function TenantLicenseBanner({
  isAdmin,
  isPlatformAdmin,
  isLimitReached,
  activeCount,
  tenantUserLimit,
  visualBlocksString,
  currentTenant,
  remainingSlots,
  currentTenantId,
  isUpdatingLimit,
  tenants,
  usagePercentage,
  tenantUsers,
  onQuickUpdateLimit,
  onSelectTenantFilter,
  onOpenLimitModal,
  onOpenAddModal
}: TenantLicenseBannerProps) {
  if (!isAdmin && !isPlatformAdmin) return null;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-xs">
      <div className="p-3.5 sm:p-4 bg-muted/20 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
            isLimitReached 
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30" 
              : "bg-primary/10 text-primary border border-primary/20"
          )}>
            {isLimitReached ? <AlertTriangle className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-foreground leading-tight">
                Licenças Contratadas: {activeCount} de {tenantUserLimit} vagas ativas
              </h3>
              <span className="font-mono text-xs font-bold text-muted-foreground select-all bg-muted px-2 py-0.5 rounded border border-border">
                {visualBlocksString}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
              <span className="font-semibold text-foreground">{currentTenant.name}</span> • {isLimitReached ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">Capacidade máxima atingida (100% ocupado)</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {remainingSlots} vaga{remainingSlots > 1 ? 's' : ''} disponível{remainingSlots > 1 ? 'is' : ''} para novos corretores
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isPlatformAdmin && (
            <div className="flex items-center gap-1.5 bg-muted/60 border border-border px-2 py-1 rounded-lg">
              <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                <Settings2 className="w-3 h-3 text-primary" /> Vagas:
              </span>
              <input 
                type="number" 
                min={1} 
                max={500} 
                defaultValue={tenantUserLimit}
                key={`topcard-${currentTenantId}-${tenantUserLimit}`}
                disabled={isUpdatingLimit}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1 && val !== tenantUserLimit) {
                    onQuickUpdateLimit(val, currentTenantId);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (!isNaN(val) && val >= 1 && val !== tenantUserLimit) {
                      onQuickUpdateLimit(val, currentTenantId);
                    }
                  }
                }}
                className="w-12 px-1 py-0.5 text-xs bg-background border border-border rounded font-mono font-bold text-foreground text-center focus:ring-1 focus:ring-primary focus:outline-none"
                title="Altere o total de vagas contratadas e pressione Enter ou clique fora para salvar"
              />
              <span className="text-[10px] text-muted-foreground font-medium">limite</span>
            </div>
          )}

          {isPlatformAdmin && tenants.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Imobiliária:</span>
              <select 
                value={currentTenantId}
                onChange={(e) => onSelectTenantFilter(e.target.value)}
                className="text-xs bg-card border border-border rounded-lg px-2 py-1 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {isLimitReached ? (
            <button
              onClick={onOpenLimitModal}
              className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Solicitar Mais Vagas</span>
            </button>
          ) : (
            <button
              onClick={onOpenAddModal}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Convidar Corretor</span>
            </button>
          )}
        </div>
      </div>

      {/* Segmented Visual Blocks & Progress */}
      <div className="p-3.5 sm:p-4 bg-muted/5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Distribuição Visual das Licenças
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground font-mono">
              {activeCount}/{tenantUserLimit} ({usagePercentage}%)
            </span>
            <span className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
              isLimitReached
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
            )}>
              {isLimitReached ? "Limite Atingido" : `${remainingSlots} Vaga${remainingSlots > 1 ? 's' : ''} Livre${remainingSlots > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* Visual Blocks Render [■■■□□] */}
        <div className="flex flex-wrap items-center gap-1.5">
          {Array.from({ length: Math.max(tenantUserLimit, activeCount) }).map((_, idx) => {
            const isOccupied = idx < activeCount;
            const assignedUser = tenantUsers[idx];
            return (
              <div 
                key={idx}
                title={isOccupied ? `Vaga ${idx + 1}: ${assignedUser?.displayName || assignedUser?.email || 'Ocupada'}` : `Vaga ${idx + 1}: Disponível para convidar corretor`}
                className={cn(
                  "h-8 min-w-8 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-mono font-bold transition-all border",
                  isOccupied 
                    ? isLimitReached 
                      ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                      : "bg-primary text-white border-primary shadow-xs"
                    : "bg-muted/30 border-dashed border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <span>{isOccupied ? "■" : "□"}</span>
                <span className="text-[10px]">{idx + 1}</span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden border border-border/50">
          <div 
            className={cn(
              "h-full transition-all duration-500 rounded-full",
              isLimitReached ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
