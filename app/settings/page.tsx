"use client";

export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/sidebar";
import { useTheme } from "@/providers/theme-provider";
import { useAuth } from "@/providers/auth-provider";
import { 
  Palette, 
  Check, 
  Layout, 
  Sparkles, 
  Monitor,
  Target,
  Percent,
  Clock,
  Moon,
  Volume2,
  VolumeX,
  User,
  Shield,
  Building,
  Bell,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Loader2
} from "lucide-react";
import { STAGES, DEFAULT_TENANT_NAME } from "@/lib/constants";
import { safeGetItem, safeSetItem, safeGetJson, safeSetJson, getTenantPipelineProbabilities, saveTenantPipelineProbabilities } from "@/lib/safe-storage";
import { isSoundEnabled, setSoundEnabled, playIcqSound, unlockAudio } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { recordAuditEvent } from "@/lib/audit";
import { supabase } from "@/lib/supabase";
import { updateUserProfile } from "@/lib/db";
import { DataImportSection } from "@/components/settings/DataImportSection";
import Image from "next/image";

interface ColorOption {
  name: string;
  value: "blue" | "emerald" | "orange" | "purple" | "rose" | "indigo";
  hex: string;
}

const COLOR_OPTIONS: ColorOption[] = [
  { name: "Ocean Blue", value: "blue", hex: "#3b82f6" },
  { name: "Forest Green", value: "emerald", hex: "#10b981" },
  { name: "Sunset Orange", value: "orange", hex: "#f97316" },
  { name: "Royal Purple", value: "purple", hex: "#a855f7" },
  { name: "Velvet Rose", value: "rose", hex: "#f43f5e" },
  { name: "Deep Indigo", value: "indigo", hex: "#6366f1" },
];

