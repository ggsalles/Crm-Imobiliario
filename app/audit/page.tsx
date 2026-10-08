"use client";

import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { isPlatformAdmin } from "@/lib/constants";
import { getTenants } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { apiClient } from "@/lib/api-client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  RefreshCw, 
  Download, 
  Trash2, 
  ChevronRight, 
  ChevronLeft,
  Lock,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { safeGetItem, safeJsonParse } from "@/lib/safe-storage";

import { AuditLogItem } from "@/components/audit/types";
import { AuditStatsCards } from "@/components/audit/AuditStatsCards";
import { AuditFilterToolbar } from "@/components/audit/AuditFilterToolbar";
import { AuditTableRow } from "@/components/audit/AuditTableRow";
import { AuditInspectModal } from "@/components/audit/AuditInspectModal";
import { AuditClearModal } from "@/components/audit/AuditClearModal";

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
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selected Log Modal for inspection
  const [inspectingLog, setInspectingLog] = useState<AuditLogItem | null>(null);

  // Clear Logs Modal state
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const isMaster = Boolean(
    (profile?.email && isPlatformAdmin(profile.email)) || 
    (user?.email && isPlatformAdmin(user.email))
  );
  const isAdmin = Boolean(profile?.role === "Admin" || profile?.isAdmin || isMaster);

  // Reset pagination whenever search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTenant, selectedSeverity, selectedCategory, selectedDateRange, sortOrder, pageSize]);

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

  const tenantMap = useMemo(() => {
    const map: Record<string, string> = {};
    tenants.forEach(t => {
      if (t.id && t.name) map[t.id] = t.name;
    });
    return map;
  }, [tenants]);

  // Fetch logs
  const fetchLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (isMaster && selectedTenant !== "all") {
        params.set("tenantId", selectedTenant);
      } else if (!isMaster && profile?.tenantId) {
        params.set("tenantId", profile.tenantId);
      }

      params.set("limit", "500");

      const data = await apiClient.get<any>(`/api/audit?${params.toString()}`);
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (err: any) {
      console.error("[AuditPage] Erro ao buscar logs:", err);
      // Only toast error if not a transient unauthenticated during mount
      if (user && err?.status !== 401) {
        toast.error(err.message || "Erro ao atualizar auditoria.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isMaster, selectedTenant, profile?.tenantId, user]);

  // Clear audit logs handler
  const handleClearAuditLogs = useCallback(async () => {
    setIsClearing(true);
    try {
      const url = isMaster && selectedTenant && selectedTenant !== 'all'
        ? `/api/audit?tenantId=${selectedTenant}`
        : `/api/audit`;

      await apiClient.delete(url);

      toast.success("Tabela de logs de auditoria limpa com sucesso!");
      setIsClearModalOpen(false);
      await fetchLogs(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao limpar logs de auditoria.");
    } finally {
      setIsClearing(false);
    }
  }, [isMaster, selectedTenant, fetchLogs]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      fetchLogs();
    }
  }, [authLoading, user, isAdmin, fetchLogs]);

  // Filtered Logs calculation memoized
  const filteredLogs = useMemo(() => {
    const now = new Date().getTime();
    const q = searchQuery.toLowerCase().trim();

    const filtered = logs.filter(log => {
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
      if (q) {
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

    // Sorting
    return filtered.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
  }, [logs, selectedDateRange, selectedSeverity, selectedCategory, searchQuery, sortOrder]);

  // Paginated subset of logs for instant rendering
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Statistics calculation memoized
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
  const handleExportCSV = useCallback(() => {
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
  }, [filteredLogs]);

  const handleInspect = useCallback((log: AuditLogItem) => {
    setInspectingLog(log);
  }, []);

  // Unauthenticated guard
  if (authLoading || !user) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Redirecionando para login...</span>
        </div>
      </div>
    );
  }

  // Access check guard for authenticated non-admin users
  if (!isAdmin) {
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
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:bg-primary/90 transition-colors w-full cursor-pointer"
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-muted/60 hover:bg-muted text-foreground transition-all border border-border disabled:opacity-50 cursor-pointer"
                title="Recarregar registros"
              >
                <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} />
                Atualizar
              </button>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
              >
                <Download className="w-3 h-3" />
                Exportar Relatório (CSV)
              </button>

              {isMaster && (
                <button
                  onClick={() => setIsClearModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 transition-all shadow-xs cursor-pointer"
                  title="Limpar registros de auditoria (Exclusivo Master)"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpar Logs
                </button>
              )}
            </div>
          </div>

          {/* Stats KPI Cards */}
          <AuditStatsCards stats={stats} />
        </header>

        {/* Content Body */}
        <div className="p-3 sm:p-4 md:p-5 space-y-3.5 flex-1 max-w-7xl mx-auto w-full">
          {/* Filter Bar */}
          <AuditFilterToolbar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isMaster={isMaster}
            selectedTenant={selectedTenant}
            setSelectedTenant={setSelectedTenant}
            tenants={tenants}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedSeverity={selectedSeverity}
            setSelectedSeverity={setSelectedSeverity}
            selectedDateRange={selectedDateRange}
            setSelectedDateRange={setSelectedDateRange}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
          />

          {/* Table Container */}
          <div className="rounded-xl bg-card border border-border shadow-xs overflow-hidden flex flex-col">
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
                  Não foram encontrados registros para os filtros selecionados.
                </p>
              </div>
            ) : (
              <>
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
                      {paginatedLogs.map((log) => (
                        <AuditTableRow
                          key={log.id}
                          log={log}
                          isMaster={isMaster}
                          tenantName={log.tenant_id ? tenantMap[log.tenant_id] : undefined}
                          onInspect={handleInspect}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground font-medium text-[11px]">
                    <span>
                      Mostrando {Math.min((currentPage - 1) * pageSize + 1, filteredLogs.length)} a {Math.min(currentPage * pageSize, filteredLogs.length)} de {filteredLogs.length} eventos
                    </span>
                    <span className="text-border">|</span>
                    <div className="flex items-center gap-1">
                      <span>Exibir:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="bg-card border border-border rounded-md px-1.5 py-0.5 text-[11px] font-bold focus:outline-none cursor-pointer"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2.5 py-1 text-xs font-bold text-foreground">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage >= totalPages}
                      className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                      title="Próxima página"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Log Details Modal */}
      <AuditInspectModal
        log={inspectingLog}
        onClose={() => setInspectingLog(null)}
      />

      {/* Confirmation Modal to Clear Audit Logs - Exclusivo Master */}
      <AuditClearModal
        isOpen={isMaster && isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleClearAuditLogs}
        isClearing={isClearing}
        totalLogsCount={logs.length}
      />
    </div>
  );
}
