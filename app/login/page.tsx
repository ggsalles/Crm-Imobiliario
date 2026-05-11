"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function LoginPage() {
  const { user, login, register, resetPassword, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      router.push("/");
    }
  }, [user, authLoading, router]);

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
        await register(cleanEmail, password, cleanDisplayName);
        // We don't necessarily redirect here because if email verification is ON, 
        // there is no session yet and the AuthProvider won't trigger a navigation.
        // The toast in register() will handle the message.
        setMode("login"); // Switch to login mode so they can try to enter after verifying
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

  if (authLoading) return null;

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
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Endereço de E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
    </div>
  );
}
