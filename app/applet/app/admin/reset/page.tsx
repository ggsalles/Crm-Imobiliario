"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { 
  Building2, 
  Trash2, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  RotateCcw, 
  Calendar, 
  Kanban, 
  Users, 
  Home, 
  MessageSquare, 
  Target, 
  FileText, 
  UserMinus, 
  ShieldCheck, 
  ArrowLeft,
  RefreshCw,
  Loader2,
  Lock,
  Flame,
  Check,
  X
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getTenants, clearLocalCache, forceDataResync } from "@/lib/db";
import Link from "next/link";
import { PLATFORM_ADMIN_EMAIL } from "@/lib/constants";
import { Sidebar } from "@/components/sidebar";

interface EntityOption {
  id: string;
  name: string;
  description: string;
  icon: any;
  defaultChecked: boolean;
  color: string;
}

const ENTITY_OPTIONS: EntityOption[] = [
  {
    id: "activities",
    name: "Atividades & Calendário",
    description: "Tarefas, ligações, visitas, anotações e compromissos do calendário.",
    icon: Calendar,
    defaultChecked: true,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20"
  },
  {
    id: "deals",
    name: "Pipeline (Negócios)",
    description: "Cards de negociação e oportunidades em todos os estágios do funil.",
    icon: Kanban,
    defaultChecked: true,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20"
  },
  {
    id: "contacts",
    name: "Clientes & Leads",
    description: "Base de contatos, clientes compradores, proprietários e leads.",
    icon: Users,
    defaultChecked: true,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20"
  },
  {
    id: "companies",
    name: "Empresas",
    description: "Empresas e pessoas jurídicas parceiras cadastradas.",
    icon: Building2,
    defaultChecked: true,
    color: "text-sky-500 bg-sky-500/10 border-sky-500/20"
  },
  {
    id: "properties",
    name: "Imóveis & Fotos",
    description: "Catálogo completo de imóveis da carteira, fotos e galeria.",
    icon: Home,
    defaultChecked: true,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
  },
  {
    id: "messages",
    name: "Mensagens & Chat",
    description: "Histórico de conversas, canais de chat e mensagens internas.",
    icon: MessageSquare,
    defaultChecked: true,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20"
  },
  {
    id: "goals",
    name: "Metas Comerciais",
    description: "Metas mensais de vendas e faturamento configuradas.",
    icon: Target,
    defaultChecked: true,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/20"
  },
  {
    id: "timeline",
    name: "Trilha de Auditoria (LGPD) & Logs",
    description: "Histórico completo de auditoria, eventos de segurança, acessos, logins e rastreabilidade.",
    icon: FileText,
    defaultChecked: true,
    color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20"
  },
  {
    id: "members",
    name: "Usuários (Membros / Equipe)",
    description: "Exclui corretores e membros da equipe (preserva seu usuário e administradores).",
    icon: UserMinus,
    defaultChecked: true,
    color: "text-red-500 bg-red-500/10 border-red-500/20"
  }
];

