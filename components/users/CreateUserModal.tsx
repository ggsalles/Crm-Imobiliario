'use client';

import React from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { Tenant } from '@/lib/db';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isCreating: boolean;
  newUserData: {
    displayName: string;
    email: string;
    role: "Membro" | "Admin";
    userType: "funcionário" | "cliente";
    tenantId: string;
    tenantIds: string[];
  };
  setNewUserData: React.Dispatch<React.SetStateAction<{
    displayName: string;
    email: string;
    role: "Membro" | "Admin";
    userType: "funcionário" | "cliente";
    tenantId: string;
    tenantIds: string[];
  }>>;
  isAdmin: boolean;
  tenants: Tenant[];
}

export function CreateUserModal({
  isOpen,
  onClose,
  onSubmit,
  isCreating,
  newUserData,
  setNewUserData,
  isAdmin,
  tenants
}: CreateUserModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground leading-tight">Cadastrar Usuário</h3>
              <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Preencha os dados de acesso</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        
        <form onSubmit={onSubmit} className="p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Nome de Exibição</label>
            <input 
              type="text"
              required
              placeholder="Ex: João Silva"
              value={newUserData.displayName}
              onChange={(e) => setNewUserData(prev => ({ ...prev, displayName: e.target.value }))}
              className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary/10 transition-all font-medium focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">E-mail (Google)</label>
            <input 
              type="email"
              required
              placeholder="email@gmail.com"
              value={newUserData.email}
              onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary/10 transition-all font-medium focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Tipo</label>
              <select 
                className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:outline-none appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em] font-medium"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                value={newUserData.userType}
                onChange={(e) => setNewUserData(prev => ({ ...prev, userType: e.target.value as any }))}
              >
                <option value="funcionário" className="bg-card">Funcionário</option>
                <option value="cliente" className="bg-card">Cliente</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Nível</label>
              <select 
                className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:outline-none appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em] font-medium"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                value={newUserData.role}
                onChange={(e) => setNewUserData(prev => ({ ...prev, role: e.target.value as any }))}
              >
                <option value="Membro" className="bg-card">Membro</option>
                <option value="Admin" className="bg-card">Admin</option>
              </select>
            </div>
          </div>

          {/* Multi-Tenant associations in creation form */}
          {isAdmin && tenants.length > 0 && (
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Vincular a Imobiliárias / Empresas</label>
              <div className="border border-border bg-muted/20 rounded-lg p-2.5 space-y-1.5 max-h-[140px] overflow-y-auto">
                {tenants.map(t => {
                  const isNewChecked = (newUserData.tenantIds || []).includes(t.id);
                  return (
                    <label key={t.id} className="flex items-center gap-2 hover:bg-muted/50 p-1 rounded-lg cursor-pointer text-xs font-semibold text-foreground">
                      <input 
                        type="checkbox"
                        checked={isNewChecked}
                        onChange={(e) => {
                          let currentIds = newUserData.tenantIds || [];
                          if (e.target.checked) {
                            currentIds = [...currentIds, t.id];
                          } else {
                            currentIds = currentIds.filter(id => id !== t.id);
                          }
                          if (currentIds.length === 0) {
                            currentIds = [t.id];
                          }
                          setNewUserData(prev => ({
                            ...prev,
                            tenantIds: currentIds,
                            tenantId: currentIds[0]
                          }));
                        }}
                        className="rounded border-border text-primary focus:ring-primary/20 w-3.5 h-3.5 cursor-pointer accent-primary"
                      />
                      <span className="truncate">{t.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/10 p-2.5 rounded-lg">
            <p className="text-[10px] text-primary leading-tight font-medium">
              <strong>Informação Importante:</strong> Após o cadastro aqui, o usuário deve acessar a tela de login, clicar em <strong>&quot;Não tem uma senha ainda? Cadastre-se aqui&quot;</strong> e definir sua senha inicial usando o e-mail informado.
            </p>
          </div>

          <button 
            type="submit" 
            disabled={isCreating}
            className="w-full bg-primary text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 mt-1 cursor-pointer"
          >
            {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Finalizar Cadastro"}
          </button>
        </form>
      </div>
    </div>
  );
}
