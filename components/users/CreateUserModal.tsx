'use client';

import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  Loader2, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Check, 
  Share2 
} from 'lucide-react';
import { Tenant } from '@/lib/db';
import { toast } from 'sonner';

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
    password?: string;
    securityKeyword?: string;
  };
  setNewUserData: React.Dispatch<React.SetStateAction<{
    displayName: string;
    email: string;
    role: "Membro" | "Admin";
    userType: "funcionário" | "cliente";
    tenantId: string;
    tenantIds: string[];
    password?: string;
    securityKeyword?: string;
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
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const special = "@#$&*!";
    let pass = "";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass += special.charAt(Math.floor(Math.random() * special.length));
    pass += Math.floor(10 + Math.random() * 90);
    setNewUserData(prev => ({ ...prev, password: pass }));
    setShowPassword(true);
    toast.success("Senha segura gerada!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-border flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground leading-tight">Cadastrar Usuário</h3>
              <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Preencha os dados e credenciais de acesso</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={onSubmit} className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
          {/* Nome */}
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

          {/* E-mail */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">E-mail de Acesso</label>
            <input 
              type="email"
              required
              placeholder="corretor@imobiliaria.com"
              value={newUserData.email}
              onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary/10 transition-all font-medium focus:outline-none"
            />
          </div>

          {/* Senha Inicial */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">
                Senha Inicial (Opcional)
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                Gerar Senha Forte
              </button>
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="Definir senha provisória ou gerar"
                value={newUserData.password || ""}
                onChange={(e) => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full pl-3 pr-9 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary/10 transition-all font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground leading-tight">
              Se deixar em branco, o usuário poderá definir a senha através de &quot;Esqueci minha senha&quot; no primeiro acesso.
            </p>
          </div>

          {/* Palavra-Chave Secreta de Recuperação */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-amber-500" />
                Palavra-Chave de Recuperação (Opcional)
              </label>
            </div>
            <input 
              type="text"
              placeholder="Ex: imovel2026, golden, leao"
              value={newUserData.securityKeyword || ""}
              onChange={(e) => setNewUserData(prev => ({ ...prev, securityKeyword: e.target.value }))}
              className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary/10 transition-all font-medium focus:outline-none"
            />
            <p className="text-[9px] text-muted-foreground leading-tight">
              Permite ao usuário recuperar a conta na tela de login de forma instantânea, sem precisar de e-mail.
            </p>
          </div>

          {/* Tipo e Nível */}
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
              <div className="border border-border bg-muted/20 rounded-lg p-2.5 space-y-1.5 max-h-[120px] overflow-y-auto">
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

          {/* Submit */}
          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isCreating}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-md"
            >
              {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              {isCreating ? "Cadastrando Usuário..." : "Finalizar Cadastro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
