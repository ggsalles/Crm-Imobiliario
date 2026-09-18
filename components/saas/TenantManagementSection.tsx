'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, CreditCard, ArrowUpRight, Loader2, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tenant, UserProfile } from '@/lib/db';
import { DEFAULT_TENANT_ID } from '@/lib/constants';
import { TenantPlanCard } from '@/components/saas/TenantPlanCard';

interface TenantManagementSectionProps {
  tenants: Tenant[];
  users: UserProfile[];
  selectedTenantFilter: string;
  currentTenantId: string;
  currentTenant: Tenant;
  tenantUsers: UserProfile[];
  newTenantName: string;
  setNewTenantName: (val: string) => void;
  isCreatingTenant: boolean;
  isUpdatingLimit: boolean;
  isPlatformAdmin: boolean;
  onCreateTenant: (e: React.FormEvent) => void;
  onQuickUpdateLimit: (val: number, targetTenantId?: string) => void;
  onSelectTenant: (id: string) => void;
  onEditTenant: (t: Tenant) => void;
  onRefreshTenants: () => void;
}

export function TenantManagementSection({
  tenants,
  users,
  selectedTenantFilter,
  currentTenantId,
  currentTenant,
  tenantUsers,
  newTenantName,
  setNewTenantName,
  isCreatingTenant,
  isUpdatingLimit,
  isPlatformAdmin,
  onCreateTenant,
  onQuickUpdateLimit,
  onSelectTenant,
  onEditTenant,
  onRefreshTenants
}: TenantManagementSectionProps) {
  return (
    <div className="mb-4 bg-card rounded-xl border border-border overflow-hidden shadow-xs animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="p-3.5 sm:p-4 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight">Painel SaaS - Inquilinos (Tenants)</h3>
            <p className="text-[11px] text-muted-foreground font-medium">
              Cadastre novas imobiliárias/empresas clientes e gerencie suas vagas e isolamento
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/admin/billing"
            className="px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            title="Acessar tela completa de faturamento e vagas"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Gestão SaaS & Cobrança</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>

          <form onSubmit={onCreateTenant} className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Nome da Imobiliária..." 
              value={newTenantName}
              onChange={(e) => setNewTenantName(e.target.value)}
              required
              className="flex-1 sm:w-40 px-3 py-1.5 text-xs bg-muted/60 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
            <button 
              type="submit" 
              disabled={isCreatingTenant}
              className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-all flex items-center gap-1 disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {isCreatingTenant ? <Loader2 className="w-3 h-3 animate-spin" /> : "+ Cadastrar"}
            </button>
          </form>
        </div>
      </div>
      
      <div className="p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-muted/5">
        {tenants.map(t => {
          const tenantUserCount = users.filter(u => u.tenantId === t.id).length;
          const limit = t.userLimit ?? 5;
          const isSelected = (selectedTenantFilter || currentTenantId) === t.id;
          return (
            <div 
              key={t.id} 
              className={cn(
                "relative p-3 bg-card border rounded-lg transition-all shadow-xs flex flex-col justify-between gap-3",
                isSelected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/30"
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="font-bold text-xs text-foreground leading-tight tracking-tight truncate">{t.name}</span>
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                    t.id === DEFAULT_TENANT_ID 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted text-muted-foreground border border-border"
                  )}>
                    {t.id === DEFAULT_TENANT_ID ? 'Padrão' : 'SaaS'}
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground font-mono truncate mb-2 select-all">slug: {t.slug || 'default'}</p>
              </div>
              
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Membros Ativos</span>
                  <span className="text-[11px] font-bold text-foreground bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                    {tenantUserCount} {tenantUserCount === 1 ? 'usuário' : 'usuários'}
                  </span>
                </div>

                {/* Direct User Limit Configurator */}
                <div className="flex items-center justify-between bg-muted/40 p-2 rounded-md border border-border/50">
                  <div>
                    <span className="text-[10px] font-bold text-foreground uppercase tracking-wider block">Vagas / Licenças</span>
                    <span className="text-[8.5px] text-muted-foreground">Definir limite</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="number"
                      min={1}
                      max={500}
                      defaultValue={limit}
                      key={`${t.id}-${limit}`}
                      disabled={isUpdatingLimit}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val !== limit) {
                          onQuickUpdateLimit(val, t.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt((e.target as HTMLInputElement).value);
                          if (!isNaN(val) && val >= 1 && val !== limit) {
                            onQuickUpdateLimit(val, t.id);
                          }
                        }
                      }}
                      className="w-14 px-1.5 py-1 text-xs bg-background border border-border rounded font-mono font-bold text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
                      title="Pressione Enter ou saia do campo para salvar o limite"
                    />
                    <span className="text-[10px] text-muted-foreground font-semibold">vagas</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onEditTenant(t)}
                    className="py-1 px-2 rounded text-[11px] font-semibold bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-all cursor-pointer"
                    title="Editar nome, CNPJ, telefone e localização"
                  >
                    <Edit3 className="w-3 h-3 text-amber-500" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTenant(t.id)}
                    className={cn(
                      "py-1 px-2 rounded text-[11px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer",
                      isSelected 
                        ? "bg-primary text-white" 
                        : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isSelected ? "✓ Selecionada" : "Gerenciar"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Moderno de Precificação e Vagas SaaS */}
      {currentTenant && (
        <div className="p-4 sm:p-5 border-t border-border bg-muted/10 flex flex-col items-center justify-center">
          <div className="text-center mb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Plano Comercial & Vagas SaaS</span>
            <h4 className="text-xs font-bold text-foreground">Gestão de Licenças e Faturamento da Imobiliária</h4>
          </div>
          <TenantPlanCard 
            tenant={currentTenant}
            activeBrokers={tenantUsers.filter(u => u.role === 'Membro' || u.userType !== 'cliente').length}
            activeAdmins={tenantUsers.filter(u => u.role === 'Admin').length}
            totalContacts={tenantUsers.filter(u => u.userType === 'cliente').length}
            isPlatformAdmin={isPlatformAdmin}
            onRefresh={onRefreshTenants}
          />
        </div>
      )}
    </div>
  );
}
