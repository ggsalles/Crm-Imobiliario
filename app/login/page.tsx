"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  LogIn, 
  Rocket, 
  Loader2, 
  TrendingUp, 
  Mail, 
  Lock, 
  Eye, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Github
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function LoginPage() {
  const { user, profile, login, register, resetPassword, loading: authLoading, changeTenant } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Tenant / Imobiliária modal states
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [userTenants, setUserTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [hasConfirmedTenant, setHasConfirmedTenant] = useState(false);
  const [isLoadingUserTenants, setIsLoadingUserTenants] = useState(false);
  const [isSwitchingTenant, setIsSwitchingTenant] = useState(false);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    
    // Auto resolution suggestion for corporate domains (Register mode only, and only if companyName is empty/pristine)
    if (mode === "register" && val.includes("@")) {
      const parts = val.split("@");
      const domain = parts[1]?.toLowerCase();
      if (domain && domain.includes(".")) {
        const genericDomains = [
          "gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "live.com", 
          "icloud.com", "aol.com", "zoho.com", "protonmail.com", "yandex.com", 
          "globomail.com", "bol.com.br", "uol.com.br", "terra.com.br", "ig.com.br"
        ];
        if (!genericDomains.includes(domain)) {
          const domainName = domain.split(".")[0];
          const suggestedName = domainName.charAt(0).toUpperCase() + domainName.slice(1);
          setCompanyName((prev) => prev === "" ? suggestedName : prev);
        }
      }
    }
  };

  // 1. Fetch available tenants for multi-tenant users on login success
  useEffect(() => {
    async function checkAndLoadUserTenants() {
      if (user && profile && !authLoading && !hasConfirmedTenant) {
        try {
          setIsLoadingUserTenants(true);

          // Get fresh session token to satisfy RLS rules
          const { data: { session } } = await supabase.auth.getSession();
          const headers: Record<string, string> = {};
          if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }

          // Fetch the REAL database-level profile to guarantee authentic role & tenantIds
          const profileRes = await fetch(`/api/profiles?id=${user.id}`, { headers });
          let targetProfile = profile;
          if (profileRes.ok) {
            const apiProfile = await profileRes.json();
            if (apiProfile && apiProfile.id) {
              targetProfile = apiProfile;
            }
          }

          // Fetch all active tenants
          const res = await fetch("/api/tenants", { headers });
          if (res.ok) {
            const allTenants = await res.json();
            if (Array.isArray(allTenants)) {
              const isAdmin = targetProfile.role?.toLowerCase() === 'admin' || targetProfile.isAdmin || targetProfile.email?.toLowerCase() === 'ggsalles@gmail.com';
              const userTenantIds = Array.from(new Set([...(targetProfile.tenantIds || []), targetProfile.tenantId].filter(Boolean)));
              const filtered = isAdmin ? allTenants : allTenants.filter((t: any) => userTenantIds.includes(t.id));
              
              if (filtered.length > 1) {
                // User owns or acts for multiple tenants, show modal selector
                setUserTenants(filtered);
                // Pre-select current profile's tenant
                setSelectedTenantId(targetProfile.tenantId || filtered[0]?.id || null);
                setShowTenantModal(true);
              } else {
                // Single tenant user, proceed directly
                setHasConfirmedTenant(true);
              }
            } else {
              setHasConfirmedTenant(true);
            }
          } else {
            setHasConfirmedTenant(true);
          }
        } catch (err) {
          console.error("Erro ao carregar imobiliárias do usuário:", err);
          setHasConfirmedTenant(true); // Fallback to avoid deadlocks
        } finally {
          setIsLoadingUserTenants(false);
        }
      }
    }
    checkAndLoadUserTenants();
  }, [user, profile, authLoading, hasConfirmedTenant]);

  // 2. Navigation redirect when tenant selection is secure and completed
  useEffect(() => {
    if (user && profile && !authLoading && hasConfirmedTenant) {
      router.push("/");
    }
  }, [user, profile, authLoading, hasConfirmedTenant, router]);

  const handleSelectTenant = (tenantId: string) => {
    setSelectedTenantId(tenantId);
  };

  const handleConfirmAndAccess = async () => {
    if (!selectedTenantId) {
      toast.info("Por favor, selecione uma imobiliária.");
      return;
    }
    setIsSwitchingTenant(true);
    try {
      if (selectedTenantId !== profile?.tenantId) {
        await changeTenant(selectedTenantId);
      }
      // O perfil agora está atualizado com o tenantId correto. Definimos a confirmação
      // para disparar a navegação client-side limpa para "/" através do useEffect.
      setHasConfirmedTenant(true);
    } catch (err) {
      console.error("Error switching tenant during login:", err);
      toast.error("Erro ao selecionar imobiliária.");
    } finally {
      setIsSwitchingTenant(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    if (mode === "login") {
      setIsLoggingIn(true);
      try {
        await login(cleanEmail, password);
      } catch (error: any) {
        toast.error(error.message || "Erro ao fazer login");
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      setIsRegistering(true);
      try {
        await register(cleanEmail, password, cleanDisplayName, companyName);
        toast.success("Conta criada com sucesso!");
        setMode("login"); // Switched to login mode
      } catch (error: any) {
        toast.error(error.message || "Erro ao criar conta");
      } finally {
        setIsRegistering(false);
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.info("Por favor, digite seu e-mail no campo acima primeiro.");
      return;
    }

    setIsResettingPassword(true);
    try {
      await resetPassword(email);
      toast.success("E-mail de redefinição enviado! Verifique sua caixa de entrada.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar e-mail de redefinição.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (authLoading || (user && !profile && !hasConfirmedTenant)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Verificando suas credenciais e perfil...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background font-sans selection:bg-primary/10 text-foreground transition-colors duration-500">
      {/* Left side: Branding & Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 relative overflow-hidden flex-col justify-between p-12 text-white border-r border-border">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>
        
        {/* Top Logo */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 relative z-10"
        >
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">SalesScore <span className="text-white/40 text-[10px] uppercase align-middle ml-2">• Enterprise Edition</span></span>
        </motion.div>

        {/* Center Content */}
        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-8 backdrop-blur-md">
              <Zap className="w-8 h-8 text-primary/40" />
            </div>
            <h1 className="text-5xl font-bold leading-[1.1] tracking-tight mb-6">
              Gerencie seu pipeline com precisão absoluta.
            </h1>
            <p className="text-xl text-blue-100/70 font-light leading-relaxed">
              O SalesScore fornece os insights necessários para transformar dados brutos em decisões estratégicas de crescimento.
            </p>
          </motion.div>
        </div>

        {/* Bottom Cards */}
        <div className="grid grid-cols-2 gap-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-2xl"
          >
            <div className="text-3xl font-bold mb-1">+42%</div>
            <div className="text-xs text-blue-100/60 uppercase tracking-wider font-semibold">Aumento médio em conversão</div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-2xl"
          >
            <div className="text-3xl font-bold mb-1">24/7</div>
            <div className="text-xs text-blue-100/60 uppercase tracking-wider font-semibold">Monitoramento de ativos</div>
          </motion.div>
        </div>

        {/* Decorative circle */}
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary rounded-full blur-[120px] opacity-20" />
      </div>

      {/* Right side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-24 bg-background">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="mb-10 text-left">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              {mode === "login" ? "Bem-vindo de volta" : "Criar sua conta"}
            </h2>
            <p className="text-muted-foreground">
              {mode === "login" 
                ? "Acesse sua conta para continuar gerenciando seus negócios." 
                : "Cadastre-se para começar a usar o SalesScore Corporate."}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {mode === "register" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Seu Nome</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground">
                    <LogIn className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="João Silva"
                    required
                    className="w-full pl-11 pr-4 py-3.5 bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm text-foreground"
                  />
                </div>
              </div>
            )}

            {/* Nome da Imobiliária (Apenas no Cadastro/Register) */}
            {mode === "register" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Nome da sua Imobiliária / Empresa</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <input 
                    type="text" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Imobiliária Prime"
                    required
                    className="w-full pl-11 pr-4 py-3.5 bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm text-foreground"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Endereço de E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="nome@empresa.com"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm text-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Senha</label>
                <button 
                  type="button" 
                  disabled={isResettingPassword}
                  onClick={handleForgotPassword}
                  className="text-xs font-semibold text-primary hover:text-primary/80 disabled:opacity-50"
                >
                  {isResettingPassword ? "Enviando..." : "Esqueci minha senha"}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-11 py-3.5 bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm text-foreground"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 px-1">
              <input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-muted" />
              <label className="text-sm text-muted-foreground font-medium">Lembrar de mim</label>
            </div>

            <div className="text-center mt-6">
              <button 
                type="button" 
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                {mode === "login" 
                  ? "Não tem uma senha ainda? Cadastre-se aqui" 
                  : "Já tem uma conta? Entre agora"}
              </button>
            </div>

            <button 
              type="submit"
              disabled={isLoggingIn || isRegistering}
              className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              {isLoggingIn || isRegistering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "login" ? (
                <>Entrar <ArrowRight className="w-4 h-4" /></>
              ) : (
                <>Criar Conta <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

          </form>

          <footer className="mt-10 text-center">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-300">
              © 2024 SalesScore Enterprise. Todos os direitos reservados.
            </p>
          </footer>
        </motion.div>
      </div>

      {/* Modern, Premium Tenant Selection Modal */}
      <AnimatePresence>
        {showTenantModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with elegant blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            {/* Modal Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl p-6 lg:p-8 text-foreground overflow-hidden"
            >
              {/* Subtle top border gradient representing premium brand styling */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                  Acessar Imobiliária
                </h3>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                  Olá, <span className="text-foreground font-semibold">{profile?.displayName || user?.email}</span>! Seu e-mail possui acesso a mais de uma empresa. Selecione por qual deseja trabalhar:
                </p>
              </div>

              {isLoadingUserTenants ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-wider">Carregando imobiliárias disponíveis...</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1.5 scrollbar-thin">
                  {userTenants.map((tenant) => {
                    const isSelected = tenant.id === selectedTenantId;
                    return (
                      <button
                        key={tenant.id}
                        type="button" 
                        disabled={isSwitchingTenant}
                        onClick={() => handleSelectTenant(tenant.id)}
                        className={cn(
                          "w-full flex items-center justify-between gap-4 p-4 rounded-xl text-left border transition-all duration-300 disabled:opacity-50 cursor-pointer group hover:shadow-md select-none",
                          isSelected 
                            ? "bg-primary/5 border-primary shadow-lg shadow-primary/5 ring-1 ring-primary/20" 
                            : "bg-muted/30 hover:bg-muted/60 border-border hover:border-primary/20"
                        )}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border transition-all duration-300 select-none",
                            isSelected 
                              ? "bg-primary text-white border-primary/20 shadow-md shadow-primary/10" 
                              : "bg-background border-border text-foreground group-hover:border-primary/20 group-hover:text-primary"
                          )}>
                            {tenant.name?.[0]?.toUpperCase() || "I"}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-foreground text-sm block truncate select-none">
                              {tenant.name}
                            </span>
                            <span className="text-xs text-muted-foreground block truncate select-none">
                              {isSelected ? "Selecionada para este acesso" : "Clique para selecionar"}
                            </span>
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 select-none animate-in fade-in zoom-in duration-200">
                            Selecionada
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-border flex items-center justify-center text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:border-primary/40 group-hover:bg-primary/5 transition-all shrink-0">
                            <ArrowRight className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Action footer buttons */}
              {!isLoadingUserTenants && (
                <div className="mt-6 flex flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={isSwitchingTenant || !selectedTenantId}
                    onClick={handleConfirmAndAccess}
                    className="w-full bg-primary text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-primary/10 cursor-pointer text-sm select-none"
                  >
                    {isSwitchingTenant ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Acessando Painel...
                      </>
                    ) : (
                      <>Confirmar e Acessar Painel <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isSwitchingTenant}
                    onClick={() => {
                      window.location.reload();
                    }}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground text-center select-none cursor-pointer py-1"
                  >
                    Voltar para a tela de login
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
