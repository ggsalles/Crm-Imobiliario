"use client";

export const dynamic = 'force-dynamic';

/**
 * SalesScore CRM - Versão Estável Sincronizada
 * Build: 2026-05-10 v0.2.0 - Novo Leads corrigido para 1
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { Sidebar } from "@/components/sidebar";
import { 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  Search,
  HelpCircle,
  MoreHorizontal,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  SlidersHorizontal,
  Plus,
  Calendar,
  Mail,
  Info,
  BarChart3,
  Target,
  Zap,
  Layers,
  X,
  ChevronDown,
  Check,
  ExternalLink,
  Eye,
  MessageSquare,
  ArrowRight,
  Trash2,
  Building2,
  Phone,
  RotateCcw,
  AlertTriangle,
  AlertOctagon,
  MessageCircle
} from "lucide-react";
import { getDealStaleInfo, getWhatsAppRescueUrl } from "@/lib/lead-health";
import { toast } from "sonner";
import { recordAuditEvent } from "@/lib/audit";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { 
  Deal, 
  Contact, 
  Goal, 
  subscribeToDeals, 
  subscribeToContacts, 
  subscribeToGoals,
  subscribeToActivities,
  subscribeToProperties,
  updateActivity,
  Activity,
  Property,
  UserProfile,
  getDeals,
  getContacts,
  getGoals,
  getProperties,
  subscribeToUsers,
  updateDeal,
  deleteDeal
} from "@/lib/db";
import { safeAiCall } from "@/lib/ai";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Suspense } from "react";
import { IntelligenceWidget } from "@/components/IntelligenceWidget";

const STAGES = [
  { id: "lead", title: "Novo Lead", color: "blue" },
  { id: "qualification", title: "Qualificação / Visita", color: "purple" },
  { id: "proposal", title: "Proposta", color: "orange" },
  { id: "negotiation", title: "Análise Jurídica", color: "yellow" },
  { id: "closed", title: "Vendido / Alugado", color: "emerald" },
];

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState("Visão Geral");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [customProbabilities, setCustomProbabilities] = useState<Record<string, number>>({});
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'weekly' | 'monthly'>('monthly');

  // Recent Deals Filter & Action States
  const [showDealFilter, setShowDealFilter] = useState(false);
  const [dealSearch, setDealSearch] = useState("");
  const [dealStageFilter, setDealStageFilter] = useState<string>("all");
  const [dealValueRange, setDealValueRange] = useState<string>("all");
  const [dealScoreFilter, setDealScoreFilter] = useState<string>("all");
  const [dealOwnerFilter, setDealOwnerFilter] = useState<string>("all");
  const [dealSortBy, setDealSortBy] = useState<string>("recent");
  const [dealLimit, setDealLimit] = useState<number>(6);
  const [activeDealMenu, setActiveDealMenu] = useState<string | null>(null);
  const [deletingDealId, setDeletingDealId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest?.('.deal-menu-container')) {
        setActiveDealMenu(null);
      }
    };
    if (activeDealMenu) {
      document.addEventListener('click', handleGlobalClick);
      return () => document.removeEventListener('click', handleGlobalClick);
    }
  }, [activeDealMenu]);

  useEffect(() => {
    // Pequeno delay para garantir que containers Recharts tenham largura calculada
    const timer = setTimeout(() => setMounted(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // --- Calculations ---
  const now = useMemo(() => new Date(), []);
  const currentMonthStr = useMemo(() => format(now, "yyyy-MM"), [now]);
  const lastMonthDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), [now]);
  const lastMonthStr = useMemo(() => format(lastMonthDate, "yyyy-MM"), [lastMonthDate]);

  const currentGoal = useMemo(() => {
    const monthGoals = goals.filter(g => g.month === currentMonthStr);
    return monthGoals.find(g => g.ownerId === user?.id) || monthGoals[0];
  }, [goals, currentMonthStr, user]);

  const goalRevenue = useMemo(() => currentGoal?.stageGoals?.['closed'] || currentGoal?.revenue || 0, [currentGoal]);
  const closedDealsTotal = useMemo(() => deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + d.value, 0), [deals]);
  const staleDeals = useMemo(() => deals.filter(d => getDealStaleInfo(d).isStale), [deals]);
  const criticalDeals = useMemo(() => deals.filter(d => getDealStaleInfo(d).severity === 'critical'), [deals]);
  const staleDealsValue = useMemo(() => staleDeals.reduce((acc, d) => acc + (d.value || 0), 0), [staleDeals]);

  // Filtered and Sorted Recent Deals (Placed before any early returns to satisfy React Rules of Hooks)
  const filteredRecentDeals = useMemo(() => {
    let list = [...deals];

    // Text search (Title, Contact, Property)
    if (dealSearch.trim()) {
      const q = dealSearch.toLowerCase().trim();
      list = list.filter(d => {
        const title = (d.title || "").toLowerCase();
        const contact = contacts.find(c => c.id === d.contactId);
        const contactName = (contact?.name || "").toLowerCase();
        const prop = properties.find(p => p.id === d.propertyId);
        const propTitle = (prop?.title || "").toLowerCase();
        return title.includes(q) || contactName.includes(q) || propTitle.includes(q);
      });
    }

    // Stage filter
    if (dealStageFilter !== "all") {
      list = list.filter(d => d.stage === dealStageFilter);
    }

    // Value Range filter
    if (dealValueRange !== "all") {
      list = list.filter(d => {
        const val = Number(d.value) || 0;
        if (dealValueRange === "under-500k") return val < 500000;
        if (dealValueRange === "500k-1.5m") return val >= 500000 && val <= 1500000;
        if (dealValueRange === "1.5m-3m") return val > 1500000 && val <= 3000000;
        if (dealValueRange === "above-3m") return val > 3000000;
        return true;
      });
    }

    // Owner filter
    if (dealOwnerFilter !== "all") {
      list = list.filter(d => d.ownerId === dealOwnerFilter);
    }

    // Score filter
    if (dealScoreFilter !== "all") {
      list = list.filter(d => {
        const prob = customProbabilities[d.stage] ?? (d.stage === 'closed' ? 100 : (STAGES.findIndex(s => s.id === d.stage) + 1) * 20);
        if (dealScoreFilter === "high") return prob >= 70;
        if (dealScoreFilter === "medium") return prob >= 30 && prob < 70;
        if (dealScoreFilter === "low") return prob < 30;
        return true;
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (dealSortBy === "value-desc") return (b.value || 0) - (a.value || 0);
      if (dealSortBy === "value-asc") return (a.value || 0) - (b.value || 0);
      if (dealSortBy === "probability-desc") {
        const probA = customProbabilities[a.stage] ?? (a.stage === 'closed' ? 100 : (STAGES.findIndex(s => s.id === a.stage) + 1) * 20);
        const probB = customProbabilities[b.stage] ?? (b.stage === 'closed' ? 100 : (STAGES.findIndex(s => s.id === b.stage) + 1) * 20);
        return probB - probA;
      }
      if (dealSortBy === "title-asc") return (a.title || "").localeCompare(b.title || "");
      // Default: recent (updatedAt or createdAt)
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return list;
  }, [deals, dealSearch, dealStageFilter, dealValueRange, dealOwnerFilter, dealScoreFilter, dealSortBy, customProbabilities, contacts, properties]);

  const hasActiveDealFilters = dealSearch !== "" || dealStageFilter !== "all" || dealValueRange !== "all" || dealScoreFilter !== "all" || dealOwnerFilter !== "all" || dealSortBy !== "recent";
  const activeDealFilterCount = [
    dealSearch !== "",
    dealStageFilter !== "all",
    dealValueRange !== "all",
    dealScoreFilter !== "all",
    dealOwnerFilter !== "all",
    dealSortBy !== "recent"
  ].filter(Boolean).length;

  const clearDealFilters = () => {
    setDealSearch("");
    setDealStageFilter("all");
    setDealValueRange("all");
    setDealScoreFilter("all");
    setDealOwnerFilter("all");
    setDealSortBy("recent");
  };

  const filteredDealsTotalValue = useMemo(() => {
    return filteredRecentDeals.reduce((acc, d) => acc + (Number(d.value) || 0), 0);
  }, [filteredRecentDeals]);

  // Prepared Deals for display
  const displayRecentDeals = useMemo(() => {
    return filteredRecentDeals.slice(0, dealLimit).map(d => {
      const stage = STAGES.find(s => s.id === d.stage);
      const contact = contacts.find(c => c.id === d.contactId);
      const property = properties.find(p => p.id === d.propertyId);
      const owner = users.find(u => u.id === d.ownerId);

      return {
        id: d.id,
        raw: d,
        account: d.title,
        initials: (d.title || "LE").substring(0, 2).toUpperCase(),
        valueNum: Number(d.value) || 0,
        value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(d.value) || 0),
        stageId: d.stage,
        stage: stage?.title || d.stage,
        color: stage?.color || 'slate',
        contactName: contact?.name,
        contactPhone: contact?.phone,
        propertyTitle: property?.title,
        ownerName: owner?.displayName || owner?.name,
        date: d.updatedAt ? format(new Date(d.updatedAt), "dd/MM/yyyy") : '-',
        probability: customProbabilities[d.stage] ?? (d.stage === 'closed' ? 100 : (STAGES.findIndex(s => s.id === d.stage) + 1) * 20)
      };
    });
  }, [filteredRecentDeals, dealLimit, contacts, properties, users, customProbabilities]);

  // Fast stage advance handler
  const handleAdvanceStage = async (dealId: string, currentStageId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentIndex = STAGES.findIndex(s => s.id === currentStageId);
    if (currentIndex === -1 || currentIndex >= STAGES.length - 1) {
      toast.info("Este negócio já está na fase final (Vendido / Alugado).");
      return;
    }
    const nextStage = STAGES[currentIndex + 1];
    try {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: nextStage.id, updatedAt: new Date().toISOString() } : d));
      await updateDeal(dealId, { stage: nextStage.id });
      recordAuditEvent({
        action: 'UPDATE_DEAL_STAGE',
        title: 'Avanço de Etapa no Funil',
        content: `Negócio avançado para "${nextStage.title}".`,
        severity: 'low',
        category: 'modification',
        relatedId: dealId,
        entityType: 'deal',
        metadata: { newStage: nextStage.id, stageTitle: nextStage.title }
      });
      toast.success(`Avançado para: ${nextStage.title}`);
    } catch (err) {
      toast.error("Não foi possível atualizar a etapa.");
      refreshData(false);
    }
  };

  // Change stage directly
  const handleChangeStage = async (dealId: string, targetStageId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetStage = STAGES.find(s => s.id === targetStageId);
    if (!targetStage) return;
    try {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: targetStage.id, updatedAt: new Date().toISOString() } : d));
      await updateDeal(dealId, { stage: targetStage.id });
      recordAuditEvent({
        action: 'UPDATE_DEAL_STAGE',
        title: 'Alteração de Etapa do Negócio',
        content: `Negócio alterado para "${targetStage.title}".`,
        severity: 'low',
        category: 'modification',
        relatedId: dealId,
        entityType: 'deal',
        metadata: { newStage: targetStage.id, stageTitle: targetStage.title }
      });
      toast.success(`Etapa alterada para ${targetStage.title}!`);
      setActiveDealMenu(null);
    } catch (err) {
      toast.error("Erro ao alterar etapa.");
      refreshData(false);
    }
  };

  // Delete deal from dashboard
  const handleDeleteDeal = async (id: string, title?: string) => {
    try {
      setDeals(prev => prev.filter(d => d.id !== id));
      await deleteDeal(id);
      recordAuditEvent({
        action: 'DELETE_DEAL',
        title: 'Exclusão de Negócio pelo Dashboard',
        content: `Negócio "${title || id}" foi excluído.`,
        severity: 'high',
        category: 'deletion',
        relatedId: id,
        entityType: 'deal',
        metadata: { dealId: id, title }
      });
      toast.success("Negócio excluído com sucesso.");
      setDeletingDealId(null);
      setActiveDealMenu(null);
    } catch (err) {
      toast.error("Erro ao excluir negócio.");
      refreshData(false);
    }
  };

  const refreshData = useCallback(async (showLoading = true) => {
    if (!user || !profile) return;
    if (showLoading) setLoading(true);
    setErrorStatus(null);
    try {
      const ownerId = profile.role === 'Admin' ? undefined : user.id;
      
      const results = await Promise.allSettled([
        getDeals(ownerId),
        getContacts(ownerId),
        getProperties(ownerId),
        getGoals(ownerId)
      ]);
      
      if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) setDeals(results[0].value);
      if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) setContacts(results[1].value);
      if (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) setProperties(results[2].value);
      if (results[3].status === 'fulfilled' && Array.isArray(results[3].value)) setGoals(results[3].value);
    } catch (err: any) {
      console.error("[Dashboard] Refresh error:", err);
      if (deals.length === 0 && contacts.length === 0) {
        setErrorStatus(err.message || "Erro ao carregar dados.");
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user, profile, deals.length, contacts.length]);

  useEffect(() => {
    // Only call refreshData if data remains empty after subscriptions have had a chance to connect
    if (user && profile && deals.length === 0 && contacts.length === 0) {
      const timer = setTimeout(() => {
        if (deals.length === 0 && contacts.length === 0) {
          refreshData(false);
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [user, profile, refreshData, deals.length, contacts.length]);

  const generateAIInsights = useCallback(async (bypassCache = false) => {
    if (!bypassCache) {
      const cached = localStorage.getItem("dashboard_ai_insights");
      if (cached) {
        try {
          const { text, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < 3600000) { // 1 hour
            setAiInsights(text);
            return;
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    }

    setLoadingAI(true);
    const currentMonthStr = format(new Date(), "yyyy-MM");
    const currentGoal = goals.find(g => g.month === currentMonthStr && g.ownerId === user?.id) || 
                        goals.find(g => g.month === currentMonthStr);
    const goalRevenue = currentGoal?.stageGoals?.['closed'] || currentGoal?.revenue || 0;
    const closedDealsTotal = deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + d.value, 0);
    const totalPipelineValue = deals
      .filter(d => STAGES.some(s => s.id === d.stage && s.id !== 'closed'))
      .reduce((acc, d) => acc + d.value, 0);
    
    const weightedPipelineValue = deals
      .filter(d => d.stage !== 'closed')
      .reduce((acc, d) => {
        const prob = customProbabilities[d.stage] ?? (STAGES.findIndex(s => s.id === d.stage) + 1) * 20;
        return acc + (d.value * (prob / 100));
      }, 0);

    const forecastValue = weightedPipelineValue + closedDealsTotal;
    
    const stageCounts = STAGES.map(stage => ({
      name: stage.title,
      count: deals.filter(d => d.stage === stage.id).length,
      value: deals.filter(d => d.stage === stage.id).reduce((acc, d) => acc + d.value, 0),
    }));

    const prompt = `
      Analise os seguintes dados do CRM SalesScore e forneça um resumo executivo de previsões de vendas e recomendações estratégicas.
      Mês Atual: ${currentMonthStr}
      Objetivo de Receita: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(goalRevenue) || 0)}
      Vendas Realizadas (Closed): ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(closedDealsTotal) || 0)}
      Valor em Pipeline (Aberto): ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(totalPipelineValue) || 0)}
      Previsão Ponderada (Realista): ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(forecastValue) || 0)}

      Distribuição do Pipeline:
      ${stageCounts.map(s => `- ${s.name}: ${s.count} negócios, total ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(s.value) || 0)}`).join('\n')}

      Por favor, forneça:
      1. Uma avaliação da probabilidade de atingir a meta.
      2. Qual estágio do funil é o maior gargalo.
      3. Uma recomendação prática para fechar mais negócios.
      
      Responda em PORTUGUÊS, use tom profissional e direto. Use formatação em parágrafos curtos.
    `;

    const result = await safeAiCall(prompt, "Não foi possível gerar os insights agora. Tente novamente em alguns minutos.");
    setAiInsights(result.text);
    try {
      localStorage.setItem("dashboard_ai_insights", JSON.stringify({
        text: result.text,
        timestamp: Date.now()
      }));
    } catch (e) {
      // ignore
    }
    setLoadingAI(false);
  }, [goals, deals, customProbabilities, user?.id]);

  useEffect(() => {
    if (activeTab === 'Previsões' && deals.length > 0 && !aiInsights && !loadingAI) {
      generateAIInsights(false);
    }
  }, [activeTab, deals.length, aiInsights, loadingAI, generateAIInsights]);

  useEffect(() => {
    const loadProbabilities = () => {
      const saved = localStorage.getItem("pipeline_probabilities");
      if (saved) {
        setCustomProbabilities(JSON.parse(saved));
      } else {
        const defaults = STAGES.reduce((acc, stage, idx) => {
          acc[stage.id] = (idx + 1) * 20;
          return acc;
        }, {} as Record<string, number>);
        setCustomProbabilities(defaults);
      }
    };

    loadProbabilities();

    const handleUpdate = () => loadProbabilities();
    window.addEventListener("storage_probabilities_updated", handleUpdate);
    return () => window.removeEventListener("storage_probabilities_updated", handleUpdate);
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['Visão Geral', 'Relatórios', 'Equipe', 'Previsões'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    // Trava de segurança: força o carregamento do painel após 5 segundos
    // para evitar que o usuário fique preso no "Carregando" caso o perfil demore a sincronizar
    const timer = setTimeout(() => {
      if (loading) {
        console.log("[Dashboard] Safety timeout (5s) triggered, forcing loading false");
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    console.log("[Dashboard] Auth State:", { authLoading, hasUser: !!user });
    if (!authLoading) {
      if (!user) {
        console.log("[Dashboard] Roteando para login...");
        router.push("/login");
      } else {
        // Stop showing generic loader if auth is done and user is here
        console.log("[Dashboard] Auth concluído, liberando interface.");
        setLoading(false);
      }
    }
  }, [user, authLoading, router, loading]);

  useEffect(() => {
    if (!user || !profile) return;

    // Safety timeout: force loading false if it takes too long
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 8000);

    // Subscriptions
    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsubDeals = subscribeToDeals((data) => {
      setDeals(data);
      setLoading(false);
      clearTimeout(safetyTimer);
    }, ownerId);
    
    const unsubContacts = subscribeToContacts(setContacts, ownerId);
    const unsubProperties = subscribeToProperties(setProperties, ownerId);
    
    const unsubGoals = subscribeToGoals((data) => {
      setGoals(data);
    }, ownerId);
    
    const unsubActivities = subscribeToActivities((data) => {
      setActivities(data);
    }, ownerId);

    // Fetch team members if Admin
    let unsubUsers = () => {};
    if (profile.role === 'Admin') {
      unsubUsers = subscribeToUsers(setUsers);
    }

    return () => {
      unsubDeals();
      unsubContacts();
      unsubProperties();
      unsubGoals();
      unsubActivities();
      unsubUsers();
      clearTimeout(safetyTimer);
    };
  }, [user, profile]);

  // Metric Data helper for Sparklines

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#090d16] text-white gap-6">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <TrendingUp className="w-6 h-6 text-primary animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-100 animate-pulse">Carregando o SalesScore...</p>
          <p className="text-xs text-slate-500 mt-2 select-none">Sincronizando ambiente seguro de negócios</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (loading && deals.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#090d16] text-white gap-6">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <TrendingUp className="w-6 h-6 text-primary animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-100 animate-pulse">Carregando o SalesScore...</p>
          <p className="text-xs text-slate-500 mt-2 select-none">Sincronizando ambiente seguro de negócios</p>
        </div>
      </div>
    );
  }

  // Metric Data helper for Sparklines
  const getTrendData = (type: 'revenue' | 'leads' | 'deals') => {
    return Array.from({ length: 12 }).map((_, i) => ({
      value: Math.floor(Math.random() * 50) + 50
    }));
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Revenue
  const currentMonthRevenue = deals
    .filter(d => d.stage === 'closed' && d.updatedAt?.startsWith(currentMonthStr))
    .reduce((acc, d) => acc + d.value, 0);

  const lastMonthRevenue = deals
    .filter(d => d.stage === 'closed' && d.updatedAt?.startsWith(lastMonthStr))
    .reduce((acc, d) => acc + d.value, 0);

  const revenueTrend = lastMonthRevenue > 0 
    ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
    : 100;

  // Win Rate (Conversion Rate)
  // We only count deals that are actually in one of the pipeline stages
  const validDeals = deals.filter(d => STAGES.some(s => s.id === d.stage));
  const totalDealsFinished = validDeals.filter(d => d.stage === 'closed').length;
  const winRate = validDeals.length > 0 ? (totalDealsFinished / validDeals.length) * 100 : 0;
  const winRateDetails = `${totalDealsFinished} de ${validDeals.length} negócios`;

  // progressPercentage - Use monthly revenue for monthly goal
  const progressPercentage = goalRevenue > 0 ? Math.round((currentMonthRevenue / goalRevenue) * 100) : 0;

  // New Leads (Deals in Novo Lead stage created this month) - Force Sync trigger
  // We use deals instead of contacts as it aligns better with the pipeline view
  const currentMonthDeals = deals.filter(d => d.createdAt?.startsWith(currentMonthStr));
  const newLeads = currentMonthDeals.filter(d => d.stage === 'lead').length;
  const lastMonthDeals = deals.filter(d => d.createdAt?.startsWith(lastMonthStr));
  const lastMonthLeads = lastMonthDeals.filter(d => d.stage === 'lead').length;
  const leadsTrend = lastMonthLeads > 0 ? ((newLeads - lastMonthLeads) / lastMonthLeads) * 100 : (newLeads > 0 ? 100 : 0);

  // Open Deals
  const openDeals = deals.filter(d => d.stage !== 'closed');

  // Forecast Calculation (Weighted by custom probabilities)
  const closedDealsTotalForForecast = deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + d.value, 0);
  
  const weightedPipelineValue = deals
    .filter(d => d.stage !== 'closed')
    .reduce((acc, d) => {
      const prob = customProbabilities[d.stage] ?? (STAGES.findIndex(s => s.id === d.stage) + 1) * 20;
      return acc + (d.value * (prob / 100));
    }, 0);

  const forecastValue = weightedPipelineValue + closedDealsTotalForForecast;
  
  // Properties Available
  const activeProperties = properties.filter(p => p.status === 'disponível').length;

  // Chart Data (Last 6 months/weeks)
  const chartData = chartPeriod === 'monthly'
    ? Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const mStr = format(d, "yyyy-MM");
        const mLabel = format(d, "MMM", { locale: ptBR }).replace('.', '').toUpperCase();
        
        const monthlyActual = deals
          .filter(deal => deal.stage === 'closed' && deal.updatedAt?.startsWith(mStr))
          .reduce((acc, deal) => acc + deal.value, 0);
        
        // Projected could be from Goal
        const monthGoals = goals.filter(g => g.month === mStr);
        const monthGoal = monthGoals.find(g => g.ownerId === user?.id) || monthGoals[0];
        const monthlyProjected = monthGoal?.stageGoals?.['closed'] || 0;

        return { name: mLabel, actual: monthlyActual, projected: monthlyProjected };
      })
    : Array.from({ length: 6 }).map((_, i) => {
        // Weekly view: Last 6 calendar weeks (Monday to Sunday)
        const currentDay = now.getDay(); // 0 Sunday, 1 Monday, etc.
        const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
        const startOfCurrentWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday, 0, 0, 0, 0);

        // Go back (5 - i) weeks
        const weekStart = new Date(startOfCurrentWeek.getTime() - (5 - i) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000);
        
        const weekLabel = `Sem ${format(weekStart, "dd/MM")}`;

        const weeklyActual = deals
          .filter(deal => {
            if (deal.stage !== 'closed' || !deal.updatedAt) return false;
            const dealDate = new Date(deal.updatedAt);
            return dealDate >= weekStart && dealDate <= weekEnd;
          })
          .reduce((acc, deal) => acc + deal.value, 0);

        // Weekly projected is roughly monthly goal divided by 4
        const mStr = format(weekStart, "yyyy-MM");
        const monthGoals = goals.filter(g => g.month === mStr);
        const monthGoal = monthGoals.find(g => g.ownerId === user?.id) || monthGoals[0];
        const monthlyProjected = monthGoal?.stageGoals?.['closed'] || 0;
        const weeklyProjected = monthlyProjected / 4;

        return { name: weekLabel, actual: weeklyActual, projected: Math.round(weeklyProjected) };
      });

  const handleToggleActivity = async (activity: Activity) => {
    const newStatus = activity.status === 'pending' ? 'completed' : 'pending';
    await updateActivity(activity.id, { status: newStatus });
  };

  // Activities (Using real activities)
  const displayActivities = [...activities]
    .sort((a, b) => {
      // Prioritize pending
      if (a.status === 'pending' && b.status === 'completed') return -1;
      if (a.status === 'completed' && b.status === 'pending') return 1;
      // Then by date ascending (for pending) or descending (for completed)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
    .slice(0, 4) // Show up to 4
    .map(a => {
      return {
        id: a.id,
        raw: a,
        date: format(new Date(a.date), "dd MMM", { locale: ptBR }).toUpperCase(),
        title: a.title,
        time: format(new Date(a.date), "HH:mm"),
        statusLabel: a.status === 'completed' ? 'Concluída' : 'Pendente',
        isCompleted: a.status === 'completed',
        type: a.type
      };
    });

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Header */}
        <header className="h-auto md:h-16 lg:h-18 bg-card/80 backdrop-blur-md border-b border-border px-4 md:px-6 py-3 md:py-0 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-20 gap-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-8 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <h2 className="text-base md:text-lg font-black text-foreground shrink-0">Dashboard</h2>
                <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider leading-none">Bem-vindo, {profile?.displayName?.split(' ')[0]}</p>
              </div>
              <button 
                onClick={() => refreshData()}
                className="p-1.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                title="Recarregar Dados"
              >
                <TrendingUp className={cn("w-4 h-4", loading && "animate-pulse")} />
              </button>
            </div>
            
            {errorStatus && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[9.5px] font-bold uppercase tracking-wider">
                <Info className="w-3 h-3" />
                {errorStatus}
              </div>
            )}
            
            <div className="w-full md:max-w-xs lg:max-w-sm relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="w-full bg-muted/50 border-none rounded-xl py-1.5 md:py-2 pl-9 pr-3 text-xs focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-border"
              />
            </div>

            <nav className="hidden xl:flex items-center gap-6 ml-2 h-full">
              {['Visão Geral', 'Relatórios', 'Equipe', 'Previsões'].map((tab) => (
                <button 
                  key={tab} 
                  onClick={() => {
                    setActiveTab(tab);
                    router.push(`/?tab=${tab}`);
                  }}
                  className={`text-xs font-bold transition-all relative py-5 md:py-5.5 ${activeTab === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-border">
            {/* Notifications removed as per user request */}
          </div>
        </header>

        {/* Dashboard Content */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-3.5 sm:p-4 md:p-5 lg:p-6 space-y-4 md:space-y-5 max-w-[1700px] w-full mx-auto pb-16 md:pb-20"
          >
            {activeTab === 'Visão Geral' && (
              <>
                {/* Metrics Rows */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
                  <MetricCard 
                    variants={itemVariants}
                    title="RECEITA MENSAL" 
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(currentMonthRevenue) || 0)} 
                    trend={`${revenueTrend > 0 ? '+' : ''}${revenueTrend.toFixed(1)}% vs mês ant.`}
                    description="Valor total faturado este mês com imóveis vendidos ou alugados. Reflete o desempenho financeiro direto do período atual."
                    isPositive={revenueTrend >= 0}
                    chartData={getTrendData('revenue')}
                  />
                  <MetricCard 
                    variants={itemVariants}
                    title="TAXA DE CONVERSÃO" 
                    value={`${winRate.toFixed(1)}%`} 
                    trend={winRateDetails}
                    description="Percentual de fechamentos bem-sucedidos em relação ao volume total de oportunidades. Indica a eficiência do seu processo comercial."
                    isPositive={winRate > 15}
                    chartData={getTrendData('revenue').reverse()}
                  />
                  <MetricCard 
                    variants={itemVariants}
                    title="NOVOS LEADS" 
                    value={newLeads.toString()} 
                    trend={`${leadsTrend > 0 ? '+' : ''}${leadsTrend.toFixed(1)}% vs mês ant.`}
                    description="Novos clientes potenciais e negócios que entraram no pipeline este mês. Mede a eficácia das suas ações de prospecção."
                    isPositive={leadsTrend >= 0}
                    chartData={getTrendData('leads')}
                  />
                  <MetricCard 
                    variants={itemVariants}
                    title="NEGÓCIOS ABERTOS" 
                    value={openDeals.length.toString()} 
                    trend={`Fluxo total ativo`}
                    description="Negociações em andamento em todas as fases do funil. Representa o volume de trabalho e oportunidades de receita futura."
                    isPositive={true}
                    isNeutral={true}
                    chartData={getTrendData('deals')}
                  />
                  <MetricCard 
                    variants={itemVariants}
                    title="IMÓVEIS DISPONÍVEIS" 
                    value={activeProperties.toString()} 
                    trend={`Total em portfólio`}
                    description="Unidades prontas para comercialização em seu inventário. Um portfólio atualizado é essencial para gerar novas oportunidades."
                    isPositive={true}
                    isNeutral={true}
                    chartData={getTrendData('leads').reverse()}
                  />
                </div>

                {/* Stale Leads Rescue Widget */}
                {staleDeals.length > 0 && (
                  <motion.div
                    variants={itemVariants}
                    className="p-4 md:p-5 rounded-2xl md:rounded-3xl border border-amber-500/30 bg-amber-500/[0.04] shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5 animate-bounce" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm md:text-base font-bold text-foreground">
                              Atenção Comercial: {staleDeals.length} {staleDeals.length === 1 ? 'Lead Parado' : 'Leads Parados'}
                            </h4>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(staleDealsValue)} em risco
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Oportunidades sem contato há mais de 5 dias. Recupere estes clientes antes que desistam ou busquem outra imobiliária.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push('/pipeline')}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
                      >
                        Abrir Funil de Resgate
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {staleDeals.slice(0, 4).map(deal => {
                        const staleInfo = getDealStaleInfo(deal);
                        const contact = contacts.find(c => c.id === deal.contactId);
                        const rescueUrl = contact?.phone 
                          ? getWhatsAppRescueUrl(contact.phone, contact.name, deal.title)
                          : null;

                        return (
                          <div 
                            key={deal.id}
                            className="p-3 rounded-xl border border-border/80 bg-card hover:border-amber-500/40 transition-all flex flex-col justify-between gap-2 shadow-2xs"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className={cn(
                                  "text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md",
                                  staleInfo.severity === 'critical' 
                                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" 
                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                )}>
                                  {staleInfo.daysInactive}d sem contato
                                </span>
                                <span className="text-[10px] font-bold text-foreground">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(deal.value || 0)}
                                </span>
                              </div>
                              <p className="font-bold text-xs text-foreground line-clamp-1" title={deal.title}>
                                {deal.title}
                              </p>
                              <p className="text-[10.5px] text-muted-foreground truncate">
                                {contact?.name || 'Cliente sem nome'}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-1">
                              <button
                                onClick={() => router.push(`/deals/${deal.id}`)}
                                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Ver detalhes
                              </button>
                              {rescueUrl ? (
                                <a
                                  href={rescueUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-bold flex items-center gap-1 transition-all"
                                  title="Enviar mensagem no WhatsApp"
                                >
                                  <MessageCircle className="w-2.5 h-2.5" />
                                  Resgatar
                                </a>
                              ) : (
                                <button
                                  onClick={() => router.push(`/deals/${deal.id}`)}
                                  className="px-2 py-1 rounded-lg bg-muted text-muted-foreground text-[9.5px] font-bold"
                                >
                                  Sem telefone
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                  {/* Chart Column */}
                  <motion.div 
                    variants={itemVariants}
                    className="lg:col-span-2 bg-card rounded-2xl md:rounded-3xl border border-border p-4 sm:p-5 md:p-6 shadow-sm relative overflow-hidden card-hover"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-3">
                      <div className="text-left">
                        <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">Análise de Performance</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Vendas e previsões atuais.</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button 
                          onClick={() => setChartPeriod('weekly')}
                          className={cn(
                            "px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-wider rounded-xl transition-colors",
                            chartPeriod === 'weekly' 
                              ? "bg-primary/10 text-primary" 
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          Semanal
                        </button>
                        <button 
                          onClick={() => setChartPeriod('monthly')}
                          className={cn(
                            "px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-wider rounded-xl transition-colors",
                            chartPeriod === 'monthly' 
                              ? "bg-primary/10 text-primary" 
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          Mensal
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6 border-b border-border pb-4 md:pb-6">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-2 h-2 rounded-full bg-primary shadow-md shadow-primary/40" />
                          <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Receita Real</span>
                        </div>
                        <p className="text-xl md:text-2xl font-light text-foreground tracking-tighter">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(currentMonthRevenue) || 0)}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-2 h-2 rounded-full bg-border" />
                          <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Previsão</span>
                          <div className="relative group/info">
                            <HelpCircle className="w-3 h-3 cursor-help text-muted-foreground opacity-50 hover:opacity-100 transition-opacity" />
                            <div className="absolute right-0 top-full mt-2 w-64 p-3.5 bg-slate-900 dark:bg-slate-950 text-white text-[11px] rounded-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all duration-200 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-800 dark:border-slate-800/80 font-medium leading-relaxed normal-case tracking-normal -translate-y-1 group-hover/info:translate-y-0">
                              Previsão baseada em 20% do valor total das negociações em aberto + 100% dos negócios já fechados no mês.
                            </div>
                          </div>
                        </div>
                        <p className="text-xl md:text-2xl font-light text-foreground tracking-tighter">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(forecastValue) || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="h-[250px] md:h-[350px] w-full min-h-[250px]">
                      {mounted && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                              dy={15}
                            />
                            <YAxis hide />
                            <Tooltip 
                              cursor={{ fill: 'rgba(59, 130, 246, 0.03)' }}
                              wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/50 relative z-50">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-2">{payload[0].payload.name}</p>
                                      <div className="space-y-1">
                                        <div className="flex justify-between gap-6">
                                          <span className="text-xs text-slate-300">Realizado:</span>
                                          <span className="text-xs font-bold text-blue-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(payload[1].value) || 0)}</span>
                                        </div>
                                        <div className="flex justify-between gap-6">
                                          <span className="text-xs text-slate-300">Objetivo:</span>
                                          <span className="text-xs font-bold text-slate-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(payload[0].value) || 0)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="projected" fill="#F1F5F9" radius={[12, 12, 12, 12]} barSize={32} />
                            <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[12, 12, 12, 12]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </motion.div>

                  {/* Activities Column: Intelligence Widget */}
                  <motion.div variants={itemVariants}>
                    <IntelligenceWidget 
                      activities={activities} 
                      deals={deals} 
                      onToggle={handleToggleActivity}
                    />
                  </motion.div>
                </div>

                {/* Recent Deals Table with Complete Filtering & Actions */}
                <motion.div 
                  variants={itemVariants}
                  className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 sm:p-5 md:p-6 shadow-sm overflow-hidden card-hover"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-5 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 md:w-10 md:h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-inner">
                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Negócios Recentes</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-bold text-muted-foreground border border-border">
                            {filteredRecentDeals.length}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Últimas movimentações e gestão do funil</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Filter Toggle Button */}
                      <button 
                        onClick={() => setShowDealFilter(prev => !prev)}
                        className={cn(
                          "relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs",
                          showDealFilter 
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/30" 
                            : hasActiveDealFilters
                              ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        )}
                        title="Filtrar negócios recentes"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Filtros</span>
                        {activeDealFilterCount > 0 && (
                          <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center -mr-0.5 shadow-xs animate-in zoom-in">
                            {activeDealFilterCount}
                          </span>
                        )}
                      </button>

                      {/* Pipeline Button */}
                      <button 
                        onClick={() => router.push("/pipeline")}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[10px] font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-all font-sans uppercase tracking-widest flex items-center gap-1.5"
                      >
                        <span>Pipeline</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Filter Panel */}
                  <AnimatePresence>
                    {showDealFilter && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-muted/40 rounded-2xl md:rounded-3xl border border-border p-5 md:p-6 space-y-4 shadow-inner">
                          {/* Top row: Search + Quick Reset */}
                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <div className="relative flex-1 w-full">
                              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input 
                                type="text"
                                value={dealSearch}
                                onChange={(e) => setDealSearch(e.target.value)}
                                placeholder="Buscar por título do negócio, cliente ou imóvel..."
                                className="w-full pl-10 pr-9 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                              />
                              {dealSearch && (
                                <button 
                                  onClick={() => setDealSearch("")}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {hasActiveDealFilters && (
                              <button 
                                onClick={clearDealFilters}
                                className="text-xs text-muted-foreground hover:text-primary font-bold flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors shrink-0"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Limpar Filtros
                              </button>
                            )}
                          </div>

                          {/* Filter Selects Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {/* Fase */}
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                Fase do Funil
                              </label>
                              <select 
                                value={dealStageFilter}
                                onChange={(e) => setDealStageFilter(e.target.value)}
                                className="w-full bg-background border border-border rounded-xl text-xs px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-medium"
                              >
                                <option value="all">Todas as Fases ({deals.length})</option>
                                {STAGES.map(stage => (
                                  <option key={stage.id} value={stage.id}>
                                    {stage.title} ({deals.filter(d => d.stage === stage.id).length})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Faixa de Valor */}
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                Faixa de Valor
                              </label>
                              <select 
                                value={dealValueRange}
                                onChange={(e) => setDealValueRange(e.target.value)}
                                className="w-full bg-background border border-border rounded-xl text-xs px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-medium"
                              >
                                <option value="all">Todos os Valores</option>
                                <option value="under-500k">Até R$ 500 mil</option>
                                <option value="500k-1.5m">R$ 500k a R$ 1,5M</option>
                                <option value="1.5m-3m">R$ 1,5M a R$ 3M</option>
                                <option value="above-3m">Acima de R$ 3M</option>
                              </select>
                            </div>

                            {/* Score / Probabilidade */}
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                Probabilidade
                              </label>
                              <select 
                                value={dealScoreFilter}
                                onChange={(e) => setDealScoreFilter(e.target.value)}
                                className="w-full bg-background border border-border rounded-xl text-xs px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-medium"
                              >
                                <option value="all">Todos os Scores</option>
                                <option value="high">Alta Chance (≥ 70%)</option>
                                <option value="medium">Média Chance (30-69%)</option>
                                <option value="low">Inicial (&lt; 30%)</option>
                              </select>
                            </div>

                            {/* Ordenação */}
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                Ordenar Por
                              </label>
                              <select 
                                value={dealSortBy}
                                onChange={(e) => setDealSortBy(e.target.value)}
                                className="w-full bg-background border border-border rounded-xl text-xs px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-medium"
                              >
                                <option value="recent">Mais Recentes</option>
                                <option value="value-desc">Maior Valor (R$)</option>
                                <option value="value-asc">Menor Valor (R$)</option>
                                <option value="probability-desc">Maior Score (%)</option>
                                <option value="title-asc">Ordem Alfabética (A-Z)</option>
                              </select>
                            </div>

                            {/* Exibir quantidade */}
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                Exibição
                              </label>
                              <select 
                                value={dealLimit}
                                onChange={(e) => setDealLimit(Number(e.target.value))}
                                className="w-full bg-background border border-border rounded-xl text-xs px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-medium"
                              >
                                <option value={4}>4 negócios</option>
                                <option value={6}>6 negócios</option>
                                <option value={10}>10 negócios</option>
                                <option value={999}>Todos ({filteredRecentDeals.length})</option>
                              </select>
                            </div>
                          </div>

                          {/* Quick Stage Chips */}
                          <div className="pt-2 border-t border-border/60 flex items-center gap-2 overflow-x-auto pb-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
                              Etapas:
                            </span>
                            <button
                              onClick={() => setDealStageFilter("all")}
                              className={cn(
                                "px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0",
                                dealStageFilter === "all" 
                                  ? "bg-foreground text-background shadow-xs" 
                                  : "bg-background text-muted-foreground hover:text-foreground border border-border"
                              )}
                            >
                              Todas ({deals.length})
                            </button>
                            {STAGES.map(stage => {
                              const count = deals.filter(d => d.stage === stage.id).length;
                              const isSelected = dealStageFilter === stage.id;
                              return (
                                <button
                                  key={stage.id}
                                  onClick={() => setDealStageFilter(stage.id)}
                                  className={cn(
                                    "px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border",
                                    isSelected 
                                      ? "bg-primary text-primary-foreground border-primary shadow-xs" 
                                      : "bg-background text-muted-foreground hover:text-foreground border-border"
                                  )}
                                >
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    stage.color === 'emerald' ? "bg-emerald-500" :
                                    stage.color === 'blue' ? "bg-blue-500" :
                                    stage.color === 'purple' ? "bg-purple-500" :
                                    stage.color === 'orange' ? "bg-orange-500" :
                                    "bg-yellow-500"
                                  )} />
                                  <span>{stage.title}</span>
                                  <span className={cn(
                                    "text-[10px] px-1.5 py-0.2 rounded-full",
                                    isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                                  )}>
                                    {count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Active Filter Badges Bar */}
                  {hasActiveDealFilters && (
                    <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-muted/20 border border-border rounded-xl">
                      <span className="text-[11px] font-bold text-muted-foreground">Filtros ativos:</span>
                      
                      {dealSearch && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border text-foreground rounded-lg text-xs font-medium">
                          Busca: &ldquo;{dealSearch}&rdquo;
                          <button onClick={() => setDealSearch("")} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {dealStageFilter !== "all" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border text-foreground rounded-lg text-xs font-medium">
                          Etapa: {STAGES.find(s => s.id === dealStageFilter)?.title}
                          <button onClick={() => setDealStageFilter("all")} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {dealValueRange !== "all" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border text-foreground rounded-lg text-xs font-medium">
                          Valor: {
                            dealValueRange === 'under-500k' ? 'Até R$ 500k' :
                            dealValueRange === '500k-1.5m' ? 'R$ 500k a R$ 1,5M' :
                            dealValueRange === '1.5m-3m' ? 'R$ 1,5M a R$ 3M' : 'Acima de R$ 3M'
                          }
                          <button onClick={() => setDealValueRange("all")} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {dealScoreFilter !== "all" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border text-foreground rounded-lg text-xs font-medium">
                          Score: {
                            dealScoreFilter === 'high' ? 'Alta (≥ 70%)' :
                            dealScoreFilter === 'medium' ? 'Média (30-69%)' : 'Inicial (< 30%)'
                          }
                          <button onClick={() => setDealScoreFilter("all")} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      {dealSortBy !== "recent" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border text-foreground rounded-lg text-xs font-medium">
                          Ordem: {
                            dealSortBy === 'value-desc' ? 'Maior Valor' :
                            dealSortBy === 'value-asc' ? 'Menor Valor' :
                            dealSortBy === 'probability-desc' ? 'Maior Score' : 'A-Z'
                          }
                          <button onClick={() => setDealSortBy("recent")} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}

                      <span className="text-xs text-muted-foreground ml-auto">
                        Total: <strong className="text-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(filteredDealsTotalValue)}</strong>
                      </span>
                    </div>
                  )}
                  
                  {/* Deals Table */}
                  <div className="overflow-x-auto w-full">
                    <table className="w-full border-separate border-spacing-y-2 md:border-spacing-y-2.5">
                      <thead>
                        <tr className="text-[9.5px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
                          <th className="px-3.5 md:px-4 pb-1.5">Empresa / Projeto</th>
                          <th className="px-3.5 md:px-4 pb-1.5">Valor</th>
                          <th className="px-3.5 md:px-4 pb-1.5">Fase Atual</th>
                          <th className="px-3.5 md:px-4 pb-1.5">Score</th>
                          <th className="px-3.5 md:px-4 pb-1.5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayRecentDeals.length > 0 ? displayRecentDeals.map((deal) => (
                          <tr 
                            key={deal.id} 
                            className="group cursor-pointer"
                            onClick={() => router.push(`/deals/${deal.id}`)}
                          >
                            {/* EMPRESA / PROJETO */}
                            <td className="px-3.5 md:px-4 py-2.5 md:py-3 bg-muted/30 group-hover:bg-card border-y border-l border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-md transition-all rounded-l-xl md:rounded-l-2xl">
                              <div className="flex items-center gap-2.5 md:gap-3">
                                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-[10px] md:text-xs font-bold bg-background text-primary shadow-xs shrink-0 border border-border">
                                  {deal.initials}
                                </div>
                                <div className="min-w-0 max-w-[200px] sm:max-w-xs md:max-w-sm lg:max-w-md">
                                  <span className="text-xs md:text-sm font-bold text-foreground group-hover:text-primary transition-colors uppercase tracking-tight block truncate">
                                    {deal.account}
                                  </span>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 truncate">
                                    {deal.contactName && (
                                      <span className="flex items-center gap-1 font-medium truncate">
                                        <Users className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                                        <span className="truncate">{deal.contactName}</span>
                                      </span>
                                    )}
                                    {deal.propertyTitle && (
                                      <span className="flex items-center gap-1 text-muted-foreground/80 truncate">
                                        <span>•</span>
                                        <Building2 className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{deal.propertyTitle}</span>
                                      </span>
                                    )}
                                    {deal.ownerName && profile?.role === 'Admin' && (
                                      <span className="text-[10px] text-muted-foreground/60 hidden lg:inline shrink-0">
                                        • {deal.ownerName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* VALOR */}
                            <td className="px-3.5 md:px-4 py-2.5 md:py-3 bg-muted/30 group-hover:bg-card border-y border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-md transition-all whitespace-nowrap">
                              <span className="text-xs md:text-sm font-bold text-foreground tracking-tight">{deal.value}</span>
                            </td>

                            {/* FASE ATUAL */}
                            <td className="px-3.5 md:px-4 py-2.5 md:py-3 bg-muted/30 group-hover:bg-card border-y border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-md transition-all whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9.5px] md:text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset shadow-xs",
                                  deal.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20" :
                                  deal.color === 'blue' ? "bg-primary/10 text-primary ring-primary/20" :
                                  deal.color === 'purple' ? "bg-purple-500/10 text-purple-500 ring-purple-500/20" :
                                  deal.color === 'orange' ? "bg-orange-500/10 text-orange-500 ring-orange-500/20" :
                                  "bg-yellow-500/10 text-yellow-500 ring-yellow-500/20"
                                )}>
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full animate-pulse shrink-0",
                                    deal.color === 'emerald' ? "bg-emerald-500" :
                                    deal.color === 'blue' ? "bg-primary" :
                                    deal.color === 'purple' ? "bg-purple-500" :
                                    deal.color === 'orange' ? "bg-orange-500" :
                                    "bg-yellow-500"
                                  )} />
                                  {deal.stage}
                                </span>

                                {/* Quick advance button if not closed */}
                                {deal.stageId !== 'closed' && (
                                  <button
                                    onClick={(e) => handleAdvanceStage(deal.id, deal.stageId, e)}
                                    className="p-1 rounded-md bg-background hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors border border-border opacity-0 group-hover:opacity-100"
                                    title="Avançar para próxima etapa no funil"
                                  >
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* SCORE */}
                            <td className="px-3.5 md:px-4 py-2.5 md:py-3 bg-muted/30 group-hover:bg-card border-y border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-md transition-all whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] md:text-[11px] font-bold text-muted-foreground w-8">{deal.probability}%</span>
                                <div className="h-1.5 w-16 sm:w-20 bg-background rounded-full overflow-hidden shadow-inner ring-1 ring-border">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${deal.probability}%` }}
                                    className={cn(
                                      "h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(var(--primary),0.5)]",
                                      deal.color === 'emerald' ? "bg-emerald-500 shadow-emerald-500/50" : "bg-primary"
                                    )} 
                                  />
                                </div>
                              </div>
                            </td>

                            {/* AÇÃO */}
                            <td className="px-3.5 md:px-4 py-2.5 md:py-3 bg-muted/30 group-hover:bg-card border-y border-r border-transparent group-hover:border-border ring-1 ring-border group-hover:shadow-md transition-all rounded-r-xl md:rounded-r-2xl text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1 deal-menu-container" onClick={(e) => e.stopPropagation()}>
                                {/* Quick View Details Button */}
                                <button
                                  onClick={() => router.push(`/deals/${deal.id}`)}
                                  className="p-1.5 hover:bg-background rounded-lg transition-all text-muted-foreground hover:text-primary border border-transparent hover:border-border shadow-xs"
                                  title="Ver Detalhes 360°"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* WhatsApp Button if phone exists */}
                                {deal.contactPhone && (
                                  <a
                                    href={`https://wa.me/55${deal.contactPhone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 hover:bg-emerald-500/10 rounded-lg transition-all text-muted-foreground hover:text-emerald-500 border border-transparent hover:border-emerald-500/20 shadow-xs"
                                    title={`Conversar no WhatsApp (${deal.contactPhone})`}
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </a>
                                )}

                                {/* Dropdown Menu Button */}
                                <div className="relative">
                                  <button 
                                    onClick={() => setActiveDealMenu(activeDealMenu === deal.id ? null : deal.id)}
                                    className={cn(
                                      "p-1.5 rounded-lg transition-all border shadow-xs",
                                      activeDealMenu === deal.id
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground border-border"
                                    )}
                                    title="Mais opções de ação"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Action Dropdown Menu */}
                                  {activeDealMenu === deal.id && (
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-2xl p-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                                      <div className="px-2.5 py-1 text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border mb-1">
                                        Ações Rápidas
                                      </div>

                                      <button
                                        onClick={() => {
                                          setActiveDealMenu(null);
                                          router.push(`/deals/${deal.id}`);
                                        }}
                                        className="w-full px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted rounded-lg flex items-center gap-2 transition-colors"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-primary" />
                                        <span>Ver Ficha Completa</span>
                                      </button>

                                      <button
                                        onClick={() => {
                                          setActiveDealMenu(null);
                                          router.push("/pipeline");
                                        }}
                                        className="w-full px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted rounded-lg flex items-center gap-2 transition-colors"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5 text-primary" />
                                        <span>Abrir no Funil Kanban</span>
                                      </button>

                                      {/* Sub-menu: Alterar Etapa */}
                                      <div className="my-1 border-t border-border pt-1">
                                        <div className="px-2.5 py-1 text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
                                          Mover para Etapa
                                        </div>
                                        {STAGES.map(stage => (
                                          <button
                                            key={stage.id}
                                            onClick={(e) => handleChangeStage(deal.id, stage.id, e)}
                                            className={cn(
                                              "w-full px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center justify-between transition-colors",
                                              deal.stageId === stage.id
                                                ? "bg-primary/10 text-primary font-bold"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                            )}
                                          >
                                            <span className="flex items-center gap-2">
                                              <span className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                stage.color === 'emerald' ? "bg-emerald-500" :
                                                stage.color === 'blue' ? "bg-blue-500" :
                                                stage.color === 'purple' ? "bg-purple-500" :
                                                stage.color === 'orange' ? "bg-orange-500" :
                                                "bg-yellow-500"
                                              )} />
                                              {stage.title}
                                            </span>
                                            {deal.stageId === stage.id && (
                                              <Check className="w-3 h-3 text-primary" />
                                            )}
                                          </button>
                                        ))}
                                      </div>

                                      {/* Delete action */}
                                      <div className="mt-1 border-t border-border pt-1">
                                        <button
                                          onClick={() => {
                                            setActiveDealMenu(null);
                                            setDeletingDealId(deal.id);
                                          }}
                                          className="w-full px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-lg flex items-center gap-2 transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                          <span>Excluir Negócio</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="py-12 text-center">
                              <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-2.5">
                                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                                  <Search className="w-5 h-5" />
                                </div>
                                <h4 className="text-xs font-bold text-foreground">Nenhum negócio encontrado</h4>
                                <p className="text-[11px] text-muted-foreground">
                                  Nenhum negócio corresponde aos filtros aplicados no momento.
                                </p>
                                {hasActiveDealFilters && (
                                  <button
                                    onClick={clearDealFilters}
                                    className="mt-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:opacity-90 transition-opacity"
                                  >
                                    Limpar Filtros
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer: Count & Ver Mais */}
                  <div className="mt-4 pt-3.5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Exibindo <strong className="text-foreground">{displayRecentDeals.length}</strong> de <strong className="text-foreground">{filteredRecentDeals.length}</strong> negócios encontrados
                      {filteredRecentDeals.length !== deals.length && ` (total cadastrado: ${deals.length})`}
                    </p>

                    <div className="flex items-center gap-2.5">
                      {filteredRecentDeals.length > displayRecentDeals.length && (
                        <button
                          onClick={() => setDealLimit(prev => prev + 4)}
                          className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-colors"
                        >
                          Ver Mais (+4)
                        </button>
                      )}

                      <button
                        onClick={() => router.push("/pipeline")}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
                      >
                        <span>Abrir Funil Completo</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Modal de Confirmação de Exclusão */}
                <AnimatePresence>
                  {deletingDealId && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
                      <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                          <Trash2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-foreground">Excluir Negócio?</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Tem certeza de que deseja remover esta oportunidade? Esta ação será registrada no log de auditoria da imobiliária.
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-2.5 pt-2">
                          <button
                            onClick={() => setDeletingDealId(null)}
                            className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-bold transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => {
                              const target = deals.find(d => d.id === deletingDealId);
                              handleDeleteDeal(deletingDealId, target?.title);
                            }}
                            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all"
                          >
                            Confirmar Exclusão
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </>
            )}

            {activeTab === 'Equipe' && (
              <TeamView users={users} deals={deals} />
            )}

            {activeTab === 'Relatórios' && (
              <ReportsView deals={deals} contacts={contacts} progressPercentage={progressPercentage} />
            )}

            {activeTab === 'Previsões' && (
              <ForecastView 
                deals={deals} 
                goals={goals} 
                goalRevenue={goalRevenue} 
                progressPercentage={progressPercentage}
                customProbabilities={customProbabilities}
                aiInsights={aiInsights}
                loadingAI={loadingAI}
                onRefreshAI={() => generateAIInsights(true)}
                currentGoal={currentGoal}
              />
            )}
          </motion.div>
        </AnimatePresence>


      </main>
    </div>
  );
}

function TeamView({ users, deals }: { users: UserProfile[], deals: Deal[] }) {
  const getAgentPerformance = (userId: string) => {
    const agentDeals = deals.filter(d => d.ownerId === userId);
    const closed = agentDeals.filter(d => d.stage === 'closed');
    const totalValue = closed.reduce((acc, d) => acc + d.value, 0);
    const winRate = agentDeals.length > 0 ? (closed.length / agentDeals.length) * 100 : 0;
    
    return {
      totalValue,
      count: closed.length,
      winRate,
      active: agentDeals.filter(d => d.stage !== 'closed').length
    };
  };

  const agents = users
    .filter(u => u.role === 'Membro' || u.role === 'Admin')
    .map(u => ({
      ...u,
      stats: getAgentPerformance(u.id)
    }))
    .sort((a, b) => b.stats.totalValue - a.stats.totalValue);

  return (
    <div className="space-y-4 md:space-y-5 pb-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-card p-4 md:p-5 rounded-2xl border border-border shadow-sm card-hover">
          <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Média de Vendas/Agente</p>
          <p className="text-xl md:text-2xl font-light text-foreground tracking-tight">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(
              Number(agents.reduce((acc, a) => acc + a.stats.totalValue, 0) / (agents.length || 1)) || 0
            )}
          </p>
        </div>
        <div className="bg-card p-4 md:p-5 rounded-2xl border border-border shadow-sm card-hover">
          <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Melhor Performance</p>
          <p className="text-xl md:text-2xl font-light text-foreground tracking-tight truncate">
            {agents[0]?.displayName || '-'}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-2xl md:rounded-3xl border border-border shadow-sm overflow-hidden card-hover">
        <div className="p-4 md:p-5 border-b border-border">
          <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Performance da Equipe</h3>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-[9.5px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
                <th className="px-4 md:px-5 py-3 border-b border-border">Membro</th>
                <th className="px-4 md:px-5 py-3 border-b border-border">Vendas Totais</th>
                <th className="px-4 md:px-5 py-3 border-b border-border">Negócios Fechados</th>
                <th className="px-4 md:px-5 py-3 border-b border-border">Taxa de Conversão</th>
                <th className="px-4 md:px-5 py-3 border-b border-border">Ativos</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="group hover:bg-muted/50 transition-colors">
                  <td className="px-4 md:px-5 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shadow-xs overflow-hidden relative shrink-0">
                        {agent.photoURL ? <Image src={agent.photoURL} alt="" fill className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : agent.displayName?.[0]}
                      </div>
                      <div>
                        <p className="text-xs md:text-sm font-bold text-foreground group-hover:text-primary transition-colors">{agent.displayName}</p>
                        <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">{agent.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-5 py-3 border-b border-border">
                    <p className="text-xs md:text-sm font-bold text-foreground">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(agent.stats.totalValue) || 0)}
                    </p>
                  </td>
                  <td className="px-4 md:px-5 py-3 border-b border-border text-xs font-medium text-muted-foreground">{agent.stats.count}</td>
                  <td className="px-4 md:px-5 py-3 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-foreground">{agent.stats.winRate.toFixed(1)}%</span>
                      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${agent.stats.winRate}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-5 py-3 border-b border-border">
                    <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-[9.5px] font-bold uppercase tracking-wider ring-1 ring-primary/10">
                      {agent.stats.active} ativos
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ForecastView({ 
  deals, 
  goals, 
  goalRevenue, 
  progressPercentage,
  customProbabilities,
  aiInsights,
  loadingAI,
  onRefreshAI,
  currentGoal
}: { 
  deals: Deal[], 
  goals: Goal[], 
  goalRevenue: number, 
  progressPercentage: number,
  customProbabilities: Record<string, number>,
  aiInsights: string | null,
  loadingAI: boolean,
  onRefreshAI: () => void,
  currentGoal?: Goal
}) {
  const closedDealsTotal = deals.filter(d => d.stage === 'closed').reduce((acc, d) => acc + d.value, 0);
  const totalPipelineValue = deals
    .filter(d => STAGES.some(s => s.id === d.stage && s.id !== 'closed'))
    .reduce((acc, d) => acc + d.value, 0);

  const weightedPipelineValue = deals
    .filter(d => d.stage !== 'closed')
    .reduce((acc, d) => {
      const prob = customProbabilities[d.stage] ?? (STAGES.findIndex(s => s.id === d.stage) + 1) * 20;
      return acc + (d.value * (prob / 100));
    }, 0);

  const forecastValue = weightedPipelineValue + closedDealsTotal;
  
  const stageCounts = STAGES.map(stage => ({
    name: stage.title,
    count: deals.filter(d => d.stage === stage.id).length,
    value: deals.filter(d => d.stage === stage.id).reduce((acc, d) => acc + d.value, 0),
    goal: currentGoal?.stageGoals?.[stage.id] || 0,
    color: stage.color
  }));

  return (
    <div className="space-y-4 md:space-y-5 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-5">
          <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-6 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] rotate-12 pointer-events-none">
              <Layers className="w-48 h-48" />
            </div>

            <div className="flex items-center justify-between mb-6 relative z-20">
              <div>
                <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">Funil de Vendas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Sua pipeline ativa distribuída por estágio.</p>
              </div>
              <div className="text-right group relative">
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Valor Total Pipeline</p>
                  <div className="cursor-help text-muted-foreground/30 hover:text-primary transition-colors">
                    <Info className="w-3 h-3" />
                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-900 dark:bg-slate-950 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 shadow-2xl border border-slate-800 dark:border-slate-800/80 font-medium normal-case tracking-normal translate-y-1 group-hover:translate-y-0">
                      <p className="leading-relaxed">Valor bruto de todos os negócios que estão ativos no seu funil, sem considerar a probabilidade de fechamento.</p>
                    </div>
                  </div>
                </div>
                <p className="text-xl md:text-2xl font-light text-foreground tracking-tight">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(totalPipelineValue) || 0)}
                </p>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              {stageCounts.map((stage, idx) => {
                const progressByValue = stage.goal > 0 
                  ? (stage.value / stage.goal) * 100 
                  : (totalPipelineValue > 0 ? (stage.value / totalPipelineValue) * 100 : 0);
                
                const visualProgress = stage.value > 0 ? Math.max(2, Math.min(100, progressByValue)) : 0;

                return (
                  <div key={stage.name} className="relative group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          stage.color === 'blue' ? "bg-primary" :
                          stage.color === 'purple' ? "bg-purple-600" :
                          stage.color === 'orange' ? "bg-orange-600" :
                          stage.color === 'yellow' ? "bg-yellow-600" : "bg-emerald-600"
                        )} />
                        <span className="text-xs md:text-sm font-bold text-foreground">{stage.name}</span>
                        <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider ml-1.5">
                          {stage.count} {stage.count === 1 ? 'negócio' : 'negócios'}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-foreground">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(stage.value) || 0)}
                        </p>
                        {stage.goal > 0 && (
                          <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
                            Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(stage.goal) || 0)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner ring-1 ring-border p-0.5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${visualProgress}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          stage.color === 'blue' ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]" :
                          stage.color === 'purple' ? "bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.4)]" :
                          stage.color === 'orange' ? "bg-orange-600 shadow-[0_0_8px_rgba(234,88,12,0.4)]" :
                          stage.color === 'yellow' ? "bg-yellow-600 shadow-[0_0_8px_rgba(202,138,4,0.4)]" : 
                          "bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.4)]"
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-6 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-bold tracking-tight">Insights de IA</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Análise Estratégica do Pipeline</p>
                </div>
              </div>
              <button 
                onClick={onRefreshAI}
                disabled={loadingAI}
                className="p-2 bg-muted hover:bg-muted-foreground/10 text-muted-foreground rounded-xl transition-all disabled:opacity-50"
              >
                <div className={cn(loadingAI && "animate-spin")}>
                  <Clock className="w-4 h-4" />
                </div>
              </button>
            </div>

            <div className="min-h-[150px] relative">
              {loadingAI ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Inteligência Artificial processando...</p>
                </div>
              ) : aiInsights ? (
                <div className="space-y-4 text-sm leading-relaxed text-muted-foreground font-medium">
                  {aiInsights.split('\n').map((para, i) => para.trim() ? (
                    <p key={i}>{para}</p>
                  ) : null)}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-sm text-muted-foreground italic">Clique no ícone de relógio para gerar novas previsões baseadas no estado atual dos negócios.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 text-white shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <TrendingUp className="w-32 h-32" />
          </div>
          
          <div className="relative z-10 flex-1">
            <h3 className="text-base md:text-lg font-bold tracking-tight mb-5">Meta Mensal</h3>
            
            <div className="mb-6">
              <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso Geral (Valor)</p>
              <div className="flex items-baseline gap-2 mb-3">
                <p className="text-3xl md:text-4xl font-light tracking-tight">
                  {progressPercentage}%
                </p>
                <span className="text-slate-400 text-xs font-medium">realizado</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, progressPercentage)}%` }}
                  className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(var(--color-primary),0.6)]"
                />
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Objetivo:</span>
                <span className="text-xs font-bold text-white">
                   {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(goalRevenue) || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-5 pt-5 border-t border-white/10 mt-auto">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Previsão Realista</p>
                  <div className="flex items-center gap-2">
                    <div className="group relative">
                      <div className="cursor-help text-slate-500 hover:text-emerald-500 transition-colors">
                        <Info className="w-3.5 h-3.5" />
                        <div className="absolute right-0 top-full mt-2 w-64 p-3.5 bg-slate-800 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 shadow-2xl border border-white/10 font-medium normal-case tracking-normal backdrop-blur-xl translate-y-1 group-hover:translate-y-0">
                          <p className="font-bold mb-2 uppercase tracking-wider text-emerald-400 border-b border-white/10 pb-1.5 flex items-center gap-2">
                            <Layers className="w-3 h-3" />
                            Equação do Momento
                          </p>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center bg-white/5 p-1.5 rounded-lg">
                              <span className="text-slate-400">Realizado (100%):</span>
                              <span className="font-bold font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(closedDealsTotal) || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-1.5 rounded-lg">
                              <span className="text-slate-400">Ponderado (Pipeline):</span>
                              <span className="font-bold font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(weightedPipelineValue) || 0)}</span>
                            </div>
                            <div className="h-px bg-white/10 my-1"></div>
                            <div className="flex justify-between items-center text-[10px] px-1">
                              <span className="font-bold text-emerald-400">Previsão Final:</span>
                              <span className="font-bold text-emerald-400 font-mono italic">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(forecastValue) || 0)}</span>
                            </div>
                          </div>
                          <p className="mt-3 text-[9px] text-slate-500 leading-tight">
                            * O valor ponderado é a soma de cada negócio multiplicado pela probabilidade de fechamento do seu respectivo estágio.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="w-7 h-7 bg-emerald-500/20 text-emerald-500 rounded-lg flex items-center justify-center">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
                <p className="text-2xl md:text-3xl font-light tracking-tight mb-1.5">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(forecastValue) || 0)}
                </p>
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                  Cálculo baseado no fechamento atual somado à probabilidade de conversão ponderada de cada estágio do funil.
                </p>
              </div>

              <div className="bg-white/5 rounded-xl md:rounded-2xl p-4 border border-white/10">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-7 h-7 bg-blue-500/20 text-blue-500 rounded-lg flex items-center justify-center">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Status da Meta</span>
                </div>
                <p className="text-xs font-medium leading-relaxed">
                  {progressPercentage >= 100 
                    ? "Meta atingida! Excelente trabalho! Sua previsão indica que você pode superar o objetivo em mais de " + 
                      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Math.max(0, (Number(forecastValue) || 0) - (Number(goalRevenue) || 0))) + "."
                    : "Você ainda tem " + (100 - progressPercentage) + "% para atingir seu objetivo. Foque nos estágios de negociação final para acelerar o fechamento."
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CustomRevenueTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const revenueVal = Number(payload[0].value) || 0;
    const dealsCount = payload[0].payload?.deals || 0;
    return (
      <div className="bg-slate-900 border border-slate-700/80 px-4 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative z-50 min-w-[140px] text-left">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5 mb-1.5">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-mono">{label}</p>
          {dealsCount > 0 && (
            <span className="text-[9px] font-bold bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-mono">
              {dealsCount} {dealsCount === 1 ? 'venda' : 'vendas'}
            </span>
          )}
        </div>
        <p className="text-sm font-black text-white tracking-tight font-mono">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(revenueVal)}
        </p>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700/80 px-3.5 py-2.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col gap-1 relative z-50 min-w-[150px] text-left">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 mb-0.5">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
          <span className="text-[11px] font-bold text-slate-200 tracking-wider uppercase font-mono">{data.name}</span>
        </div>
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="text-slate-400 font-medium">Negócios:</span>
          <span className="font-bold text-white font-mono">{data.value}</span>
        </div>
      </div>
    );
  }
  return null;
};

