"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Lock, 
  Loader2, 
  ShieldCheck, 
  TrendingUp,
  ArrowRight,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const checkRecovery = async () => {
      try {
        console.log("--- DEBUG RECOVERY ---");
        const url = window.location.href;
        const hash = window.location.hash;
        const search = window.location.search;
        
        console.log("URL:", url);
        
        // Verifica se existe algum indício de token ou contexto de recuperação na URL
        const hasToken = hash.includes("access_token=") || 
                         hash.includes("type=recovery") || 
                         hash.includes("error=") ||
                         search.includes("code=");
        
        console.log("Contexto detectado:", { hasToken, hash: !!hash, search: !!search });
        
        // Tentativa 1 imediata
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Erro ao pegar sessão inicial:", sessionError);
          throw sessionError;
        }
        
        if (session) {
          console.log("Sessão encontrada imediatamente. Usuário:", session.user.email);
          setIsReady(true);
          return;
        }

        // Se chegamos aqui, ou tem token na URL ou o Supabase pode estar processando-o.
        // Vamos aguardar por mudanças de estado ou por um tempo limite.
        console.log("Aguardando processamento do link de recuperação...");
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log("Mudança de estado detectada:", event, !!session);
          if (session) {
            setIsReady(true);
            if (timeoutId) clearTimeout(timeoutId);
          }
        });
        authSubscription = subscription;

        // Limite de espera para o processamento automático (um pouco mais longo)
        timeoutId = setTimeout(async () => {
          const { data: { session: finalSession } } = await supabase.auth.getSession();
          if (!finalSession) {
            console.log("Sem sessão após espera prolongada.");
            // Se NÃO tem token na URL E não tem sessão após 6 segundos, aí sim redirecionamos
            if (!hasToken) {
              toast.error("O link de redefinição pode ter expirado ou o acesso é inválido.");
              router.push("/login");
            } else {
              // Se tinha token mas não logou, pode ser erro no token
              toast.error("Não foi possível validar seu acesso. Tente solicitar um novo link.");
              router.push("/login");
            }
          } else {
            console.log("Sessão recuperada após espera.");
            setIsReady(true);
          }
        }, 6000);

      } catch (err: any) {
        console.error("Erro no checkRecovery:", err);
        setIsReady(true); // Fallback: libera o form para o usuário tentar via session se existir
      }
    };

    checkRecovery();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (authSubscription) authSubscription.unsubscribe();
    };
  }, [router]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      console.log("Iniciando redefinição de senha...");
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;
      
      console.log("Senha redefinida com sucesso.");
      
      // Primeiro setamos o estado de sucesso para mudar a UI IMEDIATAMENTE
      setIsSuccess(true);
      setLoading(false);
      toast.success("Sua senha foi atualizada!");

      // Tentamos limpar a sessão em segundo plano, mas sem bloquear a UI de sucesso
      supabase.auth.signOut().catch(err => console.error("Erro ao deslogar:", err));

      // Redirecionamento automático após 4 segundos para o usuário ver a mensagem
      setTimeout(() => {
        console.log("Executando redirecionamento automático...");
        window.location.href = "/login";
      }, 4000);

    } catch (error: any) {
      console.error("Erro ao redefinir senha:", error);
      toast.error(error.message || "Não foi possível atualizar sua senha. O link pode ter expirado.");
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl border border-border max-w-md w-full"
        >
          <div className="w-20 h-20 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center mb-8 text-green-600">
             <ShieldCheck className="w-10 h-10" />
          </div>
          <h3 className="text-3xl font-bold mb-4">Sucesso!</h3>
          <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
            Sua senha foi redefinida com segurança. Você será redirecionado para o login em instantes.
          </p>
          <a 
            href="/login"
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
          >
            Ir para login agora <ArrowRight className="w-5 h-5" />
          </a>
        </motion.div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <h3 className="text-lg font-medium">Validando link de acesso...</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          Aguarde um instante enquanto verificamos seus dados de segurança.
        </p>
        <div className="mt-8">
          <button 
            onClick={() => window.location.reload()}
            className="text-xs text-primary hover:underline font-medium"
          >
            O link não carregou? Clique aqui para atualizar a página.
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background font-sans selection:bg-primary/10 text-foreground">
      {/* Left side: Branding (Simplified from login) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 relative overflow-hidden flex-col justify-center p-12 text-white border-r border-border">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>
        
        <div className="relative z-10 max-w-lg mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-8 backdrop-blur-md mx-auto">
              <ShieldCheck className="w-8 h-8 text-primary/40" />
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight mb-4">
              Segurança em Primeiro Lugar.
            </h1>
            <p className="text-lg text-blue-100/70 font-light">
              Escolha uma senha forte para proteger seus dados e garantir a continuidade do seu trabalho.
            </p>
          </motion.div>
        </div>
        
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary rounded-full blur-[120px] opacity-20" />
      </div>

      {/* Right side: Reset Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="mb-10 text-left">
            <div className="flex items-center gap-2 mb-6 lg:hidden">
              <TrendingUp className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold">SalesScore</span>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-3">
              Redefinir Senha
            </h2>
            <p className="text-muted-foreground">
              Digite sua nova senha abaixo para recuperar o acesso à sua conta.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleReset}>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Nova Senha</label>
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
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Confirmar Nova Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-11 py-3.5 bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm text-foreground"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Atualizar Senha <ArrowRight className="w-4 h-4" /></>
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
