"use client";

import { useState } from "react";
import { 
  X, 
  Sparkles, 
  LayoutDashboard, 
  Trello, 
  Calendar, 
  Users, 
  ShieldCheck, 
  MessageSquare, 
  Home, 
  Building2, 
  ChevronRight, 
  Info,
  HelpCircle,
  TrendingUp,
  Target,
  FileText,
  Calculator,
  Lock,
  Compass,
  Laptop
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface InteractiveGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

interface Hotspot {
  id: number;
  top: string;
  left: string;
  title: string;
  description: string;
  badge: string;
}

export function InteractiveGuideModal({ isOpen, onClose, initialTab = "dashboard" }: InteractiveGuideModalProps) {
  const [activeSection, setActiveSection] = useState<string>(initialTab);
  const [selectedHotspot, setSelectedHotspot] = useState<number | null>(1);

  const sections = [
    {
      id: "dashboard",
      title: "Controle Operacional",
      icon: LayoutDashboard,
      subtitle: "Dashboard Central de Performance",
      description: "O cérebro operacional do seu CRM. Fornece métricas de performance da equipe, tendências de vendas, progresso de metas e diagnósticos analíticos baseados em inteligência artificial.",
      hotspots: [
        {
          id: 1,
          top: "15%",
          left: "22%",
          badge: "Forecast",
          title: "Previsão de Receita (Forecast)",
          description: "Calcula a previsão realista de faturamento para o mês corrente. Utiliza a fórmula: Receita Confirmada + Somatório dos valores de negócios atrelando o percentual de fechamento de cada estágio do Pipeline. Ideal para prever fluxo de caixa futuro seguro."
        },
        {
          id: 2,
          top: "40%",
          left: "48%",
          badge: "Saúde Comercial",
          title: "Radar de Diagnóstico Comercial",
          description: "Gráfico de radar que cruza em tempo real 5 dimensões vitais do seu negócio: Volume de Leads, Velocidade dos Negócios, Ticket Médio das Operações, Taxa de Retenção e Cobertura de Meta. Uma área regular indica consistência nas operações."
        },
        {
          id: 3,
          top: "15%",
          left: "75%",
          badge: "Metas",
          title: "Batimento de Meta do Mês",
          description: "Barra de progresso de alta visibilidade que mostra a porcentagem de alcance em relação à meta financeira do mês. Ideal para manter corretores focados, integrando faturamentos garantidos de transações fechadas com as que estão em estágio avançado."
        },
        {
          id: 4,
          top: "70%",
          left: "22%",
          badge: "Ranking",
          title: "Leaderboard e Ranking de Corretores",
          description: "Mede o desempenho individual de vendas e locações da sua equipe. Mostra o ranking dos corretores mais produtivos com faturamento acumulado, taxa de conversão e velocidade de encerramento de negócios."
        },
        {
          id: 5,
          top: "72%",
          left: "75%",
          badge: "IA",
          title: "Assistente de Inteligência Artificial",
          description: "Análise inteligente que coleta anomalias em seus funis, sugere ações proativas prioritárias (Ex: 'Lead Viviane frio há 8 dias') e recomenda o próximo melhor imóvel correspondente a um comprador ativo."
        }
      ] as Hotspot[],
      visualMarkup: (
        <div className="w-full h-full rounded-2xl bg-slate-900 border border-slate-800 p-4 relative text-white text-[10px] overflow-hidden select-none font-sans flex flex-col justify-between">
          {/* Mock Header */}
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-200">Painel Operacional Analítico - SalesScore</span>
            </div>
            <span className="text-slate-400 text-[8px] bg-slate-800 px-2 py-0.5 rounded font-mono">Tenant Ativo: Nando Imobiliária</span>
          </div>

          <div className="flex gap-2 flex-1 min-h-0">
            {/* Main column */}
            <div className="flex-1 flex flex-col gap-2 justify-between">
              {/* Row 1 - Cards */}
              <div className="grid grid-cols-2 gap-2">
                <div id="mock-forecast" className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <span className="text-slate-500 text-[8px] uppercase tracking-wider font-bold font-sans">Previsão Realista (Forecast)</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-emerald-400 font-extrabold text-[13px]">R$ 2.450.000</span>
                    <span className="text-slate-500 font-mono text-[7px]">Méd. Prob.</span>
                  </div>
                </div>

                <div id="mock-goals" className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <span className="text-slate-500 text-[8px] uppercase tracking-wider font-bold font-sans">Atingimento de Meta</span>
                  <div className="mt-1">
                    <div className="flex justify-between text-slate-300 font-mono text-[8px] mb-1 font-bold">
                      <span>R$ 1.8M / R$ 3.0M</span>
                      <span className="text-primary font-black">60%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="w-[60%] h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2 - Broker list */}
              <div id="mock-ranking" className="flex-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between">
                <span className="text-slate-400 font-bold uppercase text-[8px] tracking-wider mb-1 block font-sans">Performance da Equipe</span>
                <div className="space-y-1 my-1">
                  <div className="flex justify-between items-center bg-slate-900/60 p-1 rounded">
                    <span className="text-slate-200">1. gg_salles (Admin)</span>
                    <span className="text-emerald-400 font-mono font-bold">R$ 1.800.000 (3 vendas)</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900/60 p-1 rounded">
                    <span className="text-slate-300">2. Nando_Corretor</span>
                    <span className="text-emerald-400 font-mono">R$ 650.000 (1 venda)</span>
                  </div>
                </div>
                <div className="text-[7px] text-slate-500 text-center italic mt-1 border-t border-slate-900 pt-1">Atualizado em tempo real</div>
              </div>
            </div>

            {/* Right column */}
            <div className="w-2/5 flex flex-col gap-2 justify-between">
              {/* Radar area */}
              <div id="mock-radar" className="flex-1 bg-slate-950 p-2 rounded-lg border border-slate-800 flex flex-col items-center justify-center relative min-h-[90px]">
                <span className="absolute top-1.5 left-2 text-[7px] font-bold uppercase tracking-wider text-slate-500 font-sans">Radar Comercial</span>
                {/* Simulated Radar Pentagon */}
                <div className="w-12 h-12 border border-slate-700/60 rounded-full flex items-center justify-center rotate-45">
                  <div className="w-8 h-8 border border-slate-700 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-primary/20 rotate-12 border border-primary/60 rounded-full" />
                  </div>
                </div>
                <div className="flex justify-between w-full text-[6px] text-slate-400 px-1 mt-1 shrink-0">
                  <span>Velocidade 82%</span>
                  <span>Volume 70%</span>
                </div>
              </div>

              {/* AI Insight Box */}
              <div id="mock-ai" className="h-1/3 bg-slate-950 p-2 rounded-lg border border-dashed border-primary/30 flex flex-col justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-2.5 h-2.5 text-primary animate-pulse shrink-0" />
                  <span className="text-primary font-bold text-[8px] uppercase tracking-wider font-sans">Ações de IA</span>
                </div>
                <p className="text-slate-400 text-[7px] leading-relaxed italic truncate">{"\"O lead Viviane esfriou no funil...\""}</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "pipeline",
      title: "Funil de Vendas",
      icon: Trello,
      subtitle: "CRM Estilo Kanban Interativo",
      description: "O núcleo do fechamento de negócios. O fluxo visual em colunas permite acompanhar o progresso de cada oportunidade imobiliária desde o primeiro contato até o fechamento contratual.",
      hotspots: [
        {
          id: 1,
          top: "15%",
          left: "25%",
          badge: "Fases",
          title: "Estágios Estruturados (Funil)",
          description: "Os estágios representam a jornada do cliente: Novo Lead, Qualificação/Visita, Proposta, Análise Jurídica e Vendido/Alugado. Cada estágio possui um peso percentual de probabilidade que alimenta o cálculo automático do Forecast."
        },
        {
          id: 2,
          top: "40%",
          left: "32%",
          badge: "Cards",
          title: "Card Inteligente de Negócio (Deal)",
          description: "Cada card consolida: Nome do cliente, valor da transação, imóvel associado e indicador visual de atraso (quando um negócio está sem interações há muitos dias). A foto do corretor responsável e tags rápidas de prioridade facilitam a identificação visual rápida."
        },
        {
          id: 3,
          top: "15%",
          left: "75%",
          badge: "Resiliência",
          title: "Soma Financeira das Colunas",
          description: "Cada coluna do Kanban exibe automaticamente a soma total dos valores e também o valor ponderado pela probabilidade da fase. Isso dá visibilidade imediata ao volume de negócios concentrado em cada fase comercial."
        },
        {
          id: 4,
          top: "70%",
          left: "58%",
          badge: "Arrastar",
          title: "Sistema Drag & Drop (Arrastar/Soltar)",
          description: "Mover um negócio de coluna atualiza instantaneamente seu status no banco de dados, registra um log histórico automatizado na Timeline do Lead, recalcula o Forecast geral e atualiza em tempo real para os outros membros da equipe."
        }
      ] as Hotspot[],
      visualMarkup: (
        <div className="w-full h-full rounded-2xl bg-slate-900 border border-slate-800 p-4 relative text-white text-[10px] overflow-hidden select-none font-sans flex flex-col justify-between">
          {/* Mock Header */}
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Trello className="w-3 h-3 text-primary" />
              <span className="font-bold text-slate-200">Funil de Vendas Recorrentes - Imóveis</span>
            </div>
            <span className="text-[7.5px] text-slate-400 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-bold">Otimizado</span>
          </div>

          {/* Kanban columns */}
          <div className="flex gap-2 flex-1 min-h-0">
            {/* Column 1 */}
            <div className="flex-1 bg-slate-950 p-2 rounded-lg border border-slate-800/80 flex flex-col h-full">
              <div className="flex justify-between text-[7px] text-slate-400 border-b border-slate-900 pb-1 mb-1 font-bold uppercase shrink-0 font-sans">
                <span>Leads (20%)</span>
                <span className="text-primary font-mono">R$ 1.8M</span>
              </div>
              <div className="flex-1 flex flex-col gap-1.5 overflow-hidden justify-start">
                <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex flex-col gap-1 cursor-grab">
                  <span className="text-[8px] font-bold text-slate-200">Apartamento no Leblon</span>
                  <div className="flex justify-between text-[7px] text-slate-400 font-mono mt-0.5">
                    <span>Viviane M.</span>
                    <span className="text-emerald-400 font-bold">R$ 1.500.000</span>
                  </div>
                  <div className="w-fit text-[6px] bg-sky-500/10 text-sky-400 px-1 py-0.2 rounded border border-sky-500/20 mt-1 font-bold">Match Alto</div>
                </div>
              </div>
            </div>

            {/* Column 2 */}
            <div className="flex-1 bg-slate-950 p-2 rounded-lg border border-slate-800/80 flex flex-col h-full">
              <div className="flex justify-between text-[7px] text-slate-400 border-b border-slate-900 pb-1 mb-1 font-bold uppercase shrink-0 font-sans">
                <span>Proposta (60%)</span>
                <span className="text-primary font-mono">R$ 800k</span>
              </div>
              <div className="flex-1 flex flex-col gap-1.5 overflow-hidden justify-start">
                <div className="bg-slate-900/80 p-2 rounded border border-slate-800 flex flex-col gap-1">
                  <span className="text-[8px] font-bold text-slate-200">Cobertura Ipanema</span>
                  <div className="flex justify-between text-[7px] text-slate-400 font-mono mt-0.5">
                    <span>Rodrigo A.</span>
                    <span className="text-emerald-400 font-bold">R$ 800.000</span>
                  </div>
                  <div className="w-fit text-[6px] bg-amber-500/10 text-amber-500 px-1 py-0.2 rounded border border-amber-500/20 mt-1 font-bold font-sans">Visita Feita</div>
                </div>
              </div>
            </div>

            {/* Column 3 */}
            <div className="flex-1 bg-slate-950 p-2 rounded-lg border border-slate-800/80 flex flex-col h-full">
              <div className="flex justify-between text-[7px] text-slate-400 border-b border-slate-900 pb-1 mb-1 font-bold uppercase shrink-0 font-sans">
                <span>Fechado (100%)</span>
                <span className="text-emerald-400 font-mono">R$ 4.5M</span>
              </div>
              <div className="flex-1 flex flex-col gap-1.5 overflow-hidden justify-start">
                <div className="bg-slate-905 p-2 rounded border border-slate-850 opacity-40 flex flex-col gap-1">
                  <span className="text-[8px] font-bold text-slate-300">Sala Comercial Barra</span>
                  <div className="flex justify-between text-[7px] text-slate-500 mt-0.5">
                    <span>Imob. Nando</span>
                    <span>R$ 4.500.000</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "matching",
      title: "Imóveis & Match",
      icon: Home,
      subtitle: "Matching Inteligente de Oportunidades",
      description: "Cruza instantaneamente as preferências de compra (orçamento máximo, banheiros, quartos e localização) dos novos leads cadastrados e o acervo de imóveis ativos da imobiliária no banco.",
      hotspots: [
        {
          id: 1,
          top: "15%",
          left: "25%",
          badge: "Cadastro",
          title: "Ficha do Imóvel Otimizada",
          description: "Cadastro robusto do imóvel incluindo código técnico interno, valor do IPTU, taxa de condomínio, zoneamento comercial/residencial, descrição persuasiva de marketing, comissão combinada e galeria de fotos integradas com compressão inteligente em tempo de upload."
        },
        {
          id: 2,
          top: "40%",
          left: "48%",
          badge: "Match",
          title: "Cálculo de Match (Afinidade)",
          description: "Utiliza algoritmos vetoriais de pertinência. Cruza a faixa de preço buscada (orçamento ideal ± margem de 10%), número de quartos desejados, banheiros e vagas contra as especificações reais de cada imóvel. O percentual final mede a proximidade da oferta com o desejo."
        },
        {
          id: 3,
          top: "15%",
          left: "75%",
          badge: "Ação",
          title: "Sugerir e Vincular Direto do Lead",
          description: "Dentro da tela de detalhes de um cliente, o sistema executa o matching e lista os top-3 imóveis mais compatíveis. Com 1 clique, você pode associar esse imóvel ao negócio, gerando automaticamente uma proposta em PDF ou uma mensagem de texto estruturada de apresentação."
        }
      ] as Hotspot[],
      visualMarkup: (
        <div className="w-full h-full rounded-2xl bg-slate-900 border border-slate-800 p-4 relative text-white text-[10px] overflow-hidden select-none font-sans flex flex-col justify-between">
          {/* Mock Header */}
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Home className="w-3 h-3 text-primary" />
              <span className="font-bold text-slate-200">Inventário de Imóveis & Matchmaker</span>
            </div>
          </div>

          <div className="flex-1 flex gap-2 min-h-0 items-center justify-between">
            {/* Visual card of Property */}
            <div className="w-[55%] bg-slate-950 rounded-lg border border-slate-800 p-2.5 flex flex-col gap-1.5">
              <div className="w-full h-16 rounded bg-slate-800 relative overflow-hidden flex items-center justify-center">
                <span className="text-slate-500 text-[6px]">Visualização Otimizada (Mockup)</span>
                <span className="absolute bottom-1 right-2 bg-emerald-500/20 text-emerald-400 font-bold px-1 rounded text-[6px] font-mono">Ref: CA205</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] font-bold text-slate-200">Casa de Condomínio - Barra da Tijuca</span>
                <span className="text-emerald-400 font-mono font-bold text-[9px]">R$ 3.800.000</span>
              </div>
              <div className="flex justify-between text-[6.5px] text-slate-400 border-t border-slate-900 pt-1 font-sans">
                <span>3 Quartos</span>
                <span>2 Suítes</span>
                <span>4 Vagas</span>
              </div>
            </div>

            {/* Matching Panel */}
            <div className="w-[42%] bg-slate-950 rounded-lg border border-primary/30 p-2 flex flex-col gap-1.5 h-full justify-between">
              <span className="text-[7.5px] font-extrabold text-primary uppercase tracking-wider block font-sans">Inteligência de Match</span>
              <div className="bg-slate-900 p-1.5 rounded flex items-center justify-between border border-primary/10">
                <div className="flex flex-col">
                  <span className="text-slate-300 font-bold text-[7px]" id="lead-viviane-match">Cliente: Viviane</span>
                  <span className="text-[5.5px] text-slate-500">Busca até R$ 4.0M</span>
                </div>
                <div className="bg-emerald-500 text-slate-950 font-black rounded text-[8px] px-1.5 py-0.5 animate-pulse shrink-0 font-mono">
                  92% Match
                </div>
              </div>
              <p className="text-[6px] text-slate-400 leading-relaxed italic border-t border-slate-900 pt-1">Combina requisitos de dormitórios, banheiros e faixa orçamentária.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "temperature",
      title: "Temperatura do Lead",
      icon: Users,
      subtitle: "Qualificação e Priorização Dinâmica de Leads",
      description: "Classifique seus clientes pelo nível de engajamento operacional recente. A classificação de temperatura do lead orienta a rotina de atendimento estruturado do corretor e auxilia na conversão.",
      hotspots: [
        {
          id: 1,
          top: "50%",
          left: "20%",
          badge: "Quente",
          title: "🔥 Leads Quentes",
          description: "Representa compradores com altíssima intenção de compra, visitas agendadas ou propostas ativas em negociação direta. Atendimento crítico recomendado em até 2 horas. Apresenta comportamento pulsante no painel."
        },
        {
          id: 2,
          top: "50%",
          left: "50%",
          badge: "Morno",
          title: "⚡ Leads Mornos",
          description: "Clientes em estágio intermediário de qualificação. Possuem contato regular estabelecido, mas ainda estão na fase de estudo de perfil de imóvel ou aprovação de financiamento bancário. Cadência recomendada de contato: a cada 48h."
        },
        {
          id: 3,
          top: "50%",
          left: "80%",
          badge: "Frio",
          title: "❄️ Leads Frios",
          description: "Contatos com nenhuma interação recente, recusaram propostas antigas ou estão sem resposta no WhatsApp há mais de 10 dias. Perfeitos para campanhas de reativação por e-mail marketing ou disparos sazonais estruturados."
        }
      ] as Hotspot[],
      visualMarkup: (
        <div className="w-full h-full rounded-2xl bg-slate-900 border border-slate-800 p-4 relative text-white text-[10px] overflow-hidden select-none font-sans flex flex-col justify-between">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-red-500 animate-pulse" />
              <span className="font-bold text-slate-200">Painel de Qualificação de Lead em Tempo Real</span>
            </div>
            <span className="text-[7px] text-slate-500 font-mono">Guia de Conversão</span>
          </div>

          <div className="flex-1 flex gap-2.5 min-h-0 items-center justify-between py-2">
            <div className="flex-1 bg-slate-950 p-2 text-center rounded-lg border border-red-500/20 relative flex flex-col gap-1 items-center h-full justify-center">
              <span className="text-[12px] animate-pulse">🔥</span>
              <span className="text-[8px] font-extrabold text-red-500 uppercase tracking-widest mt-0.5">Quente</span>
              <span className="text-[7px] text-slate-400 mt-1 font-mono">Ação Imediata</span>
            </div>

            <div className="flex-1 bg-slate-950 p-2 text-center rounded-lg border border-amber-500/10 relative flex flex-col gap-1 items-center h-full justify-center">
              <span className="text-[12px]">⚡</span>
              <span className="text-[8px] font-extrabold text-amber-500 uppercase tracking-widest mt-0.5">Morno</span>
              <span className="text-[7px] text-slate-400 mt-1 font-mono">Nutrição Rápida</span>
            </div>

            <div className="flex-1 bg-slate-950 p-2 text-center rounded-lg border border-indigo-500/10 relative flex flex-col gap-1 items-center h-full justify-center">
              <span className="text-[12px]">❄️</span>
              <span className="text-[8px] font-extrabold text-indigo-400 uppercase tracking-widest mt-0.5">Frio</span>
              <span className="text-[7px] text-slate-400 mt-1 font-mono">Reengajamento</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "sec_saas",
      title: "Isolamento SaaS",
      icon: ShieldCheck,
      subtitle: "Multi-Tenant e Segurança Garantida",
      description: "Como funciona a arquitetura multilocatária (SaaS). Cada imobiliária parceira opera dentro de um ambiente isolado, impedindo vazamento de negócios, contatos e faturamentos.",
      hotspots: [
        {
          id: 1,
          top: "15%",
          left: "25%",
          badge: "SQL RLS",
          title: "Row-Level Security (RLS) no Supabase",
          description: "Toda tabela no SalesScore possui segurança nativa de linha no banco de dados. Quando uma consulta é disparada pelo formulário ou painel, o sistema autentica a requisição via JWT e a função SQL 'public.get_user_tenant()' filtra de maneira estrita os registros que correspondem à corretora logada."
        },
        {
          id: 2,
          top: "40%",
          left: "48%",
          badge: "Admin",
          title: "Controles de Acesso do Administrador",
          description: "Gerentes e proprietários de imobiliárias possuem nível 'Admin' dentro de seu tenant correspondente. Podem adicionar novos corretores à equipe, alterar metas e avaliar o radar. Corretores têm nível 'Corretor' e visualizam apenas sua própria esteira de leads atribuída."
        },
        {
          id: 3,
          top: "70%",
          left: "75%",
          badge: "Prevenção",
          title: "Salvaguardas Cruzadas de Transação",
          description: "Os endpoints da API no Backend e os gatilhos das rotas analisam e bloqueiam de forma proativa qualquer inserção de dados que contenha ID de Tenant modificado manualmente pelo navegador do usuário. Segurança robusta, total e à prova de invasão comercial."
        }
      ] as Hotspot[],
      visualMarkup: (
        <div className="w-full h-full rounded-2xl bg-slate-900 border border-slate-800 p-4 relative text-white text-[10px] overflow-hidden select-none font-sans flex flex-col justify-between">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="font-bold text-slate-200">Arquitetura Logística de Segurança (SaaS Multi-Tenant)</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between my-2">
            {/* Visual of database separation */}
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
              <div className="flex flex-col gap-1 w-2/5">
                <span className="text-[6.5px] uppercase tracking-wider text-slate-500 font-bold font-sans">Inquilinos Cadastrados</span>
                <div className="bg-primary/10 text-primary px-2 py-1 rounded text-center border border-primary/20 font-bold">Imob. Nando</div>
                <div className="bg-amber-500/10 text-amber-500 px-2 py-1 rounded text-center border border-amber-500/20 font-bold">SalesScore S/A</div>
              </div>

              {/* Secure middleware representation */}
              <div className="flex-1 flex flex-col items-center justify-center relative">
                <div className="w-fit bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 px-2.5 py-1.5 rounded-full font-mono text-[6px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  Barreira RLS Ativa
                </div>
                {/* Arrow lines representation */}
                <div className="w-full text-center text-[5.5px] text-slate-500 italic mt-1.5">Nenhum registro ultrapassa sem correspondência do JWT do usuário</div>
              </div>
            </div>

            <div className="bg-slate-950 p-2 rounded-lg border border-dashed border-emerald-500/20 text-[6.5px] text-slate-400 leading-relaxed flex items-start gap-1.5">
              <Info className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
              <span>Conforme o banco de dados principal de produção, a tabela de &quot;conversas&quot;, &quot;propriedades&quot;, &quot;leads&quot; de um corretor de outra imobiliária estão criptograficamente e estruturalmente inacessíveis para terceiros.</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  const currentSection = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 bg-slate-950/50 backdrop-blur-md">
          {/* Backdrop closer */}
          <div className="absolute inset-0 cursor-default" onClick={onClose} />

          {/* Dialog Card Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="bg-card w-full max-w-6xl h-[88vh] md:h-[80vh] rounded-[32px] border border-border shadow-2xl relative overflow-hidden flex flex-col md:flex-row z-10"
          >
            {/* Sidebar of the guide modal */}
            <div className="w-full md:w-[260px] bg-muted/20 border-b md:border-b-0 md:border-r border-border p-5 shrink-0 flex flex-col justify-between">
              <div>
                {/* Logo and title */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Laptop className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-extrabold text-foreground text-xs uppercase tracking-wider block">Guia do Sistema</span>
                    <span className="text-[9px] text-muted-foreground/80 font-bold uppercase tracking-wider font-mono">SalesScore v0.2.0</span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground mb-4">Escolha um item do menu para explorar e entender cada indicador da tela em detalhes.</p>

                {/* Tabs selection list */}
                <div className="space-y-1.5">
                  {sections.map((sect) => {
                    const SectIcon = sect.icon;
                    const isSelected = activeSection === sect.id;
                    return (
                      <button
                        key={sect.id}
                        type="button"
                        onClick={() => {
                          setActiveSection(sect.id);
                          setSelectedHotspot(1); // Reset to first hotspot on section change
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all relative border cursor-pointer select-none text-left",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10"
                            : "hover:bg-muted bg-background text-muted-foreground hover:text-foreground border-border"
                        )}
                      >
                        <SectIcon className="w-4 h-4 shrink-0" />
                        <span className="flex-1 truncate">{sect.title}</span>
                        <ChevronRight className={cn("w-3.5 h-3.5 opacity-50 shrink-0", isSelected && "opacity-100")} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User badge */}
              <div className="hidden md:flex items-center gap-2.5 p-3.5 bg-background border border-border/60 rounded-xl mt-4 select-none">
                <HelpCircle className="w-4 h-4 text-primary" />
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase text-foreground leading-none">Dúvidas Frequentes</p>
                  <span className="text-[8.5px] text-muted-foreground block mt-0.5">Suporte 24h Disponível</span>
                </div>
              </div>
            </div>

            {/* Main content display area */}
            <div className="flex-1 flex flex-col min-h-0 bg-background relative">
              {/* Header inside display */}
              <div className="p-6 border-b border-border/60 flex items-center justify-between shrink-0 select-none">
                <div>
                  <h3 className="text-base font-extrabold text-foreground tracking-tight">{currentSection.subtitle}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">{currentSection.description}</p>
                </div>
                
                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-muted/60 hover:bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main inner splitter */}
              <div className="flex-1 flex flex-col lg:flex-row min-h-0">
                {/* Visual Interativo (The Blueprint mockup on the Left) */}
                <div className="flex-1 bg-muted/10 p-6 flex flex-col justify-center items-center relative border-b lg:border-b-0 lg:border-r border-border/40 select-none">
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest absolute top-3 left-6 flex items-center gap-1.5">
                    <Compass className="w-3 h-3 text-primary animate-spin" style={{ animationDuration: '3s' }} />
                    Blueprint Interativo da Tela (Simulação)
                  </div>
                  
                  {/* Container of the interactive display */}
                  <div className="w-full max-w-[460px] aspect-[1.35/1] bg-slate-950 p-2 rounded-[24px] border border-slate-800 shadow-xl relative mt-2 shrink-0">
                    
                    {/* Render the section custom visual markup */}
                    {currentSection.visualMarkup}

                    {/* Overlay section for hotspots pins */}
                    {currentSection.hotspots.map((hs) => {
                      const isSelected = selectedHotspot === hs.id;
                      return (
                        <button
                          key={hs.id}
                          type="button"
                          onClick={() => setSelectedHotspot(hs.id)}
                          style={{ top: hs.top, left: hs.left }}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer select-none group"
                        >
                          {/* Pulse Effect */}
                          <div className={cn(
                            "absolute w-6 h-6 rounded-full animate-ping opacity-25",
                            isSelected ? "bg-primary" : "bg-sky-400"
                          )} />
                          {/* Pin */}
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shadow-lg transition-transform border z-10 scale-100 group-hover:scale-110",
                            isSelected 
                              ? "bg-primary text-primary-foreground border-background font-black" 
                              : "bg-slate-900 text-sky-400 border-sky-400/40 hover:border-sky-400"
                          )}>
                            {hs.id}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[10px] text-muted-foreground/80 mt-4 text-center">
                    Clique nos números azuis piscando <span className="text-primary font-bold font-sans">① ② ③</span> no painel de demonstração acima para carregar as notas explicativas detalhadas.
                  </p>
                </div>

                {/* Hotspot details sidebar (On the Right) */}
                <div className="w-full lg:w-[320px] p-6 overflow-y-auto scrollbar-thin shrink-0 bg-background flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 select-none">
                      <Info className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">Detalhamento Técnico</span>
                    </div>

                    <AnimatePresence mode="wait">
                      {selectedHotspot !== null ? (
                        (() => {
                          const hs = currentSection.hotspots.find(h => h.id === selectedHotspot);
                          if (!hs) return null;
                          return (
                            <motion.div
                              key={hs.id}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              transition={{ duration: 0.15 }}
                              className="space-y-3.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 rounded-full font-black uppercase px-2.5 py-0.5">
                                  {hs.badge}
                                </span>
                                <span className="text-[10px] font-bold text-muted-foreground">Posição Nº {hs.id}</span>
                              </div>

                              <h4 className="text-sm font-extrabold text-foreground leading-snug">{hs.title}</h4>
                              <p className="text-xs text-muted-foreground leading-relaxed font-normal whitespace-pre-wrap">
                                {hs.description}
                              </p>
                            </motion.div>
                          );
                        })()
                      ) : (
                        <div className="text-center py-12 text-muted-foreground text-xs select-none">
                          Selecione um ponto interativo no blueprint para ver o detalhamento técnico e prático de negócio.
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Summary formula panel inside the guide */}
                  <div className="bg-muted/30 border border-border p-4 rounded-2xl select-none mt-6">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Importante para o Corretor</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 leading-relaxed font-normal">
                      Cada transação efetuada nos módulos do CRM atualiza instantaneamente as visualizações de metas e forecasts do sistema de forma segura e encapsulada.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
