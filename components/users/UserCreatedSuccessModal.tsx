'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  X, 
  Copy, 
  Check, 
  Share2, 
  User, 
  Mail, 
  Lock, 
  Building2 
} from 'lucide-react';
import { toast } from 'sonner';

interface UserCreatedSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: {
    displayName: string;
    email: string;
    password?: string;
    securityKeyword?: string;
    role: string;
    tenantName?: string;
  } | null;
}

export function UserCreatedSuccessModal({
  isOpen,
  onClose,
  userData
}: UserCreatedSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !userData) return null;

  const handleCopyAccess = () => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const text = `🎉 *Novo Acesso ao CRM - ${userData.tenantName || 'Imobiliária'}*\n\n` +
      `Olá, *${userData.displayName}*! Seu acesso ao sistema está liberado:\n\n` +
      `📧 *E-mail:* ${userData.email}\n` +
      (userData.password ? `🔒 *Senha Inicial:* ${userData.password}\n` : `🔒 *Senha:* Utilize a opção "Esqueci minha senha" no primeiro acesso para cadastrar sua senha.\n`) +
      (userData.securityKeyword ? `🔑 *Palavra-Chave de Recuperação:* ${userData.securityKeyword}\n` : '') +
      `🌐 *Link de Acesso:* ${appUrl}/login\n\n` +
      `_Bom trabalho e ótimas vendas!_`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Dados de acesso copiados para a área de transferência!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-border">
        {/* Header */}
        <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground leading-tight">Usuário Cadastrado!</h3>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Acesso pronto para uso</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="bg-muted/30 border border-border rounded-xl p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground font-medium">Nome:</span>
              <span className="font-bold text-foreground truncate">{userData.displayName}</span>
            </div>

            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground font-medium">E-mail:</span>
              <span className="font-bold text-foreground truncate">{userData.email}</span>
            </div>

            {userData.password && (
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground font-medium">Senha:</span>
                <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md text-[11px]">
                  {userData.password}
                </span>
              </div>
            )}

            {userData.securityKeyword && (
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-muted-foreground font-medium">Palavra-Chave:</span>
                <span className="font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md text-[11px]">
                  {userData.securityKeyword}
                </span>
              </div>
            )}

            {userData.tenantName && (
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground font-medium">Empresa:</span>
                <span className="font-bold text-foreground truncate">{userData.tenantName}</span>
              </div>
            )}
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
            onClick={onClose}
            className="w-full py-2 border border-border hover:bg-muted text-muted-foreground rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
