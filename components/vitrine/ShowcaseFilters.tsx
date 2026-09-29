"use client";

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SlidersHorizontal, X, Check, Tag } from 'lucide-react';
import { POPULAR_PROPERTY_TAGS } from '@/lib/property-tags';

export interface ShowcaseFiltersProps {
  filteredCount: number;
  loading: boolean;
  selectedStatus?: string;
  setSelectedStatus?: (status: string) => void;
  minBedrooms: number | 'all';
  setMinBedrooms: (beds: number | 'all') => void;
  minSuites?: number | 'all';
  setMinSuites?: (suites: number | 'all') => void;
  minParking: number | 'all';
  setMinParking: (spots: number | 'all') => void;
  minPrice: number | '';
  setMinPrice: (price: number | '') => void;
  maxPrice: number | '';
  setMaxPrice: (price: number | '') => void;
  selectedTags: string[];
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
  sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'area_desc';
  setSortBy: (sort: 'relevance' | 'price_asc' | 'price_desc' | 'area_desc') => void;
  resetFilters: () => void;
  isFilterDrawerOpen: boolean;
  setIsFilterDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  activeFiltersCount: number;
  showSidebar?: boolean;
}

export function ShowcaseFilters({
  filteredCount,
  loading,
  selectedStatus,
  setSelectedStatus,
  minBedrooms,
  setMinBedrooms,
  minSuites = 'all',
  setMinSuites,
  minParking,
  setMinParking,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  selectedTags,
  setSelectedTags,
  sortBy,
  setSortBy,
  resetFilters,
  isFilterDrawerOpen,
  setIsFilterDrawerOpen,
  activeFiltersCount,
  showSidebar = false,
}: ShowcaseFiltersProps) {
  return (
    <section className={
      showSidebar 
        ? "sticky top-0 z-20 bg-slate-900 border-b border-slate-800 py-3 px-4 sm:px-6 lg:px-8 shadow-md" 
        : "bg-slate-900/95 backdrop-blur-md border-b border-slate-800 py-3 px-4 sm:px-6 lg:px-8 relative z-10"
    }>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Results count */}
        <div className="text-xs sm:text-sm font-semibold text-slate-400">
          {loading ? (
            <span>Carregando imóveis...</span>
          ) : (
            <span>
              Mostrando <strong className="text-white">{filteredCount}</strong> {filteredCount === 1 ? 'imóvel disponível' : 'imóveis disponíveis'}
            </span>
          )}
        </div>

        {/* Filter Trigger & Sort dropdown */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeFiltersCount > 0 || isFilterDrawerOpen
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-blue-600 text-[10px] font-black flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Quick Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-xs font-medium outline-none cursor-pointer focus:border-blue-500"
          >
            <option value="relevance">Destaques</option>
            <option value="price_asc">Menor Preço</option>
            <option value="price_desc">Maior Preço</option>
            <option value="area_desc">Maior Metragem</option>
          </select>
        </div>
      </div>

      {/* Expandable Filter Drawer */}
      <AnimatePresence>
        {isFilterDrawerOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 pb-2 border-t border-slate-800 mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-w-7xl mx-auto">
              {/* Dormitórios */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Quartos / Dormitórios
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {['all', 1, 2, 3, 4].map((beds) => (
                    <button
                      key={String(beds)}
                      type="button"
                      onClick={() => setMinBedrooms(beds as any)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        minBedrooms === beds
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {beds === 'all' ? 'Todos' : `${beds}+`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suítes */}
              {setMinSuites && (
                <div>
                  <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                    Suítes
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {['all', 1, 2, 3].map((s) => (
                      <button
                        key={String(s)}
                        type="button"
                        onClick={() => setMinSuites(s as any)}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          minSuites === s
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {s === 'all' ? 'Todas' : `${s}+`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Vagas de Garagem */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Vagas de Garagem
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {['all', 1, 2, 3].map((spots) => (
                    <button
                      key={String(spots)}
                      type="button"
                      onClick={() => setMinParking(spots as any)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        minParking === spots
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {spots === 'all' ? 'Todos' : `${spots}+`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Faixas de Preço */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Faixa de Preço (R$)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Mín: R$ 0"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 text-xs font-medium outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Máx: Sem limite"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 text-xs font-medium outline-none focus:border-blue-500"
                  />
                </div>
                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[
                    { label: "Até 500k", min: '', max: 500000 },
                    { label: "500k - 1M", min: 500000, max: 1000000 },
                    { label: "1M - 2.5M", min: 1000000, max: 2500000 },
                    { label: "Acima 2.5M", min: 2500000, max: '' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setMinPrice(preset.min as any);
                        setMaxPrice(preset.max as any);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 hover:bg-blue-600/20 hover:text-blue-400 text-slate-400 border border-slate-750 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Limpar Filtros */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="w-full py-2 rounded-xl border border-dashed border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpar Todos os Filtros
                </button>
              </div>
            </div>

            {/* Diferenciais & Comodidades (Tags) */}
            <div className="pt-3 border-t border-slate-800 mt-3 max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Diferenciais & Comodidades ({selectedTags.length} selecionados)
                  </span>
                </div>
                {selectedTags.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedTags([])}
                    className="text-[10px] font-bold text-blue-400 hover:underline cursor-pointer"
                  >
                    Limpar tags
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {POPULAR_PROPERTY_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSelectedTags(prev =>
                          prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                        );
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tags de Filtros Ativos na Barra */}
      {selectedTags.length > 0 && (
        <div className="pt-3 border-t border-slate-800 mt-2 flex flex-wrap items-center gap-1.5 max-w-7xl mx-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-blue-400" /> Tags ativas:
          </span>
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                className="hover:text-white cursor-pointer ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setSelectedTags([])}
            className="text-[10px] font-bold text-slate-400 hover:text-red-400 hover:underline cursor-pointer ml-1"
          >
            Remover todas
          </button>
        </div>
      )}
    </section>
  );
}

export default ShowcaseFilters;
