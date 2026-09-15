"use client";

export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { isPlatformAdmin } from "@/lib/constants";
import { getActionMeta, AuditSeverity } from "@/lib/audit";
import { getTenants } from "@/lib/db";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  Filter, 
  RefreshCw, 
  Download, 
  AlertTriangle, 
  Clock, 
  User, 
  Globe, 
  Laptop, 
  CheckCircle2, 
  FileSpreadsheet, 
  Trash2, 
  Eye, 
  Key, 
  Building2, 
  ChevronRight, 
  X,
  Lock,
  ArrowUpDown,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AuditLogItem {
  id: string;
  type: string;
  category: string;
  title: string;
  content: string;
  author_name: string;
  created_by: string;
  owner_id: string;
  created_at: string;
  tenant_id: string;
  metadata?: {
    action?: string;
    severity?: AuditSeverity;
    entityType?: string;
    ip?: string;
    userAgent?: string;
    userEmail?: string;
    details?: any;
    [key: string]: any;
  };
}

export default function AuditPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDateRange, setSelectedDateRange] = useState<string>("30d");

  // Selected Log Modal for inspection
  const [inspectingLog, setInspectingLog] = useState<AuditLogItem | null>(null);

  const isMaster = Boolean(profile?.email && isPlatformAdmin(profile.email));
  const isAdmin = Boolean(profile?.role === "Admin" || profile?.isAdmin || isMaster);

  // Load tenants for master
  useEffect(() => {
    if (isMaster) {
      getTenants().then(tList => {
        if (Array.isArray(tList)) {
          setTenants(tList);
        }
      }).catch(err => console.warn("Erro ao carregar lista de tenants:", err));
    }
  }, [isMaster]);

  // Fetch logs
  const fetchLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      let rawSession: string | null = null;
      if (typeof window !== "undefined") {
        rawSession = window.sessionStorage.getItem("crm-imob-session-v5") ||
                     window.sessionStorage.getItem("crm-imob-session-v4") ||
                     window.localStorage.getItem("crm-imob-session-v4");
      }

      let authHeader = "";
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          if (parsed?.access_token) {
            authHeader = `Bearer ${parsed.access_token}`;
          }
        } catch {}
      }

      const params = new URLSearchParams();
      if (isMaster && selectedTenant !== "all") {
        params.set("tenantId", selectedTenant);
      } else if (!isMaster && profile?.tenantId) {
        params.set("tenantId", profile.tenantId);
      }

      params.set("limit", "250");

      const res = await fetch(`/api/audit?${params.toString()}`, {
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {})
        }
      });

      if (!res.ok) {
        if (res.status === 403) {
          toast.error("Acesso restrito a administradores.");
          return;
        }
        throw new Error("Falha ao consultar trilha de auditoria.");
      }

      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err: any) {
      console.error("[AuditPage] Erro ao buscar logs:", err);
      toast.error(err.message || "Erro ao atualizar auditoria.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isMaster, selectedTenant, profile?.tenantId]);

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      fetchLogs();
    }
  }, [authLoading, user, isAdmin, fetchLogs]);

  // Filtered Logs calculation
  const filteredLogs = useMemo(() => {
    const now = new Date().getTime();

    return logs.filter(log => {
      // Date filter
      if (selectedDateRange !== "all") {
        const logTime = new Date(log.created_at).getTime();
        const diffHours = (now - logTime) / (1000 * 60 * 60);

        if (selectedDateRange === "24h" && diffHours > 24) return false;
        if (selectedDateRange === "7d" && diffHours > 24 * 7) return false;
        if (selectedDateRange === "30d" && diffHours > 24 * 30) return false;
      }

      // Severity filter
      const logSeverity = log.metadata?.severity || "info";
      if (selectedSeverity !== "all" && logSeverity !== selectedSeverity) {
        return false;
      }

      // Category filter
      const action = log.metadata?.action || "";
      if (selectedCategory !== "all") {
        if (selectedCategory === "export" && !action.includes("EXPORT")) return false;
        if (selectedCategory === "deletion" && !action.includes("DELETE")) return false;
        if (selectedCategory === "sensitive_view" && !action.includes("VIEW_SENSITIVE")) return false;
        if (selectedCategory === "auth" && !action.includes("LOGIN") && !action.includes("LOGOUT")) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const author = (log.author_name || "").toLowerCase();
        const title = (log.title || "").toLowerCase();
        const content = (log.content || "").toLowerCase();
        const ip = (log.metadata?.ip || "").toLowerCase();
        const email = (log.metadata?.userEmail || "").toLowerCase();
        const actionStr = (log.metadata?.action || "").toLowerCase();

        return (
          author.includes(q) ||
          title.includes(q) ||
          content.includes(q) ||
          ip.includes(q) ||
          email.includes(q) ||
          actionStr.includes(q)
        );
      }

      return true;
    });
  }, [logs, selectedDateRange, selectedSeverity, selectedCategory, searchQuery]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = logs.length;
    let criticalCount = 0;
    let exportCount = 0;
    let sensitiveCount = 0;
    let authCount = 0;

    logs.forEach(log => {
      const act = log.metadata?.action || "";
      const sev = log.metadata?.severity || "info";

      if (sev === "critical" || sev === "high" || act.includes("DELETE") || act.includes("EXPORT")) {
        criticalCount++;
      }
      if (act.includes("EXPORT")) {
        exportCount++;
      }
      if (act.includes("VIEW_SENSITIVE")) {
        sensitiveCount++;
      }
      if (act.includes("LOGIN") || act.includes("LOGOUT")) {
        authCount++;
      }
    });

    return { total, criticalCount, exportCount, sensitiveCount, authCount };
  }, [logs]);

  // Export audit report to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.info("Nenhum registro para exportar.");
      return;
    }

    const headers = [
      "ID",
      "Data e Hora (ISO)",
      "Acao",
      "Gravidade",
      "Titulo",
      "Descricao",
      "Usuario Responsavel",
      "Email",
      "IP Origem",
      "Navegador",
      "Imobiliaria Tenant ID"
    ];

    const rows = filteredLogs.map(log => [
      `"${log.id}"`,
      `"${log.created_at}"`,
      `"${log.metadata?.action || 'AUDIT'}"`,
      `"${log.metadata?.severity || 'info'}"`,
      `"${(log.title || '').replace(/"/g, '""')}"`,
      `"${(log.content || '').replace(/"/g, '""')}"`,
      `"${(log.author_name || '').replace(/"/g, '""')}"`,
      `"${(log.metadata?.userEmail || '').replace(/"/g, '""')}"`,
      `"${log.metadata?.ip || 'N/A'}"`,
      `"${(log.metadata?.userAgent || 'N/A').replace(/"/g, '""')}"`,
      `"${log.tenant_id || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trilha-auditoria-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Relatório de auditoria exportado com sucesso.");
  };

  // Access check guard
  if (!authLoading && (!user || !isAdmin)) {
    return (
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="max-w-md w-full p-8 rounded-2xl bg-card border border-border shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto ring-1 ring-rose-500/20">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Acesso Restrito à Auditoria</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Esta área contém os registros forenses e a trilha de segurança do sistema. O acesso é exclusivo para 
              <strong> Administradores da Imobiliária</strong> e o <strong>Usuário Master</strong>.
            </p>
            <button 
              onClick={() => router.push('/')}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:bg-primary/90 transition-colors w-full"
            >
              Voltar ao Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Top Header */}
        <header className="p-3.5 sm:p-4 md:p-5 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20 shrink-0 pl-14 md:pl-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-base md:text-lg font-bold tracking-tight flex items-center gap-2">
                    Trilha de Auditoria & Segurança
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20 uppercase tracking-wider">
                      LGPD Compliance
                    </span>
                  </h1>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Rastreabilidade completa de exportações, visualizações sensíveis, alterações e acessos por usuário.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLogs(true)}
                disabled={refreshing || loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-muted/60 hover:bg-muted text-foreground transition-all border border-border disabled:opacity-50"
                title="Recarregar registros"
              >
                <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} />
                Atualizar
              </button>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
              >
                <Download className="w-3 h-3" />
                Exportar Relatório (CSV)
              </button>
            </div>
          </div>

          {/* Stats KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5">
            <div className="p-2.5 sm:p-3 rounded-lg bg-card border border-border shadow-xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">Total Auditado</p>
                <p className="text-base sm:text-lg font-black text-foreground">{stats.total}</p>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-lg bg-card border border-border shadow-xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">Ações Críticas</p>
                <p className="text-base sm:text-lg font-black text-rose-500">{stats.criticalCount}</p>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-lg bg-card border border-border shadow-xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">Exportações Base</p>
                <p className="text-base sm:text-lg font-black text-amber-500">{stats.exportCount}</p>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-lg bg-card border border-border shadow-xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Key className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">Autenticações</p>
                <p className="text-base sm:text-lg font-black text-emerald-500">{stats.authCount}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-3 sm:p-4 md:p-5 space-y-3.5 flex-1 max-w-7xl mx-auto w-full">
          {/* Filter Bar */}
          <div className="p-3 rounded-xl bg-card border border-border shadow-xs space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-2.5">
              {/* Search input */}
              <div className="lg:col-span-2 relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por corretor, IP, ação ou descrição..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Master Tenant Filter */}
              {isMaster && (
                <div>
                  <select
                    value={selectedTenant}
                    onChange={(e) => setSelectedTenant(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-medium"
                  >
                    <option value="all">Todas as Imobiliárias (Global)</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        Imobiliária: {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-medium"
                >
                  <option value="all">Todas as Categorias</option>
                  <option value="export">Exportações de Dados (CSV)</option>
                  <option value="deletion">Exclusões de Registros</option>
                  <option value="sensitive_view">Visualizações Sensíveis</option>
                  <option value="auth">Acessos & Logins</option>
                </select>
              </div>

              {/* Severity Filter */}
              <div>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-medium"
                >
                  <option value="all">Todas as Gravidades</option>
                  <option value="critical">Crítica (Exclusões/Exportações)</option>
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="info">Informativa</option>
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-medium"
                >
                  <option value="24h">Últimas 24 Horas</option>
                  <option value="7d">Últimos 7 Dias</option>
                  <option value="30d">Últimos 30 Dias</option>
                  <option value="all">Todo o Período Histórico</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-xl bg-card border border-border shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                <p className="text-xs font-semibold text-muted-foreground">Consultando trilha forense imutável...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-14 flex flex-col items-center justify-center text-center px-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground mb-2.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Nenhum evento registrado</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-0.5">
                  Não foram encontrados registros para os filtros selecionados. Conforme os usuários realizam ações críticas, elas aparecerão aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider text-[9px]">
                      <th className="py-2.5 px-3">Carimbo de Data/Hora</th>
                      <th className="py-2.5 px-3">Usuário Responsável</th>
                      <th className="py-2.5 px-3">Ação Realizada</th>
                      <th className="py-2.5 px-3">Descrição do Evento</th>
                      <th className="py-2.5 px-3">Endereço IP / Dispositivo</th>
                      <th className="py-2.5 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLogs.map((log) => {
                      const action = log.metadata?.action || "GENERAL_AUDIT";
                      const meta = getActionMeta(action);
                      const formattedDate = new Date(log.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      });

                      const ip = log.metadata?.ip || "127.0.0.1";
                      const userAgent = log.metadata?.userAgent || "Navegador";
                      const isMobile = /mobile|android|iphone/i.test(userAgent);

                      return (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors group">
                          {/* Date & Time */}
                          <td className="py-2 sm:py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1 font-mono text-[10px] sm:text-[11px] text-foreground">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span>{formattedDate}</span>
                            </div>
                          </td>

                          {/* User */}
                          <td className="py-2 sm:py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px]">
                                {log.author_name?.slice(0, 1).toUpperCase() || "U"}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-foreground truncate max-w-[130px] text-xs">{log.author_name || "Sistema"}</p>
                                <p className="text-[9px] text-muted-foreground truncate max-w-[130px]">{log.metadata?.userEmail || ""}</p>
                              </div>
                            </div>
                          </td>

                          {/* Action Badge */}
                          <td className="py-2 sm:py-2.5 px-3 whitespace-nowrap">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border",
                              meta.bg,
                              meta.color
                            )}>
                              {meta.label}
                            </span>
                          </td>

                          {/* Content / Description */}
                          <td className="py-2 sm:py-2.5 px-3">
                            <p className="text-foreground font-medium line-clamp-1 max-w-[280px] text-xs" title={log.content}>
                              {log.content || log.title}
                            </p>
                          </td>

                          {/* IP & Device */}
                          <td className="py-2 sm:py-2.5 px-3 whitespace-nowrap">
                            <div className="flex flex-col text-[9px] font-mono">
                              <span className="text-foreground flex items-center gap-1">
                                <Globe className="w-2.5 h-2.5 text-muted-foreground" />
                                {ip}
                              </span>
                              <span className="text-muted-foreground text-[8px] flex items-center gap-1 mt-0.5">
                                <Laptop className="w-2.5 h-2.5 text-muted-foreground" />
                                {isMobile ? "Dispositivo Móvel" : "Desktop / Web"}
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-2 sm:py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => setInspectingLog(log)}
                              className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
                            >
                              Inspecionar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Log Details Modal */}
      {inspectingLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">Registro Forense de Auditoria</h3>
                  <p className="text-[9px] font-mono text-muted-foreground">ID: {inspectingLog.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setInspectingLog(null)}
                className="w-6 h-6 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border">
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Ação Registrada</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">{inspectingLog.metadata?.action || inspectingLog.title}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Data e Hora Exata</p>
                  <p className="text-xs font-mono font-medium text-foreground mt-0.5">
                    {new Date(inspectingLog.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Usuário Responsável</p>
                  <p className="text-xs font-semibold text-foreground mt-0.5">{inspectingLog.author_name || "Sistema"}</p>
                  <p className="text-[9px] text-muted-foreground">{inspectingLog.metadata?.userEmail || ""}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Endereço IP Origem</p>
                  <p className="text-xs font-mono font-medium text-foreground mt-0.5">{inspectingLog.metadata?.ip || "127.0.0.1"}</p>
                </div>
              </div>

              <div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Descrição Completa</p>
                <div className="p-2.5 rounded-xl bg-background border border-border text-foreground leading-relaxed text-xs">
                  {inspectingLog.content || inspectingLog.title}
                </div>
              </div>

              <div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">User-Agent / Navegador</p>
                <div className="p-2 rounded-xl bg-background border border-border font-mono text-[9px] text-muted-foreground break-all">
                  {inspectingLog.metadata?.userAgent || "Não informado"}
                </div>
              </div>

              {inspectingLog.metadata && Object.keys(inspectingLog.metadata).length > 0 && (
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Payload de Metadados / Diff</p>
                  <pre className="p-2.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[10px] overflow-x-auto border border-border/50">
                    {JSON.stringify(inspectingLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
              <button
                onClick={() => setInspectingLog(null)}
                className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
