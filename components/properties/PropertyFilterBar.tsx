"use client";

import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  X, 
  Star, 
  SlidersHorizontal, 
  RotateCcw, 
  Tag, 
  Check, 
  Home, 
  Building, 
  Briefcase, 
  TreePine, 
  Plus 
} from "lucide-react";
import { Property } from "@/lib/db";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { recordAuditEvent } from "@/lib/audit";
import { POPULAR_PROPERTY_TAGS } from "@/lib/property-tags";

interface PropertyFilterBarProps {
  search: string;
  setSearch: (s: string) => void;
  searchStreet: string;
  setSearchStreet: (s: string) => void;
  selectedNeighborhood: string;
  setSelectedNeighborhood: (s: string) => void;
  availableNeighborhoods: string[];
  bedroomsFilter: string;
  setBedroomsFilter: (s: string) => void;
  parkingFilter: string;
  setParkingFilter: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  displayMinPrice: string;
  setDisplayMinPrice: (s: string) => void;
  displayMaxPrice: string;
  setDisplayMaxPrice: (s: string) => void;
  onlyFeaturedFilter: boolean;
  setOnlyFeaturedFilter: (b: boolean) => void;
  isFilterOpen: boolean;
  setIsFilterOpen: (b: boolean) => void;
  filterType: string;
  setFilterType: (t: string) => void;
  selectedFilterTags: string[];
  setSelectedFilterTags: (tags: string[] | ((prev: string[]) => string[])) => void;
  properties: Property[];
  activeFiltersCount: number;
  clearAllFilters: () => void;
  setPricePreset: (min: number | null, max: number | null) => void;
}

