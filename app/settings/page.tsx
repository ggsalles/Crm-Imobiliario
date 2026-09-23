"use client";

export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/sidebar";
import { useTheme } from "@/providers/theme-provider";
import { 
  Palette, 
  Check, 
  Layout, 
  Sparkles, 
  Monitor,
  Target,
  Percent,
  Clock,
  Moon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { recordAuditEvent } from "@/lib/audit";

const STAGES_CONFIG = [
  { id: "lead", title: "Novo Lead", defaultProb: 20 },
  { id: "qualification", title: "Qualificação / Visita", defaultProb: 40 },
  { id: "proposal", title: "Proposta", defaultProb: 60 },
  { id: "negotiation", title: "Análise Jurídica", defaultProb: 80 },
  { id: "closed", title: "Vendido / Alugado", defaultProb: 100 },
];

const colors: { name: string; value: "blue" | "emerald" | "orange" | "purple" | "rose" | "indigo"; hex: string }[] = [
  { name: "Ocean Blue", value: "blue", hex: "#3b82f6" },
  { name: "Forest Green", value: "emerald", hex: "#10b981" },
  { name: "Sunset Orange", value: "orange", hex: "#f97316" },
  { name: "Royal Purple", value: "purple", hex: "#a855f7" },
  { name: "Velvet Rose", value: "rose", hex: "#f43f5e" },
  { name: "Deep Indigo", value: "indigo", hex: "#6366f1" },
];

export default function SettingsPage() {
  const { primaryColor, setPrimaryColor, appearance, setAppearance } = useTheme();
  const [probabilities, setProbabilities] = useState<Record<string, number>>({});
  const [isSaved, setIsSaved] = useState(false);

  const [sessionEnabled, setSessionEnabled] = useState(true);
  const [sessionMinutes, setSessionMinutes] = useState(15);
  const [isSessionSaved, setIsSessionSaved] = useState(false);

  useEffect(() => {
    // Stage probabilities
    const saved = localStorage.getItem("pipeline_probabilities");
    if (saved) {
      setProbabilities(JSON.parse(saved));
    } else {
      const defaults = STAGES_CONFIG.reduce((acc, stage) => {
        acc[stage.id] = stage.defaultProb;
        return acc;
      }, {} as Record<string, number>);
      setProbabilities(defaults);
    }

    // Session Timeout
    const timeoutEnabled = localStorage.getItem("session_timeout_enabled") !== "false";
    const timeoutMinutes = Number(localStorage.getItem("session_timeout_minutes") || "15");
    setSessionEnabled(timeoutEnabled);
    setSessionMinutes(timeoutMinutes);
  }, []);

  const handleProbChange = (id: string, value: string) => {
    const numValue = Math.min(100, Math.max(0, parseInt(value) || 0));
    setProbabilities(prev => ({
      ...prev,
      [id]: numValue
    }));
    setIsSaved(false);
  };

  const saveProbabilities = () => {
    localStorage.setItem("pipeline_probabilities", JSON.stringify(probabilities));
    setIsSaved(true);
    recordAuditEvent({
      action: 'UPDATE_SETTINGS',
      title: 'Probabilidades do Funil Alteradas',
      content: 'Configurações de probabilidade de conversão por estágio do funil foram atualizadas.',
      severity: 'low',
      category: 'modification',
      metadata: {
        probabilities
      }
    });
    setTimeout(() => setIsSaved(false), 2000);
    // Trigger storage event so other tabs/components can update
    window.dispatchEvent(new Event("storage_probabilities_updated"));
  };

  const saveSessionSettings = () => {
    localStorage.setItem("session_timeout_enabled", String(sessionEnabled));
    localStorage.setItem("session_timeout_minutes", String(sessionMinutes));
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
    // Trigger storage event for timeout
    window.dispatchEvent(new Event("storage_timeout_updated"));
  };

  return (
    <div className="flex min-h-screen bg-background transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">
        <header className="h-14 md:h-16 bg-card/80 backdrop-blur-md border-b border-border/60 pl-14 md:pl-5 px-3 sm:px-4 md:px-5 flex items-center justify-between shrink-0 sticky top-0 z-10 transition-colors">
          <div>
            <h1 className="font-bold text-foreground text-sm sm:text-base tracking-tight">Configurações</h1>
            <p className="text-[11px] text-muted-foreground hidden sm:block">Personalize sua experiência e gerencie sua conta.</p>
          </div>
        </header>

        <div className="flex-1 p-3 sm:p-4 md:p-5 max-w-5xl w-full mx-auto space-y-3 sm:space-y-4">
          <div className="space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                  className="px-3.5 py-1.5 bg-muted text-foreground rounded-lg text-xs font-bold hover:bg-primary hover:text-white transition-all border border-border shadow-xs self-start sm:self-auto"
                >
                  Restaurar Padrões
                </button>
              </div>

              {/* Background Mode Selection */}
              <div>
                <h4 className="text-xs font-bold mb-2 text-foreground">Tema do Sistema</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: "system", label: "Sistema", icon: Monitor, bg: "bg-slate-200 dark:bg-slate-800", border: "border-slate-300 dark:border-slate-700", iconColor: "text-slate-600 dark:text-slate-400" },
                    { id: "light", label: "Claro", icon: Sparkles, bg: "bg-slate-50", border: "border-slate-200", iconColor: "text-amber-500" },
                    { id: "dark", label: "Escuro", icon: Layout, bg: "bg-slate-900", border: "border-slate-800", iconColor: "text-blue-400" },
                    { id: "neutral", label: "Preto Obsidian", icon: Moon, bg: "bg-black", border: "border-zinc-900", iconColor: "text-zinc-400" },
                  ].map((mode) => (
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
                  {colors.map((color) => (
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
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs flex items-center gap-1.5 self-start sm:self-auto",
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
                {STAGES_CONFIG.map((stage) => (
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
                        setSessionMinutes(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)));
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
          </div>
        </div>
      </main>
    </div>
  );
}
