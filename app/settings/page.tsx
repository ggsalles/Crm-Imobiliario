"use client";

import { Sidebar } from "@/components/sidebar";
import { useTheme } from "@/providers/theme-provider";
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
  Sigma
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

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

function DocItem({ title, icon: Icon, content }: { title: string; icon: any; content: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-background rounded-2xl border border-border overflow-hidden transition-all hover:border-primary/30 group">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-bold text-foreground">{title}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 pt-0">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {content}
              </p>
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

  useEffect(() => {
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

  return (
    <div className="flex min-h-screen bg-background transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 lg:p-12">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-2">Personalize sua experiência e gerencie sua conta.</p>
        </header>

        <div className="max-w-4xl">
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="bg-card rounded-[32px] p-6 md:p-8 border border-border shadow-sm space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Palette className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-bold text-foreground">Aparência do CRM</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Personalize a identidade visual e o modo de exibição do seu sistema.</p>
                </div>
                <button
                  onClick={() => {
                    setPrimaryColor("blue");
                    setAppearance("system");
                  }}
                  className="px-6 py-2.5 bg-muted text-foreground rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all border border-border shadow-sm"
                >
                  Restaurar Padrões
                </button>
              </div>

              {/* Background Mode Selection */}
              <div>
                <h4 className="text-sm font-bold mb-4">Tema do Sistema</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { id: "system", label: "Sistema", icon: Monitor, bg: "bg-slate-200", border: "border-slate-300" },
                    { id: "light", label: "Claro", icon: Sparkles, bg: "bg-slate-50", border: "border-slate-200" },
                    { id: "dark", label: "Escuro", icon: Layout, bg: "bg-slate-900", border: "border-slate-800" },
                    { id: "neutral", label: "Minimalist", icon: Smartphone, bg: "bg-white", border: "border-slate-100" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setAppearance(mode.id as any)}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                        appearance === mode.id 
                          ? "border-primary bg-primary/5 shadow-sm" 
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className={cn("w-full h-12 rounded-xl mb-1 flex items-center justify-center overflow-hidden border", mode.bg, mode.border)}>
                        <mode.icon className="w-5 h-5 opacity-40" />
                      </div>
                      <span className="text-xs font-bold">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <h4 className="text-sm font-bold mb-4">Cores de Destaque</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setPrimaryColor(color.value)}
                      className={cn(
                        "relative group h-24 rounded-2xl border-2 transition-all overflow-hidden p-4 flex flex-col justify-end",
                        primaryColor === color.value 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div 
                        className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all bg-card shadow-sm"
                        style={{ color: color.hex }}
                      >
                        {primaryColor === color.value ? <Check className="w-4 h-4 stroke-[3px]" /> : null}
                      </div>
                      <div 
                        className="w-4 h-4 rounded-full mb-2"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className={cn(
                        "text-xs font-bold transition-colors",
                        primaryColor === color.value ? "text-primary" : "text-muted-foreground"
                      )}>
                        {color.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="bg-card rounded-[32px] p-6 md:p-8 border border-border shadow-sm space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-bold text-foreground">Probabilidades do Pipeline (Score)</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Defina o percentual de sucesso projetado para cada estágio do seu funil.</p>
                </div>
                <button
                  onClick={saveProbabilities}
                  disabled={isSaved}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm flex items-center gap-2",
                    isSaved 
                      ? "bg-emerald-500 text-white border-emerald-600" 
                      : "bg-primary text-white border-primary/20 hover:bg-primary/90"
                  )}
                >
                  {isSaved ? (
                    <>
                      <Check className="w-4 h-4" />
                      Salvo com Sucesso
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                {STAGES_CONFIG.map((stage) => (
                  <div key={stage.id} className="p-4 bg-muted/30 rounded-2xl border border-border">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                      {stage.title}
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={probabilities[stage.id] ?? stage.defaultProb}
                        onChange={(e) => handleProbChange(stage.id, e.target.value)}
                        className="w-full bg-background border-none rounded-xl py-2 px-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        min="0"
                        max="100"
                      />
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-card rounded-[32px] p-6 md:p-8 border border-border shadow-sm space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Layout className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">Guia do Sistema (Documentação)</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">Explicação detalhada de cada módulo e recurso do SalesScore CRM.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DocItem 
                    title="Dashboard" 
                    icon={LayoutDashboard} 
                    content="A tela principal (Dashboard) é onde você tem o pulso do seu negócio. O gráfico de performance da equipe mostra o ranking dos agentes por volume de vendas e taxa de conversão. Os cards superiores mostram métricas rápidas como média de vendas e melhor performance individual. Use o filtro de período para analisar tendências históricas."
                  />
                  <DocItem 
                    title="Pipeline (Funil de Vendas)" 
                    icon={Trello} 
                    content="O Pipeline é o coração operacional do CRM. Cada card representa um negócio (Deal). Você pode arrastar os cards entre as colunas (Prospecção, Qualificação, Proposta, Negociação, Fechado) para atualizar o status. Clique em um card para ver o histórico completo, documentos anexos e atividades relacionadas a esse negócio específico."
                  />
                  <DocItem 
                    title="Calendário e Atividades" 
                    icon={Calendar} 
                    content="No Calendário, você gerencia seu tempo. As atividades (reuniões, visitas, chamadas) são sincronizadas em tempo real. Você pode criar novas atividades clicando em qualquer data, definir lembretes e associá-las a contatos ou imóveis. O sistema sinaliza atividades atrasadas em vermelho para evitar perda de oportunidades."
                  />
                  <DocItem 
                    title="Clientes e Contatos" 
                    icon={Users} 
                    content="Este módulo centraliza todas as informações de pessoas físicas e jurídicas. Cada perfil de cliente armazena dados de contato, preferências de imóveis pesquisados, histórico de conversas e documentos (como RG/CPF). Você pode segmentar clientes por 'Tipo' (Comprador, Proprietário, Investidor) para campanhas de marketing direcionadas."
                  />
                  <DocItem 
                    title="Relatórios e Analytics" 
                    icon={BarChart3} 
                    content="A aba de Relatórios transforma dados brutos em inteligência comercial. Analise a origem dos seus leads, o ticket médio das vendas, o tempo médio de fechamento e a eficácia de cada canal de aquisição. Os relatórios podem ser exportados para apresentações de resultados da equipe."
                  />
                  <DocItem 
                    title="Gestão de Imóveis" 
                    icon={Home} 
                    content="Gerencie seu portfólio completo de propriedades. Adicione fotos em alta resolução, tour virtual, especificações técnicas (área, quartos, vagas) e localização. O sistema permite cruzar automaticamente as características dos imóveis com as preferências cadastradas nos perfis dos clientes (Matching)."
                  />
                  <DocItem 
                    title="Equipe e Permissões" 
                    icon={ShieldCheck} 
                    content="Como Administrador, você pode gerenciar os níveis de acesso da sua equipe. Defina quem pode excluir registros, quem visualiza apenas os próprios leads e quem tem acesso aos relatórios financeiros. Mantenha a segurança dos dados da sua empresa garantindo o acesso correto para cada função."
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

            <section className="bg-card rounded-[32px] p-6 md:p-8 border border-border shadow-sm space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sigma className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">Dicionário de Fórmulas e Cálculos</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">Entenda como o SalesScore CRM processa seus dados para gerar inteligência comercial.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DocItem 
                    title="Cálculo da Taxa de Conversão" 
                    icon={Percent} 
                    content="Fórmula: (Total de Negócios Fechados / Total de Negócios no Pipeline) × 100. Consideramos todos os negócios que passaram pelo seu funil este mês. Se você tem 10 negócios e fechou 3, sua taxa é 30%."
                  />
                  <DocItem 
                    title="Previsão de Fechamento (Forecast)" 
                    icon={Calculator} 
                    content="Fórmula: Σ (Valor do Negócio × Probabilidade da Etapa) + Receita Realizada. Nós somamos o que você já vendeu com a expectativa estatística do seu pipeline atual. É a ferramenta mais poderosa para prever o faturamento futuro."
                  />
                  <DocItem 
                    title="Score de Probabilidade" 
                    icon={Target} 
                    content="A probabilidade é atribuída a cada estágio (ex: Proposta = 60%). No Dashboard, o Score de um negócio individual reflete a chance de fechamento baseada na etapa atual dele. Isso ajuda a priorizar esforços nos leads mais quentes."
                  />
                  <DocItem 
                    title="Ticket Médio" 
                    icon={Sigma} 
                    content="Fórmula: Valor Total de Vendas / Número de Negócios Fechados. Esta métrica indica o valor médio de cada contrato assinado em sua imobiliária, essencial para entender se você está focando em imóveis de alto padrão ou volume."
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

            <section className="bg-card rounded-[32px] p-6 md:p-8 border border-border shadow-sm space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">Customização Visual</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border group hover:border-primary/30 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-foreground">Modo Compacto</p>
                      <p className="text-xs text-muted-foreground">Reduz o espaçamento para mostrar mais dados.</p>
                    </div>
                    <div className="w-12 h-6 bg-muted rounded-full relative p-1 cursor-pointer">
                      <div className="w-4 h-4 bg-card rounded-full shadow-sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border group hover:border-primary/30 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-foreground">Animações de Transição</p>
                      <p className="text-xs text-muted-foreground">Habilita efeitos suaves entre telas.</p>
                    </div>
                    <div className="w-12 h-6 bg-primary rounded-full relative p-1 cursor-pointer">
                      <div className="w-4 h-4 bg-card rounded-full shadow-sm ml-auto" />
                    </div>
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
