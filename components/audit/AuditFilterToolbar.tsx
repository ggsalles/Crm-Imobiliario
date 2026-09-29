"use client";

import { Search, X, ArrowUpDown } from "lucide-react";

interface AuditFilterToolbarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isMaster: boolean;
  selectedTenant: string;
  setSelectedTenant: (val: string) => void;
  tenants: any[];
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  selectedSeverity: string;
  setSelectedSeverity: (val: string) => void;
  selectedDateRange: string;
  setSelectedDateRange: (val: string) => void;
  sortOrder: "desc" | "asc";
  setSortOrder: React.Dispatch<React.SetStateAction<"desc" | "asc">>;
}

export function AuditFilterToolbar({
  searchQuery,
  setSearchQuery,
  isMaster,
  selectedTenant,
  setSelectedTenant,
  tenants,
  selectedCategory,
  setSelectedCategory,
  selectedSeverity,
  setSelectedSeverity,
  selectedDateRange,
  setSelectedDateRange,
  sortOrder,
  setSortOrder
}: AuditFilterToolbarProps) {
  return (
    <div className="p-3 rounded-xl bg-card border border-border shadow-xs space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-2.5">
        {/* Search input */}
        <div className="lg:col-span-2 relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por corretor, IP, ação ou descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Master Tenant Filter */}
        {isMaster ? (
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
        ) : null}

        {/* Category Filter */}
        <div className={!isMaster ? "lg:col-span-1" : ""}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-medium"
          >
            <option value="all">Todas as Categorias</option>
            <option value="export">Exportações (CSV)</option>
            <option value="deletion">Exclusões</option>
            <option value="sensitive_view">Dados Sensíveis</option>
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
            <option value="critical">Crítica</option>
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
            <option value="all">Todo o Histórico</option>
          </select>
        </div>

        {/* Sort Order Toggle */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-background border border-border hover:bg-muted text-foreground transition-all cursor-pointer"
            title="Alternar ordem cronológica"
          >
            <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
            <span>{sortOrder === "desc" ? "Mais recentes" : "Mais antigos"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
