"use client";

import { UserCircle, ShieldCheck, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactsFilterBarProps {
  activeTab: 'cliente' | 'equipe';
  setActiveTab: (tab: 'cliente' | 'equipe') => void;
  clientCount: number;
  teamCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedTemperature: 'all' | 'quente' | 'morno' | 'frio';
  setSelectedTemperature: (temp: 'all' | 'quente' | 'morno' | 'frio') => void;
  temperatureCounts: { quente: number; morno: number; frio: number };
  selectedSource: string;
  setSelectedSource: (source: string) => void;
  availableSources: string[];
}

export function ContactsFilterBar({
  activeTab,
  setActiveTab,
  clientCount,
  teamCount,
  searchQuery,
  setSearchQuery,
  selectedTemperature,
  setSelectedTemperature,
  temperatureCounts,
  selectedSource,
  setSelectedSource,
  availableSources
}: ContactsFilterBarProps) {
  return (
    <div className="space-y-2.5">
      {/* Navigation & Search bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="bg-card p-1 rounded-xl border border-border flex gap-1 shadow-xs shrink-0">
          <button 
            onClick={() => setActiveTab('cliente')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
              activeTab === 'cliente' ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <UserCircle className="w-3.5 h-3.5" />
            Clientes ({clientCount})
          </button>
          <button 
            onClick={() => setActiveTab('equipe')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
              activeTab === 'equipe' ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Equipe ({teamCount})
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder={`Pesquisar em ${activeTab === 'cliente' ? 'clientes' : 'equipe'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-card border border-border text-foreground rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
          />
        </div>
      </div>

      {/* Quick Filters for Clients (Temperature & Source) */}
      {activeTab === 'cliente' && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mr-1">Temperatura:</span>
            <button
              type="button"
              onClick={() => setSelectedTemperature('all')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                selectedTemperature === 'all' 
                  ? "bg-primary text-primary-foreground shadow-xs" 
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
              )}
            >
              Todas ({clientCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTemperature('quente')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                selectedTemperature === 'quente' 
                  ? "bg-red-500 text-white shadow-xs" 
                  : "bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20"
              )}
            >
              🔥 Quente ({temperatureCounts.quente})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTemperature('morno')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                selectedTemperature === 'morno' 
                  ? "bg-amber-500 text-white shadow-xs" 
                  : "bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20"
              )}
            >
              ⚡ Morno ({temperatureCounts.morno})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTemperature('frio')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                selectedTemperature === 'frio' 
                  ? "bg-indigo-500 text-white shadow-xs" 
                  : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/20"
              )}
            >
              ❄️ Frio ({temperatureCounts.frio})
            </button>
          </div>

          {availableSources.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="all">Todas as origens</option>
                {availableSources.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {(selectedTemperature !== 'all' || selectedSource !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemperature('all');
                    setSelectedSource('all');
                    setSearchQuery('');
                  }}
                  className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