const THEME_OPTIONS = [
  { id: "system", label: "Sistema", icon: Monitor, bg: "bg-slate-200 dark:bg-slate-800", border: "border-slate-300 dark:border-slate-700", iconColor: "text-slate-600 dark:text-slate-400" },
  { id: "light", label: "Claro", icon: Sparkles, bg: "bg-slate-50", border: "border-slate-200", iconColor: "text-amber-500" },
  { id: "dark", label: "Escuro", icon: Layout, bg: "bg-slate-900", border: "border-slate-800", iconColor: "text-blue-400" },
  { id: "neutral", label: "Preto Obsidian", icon: Moon, bg: "bg-black", border: "border-zinc-900", iconColor: "text-zinc-400" },
] as const;

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { primaryColor, setPrimaryColor, appearance, setAppearance } = useTheme();
  
  // Pipeline Probabilities
  const [probabilities, setProbabilities] = useState<Record<string, number>>({});
  const [isSaved, setIsSaved] = useState(false);

  // Inactivity Timeout
  const [sessionEnabled, setSessionEnabled] = useState(true);
  const [sessionMinutes, setSessionMinutes] = useState(15);
  const [isSessionSaved, setIsSessionSaved] = useState(false);

  // Sound & Notifications
  const [soundEnabled, setSoundActiveState] = useState(true);
  const [isTestingSound, setIsTestingSound] = useState(false);

  // Password Change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Security Keyword for Instant Password Recovery
  const [securityKeywordInput, setSecurityKeywordInput] = useState("");
  const [isSavingKeyword, setIsSavingKeyword] = useState(false);

  useEffect(() => {
    if (profile?.securityKeyword) {
      setSecurityKeywordInput(profile.securityKeyword);
    }
  }, [profile?.securityKeyword]);

  const handleSaveSecurityKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) {
      toast.error("Perfil de usuário não carregado.");
      return;
    }
    setIsSavingKeyword(true);
    try {
      await updateUserProfile(profile.id, {
        securityKeyword: securityKeywordInput.trim(),
        email: profile.email
      });

      recordAuditEvent({
        action: 'UPDATE_SETTINGS',
        title: 'Atualização da Palavra-Chave Secreta',
        content: `Usuário "${profile?.displayName || profile?.email}" atualizou sua palavra-chave de recuperação de conta.`,
        severity: 'medium',
        category: 'auth',
        userId: profile?.id,
        userName: profile?.displayName || profile?.email,
        userEmail: profile?.email,
        tenantId: profile?.tenantId
      });

      toast.success("Palavra-Chave de recuperação salva com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar palavra-chave.");
    } finally {
      setIsSavingKeyword(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas informadas não coincidem.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      recordAuditEvent({
        action: 'UPDATE_SETTINGS',
        title: 'Alteração de Senha do Usuário',
        content: `Usuário "${profile?.displayName || profile?.email}" atualizou sua própria senha de acesso.`,
        severity: 'medium',
        category: 'auth',
        userId: profile?.id,
        userName: profile?.displayName || profile?.email,
        userEmail: profile?.email,
        tenantId: profile?.tenantId
      });

      toast.success("Sua senha foi alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar a senha.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  useEffect(() => {
    // Stage probabilities isoladas por Tenant
    const saved = getTenantPipelineProbabilities(profile?.tenantId);
    if (saved) {
      setProbabilities(saved);
    } else {
      const defaults = STAGES.reduce((acc, stage) => {
        acc[stage.id] = stage.defaultProb;
        return acc;
      }, {} as Record<string, number>);
      setProbabilities(defaults);
    }
  }, [profile?.tenantId]);

  useEffect(() => {
    // Session Timeout
    const timeoutEnabled = safeGetItem("session_timeout_enabled") !== "false";
    const timeoutMinutes = Number(safeGetItem("session_timeout_minutes") || "15");
    setSessionEnabled(timeoutEnabled);
    setSessionMinutes(timeoutMinutes);

    // Sound alert
    setSoundActiveState(isSoundEnabled());

    const handleSoundToggle = (e: any) => {
      if (e?.detail?.enabled !== undefined) {
        setSoundActiveState(e.detail.enabled);
      }
    };
    window.addEventListener("crm-sound-toggle", handleSoundToggle);
    return () => window.removeEventListener("crm-sound-toggle", handleSoundToggle);
  }, []);

  const handleProbChange = useCallback((id: string, value: string) => {
    const numValue = Math.min(100, Math.max(0, parseInt(value, 10) || 0));
    setProbabilities(prev => ({
      ...prev,
      [id]: numValue
    }));
    setIsSaved(false);
  }, []);

  const saveProbabilities = useCallback(() => {
    saveTenantPipelineProbabilities(profile?.tenantId, probabilities);
    setIsSaved(true);
    recordAuditEvent({
      action: 'UPDATE_SETTINGS',
      title: 'Probabilidades do Funil Alteradas',
      content: 'Configurações de probabilidade de conversão por estágio do funil foram atualizadas.',
      severity: 'low',
      category: 'modification',
      metadata: {
        probabilities,
        tenantId: profile?.tenantId
      }
    });
    setTimeout(() => setIsSaved(false), 2000);
  }, [probabilities, profile?.tenantId]);

  const saveSessionSettings = useCallback(() => {
    safeSetItem("session_timeout_enabled", String(sessionEnabled));
    safeSetItem("session_timeout_minutes", String(sessionMinutes));
    setIsSessionSaved(true);
    recordAuditEvent({
      action: 'UPDATE_SETTINGS',
      title: 'Configurações de Inatividade de Sessão',
      content: `Tempo limite de inatividade configurado para ${sessionMinutes} minutos (Ativo: ${sessionEnabled ? 'Sim' : 'Não'}).`,
      severity: 'medium',
      category: 'modification',
      metadata: {
        enabled: sessionEnabled,
        minutes: sessionMinutes
      }
    });
    toast.success("Opção de inatividade salva!");
    setTimeout(() => setIsSessionSaved(false), 2000);
    window.dispatchEvent(new Event("storage_timeout_updated"));
  }, [sessionEnabled, sessionMinutes]);

  const toggleSound = useCallback((enable: boolean) => {
    setSoundActiveState(enable);
    setSoundEnabled(enable);
    if (enable) {
      unlockAudio();
      toast.success("Alertas sonoros ativados!");
    } else {
      toast.info("Alertas sonoros desativados.");
    }
  }, []);

  const handleTestSound = useCallback(() => {
    setIsTestingSound(true);
    unlockAudio();
    playIcqSound();
    toast.info("Reproduzindo aviso sonoro de novo lead ('Uh-oh!')...");
    setTimeout(() => setIsTestingSound(false), 1200);
  }, []);

  const userInitial = useMemo(() => {
    const name = profile?.displayName || user?.displayName || user?.email || "U";
    return name.charAt(0).toUpperCase();
  }, [profile?.displayName, user?.displayName, user?.email]);

  return (
    <div className="flex min-h-screen bg-background transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">
        <header className="h-14 md:h-16 bg-card/80 backdrop-blur-md border-b border-border/60 pl-14 md:pl-5 px-3 sm:px-4 md:px-5 flex items-center justify-between shrink-0 sticky top-0 z-10 transition-colors">
          <div>
            <h1 className="font-bold text-foreground text-sm sm:text-base tracking-tight">Configurações</h1>
            <p className="text-[11px] text-muted-foreground hidden sm:block">Personalize sua experiência e gerencie preferências do CRM.</p>
          </div>
        </header>

        <div className="flex-1 p-3 sm:p-4 md:p-5 max-w-5xl w-full mx-auto space-y-3 sm:space-y-4">
          <div className="space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            
            {/* Informações da Conta e Organização */}
            {user && (
              <section className="bg-card rounded-xl p-3.5 sm:p-4 border border-border shadow-xs space-y-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <User className="w-4 h-4 text-primary" />
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">Perfil & Conta Ativa</h3>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0 relative">
                      {profile?.photoURL ? (
                        <Image 
                          src={profile.photoURL} 
                          alt="Foto de perfil" 
                          width={44} 
                          height={44} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="font-bold text-sm text-primary">{userInitial}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        {profile?.displayName || user.displayName || "Usuário do CRM"}
                        <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
                          {profile?.role || "Membro"}
                        </span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                    <div className="flex items-center gap-1.5 bg-background px-2.5 py-1.5 rounded-lg border border-border">
                      <Building className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold text-foreground">
                        {profile?.tenantId || DEFAULT_TENANT_NAME}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                      <Shield className="w-3.5 h-3.5" />
                      Ativo
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Notificações e Sons */}
            <section className="bg-card rounded-xl p-3.5 sm:p-4 border border-border shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Bell className="w-4 h-4 text-primary" />
                    <h3 className="text-xs sm:text-sm font-bold text-foreground">Alertas & Notificações</h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Configure os avisos sonoros e lembretes para novas oportunidades recebidas.</p>
                </div>
                
                <button
                  type="button"
                  onClick={handleTestSound}
                  disabled={isTestingSound}
                  className="px-3.5 py-1.5 bg-muted hover:bg-primary hover:text-white text-foreground rounded-lg text-xs font-bold transition-all border border-border shadow-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <Volume2 className={cn("w-3.5 h-3.5", isTestingSound && "animate-bounce text-emerald-400")} />
                  {isTestingSound ? "Testando Som..." : "Testar Alerta Sonoro"}
                </button>
              </div>

              <div className="p-3 bg-muted/30 rounded-xl border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs",
                    soundEnabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                  )}>
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Alerta Sonoro de Novos Leads (&quot;Uh-oh!&quot;)</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Toca o sinal acústico instantâneo quando uma nova oportunidade ingressa no funil.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleSound(!soundEnabled)}
                  className={cn(
                    "w-10 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer shrink-0 ml-3",
                    soundEnabled ? "bg-emerald-500" : "bg-muted"
                  )}
                  title={soundEnabled ? "Desativar som" : "Ativar som"}
                >
                  <div 
                    className={cn(
                      "w-4 h-4 bg-white rounded-full shadow-xs transition-transform",
                      soundEnabled ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </section>

            {/* Aparência do CRM */}
            <section className="bg-card rounded-xl p-3.5 sm:p-4 border border-border shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Palette className="w-4 h-4 text-primary" />
                    <h3 className="text-xs sm:text-sm font-bold text-foreground">Aparência do CRM</h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Personalize a identidade visual e o modo de exibição do seu sistema.</p>
                </div>
                <button
                  onClick={() => {
                    setPrimaryColor("blue");
                    setAppearance("system");
                  }}
                  className="px-3.5 py-1.5 bg-muted text-foreground rounded-lg text-xs font-bold hover:bg-primary hover:text-white transition-all border border-border shadow-xs self-start sm:self-auto cursor-pointer"
                >
                  Restaurar Padrões
                </button>
              </div>

              {/* Background Mode Selection */}
              <div>
                <h4 className="text-xs font-bold mb-2 text-foreground">Tema do Sistema</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {THEME_OPTIONS.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setAppearance(mode.id as any)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all cursor-pointer",
                        appearance === mode.id 
                          ? "border-primary bg-primary/5 shadow-xs" 
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className={cn("w-full h-9 rounded-lg flex items-center justify-center overflow-hidden border", mode.bg, mode.border)}>
                        <mode.icon className={cn("w-4 h-4", mode.iconColor)} />
                      </div>
                      <span className="text-[11px] font-bold">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-border">
                <h4 className="text-xs font-bold mb-2 text-foreground">Cores de Destaque</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setPrimaryColor(color.value)}
                      className={cn(
                        "relative group h-14 rounded-xl border transition-all overflow-hidden p-2 flex flex-col justify-end cursor-pointer",
                        primaryColor === color.value 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div 
                        className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center transition-all bg-card shadow-xs"
                        style={{ color: color.hex }}
                      >
                        {primaryColor === color.value ? <Check className="w-3 h-3 stroke-[3px]" /> : null}
                      </div>
                      <div 
                        className="w-3 h-3 rounded-full mb-1"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className={cn(
                        "text-[10px] font-bold transition-colors truncate",
                        primaryColor === color.value ? "text-primary" : "text-muted-foreground"
                      )}>
                        {color.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Probabilidades do Pipeline (Score) */}
            <section className="bg-card rounded-xl p-3.5 sm:p-4 border border-border shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Target className="w-4 h-4 text-primary" />
                    <h3 className="text-xs sm:text-sm font-bold text-foreground">Probabilidades do Pipeline (Score)</h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Defina o percentual de sucesso projetado para cada estágio do seu funil.</p>
                </div>
                <button
                  onClick={saveProbabilities}
                  disabled={isSaved}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer",
                    isSaved 
                      ? "bg-emerald-500 text-white border-emerald-600" 
                      : "bg-primary text-white border-primary/20 hover:bg-primary/90"
                  )}
                >
                  {isSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Salvo com Sucesso
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {STAGES.map((stage) => (
                  <div key={stage.id} className="p-2.5 bg-muted/30 rounded-xl border border-border">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1 truncate">
                      {stage.title}
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={probabilities[stage.id] ?? stage.defaultProb}
                        onChange={(e) => handleProbChange(stage.id, e.target.value)}
                        className="w-full bg-background border-none rounded-lg py-1 px-2.5 text-xs font-bold focus:ring-1 focus:ring-primary/20"
                        min="0"
                        max="100"
                      />
                      <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Inatividade da Sessão (Segurança) */}
            <section className="bg-card rounded-xl p-3.5 sm:p-4 border border-border shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Clock className="w-4 h-4 text-primary" />
                    <h3 className="text-xs sm:text-sm font-bold text-foreground">Inatividade da Sessão (Segurança)</h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Configure a desconexão automática se o sistema não detectar ações do usuário.</p>
                </div>
                
                <button
                  type="button"
                  onClick={saveSessionSettings}
                  disabled={isSessionSaved}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer",
                    isSessionSaved 
                      ? "bg-emerald-500 text-white border-emerald-600" 
                      : "bg-primary text-white border-primary/20 hover:bg-primary/90"
                  )}
                >
                  {isSessionSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Salvo com Sucesso
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Toggle Option */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Desconexão por Inatividade</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Sair automaticamente ao ficar inativo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionEnabled(!sessionEnabled);
                      setIsSessionSaved(false);
                    }}
                    className={cn(
                      "w-10 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer",
                      sessionEnabled ? "bg-emerald-500" : "bg-muted"
                    )}
                  >
                    <div 
                      className={cn(
                        "w-4 h-4 bg-white rounded-full shadow-xs transition-transform",
                        sessionEnabled ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Timer Selector */}
                <div className={cn(
                  "p-3 bg-muted/30 rounded-xl border border-border transition-all duration-300",
                  !sessionEnabled && "opacity-50 pointer-events-none"
                )}>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-foreground">Tempo Limite</h4>
                    <div className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-md">
                      {sessionMinutes} {sessionMinutes === 1 ? "minuto" : "minutos"}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!sessionEnabled || sessionMinutes <= 1}
                      onClick={() => {
                        setSessionMinutes(prev => Math.max(1, prev - 1));
                        setIsSessionSaved(false);
                      }}
                      className="w-7 h-7 rounded-lg bg-background hover:bg-muted border border-border font-bold text-xs flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
                    >
                      -
                    </button>
                    
                    <input 
                      type="range"
                      min="1"
                      max="30"
                      value={sessionMinutes}
                      disabled={!sessionEnabled}
                      onChange={(e) => {
                        setSessionMinutes(Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1)));
                        setIsSessionSaved(false);
                      }}
                      className="flex-1 accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer"
                    />
                    
                    <button
                      type="button"
                      disabled={!sessionEnabled || sessionMinutes >= 30}
                      onClick={() => {
                        setSessionMinutes(prev => Math.min(30, prev + 1));
                        setIsSessionSaved(false);
                      }}
                      className="w-7 h-7 rounded-lg bg-background hover:bg-muted border border-border font-bold text-xs flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground font-bold uppercase mt-1.5 px-0.5">
                    <span>Mín: 1 min</span>
                    <span>Máx: 30 min</span>
                  </div>
                </div>
              </div>
            </section>

            {/* SEÇÃO 6: TROCA DE SENHA */}
            <section className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Troca de Senha Pessoal</h3>
                  <p className="text-[11px] text-muted-foreground">Atualize sua senha de acesso pessoal ao CRM</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3.5 max-w-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Nova Senha
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary/20 transition-all font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Confirmar Nova Senha
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        placeholder="Repita a nova senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary/20 transition-all font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                        title={showConfirmPassword ? "Ocultar senha" : "Exibir senha"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                  className="py-2.5 px-4 bg-primary hover:opacity-90 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {isChangingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  {isChangingPassword ? "Atualizando Senha..." : "Atualizar Minha Senha"}
                </button>
              </form>
            </section>

            {/* SEÇÃO 7: PALAVRA-CHAVE SECRETA (RECUPERAÇÃO INSTANTÂNEA) */}
            <section className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-foreground">Palavra-Chave Secreta de Recuperação</h3>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-md border border-amber-500/20">
                        Instantâneo
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Permite recuperar seu acesso na tela de login sem precisar de e-mail ou aprovação</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveSecurityKeyword} className="space-y-3.5 max-w-lg">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <span>Sua Palavra-Chave Secreta</span>
                    {profile?.securityKeyword ? (
                      <span className="text-emerald-500 text-[10px] font-normal flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Cadastrada
                      </span>
                    ) : (
                      <span className="text-amber-500 text-[10px] font-normal">
                        (Não configurada)
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input
                      type="text"
                      placeholder="Ex: imovel2026, golden, leao"
                      value={securityKeywordInput}
                      onChange={(e) => setSecurityKeywordInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:ring-2 focus:ring-amber-500/20 transition-all font-medium focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                    💡 <strong>Como funciona:</strong> Se você esquecer sua senha, basta clicar em <em>&quot;Esqueci minha senha&quot;</em> na tela de login, digitar seu e-mail e essa palavra-chave para definir uma nova senha na mesma hora.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSavingKeyword || !securityKeywordInput.trim() || securityKeywordInput.trim() === (profile?.securityKeyword || "")}
                  className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {isSavingKeyword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {isSavingKeyword ? "Salvando Palavra-Chave..." : "Salvar Palavra-Chave"}
                </button>
              </form>
            </section>

            {/* SEÇÃO 8: IMPORTAÇÃO DE DADOS EM LOTE (EXCLUSIVO GGSALLES) */}
            <DataImportSection />
          </div>
        </div>
      </main>
    </div>
  );
}
