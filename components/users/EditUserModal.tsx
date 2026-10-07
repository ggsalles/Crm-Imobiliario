'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserCheck, 
  Loader2, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Check, 
  Share2, 
  Building2, 
  ShieldCheck, 
  User, 
  Mail, 
  Key,
  Copy,
  UserX
} from 'lucide-react';
import { UserProfile, Tenant, apiFetch } from '@/lib/db';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess: () => void;
  isAdmin: boolean;
  tenants: Tenant[];
}

export function EditUserModal({
  isOpen,
  onClose,
  user,
  onSuccess,
  isAdmin,
  tenants
}: EditUserModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Membro" | "Admin">("Membro");
  const [userType, setUserType] = useState<"funcionário" | "cliente">("funcionário");
  const [tenantId, setTenantId] = useState("");
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [inactiveReason, setInactiveReason] = useState("");
  const [securityKeyword, setSecurityKeyword] = useState("");
  
  // Senha opcional
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Inicializa dados quando o modal abre com o usuário selecionado
  useEffect(() => {
    if (user && isOpen) {
      setDisplayName(user.displayName || "");
      setEmail(user.email || "");
      setRole((user.role === "Admin" ? "Admin" : "Membro"));
      setUserType((user.userType === "cliente" ? "cliente" : "funcionário"));
      setTenantId(user.tenantId || (tenants.length > 0 ? tenants[0].id : ""));
      const initialTenants = Array.isArray(user.tenantIds) && user.tenantIds.length > 0 
        ? user.tenantIds 
        : (user.tenantId ? [user.tenantId] : (tenants.length > 0 ? [tenants[0].id] : []));
      setTenantIds(initialTenants);
      setIsActive(user.isActive !== false);
      setInactiveReason(user.inactiveReason || "");
      setSecurityKeyword(user.securityKeyword || "");
      setNewPassword("");
      setShowPassword(false);
      setCopied(false);
    }
  }, [user, isOpen, tenants]);

  if (!isOpen || !user) return null;

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const special = "@#$&*!";
    let pass = "";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass += special.charAt(Math.floor(Math.random() * special.length));
    pass += Math.floor(10 + Math.random() * 90);
    setNewPassword(pass);
    setShowPassword(true);
    toast.info("Nova senha gerada! Lembre-se de salvar as alterações.");
  };

  const handleCopyAccess = () => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const mainTenant = tenants.find(t => t.id === tenantId)?.name || 'Imobiliária';
    
    let text = `🔑 *Dados de Acesso Atualizados - ${mainTenant}*\n\n` +
      `👤 *Nome:* ${displayName || user.displayName}\n` +
      `📧 *E-mail:* ${email || user.email}\n`;

    if (newPassword) {
      text += `🔒 *Nova Senha:* ${newPassword}\n`;
    }

    text += `🌐 *Acesse em:* ${appUrl}/login\n\n` +
      `_Guarde seus dados de acesso com segurança._`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Dados copiados para a área de transferência!");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("O nome do usuário é obrigatório.");
      return;
    }
    if (!email.trim()) {
      toast.error("O e-mail é obrigatório.");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast.error("A nova senha deve conter pelo menos 6 caracteres.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Atualiza Perfil, Tipos, Papéis e Tenants
      const payload: any = {
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        role,
        userType,
        tenantId: tenantIds.length > 0 ? (tenantIds.includes(tenantId) ? tenantId : tenantIds[0]) : tenantId,
        tenantIds: tenantIds.length > 0 ? tenantIds : [tenantId],
        isActive,
        inactiveReason: !isActive ? inactiveReason.trim() : null,
        securityKeyword: securityKeyword.trim() || null
      };

      await apiFetch(`/api/profiles?id=${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });

      // 2. Se informou nova senha, redefine a senha no Auth do Supabase
      if (newPassword && newPassword.length >= 6) {
        await apiFetch('/api/users/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            targetUserId: user.id,
            targetEmail: email.trim().toLowerCase(),
            newPassword
          })
        });
      }

      toast.success(`Usuário ${displayName} atualizado com sucesso!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erro ao atualizar usuário:", err);
      toast.error(err.message || "Erro ao salvar alterações do usuário.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border/80 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl ring-1 ring-primary/20">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                Editar Usuário
                {isActive ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Ativo
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    Inativo
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Altere nome, e-mail, senha, nível de permissão e imobiliárias
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Seção 1: Identificação Básica */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-primary" />
              Informações Pessoais e Acesso
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Nome Completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full pl-10 pr-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  E-mail de Login *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="joao@imobiliaria.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Senha de Acesso (Opcional) */}
          <div className="p-4 bg-muted/20 border border-border/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-primary" />
                Redefinir Senha (Opcional)
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1.5 cursor-pointer bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 hover:bg-primary/20 transition-all"
              >
                <Sparkles className="w-3 h-3" />
                Gerar Senha Forte
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Deixe em branco caso queira manter a senha atual do usuário. Preencha apenas se desejar alterá-la.
            </p>

            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha (mínimo 6 caracteres)"
                className="w-full pl-10 pr-24 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all font-mono"
              />
              <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
                {newPassword && (
                  <button
                    type="button"
                    onClick={handleCopyAccess}
                    className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    title="Copiar dados"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Seção 3: Papéis e Permissões */}
          {isAdmin && (
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Papéis, Tipo de Acesso e Status
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Tipo de Usuário
                  </label>
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="funcionário">Funcionário / Corretor</option>
                    <option value="cliente">Cliente (Portal)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Nível de Acesso (Cargo)
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="Membro">Membro (Corretor padrão)</option>
                    <option value="Admin">Administrador (Total)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Status da Conta
                  </label>
                  <select
                    value={isActive ? "ativo" : "inativo"}
                    onChange={(e) => setIsActive(e.target.value === "ativo")}
                    className={cn(
                      "w-full px-3.5 py-2.5 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all cursor-pointer",
                      isActive ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-rose-500/10 text-rose-500 border-rose-500/30"
                    )}
                  >
                    <option value="ativo">🟢 Ativo (Com Acesso)</option>
                    <option value="inativo">🔴 Inativo (Acesso Suspenso)</option>
                  </select>
                </div>
              </div>

              {!isActive && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-rose-500 flex items-center gap-1">
                    <UserX className="w-3.5 h-3.5" />
                    Motivo da Inativação (Opcional)
                  </label>
                  <input
                    type="text"
                    value={inactiveReason}
                    onChange={(e) => setInactiveReason(e.target.value)}
                    placeholder="Ex: Desligado da empresa em Outubro/2026"
                    className="w-full px-3.5 py-2 bg-rose-500/5 border border-rose-500/30 rounded-xl text-xs text-foreground focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Seção 4: Multi-Tenant / Imobiliárias */}
          {isAdmin && tenants.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  Imobiliárias com Acesso Autorizado
                </span>
                <span className="text-[10px] font-bold text-primary">
                  {tenantIds.length} selecionada(s)
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 bg-muted/20 border border-border/80 rounded-2xl max-h-44 overflow-y-auto">
                {tenants.map((t) => {
                  const isChecked = tenantIds.includes(t.id);
                  const isPrimary = tenantId === t.id;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-all",
                        isChecked ? "bg-card border-primary/40 shadow-xs" : "bg-muted/30 border-border opacity-70"
                      )}
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-foreground select-none flex-1 truncate pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let updated: string[];
                            if (e.target.checked) {
                              updated = [...tenantIds, t.id];
                            } else {
                              updated = tenantIds.filter(id => id !== t.id);
                            }
                            if (updated.length === 0) {
                              updated = [t.id];
                            }
                            setTenantIds(updated);
                            if (!updated.includes(tenantId)) {
                              setTenantId(updated[0]);
                            }
                          }}
                          className="rounded border-border text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer accent-primary"
                        />
                        <span className="truncate">{t.name}</span>
                      </label>

                      {isChecked && (
                        <button
                          type="button"
                          onClick={() => setTenantId(t.id)}
                          className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer",
                            isPrimary 
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30" 
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          )}
                          title="Definir como Imobiliária Padrão"
                        >
                          {isPrimary ? "👑 Principal" : "Tornar Principal"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Palavra-chave de recuperação (Opcional) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-primary" />
              Palavra-chave Secreta (Recuperação de Senha)
            </label>
            <input
              type="text"
              value={securityKeyword}
              onChange={(e) => setSecurityKeyword(e.target.value)}
              placeholder="Ex: Nome da primeira imobiliária, cidade natal..."
              className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>

          {/* Actions Footer */}
          <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-muted text-muted-foreground transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando Alterações...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
