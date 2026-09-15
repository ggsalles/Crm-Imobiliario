"use client";

export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/sidebar";
import { useTheme } from "@/providers/theme-provider";
import { InteractiveGuideModal } from "@/components/InteractiveGuideModal";
import { 
  Palette, 
  Check, 
  Layout, 
  Sparkles, 
  Smartphone, 
  Monitor,
  LayoutDashboard,
  Trello,
  Calendar,
  Users,
  BarChart3,
  ShieldCheck,
  MessageSquare,
  Home,
  ChevronDown,
  Building2,
  UserCircle,
  Target,
  Percent,
  Calculator,
  Sigma,
  Clock,
  Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { toast } from "sonner";

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

function DocItem({ title, icon: Icon, content, onExplore }: { title: string; icon: any; content: string; onExplore?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-background rounded-xl border border-border overflow-hidden transition-all hover:border-primary/30 group">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left font-sans"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground">{title}</span>
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 pb-3 pt-0 flex flex-col gap-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {content}
              </p>
              {onExplore && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExplore();
                  }}
                  className="w-fit flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 hover:border-primary rounded-lg text-[9px] font-bold transition-all cursor-pointer relative overflow-hidden select-none active:scale-95 mt-0.5"
                >
                  <Sparkles className="w-2.5 h-2.5 text-primary group-hover:text-white" />
                  Visualizar Guia Técnico HTML
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SettingsPage() {
  const { primaryColor, setPrimaryColor, appearance, setAppearance } = useTheme();
  const [probabilities, setProbabilities] = useState<Record<string, number>>({});
  const [isSaved, setIsSaved] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedGuideSection, setSelectedGuideSection] = useState("dashboard");

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
    setTimeout(() => setIsSaved(false), 2000);
    // Trigger storage event so other tabs/components can update
    window.dispatchEvent(new Event("storage_probabilities_updated"));
  };

  const saveSessionSettings = () => {
    localStorage.setItem("session_timeout_enabled", String(sessionEnabled));
    localStorage.setItem("session_timeout_minutes", String(sessionMinutes));
    setIsSessionSaved(true);
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

            <section id="system-guide-section" className="bg-card rounded-xl p-3.5 sm:p-4 border border-border shadow-xs space-y-3.5">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 pb-3 border-b border-border/50">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Layout className="w-4 h-4 text-primary" />
                      <h3 className="text-xs sm:text-sm font-bold text-foreground">Guia do Sistema (Documentação)</h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Explicação detalhada e interativa de cada módulo e recurso do SalesScore CRM.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGuideSection("dashboard");
                      setIsGuideOpen(true);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] font-bold uppercase tracking-wider rounded-xl cursor-pointer hover:shadow-sm shadow-primary/20 transition-all select-none shrink-0 self-start sm:self-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    Abrir Guia HTML Interativo
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <DocItem 
                    title="Controle Operacional / Dashboard" 
                    icon={LayoutDashboard} 
                    content="A tela principal (Dashboard) integra inteligência preditiva para fornecer o pulso do seu negócio. O gráfico de performance da equipe mostra o ranking dos agentes por volume de vendas e taxa de conversão real. Os cards superiores mostram métricas rápidas como o Forecast (Previsão Realista) que utiliza algoritmos de probabilidade para estimar o fechamento do mês, além da média de vendas e melhor performance individual."
                    onExplore={() => {
                      setSelectedGuideSection("dashboard");
                      setIsGuideOpen(true);
                    }}
                  />
                  <DocItem 
                    title="Pipeline (Funil de Vendas)" 
                    icon={Trello} 
                    content="O Pipeline é o centro de comando. Cada card (Deal) exibe o valor formatado, empresa vinculada e data de atualização. Você pode arrastar os cards entre os estágios configuráveis. Ao editar um negócio, o sistema oferece integração direta com o Inventário de Imóveis e Contatos, garantindo resiliência de dados através de um cache inteligente que permite visualização imediata mesmo com instabilidades de rede."
                    onExplore={() => {
                      setSelectedGuideSection("pipeline");
                      setIsGuideOpen(true);
                    }}
                  />
                  <DocItem 
                    title="Vendas Inteligentes (IA)" 
                    icon={Sparkles} 
                    content="O SalesScore utiliza IA para analisar o histórico de interações e sugerir o próximo passo ideal. No detalhe do negócio, o módulo 'Vendas Inteligentes' gera orientações de coaching em tempo real para acelerar o fechamento, identificando gargalos no funil e sugerindo imóveis do inventário que possuem maior 'Match' com o perfil do comprador."
                  />
                  <DocItem 
                    title="Gestão de Imóveis e Matching" 
                    icon={Home} 
                    content="Gerencie seu inventário com campos técnicos detalhados. O recurso de 'Match de Imóveis' realiza um cruzamento matemático entre o valor do negócio, preferências do cliente e características do imóvel. Negócios podem ser vinculados a múltiplos registros, permitindo rastreabilidade completa entre o proprietário, o imóvel e o lead comprador."
                    onExplore={() => {
                      setSelectedGuideSection("matching");
                      setIsGuideOpen(true);
                    }}
                  />
                  <DocItem 
                    title="Segurança e Isolamento SaaS" 
                    icon={ShieldCheck} 
                    content="Como Administrador, você pode gerenciar os níveis de acesso da sua equipe. Nosso sistema de Isolamento de Multi-Tenant garante segurança criptográfica e por Row-Level Security no banco de dados, protegendo os negócios, orçamentos e cadastros de clientes contra qualquer vazamento entre imobiliárias contratantes."
                    onExplore={() => {
                      setSelectedGuideSection("sec_saas");
                      setIsGuideOpen(true);
                    }}
                  />
                  <DocItem 
                    title="Mensagens Internas" 
                    icon={MessageSquare} 
                    content="O sistema de Mensagens (Chat) elimina a necessidade de ferramentas externas para comunicação rápida. Troque informações sobre imóveis, peça ajuda em negociações complexas ou envie atualizações para toda a empresa. Notificações em tempo real garantem que ninguém perca uma mensagem importante."
                  />
                  <DocItem 
                    title="Empresas e Parceiros" 
                    icon={Building2} 
                    content="Gerencie as entidades jurídicas parceiras, como bancos para financiamento, administradoras de condomínios e outras imobiliárias. Manter os contatos das empresas atualizados facilita agilizar processos de documentação e fechamento de novos negócios."
                  />
                  <DocItem 
                    title="Perfis de Usuários" 
                    icon={UserCircle} 
                    content="Cada usuário no sistema possui um perfil personalizável. Aqui você pode atualizar sua foto, e-mail de contato e senha. Lembre-se de manter seu perfil atualizado, pois essas informações são usadas automaticamente na geração de contratos e materiais de marketing."
                  />
                </div>
              </div>
            </section>

            <section className="bg-card rounded-xl p-3.5 sm:p-4 border border-border shadow-xs space-y-3.5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sigma className="w-4 h-4 text-primary" />
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">Dicionário de Fórmulas e Cálculos</h3>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">Entenda como o SalesScore CRM processa seus dados para gerar inteligência comercial.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <DocItem 
                    title="Previsão de Fechamento (Forecast)" 
                    icon={Calculator} 
                    content="Fórmula: Receita Realizada + Σ (Valor em Pipeline × % Probabilidade do Estágio). Esta métrica projeta o fechamento realista do mês. Diferente do valor bruto do pipeline, o Forecast pondera o risco de cada etapa, fornecendo uma visão segura do faturamento esperado."
                  />
                  <DocItem 
                    title="Taxa de Conversão" 
                    icon={Percent} 
                    content="Fórmula: (Negócios Ganhos / Total de Oportunidades Finalizadas) × 100. Analisamos a eficiência individual e coletiva em transformar leads em contratos assinados. Uma taxa saudável gira entre 15% e 25% no mercado imobiliário de alto padrão."
                  />
                  <DocItem 
                    title="Empresa Individual vs Jurídica" 
                    icon={Building2} 
                    content="No SalesScore, um Negócio pode ser associado a uma 'Empresa Individual' quando o cliente é uma pessoa física direta, ou a uma 'Entidade Jurídica' quando envolve representação corporativa. Isso permite segmentar o faturamento entre B2B e B2C com precisão."
                  />
                  <DocItem 
                    title="Ticket Médio Mensal" 
                    icon={Sigma} 
                    content="Fórmula: Valor Total Faturado / Quantidade de Vendas Realizadas. Essencial para identificar o posicionamento da sua imobiliária no mercado e o perfil de ticket dos imóveis mais líquidos no inventário."
                  />
                  <DocItem 
                    title="Saúde da Carteira (Radar)" 
                    icon={Sparkles} 
                    content="O gráfico de radar analisa 5 dimensões: Volume de Leads, Velocidade de Vendas, Ticket Médio, Taxa de Retenção e Batimento de Metas. Quanto mais equilibrada a área do gráfico, mais saudável é o seu processo comercial."
                  />
                  <DocItem 
                    title="Progressão de Meta" 
                    icon={Target} 
                    content="Fórmula: (Receita do Mês Atual / Meta Estabelecida) × 100. No Dashboard de Performance, a barra de progresso mostra quão perto você está do objetivo financeiro configurado para o período atual."
                  />
                </div>
              </div>
            </section>

            <section className="bg-card rounded-xl p-3.5 sm:p-4 border border-border shadow-xs space-y-3.5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">Customização Visual</h3>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border group hover:border-primary/30 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-foreground">Modo Compacto</p>
                      <p className="text-[11px] text-muted-foreground">Reduz o espaçamento para mostrar mais dados.</p>
                    </div>
                    <div className="w-10 h-5 bg-muted rounded-full relative p-0.5 cursor-pointer">
                      <div className="w-4 h-4 bg-card rounded-full shadow-xs" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border group hover:border-primary/30 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-foreground">Animações de Transição</p>
                      <p className="text-[11px] text-muted-foreground">Habilita efeitos suaves entre telas.</p>
                    </div>
                    <div className="w-10 h-5 bg-primary rounded-full relative p-0.5 cursor-pointer">
                      <div className="w-4 h-4 bg-card rounded-full shadow-xs ml-auto" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <InteractiveGuideModal 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
        initialTab={selectedGuideSection}
      />
    </div>
  );
}