function ReportsView({ deals, contacts, progressPercentage }: { deals: Deal[], contacts: Contact[], progressPercentage: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Define color mapping for the chart to match STAGES colors
  const STAGE_COLORS: Record<string, string> = {
    blue: 'hsl(var(--primary))',
    purple: '#7C3AED',
    orange: '#EA580C',
    yellow: '#F59E0B',
    emerald: '#10B981',
    slate: '#64748B'
  };

  const getMonthlyRevenue = () => {
    const months = Array.from({ length: 6 }).map((_, i) => {
      const d = subMonths(new Date(), 5 - i);
      return {
        name: format(d, "MMM", { locale: ptBR }).replace('.', '').replace(/^./, (str) => str.toUpperCase()),
        monthKey: format(d, "yyyy-MM"),
        revenue: 0,
        deals: 0
      };
    });

    deals.forEach(deal => {
      if (deal.stage === 'closed' && deal.updatedAt) {
        try {
          const date = new Date(deal.updatedAt);
          if (date) {
            const key = format(date, "yyyy-MM");
            const month = months.find(m => m.monthKey === key);
            if (month) {
              month.revenue += deal.value || 0;
              month.deals += 1;
            }
          }
        } catch (e) {
          // Skip errors
        }
      }
    });
    return months;
  };

  const salesData = getMonthlyRevenue();
  
  // Dynamic stage distribution based on STAGES
  const stageData = STAGES.map(stage => ({
    name: stage.title,
    id: stage.id,
    color: STAGE_COLORS[stage.color] || STAGE_COLORS.slate,
    value: deals.filter(d => d.stage === stage.id).length
  })).filter(s => s.value > 0);

  // Filter deals to only include those in defined stages for the total count
  const validDeals = deals.filter(d => STAGES.some(s => s.id === d.stage));
  const closedDeals = validDeals.filter(d => d.stage === 'closed');
  const totalRevenue = closedDeals.reduce((acc, d) => acc + (d.value || 0), 0);
  const avgTicket = totalRevenue / (closedDeals.length || 1);
  const winRate = (closedDeals.length / (validDeals.length || 1)) * 100;
  
  // Pipeline Ativo: sum of deals in any stage except 'closed' (and only from valid STAGES)
  const activePipelineValue = validDeals
    .filter(d => d.stage !== 'closed')
    .reduce((acc, d) => acc + (d.value || 0), 0);

  return (
    <div className="space-y-10 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Faturamento Acumulado" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(totalRevenue) || 0)} 
          trend="+12.5% vs histórico"
          isPositive={true}
          description="Total gerado em negócios fechados."
          chartData={salesData.map(s => ({ value: s.revenue }))}
        />
        <MetricCard 
          title="Ticket Médio" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(avgTicket) || 0)} 
          trend="Equilíbrio de Vendas"
          isPositive={true}
          isNeutral={true}
          description="Valor médio por venda fechada."
          chartData={salesData.map(s => ({ value: s.deals }))}
        />
        <MetricCard 
          title="Taxa de Conversão" 
          value={`${winRate.toFixed(1)}%`} 
          trend="Eficiência do Funil"
          isPositive={winRate > 15}
          description="Porcentagem de leads que chegam ao status final."
          chartData={Array.from({ length: 12 }).map((_, i) => ({ value: 50 + Math.random() * 50 }))}
        />
        <MetricCard 
          title="Pipeline Ativo" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(activePipelineValue) || 0)} 
          trend="Oportunidades em aberto"
          isPositive={true}
          isNeutral={true}
          description="Valor total estacionado no funil (exceto vendidos)."
          chartData={Array.from({ length: 12 }).map((_, i) => ({ value: 50 + Math.random() * 50 }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-5">
        <div className="lg:col-span-2 bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-5 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Fluxo de Receita</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Sazonalidade das vendas (últimos 6 meses).</p>
          </div>
          <div className="h-[260px] md:h-[280px] w-full min-h-[260px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }}
                    dy={15}
                  />
                  <YAxis hide />
                  <Tooltip 
                    content={<CustomRevenueTooltip />}
                    wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-5 shadow-sm flex flex-col items-center justify-center">
          <div className="mb-5 w-full text-center">
            <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Fases do Funil</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-bold">Distribuição por Status</p>
          </div>
          <div className="h-[220px] md:h-[240px] w-full relative min-h-[220px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                  >
                    {stageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<CustomPieTooltip />}
                    wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-foreground">{validDeals.length}</span>
              <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Negócios</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 justify-center">
            {stageData.map((stage, i) => (
              <div key={stage.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">{stage.name}</span>
                <span className="text-[9.5px] font-bold text-muted-foreground/50 ml-0.5">{stage.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-5">
        <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-5 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Saúde da Carteira</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Eficiência multidimensional.</p>
          </div>
          <div className="h-[260px] md:h-[280px] w-full min-h-[260px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={[
                  { subject: 'Volume', A: winRate },
                  { subject: 'Ticket', A: Math.min((avgTicket/100000)*100, 100) },
                  { subject: 'Velocidade', A: 80 },
                  { subject: 'Retenção', A: 70 },
                  { subject: 'Meta', A: progressPercentage },
                ]}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} />
                  <Radar
                    name="Enterprise"
                    dataKey="A"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.1}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
               <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Performance Proativa</h3>
              <p className="text-xs text-muted-foreground">Acompanhamento vs Objetivos.</p>
            </div>
          </div>
          
          <div className="space-y-5">
            {['Volume de Leads', 'Vendas Diretas', 'Faturamento', 'Retorno ROI'].map((item, i) => {
              const val = [85, 40, 65, 30][i];
              return (
                <div key={item} className="space-y-2">
                  <div className="flex justify-between text-[9.5px] font-bold uppercase tracking-wider">
                    <span>{item}</span>
                    <span className={val > 50 ? 'text-emerald-500' : 'text-blue-500'}>{val}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${val}%` }}
                      className={cn("h-full rounded-full", val > 50 ? "bg-emerald-500" : "bg-primary")}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend, description, isNeutral, isPositive, chartData, variants }: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <motion.div 
      variants={variants}
      className="bg-card p-4 md:p-5 pb-3 rounded-2xl md:rounded-3xl border border-border shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all group relative h-full flex flex-col hover:z-30"
    >
      <div className="relative z-10 flex-1">
        <div className="flex items-start justify-between mb-1 md:mb-2 text-muted-foreground group-hover:text-primary transition-colors">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em]">{title}</p>
          {description && (
            <div className="relative group/info">
              <HelpCircle className="w-3 h-3 cursor-help opacity-40 hover:opacity-100 transition-opacity" />
              <div className="absolute right-0 top-full mt-2 w-64 p-3.5 bg-slate-900 dark:bg-slate-950 text-white text-[11px] rounded-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all duration-200 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-800 dark:border-slate-800/80 font-medium leading-relaxed normal-case tracking-normal -translate-y-1 group-hover/info:translate-y-0">
                {description}
              </div>
            </div>
          )}
        </div>
        <p className="text-2xl md:text-3xl font-light text-foreground tracking-tighter group-hover:text-primary transition-colors leading-none">{value}</p>
        
        <div className="mt-3 md:mt-4 flex items-center gap-2">
          {isNeutral ? (
            <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
              <Plus className="w-2.5 h-2.5" />
            </div>
          ) : isPositive ? (
            <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
               <ArrowUpRight className="w-2.5 h-2.5" />
            </div>
          ) : (
            <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg">
               <ArrowDownRight className="w-2.5 h-2.5" />
            </div>
          )}
          <div className="flex flex-col">
            <span className={`text-[10px] font-bold leading-none ${isNeutral ? 'text-primary' : isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
              {trend.split(' ')[0]}
            </span>
            <span className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-widest mt-0.5">{trend.split(' ').slice(1).join(' ')}</span>
          </div>
        </div>
      </div>

      {/* Sparkline in the background */}
      <div className="absolute inset-x-0 bottom-0 h-16 opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none overflow-hidden rounded-b-2xl md:rounded-b-3xl min-h-[64px]">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={isNeutral ? "hsl(var(--primary))" : isPositive ? "#10b981" : "#ef4444"} 
                strokeWidth={3} 
                dot={false}
                animationDuration={2000}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