export default function AdminResetPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [selectedScope, setSelectedScope] = useState<"current" | "all">("current");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedEntities, setSelectedEntities] = useState<string[]>(
    ENTITY_OPTIONS.map((e) => e.id)
  );

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  // Modal de confirmação
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  const isMaster = user?.email?.trim().toLowerCase() === PLATFORM_ADMIN_EMAIL.toLowerCase();

  // Carrega imobiliárias
  useEffect(() => {
    async function loadData() {
      try {
        const tList = await getTenants();
        setTenants(tList);
        if (profile?.tenantId) {
          setSelectedTenantId(profile.tenantId);
        } else if (tList.length > 0) {
          setSelectedTenantId(tList[0].id);
        }
      } catch (err) {
        console.error("Erro ao carregar tenants:", err);
      }
    }
    if (isMaster) {
      loadData();
    }
  }, [isMaster, profile?.tenantId]);

  // Carrega contagens do banco
  const fetchCounts = useCallback(async () => {
    if (!isMaster) return;
    setIsLoadingCounts(true);
    try {
      const url = `/api/admin/reset?scope=${selectedScope}&tenantId=${selectedTenantId}`;
      const res = await apiFetch(url);
      if (res && res.counts) {
        setCounts(res.counts);
      }
    } catch (err: any) {
      console.warn("Erro ao buscar contagens:", err);
    } finally {
      setIsLoadingCounts(false);
    }
  }, [isMaster, selectedScope, selectedTenantId]);

  useEffect(() => {
    if (selectedTenantId || selectedScope === "all") {
      fetchCounts();
    }
  }, [selectedTenantId, selectedScope, fetchCounts]);

  const toggleEntity = (id: string) => {
    setSelectedEntities((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedEntities(ENTITY_OPTIONS.map((e) => e.id));
  };

  const deselectAll = () => {
    setSelectedEntities([]);
  };

  const handleOpenConfirmModal = () => {
    if (selectedEntities.length === 0) {
      toast.error("Selecione pelo menos uma área para limpar.");
      return;
    }
    setConfirmInput("");
    setIsConfirmModalOpen(true);
  };

  const isConfirmationValid = confirmInput.trim().toUpperCase().replace(/\s+/g, " ") === "ZERAR TUDO";

  const handleExecuteReset = async () => {
    if (!isConfirmationValid) {
      toast.error('Digite "ZERAR TUDO" para autorizar a limpeza.');
      return;
    }

    setIsExecuting(true);
    try {
      const res = await apiFetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationText: "ZERAR TUDO",
          scope: selectedScope,
          tenantId: selectedScope === "current" ? selectedTenantId : undefined,
          entities: selectedEntities
        })
      });

      if (res.success) {
        setExecutionResult(res);
        toast.success("Limpeza concluída com sucesso!");
        clearLocalCache();
        forceDataResync();
        if (typeof window !== 'undefined') {
          try {
            Object.keys(sessionStorage).forEach((k) => {
              if (k.startsWith('db-cache:')) sessionStorage.removeItem(k);
            });
            Object.keys(localStorage).forEach((k) => {
              if (k.startsWith('db-cache:') || k.startsWith('crm_') || k.includes('insights') || k.startsWith('pipeline_')) {
                localStorage.removeItem(k);
              }
            });
          } catch {}
        }
        fetchCounts();
      } else {
        throw new Error(res.error || "Falha ao executar limpeza.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro durante a execução do reset.");
    } finally {
      setIsExecuting(false);
    }
  };

  // Se não estiver autenticado ou não for o master
  if (authLoading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isMaster) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-foreground mb-2">Acesso Restrito ao Desenvolvedor</h1>
          <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
            Esta área é de uso exclusivo do desenvolvedor master ({PLATFORM_ADMIN_EMAIL}) para testes e reinicialização controlada do sistema.
          </p>
          <Link
            href="/"
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            Voltar ao Dashboard
          </Link>
        </main>
      </div>
    );
  }

  const currentTenantObj = tenants.find((t) => t.id === selectedTenantId);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold mb-1">
                <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
                <span>/</span>
                <span className="text-foreground">Zerar APP (Dev Master)</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
                <RotateCcw className="w-6 h-6 text-rose-500" />
                Script de Limpeza do CRM
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Área exclusiva para reinicializar os dados de demonstração e testes operacionais.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={fetchCounts}
                disabled={isLoadingCounts}
                className="px-3 py-1.5 border border-border bg-card rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Atualizar contagem de registros"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCounts ? "animate-spin" : ""}`} />
                Atualizar Contadores
              </button>
              <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-[11px] font-black tracking-wider uppercase font-mono">
                {PLATFORM_ADMIN_EMAIL}
              </div>
            </div>
          </div>

          {/* Banner de Aviso e Segurança */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-amber-500 text-sm">
                Atenção: Ação Irreversível de Testes
              </h4>
              <p className="text-muted-foreground leading-relaxed">
                Este script remove os dados operacionais das tabelas selecionadas. Use para deixar a imobiliária 100% limpa para um novo ciclo de demonstração.
              </p>
            </div>
          </div>

          {/* Passo 1: Definição de Escopo */}
          <section className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">1</span>
                Escopo da Limpeza
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label 
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  selectedScope === "current" 
                    ? "bg-primary/5 border-primary ring-1 ring-primary/20" 
                    : "bg-muted/20 border-border hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="current"
                  checked={selectedScope === "current"}
                  onChange={() => setSelectedScope("current")}
                  className="mt-0.5 text-primary accent-primary cursor-pointer"
                />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">Imobiliária Específica (Recomendado)</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Limpa apenas os dados vinculados à imobiliária selecionada abaixo.
                  </p>
                  {selectedScope === "current" && (
                    <div className="pt-2">
                      <select
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {tenants.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.id.slice(0, 8)}...)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </label>

              <label 
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  selectedScope === "all" 
                    ? "bg-rose-500/5 border-rose-500 ring-1 ring-rose-500/20" 
                    : "bg-muted/20 border-border hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={selectedScope === "all"}
                  onChange={() => setSelectedScope("all")}
                  className="mt-0.5 text-rose-500 accent-rose-500 cursor-pointer"
                />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-rose-500 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5" />
                    Todas as Imobiliárias (Global)
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Aplica a limpeza em todas as imobiliárias cadastradas no sistema simultaneamente.
                  </p>
                </div>
              </label>
            </div>
          </section>

          {/* Passo 2: Seleção das Áreas */}
          <section className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">2</span>
                Selecione as Áreas para Limpeza
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  Marcar Todos
                </button>
                <span className="text-muted-foreground text-xs">•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ENTITY_OPTIONS.map((ent) => {
                const Icon = ent.icon;
                const isChecked = selectedEntities.includes(ent.id);
                const count = counts[ent.id] !== undefined ? counts[ent.id] : null;

                return (
                  <div
                    key={ent.id}
                    onClick={() => toggleEntity(ent.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                      isChecked
                        ? "bg-card border-border shadow-sm ring-1 ring-primary/20"
                        : "bg-muted/15 border-border/50 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by div
                      className="mt-1 rounded border-border text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-foreground truncate">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${ent.color.split(" ")[0]}`} />
                          <span className="truncate">{ent.name}</span>
                        </div>
                        {count !== null && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">
                            {count} {count === 1 ? "item" : "itens"}
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] text-muted-foreground leading-snug line-clamp-2">
                        {ent.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* O que é preservado */}
          <section className="bg-card rounded-2xl border border-border p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              O que NÃO será apagado (Preservado e Seguro)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                <p className="font-bold text-emerald-500">🛡️ Conta Master</p>
                <p className="text-[11px] text-muted-foreground">
                  Seu login <strong>{PLATFORM_ADMIN_EMAIL}</strong> e os perfis administradores gerais nunca são deletados.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                <p className="font-bold text-emerald-500">🏢 Estrutura da Imobiliária</p>
                <p className="text-[11px] text-muted-foreground">
                  Registro da empresa (CNPJ, nome, slug, logotipo e configurações básicas) continua intacto.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                <p className="font-bold text-emerald-500">💳 Gestão SaaS & Licenças</p>
                <p className="text-[11px] text-muted-foreground">
                  Planos contratados, faturas, chave PIX e limites de usuários continuam configurados.
                </p>
              </div>
            </div>
          </section>

          {/* Botão de Disparo */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/"
              className="px-4 py-2.5 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
            >
              Cancelar
            </Link>
            <button
              type="button"
              onClick={handleOpenConfirmModal}
              disabled={selectedEntities.length === 0}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Prosseguir com a Limpeza ({selectedEntities.length} áreas)
            </button>
          </div>
        </div>
      </main>

      {/* Modal de Confirmação em Duas Etapas */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-rose-500/30 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-border bg-rose-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Confirmação Crítica</h3>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-rose-500">
                    Ação definitiva de limpeza
                  </p>
                </div>
              </div>
              {!isExecuting && (
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Conteúdo */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 border border-border">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">Escopo:</span>
                  <span className="font-bold text-foreground">
                    {selectedScope === "current"
                      ? `Imobiliária "${currentTenantObj?.name || selectedTenantId}"`
                      : "Todas as Imobiliárias (Global)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">Áreas selecionadas:</span>
                  <span className="font-bold text-rose-500">
                    {selectedEntities.length} de {ENTITY_OPTIONS.length} áreas
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-foreground block">
                    Para confirmar, digite exatamente <strong className="text-rose-500 select-all font-mono">ZERAR TUDO</strong>:
                  </label>
                  <button
                    type="button"
                    onClick={() => setConfirmInput("ZERAR TUDO")}
                    className="text-[11px] font-bold text-rose-500 hover:text-rose-400 hover:underline cursor-pointer bg-rose-500/10 px-2 py-0.5 rounded-md"
                  >
                    Auto-preencher
                  </button>
                </div>
                <input
                  type="text"
                  autoFocus
                  placeholder="ZERAR TUDO"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isConfirmationValid && !isExecuting) {
                      e.preventDefault();
                      handleExecuteReset();
                    }
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-mono font-bold text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-rose-500/30 text-rose-500 placeholder:text-muted-foreground/40"
                />
              </div>

              {executionResult && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1.5">
                  <p className="font-bold text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Limpeza Concluída!
                  </p>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    {Object.entries(executionResult.results || {}).map(([key, val]: [string, any]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key}:</span>
                        <span className="font-mono font-bold text-foreground">
                          {val.deleted} removidos
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex items-center gap-2">
              {executionResult ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmModalOpen(false);
                    window.location.href = "/";
                  }}
                  className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-md"
                >
                  Concluir e Ir para o Dashboard
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isExecuting}
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="flex-1 py-2 border border-border hover:bg-muted text-muted-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={isExecuting || !isConfirmationValid}
                    onClick={handleExecuteReset}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-600/20"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Zerando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        Confirmar e Zerar
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
