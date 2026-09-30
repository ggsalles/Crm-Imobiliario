"use client";

import { UserCircle, Search, Building2, UserPlus, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface UsersHeaderProps {
  search: string;
  setSearch: (val: string) => void;
  isPlatformAdmin: boolean;
  isAdmin: boolean;
  showTenantsSection: boolean;
  setShowTenantsSection: (val: boolean) => void;
  isLimitReached: boolean;
  onOpenAddUserModal: () => void;
}

export function UsersHeader({
  search,
  setSearch,
  isPlatformAdmin,
  isAdmin,
  showTenantsSection,
  setShowTenantsSection,
  isLimitReached,
  onOpenAddUserModal
}: UsersHeaderProps) {
  return (
    <header className="h-auto md:h-16 bg-card/80 backdrop-blur-md border-b border-border pl-14 md:pl-5 px-3 sm:px-4 md:px-5 py-3 md:py-0 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-10 gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base md:text-lg font-bold leading-tight">Gestão da Equipe</h2>
          <p className="text-[11px] text-muted-foreground font-medium tracking-tight">Membros com acesso ao sistema, corretores e permissões</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar usuário..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-muted/50 border border-border rounded-lg text-xs w-36 sm:w-48 lg:w-56 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          />
        </div>
        
        {isPlatformAdmin && (
          <button 
            onClick={() => setShowTenantsSection(!showTenantsSection)}
            className={cn(
              "px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-all active:scale-95 cursor-pointer",
              showTenantsSection 
                ? "bg-primary text-white border-primary" 
                : "bg-muted/50 border-border text-foreground hover:bg-muted"
            )}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Painel SaaS</span>
          </button>
        )}

        {(isAdmin || isPlatformAdmin) && (
          <button 
            onClick={onOpenAddUserModal}
            className={cn(
              "px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0 shadow-xs cursor-pointer",
              isLimitReached
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
                : "bg-primary text-white hover:opacity-90"
            )}
            title={isLimitReached ? "Limite de vagas atingido. Clique para ver detalhes e solicitar upgrade." : "Cadastrar novo corretor ou membro"}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Novo Usuário</span>
            {isLimitReached && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-white dark:bg-amber-600 rounded uppercase tracking-wider">
                Limite de vagas atingido
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