export function PropertyFilterBar({
  search,
  setSearch,
  searchStreet,
  setSearchStreet,
  selectedNeighborhood,
  setSelectedNeighborhood,
  availableNeighborhoods,
  bedroomsFilter,
  setBedroomsFilter,
  parkingFilter,
  setParkingFilter,
  statusFilter,
  setStatusFilter,
  displayMinPrice,
  setDisplayMinPrice,
  displayMaxPrice,
  setDisplayMaxPrice,
  onlyFeaturedFilter,
  setOnlyFeaturedFilter,
  isFilterOpen,
  setIsFilterOpen,
  filterType,
  setFilterType,
  selectedFilterTags,
  setSelectedFilterTags,
  properties,
  activeFiltersCount,
  clearAllFilters,
  setPricePreset
}: PropertyFilterBarProps) {
  return (
    <div className="space-y-3">
      {/* Omni-Search Box & Quick Action Buttons */}
      <div className="bg-card border border-border/80 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Omni-Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar por nome, edifício/condomínio, rua, bairro, código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim().length >= 2) {
                  recordAuditEvent({
                    action: 'SEARCH_PROPERTIES',
                    title: 'Busca Textual no Catálogo',
                    content: `Pesquisa realizada no catálogo de imóveis pelo termo: "${search.trim()}".`,
                    severity: 'low',
                    category: 'modification',
                    metadata: {
                      query: search.trim()
                    }
                  });
                }
              }}
              className="w-full pl-10 pr-9 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
            {search && (
              <button 
                type="button" 
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const nextState = !onlyFeaturedFilter;
                setOnlyFeaturedFilter(nextState);
                if (nextState) {
                  recordAuditEvent({
                    action: 'SEARCH_PROPERTIES',
                    title: 'Pesquisa por Imóveis em Destaque',
                    content: 'Usuário aplicou o filtro de consulta para visualizar apenas Imóveis em Destaque.',
                    severity: 'low',
                    category: 'modification',
                    metadata: {
                      filter: 'onlyFeatured',
                      active: true
                    }
                  });
                }
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                onlyFeaturedFilter
                  ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-amber-500 border-border"
              )}
              title={onlyFeaturedFilter ? "Exibindo apenas destaques (clique para ver todos)" : "Filtrar apenas imóveis em destaque / melhores oportunidades"}
            >
              <Star className={cn("w-3.5 h-3.5", onlyFeaturedFilter ? "fill-white text-white" : "text-amber-500")} />
              <span className="hidden sm:inline">Destaques</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                isFilterOpen || activeFiltersCount > 0
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-muted/50 hover:bg-muted text-foreground border-border"
              )}
              title="Abrir painel de filtros detalhados"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-black leading-none",
                  isFilterOpen || activeFiltersCount > 0
                    ? "bg-primary-foreground text-primary"
                    : "bg-primary text-primary-foreground"
                )}>
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 text-xs font-bold transition-all cursor-pointer"
                title="Limpar todos os filtros aplicados"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Advanced Filters */}
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border/60 pt-3.5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Neighborhood */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                    Bairro
                  </label>
                  <select
                    value={selectedNeighborhood}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedNeighborhood(val);
                      recordAuditEvent({
                        action: 'SEARCH_PROPERTIES',
                        title: val === 'all' ? 'Filtro de Bairro Removido' : `Filtro por Bairro: ${val}`,
                        content: val === 'all' 
                          ? 'Filtro de localização por bairro desativado.' 
                          : `Usuário filtrou imóveis situados no bairro: "${val}".`,
                        severity: 'low',
                        category: 'modification',
                        metadata: {
                          neighborhood: val
                        }
                      });
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  >
                    <option value="all">Todos os bairros ({availableNeighborhoods.length})</option>
                    {availableNeighborhoods.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Street */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                    Rua / Logradouro
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ex: Av. Brasil, Rua 15..."
                      value={searchStreet}
                      onChange={(e) => setSearchStreet(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchStreet.trim().length >= 2) {
                          recordAuditEvent({
                            action: 'SEARCH_PROPERTIES',
                            title: 'Filtro por Logradouro / Rua',
                            content: `Filtro de rua aplicado: "${searchStreet.trim()}".`,
                            severity: 'low',
                            category: 'modification',
                            metadata: {
                              street: searchStreet.trim()
                            }
                          });
                        }
                      }}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                    {searchStreet && (
                      <button 
                        type="button" 
                        onClick={() => setSearchStreet("")} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Bedrooms */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                    Quartos (Mínimo)
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: "all", label: "Todos" },
                      { id: "1", label: "1+" },
                      { id: "2", label: "2+" },
                      { id: "3", label: "3+" },
                      { id: "4+", label: "4+" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (bedroomsFilter === item.id) return;
                          setBedroomsFilter(item.id);
                        }}
                        className={cn(
                          "py-1.5 rounded-lg text-xs font-bold transition-all text-center border cursor-pointer",
                          bedroomsFilter === item.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Parking Spots */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                    Vagas de Garagem
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: "all", label: "Todas" },
                      { id: "1", label: "1+" },
                      { id: "2+", label: "2+" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (parkingFilter === item.id) return;
                          setParkingFilter(item.id);
                        }}
                        className={cn(
                          "py-1.5 rounded-lg text-xs font-bold transition-all text-center border cursor-pointer",
                          parkingFilter === item.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Price Range */}
                <div className="sm:col-span-2 lg:col-span-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                      Faixa de Preço de Venda (R$)
                    </label>
                    {(displayMinPrice || displayMaxPrice) && (
                      <button
                        type="button"
                        onClick={() => { setDisplayMinPrice(""); setDisplayMaxPrice(""); }}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Resetar valores
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Valor mínimo (R$)"
                      value={displayMinPrice}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setDisplayMinPrice(raw ? formatCurrencyBRL(raw) : "");
                      }}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold text-foreground placeholder:font-normal focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Valor máximo (R$)"
                      value={displayMaxPrice}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setDisplayMaxPrice(raw ? formatCurrencyBRL(raw) : "");
                      }}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold text-foreground placeholder:font-normal focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>

                  {/* Price shortcuts */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Atalhos:</span>
                    {[
                      { label: "Até 300k", min: null, max: 300000 },
                      { label: "300k - 600k", min: 300000, max: 600000 },
                      { label: "600k - 1.2M", min: 600000, max: 1200000 },
                      { label: "Acima de 1.2M", min: 1200000, max: null },
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPricePreset(preset.min, preset.max)}
                        className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all border border-border/50 cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. Status */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                    Status Comercial
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  >
                    <option value="all">Todos os status</option>
                    <option value="disponível">Disponível</option>
                    <option value="reservado">Reservado</option>
                    <option value="vendido">Vendido</option>
                    <option value="alugado">Alugado</option>
                  </select>
                </div>

                {/* 7. Tag Filters */}
                <div className="sm:col-span-2 lg:col-span-3 space-y-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Filtrar por Características & Tags ({selectedFilterTags.length} selecionadas)
                      </label>
                    </div>
                    {selectedFilterTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedFilterTags([])}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Limpar tags
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {POPULAR_PROPERTY_TAGS.map((tag) => {
                      const isSelected = selectedFilterTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setSelectedFilterTags(prev =>
                              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                            );
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1",
                            isSelected
                              ? "bg-primary text-white border-primary shadow-xs"
                              : "bg-background border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Filters Badges */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Filtros ativos:</span>
            {onlyFeaturedFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/25">
                <Star className="w-2.5 h-2.5 fill-current" />
                <span>Apenas Destaques</span>
                <button type="button" onClick={() => setOnlyFeaturedFilter(false)} className="hover:opacity-70 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {selectedFilterTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/15 text-primary text-[10px] font-bold border border-primary/20"
              >
                <Tag className="w-2.5 h-2.5" />
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFilterTags(prev => prev.filter(t => t !== tag))}
                  className="hover:opacity-70 cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            {search.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                <span>Busca: &ldquo;{search}&rdquo;</span>
                <button type="button" onClick={() => setSearch("")} className="hover:opacity-70 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {selectedNeighborhood !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                <span>Bairro: {selectedNeighborhood}</span>
                <button type="button" onClick={() => setSelectedNeighborhood("all")} className="hover:opacity-70 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {searchStreet.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                <span>Rua: &ldquo;{searchStreet}&rdquo;</span>
                <button type="button" onClick={() => setSearchStreet("")} className="hover:opacity-70 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {displayMinPrice.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                <span>Min: {displayMinPrice}</span>
                <button type="button" onClick={() => setDisplayMinPrice("")} className="hover:opacity-70 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {displayMaxPrice.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                <span>Max: {displayMaxPrice}</span>
                <button type="button" onClick={() => setDisplayMaxPrice("")} className="hover:opacity-70 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {bedroomsFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                <span>{bedroomsFilter === "4+" ? "4+ Quartos" : `${bedroomsFilter}+ Quartos`}</span>
                <button type="button" onClick={() => setBedroomsFilter("all")} className="hover:opacity-70 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {parkingFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                <span>{parkingFilter === "2+" ? "2+ Vagas" : `${parkingFilter}+ Vagas`}</span>
                <button type="button" onClick={() => setParkingFilter("all")} className="hover:opacity-70 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                <span>Status: {statusFilter}</span>
                <button type="button" onClick={() => setStatusFilter("all")} className="hover:opacity-70 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filterType !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                <span>Tipo: {filterType}</span>
                <button 
                  type="button" 
                  onClick={() => setFilterType("all")} 
                  className="hover:opacity-70 cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Type Filter Pills */}
      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pb-1">
        {[
          { id: "all", label: "Todos", icon: Home },
          { id: "casa", label: "Casas", icon: Home },
          { id: "apartamento", label: "Apartamentos", icon: Building },
          { id: "sobrado", label: "Sobrados", icon: Home },
          { id: "cobertura", label: "Coberturas", icon: Building },
          { id: "comercial", label: "Comercial", icon: Briefcase },
          { id: "terreno", label: "Terrenos", icon: TreePine },
          { id: "sítio", label: "Sítios", icon: TreePine },
          { id: "chácara", label: "Chácaras", icon: TreePine },
          { id: "fazenda", label: "Fazendas", icon: TreePine },
          { id: "outros", label: "Outros", icon: Plus },
        ].map(type => {
          const count = type.id === "all" 
            ? properties.length 
            : properties.filter(p => p.type === type.id).length;
          const isActive = filterType === type.id;
          const Icon = type.icon;

          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setFilterType(type.id)}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card border-border/80 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{type.label}</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
