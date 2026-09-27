'use client';

import React, { useState } from 'react';
import { 
  KeyRound, 
  X, 
  Loader2, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Copy, 
  Check, 
  Share2, 
  ShieldAlert 
} from 'lucide-react';
import { UserProfile, apiFetch } from '@/lib/db';
import { toast } from 'sonner';

interface AdminResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  tenantName?: string;
}

export function AdminResetPasswordModal({
  isOpen,
  onClose,
  user,
  tenantName = "Imobiliária"
}: AdminResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

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
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/users/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: user.id,
          targetEmail: user.email,
          newPassword
        })
      });

      toast.success(`Senha de ${user.displayName || user.email} atualizada com sucesso!`);
      setSavedSuccess(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir a senha do usuário.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAccess = () => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const text = `🔑 *Dados de Acesso ao CRM - ${tenantName}*\n\n` +
      `👤 *Usuário:* ${user.displayName || 'Corretor'}\n` +
      `📧 *E-mail:* ${user.email}\n` +
      `🔒 *Nova Senha:* ${newPassword}\n` +
      `🌐 *Acesse em:* ${appUrl}/login\n\n` +
      `_Guarde sua senha com segurança._`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Dados de acesso copiados para a área de transferência!");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleModalClose = () => {
    setNewPassword("");
    setSavedSuccess(false);
    setShowPassword(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground leading-tight">Redefinir Senha de Acesso</h3>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Defina uma nova senha para o usuário</p>
            </div>
          </div>
          <button 
            onClick={handleModalClose} 
            className="p-1.5 hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Target User Card */}
          <div className="bg-muted/40 border border-border/80 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
              {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : user.email.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-foreground truncate">{user.displayName || "Usuário"}</h4>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted border border-border/60 text-muted-foreground shrink-0">
              {user.role}
            </span>
          </div>

          {!savedSuccess ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Nova Senha
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
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary/20 transition-all font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-500 leading-snug font-medium">
                  A nova senha entrará em vigor imediatamente. O usuário poderá utilizá-la no próximo login.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="flex-1 py-2 px-3 border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !newPassword}
                  className="flex-1 py-2 px-3 bg-primary hover:opacity-90 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center space-y-2">
                <div className="w-9 h-9 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Senha Atualizada com Sucesso!</h4>
                <div className="bg-background/80 border border-border/80 rounded-xl p-2.5 font-mono text-xs font-bold text-foreground tracking-wider flex items-center justify-center gap-2">
                  <span>{newPassword}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyAccess}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/20 active:scale-[0.98]"
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copied ? "Dados Copiados!" : "Copiar Dados de Acesso para WhatsApp"}
              </button>

              <button
                type="button"
                onClick={handleModalClose}
                className="w-full py-2 border border-border hover:bg-muted text-muted-foreground rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
