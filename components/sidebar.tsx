"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  LayoutDashboard,
  MessageSquare,
  Calendar,
  LogOut,
  Building2,
  Users,
  Trello,
  UserCircle,
  BarChart3,
  Plus,
  Settings,
  Home,
  Menu,
  X,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { isPlatformAdmin, DEFAULT_TENANT_NAME } from "@/lib/constants";
import { useState, useEffect, Suspense, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { subscribeToTotalUnreadMessages, getTenants, updateUserProfile } from "@/lib/db";
import { toast } from "sonner";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Atividades", icon: Calendar, href: "/activities" },
  { label: "Pipeline", icon: Trello, href: "/pipeline" },
  { label: "Calendário", icon: Calendar, href: "/calendar" },
  { label: "Clientes", icon: Users, href: "/contacts?tab=cliente" },
  { label: "Equipe", icon: ShieldCheck, href: "/contacts?tab=equipe" },
  { label: "Relatórios", icon: BarChart3, href: "/?tab=Relatórios" },
  { label: "Mensagens", icon: MessageSquare, href: "/messages" },
  { label: "Imóveis", icon: Home, href: "/properties" },
  { label: "Empresas", icon: Building2, href: "/companies" },
  { label: "Usuários", icon: UserCircle, href: "/users" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, logout, changeTenant } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsub = subscribeToTotalUnreadMessages(setUnreadCount);
    return unsub;
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="fixed top-4 left-4 z-40 md:hidden">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-3 bg-[#0f172a] text-white rounded-xl shadow-xl border border-white/10 relative"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg shadow-red-500/50 animate-pulse border-2 border-[#0f172a]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex bg-card h-screen sticky top-0 shrink-0 border-r border-border z-[10] transition-all duration-300",
        isCollapsed ? "w-16" : "w-52 lg:w-56"
      )}>
        <Suspense fallback={<div className={isCollapsed ? "w-16 bg-card h-full" : "w-52 lg:w-56 bg-card h-full"} />}>
          <SidebarContent 
            pathname={pathname} 
            setIsMobileMenuOpen={setIsMobileMenuOpen} 
            logout={logout}
            profile={profile}
            changeTenant={changeTenant}
            isCollapsed={isCollapsed}
            toggleCollapse={toggleCollapse}
            unreadCount={unreadCount}
          />
        </Suspense>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50] md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-64 z-[60] md:hidden shadow-2xl"
            >
              <Suspense fallback={<div className="w-64 bg-card h-full" />}>
                <SidebarContent 
                  pathname={pathname} 
                  setIsMobileMenuOpen={setIsMobileMenuOpen} 
                  logout={logout}
                  profile={profile}
                  changeTenant={changeTenant}
                  unreadCount={unreadCount}
                />
              </Suspense>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarContent({ pathname, setIsMobileMenuOpen, logout, profile, changeTenant, isCollapsed = false, toggleCollapse, unreadCount = 0 }: any) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const router = useRouter();
  const [tenants, setTenants] = useState<any[]>([]);
  const [activeTenant, setActiveTenant] = useState<any | null>(null);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [isSwitchingTenantId, setIsSwitchingTenantId] = useState<string | null>(null);
  const { billingStatus, billingSuspensionDate, dueDay, diffDays } = useAuth();

  const navRef = useRef<HTMLElement>(null);

  // Restore the scroll position of the sidebar when navigating
  useEffect(() => {
    const savedScrollPos = sessionStorage.getItem('sidebar-scroll');
    if (savedScrollPos && navRef.current) {
      const target = navRef.current;
      const scrollPos = Number(savedScrollPos);
      // Wait a fraction of a frame for navigation rendering to complete
      const timer = setTimeout(() => {
        if (target) {
          target.scrollTop = scrollPos;
        }
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [pathname, currentTab]);

  useEffect(() => {
    async function loadTenants() {
      try {
        const allTenants = await getTenants();
        if (profile) {
          const safeTenants = Array.isArray(allTenants) ? allTenants : [];
          const isPlatform = isPlatformAdmin(profile.email);
          const userTenantIds = Array.from(new Set([...(profile.tenantIds || []), profile.tenantId].filter(Boolean)));
          const filtered = isPlatform ? safeTenants : safeTenants.filter((t: any) => userTenantIds.includes(t.id));
          const active = safeTenants.find((t: any) => t.id === profile.tenantId) || { id: profile.tenantId, name: DEFAULT_TENANT_NAME };
          
          setTenants(filtered.length > 0 ? filtered : [active]);
          setActiveTenant(active);
        }
      } catch (err) {
        console.error("Erro ao carregar tenants no sidebar:", err);
      }
    }
    if (profile) {
      loadTenants();
    }

    const handleBillingUpdate = () => {
      if (profile) {
        loadTenants();
      }
    };
    window.addEventListener('saas-billing-updated', handleBillingUpdate);
    return () => {
      window.removeEventListener('saas-billing-updated', handleBillingUpdate);
    };
  }, [profile]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleTenantSwitch = async (tenantId: string) => {
    if (tenantId === profile?.tenantId) {
      setIsTenantDropdownOpen(false);
      return;
    }
    setIsSwitchingTenantId(tenantId);
    setIsTenantDropdownOpen(false);
    try {
      await changeTenant(tenantId);
      toast.success("Imobiliária alterada com sucesso!");
    } catch (err) {
      console.error("Erro ao trocar imobiliária no sidebar:", err);
      toast.error("Erro ao alterar imobiliária.");
    } finally {
      setIsSwitchingTenantId(null);
    }
  };

  return (
    <div className={cn(
      "bg-card h-full flex flex-col text-muted-foreground transition-all duration-300",
      isCollapsed ? "w-16" : "w-52 lg:w-56"
    )}>
      <div className={cn(
        "p-3 md:px-3.5 md:py-2.5 flex items-center border-b border-border/40",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        {!isCollapsed ? (
          <>
            <Link href="/" prefetch={true} className="group min-w-0">
              <h1 className="text-base font-bold text-foreground tracking-tight group-hover:text-primary transition-colors truncate">SalesScore</h1>
              <p className="text-[8.5px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5 truncate">Enterprise</p>
            </Link>
            <div className="flex items-center gap-0.5">
              {toggleCollapse && (
                <button 
                  onClick={toggleCollapse} 
                  className="hidden md:flex p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-all"
                  title="Recolher menu lateral"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-0.5">
            <Link href="/" prefetch={true} className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center font-black text-xs text-primary shadow-sm hover:bg-primary hover:text-white transition-all" title="SalesScore">
              SS
            </Link>
            {toggleCollapse && (
              <button 
                onClick={toggleCollapse} 
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-all"
                title="Expandir menu lateral"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tenant Indicator (Static Display Only) */}
      {profile && (
        <div className="px-2 mb-1 select-none relative z-50">
          {!isCollapsed ? (
            <>
              <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5 px-1 flex justify-between items-center">
                <span>Imobiliária</span>
              </div>
              
              <div
                className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-[#1e293b]/30 border border-slate-800/80 rounded-xl relative overflow-hidden backdrop-blur-sm shadow-inner text-left select-none"
                title={activeTenant?.name || "Imobiliária Ativa"}
              >
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20 shadow-sm relative z-10">
                  {activeTenant ? (
                    activeTenant.name?.[0]?.toUpperCase() || "I"
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  )}
                </div>
                
                <div className="min-w-0 flex-1 relative z-10">
                  <span className="text-xs font-bold text-foreground truncate block select-none">
                    {activeTenant?.name || "Carregando..."}
                  </span>
                  <span className="text-[7.5px] text-muted-foreground/60 block uppercase font-bold tracking-wider select-none font-mono">
                    Autorizado
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div 
              className="w-8 h-8 mx-auto rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20 shadow-sm cursor-default"
              title={`Imobiliária Ativa: ${activeTenant?.name || ''}`}
            >
              {activeTenant ? activeTenant.name?.[0]?.toUpperCase() || "I" : "..."}
            </div>
          )}
        </div>
      )}

      {/* Billing Alert Badges */}
      {!isCollapsed && billingStatus && billingStatus !== 'regular' && (
        <>
          {billingStatus === 'bloqueado' && (
            <div className="mx-2 mb-1.5 p-2 bg-rose-500/15 border border-rose-500/30 rounded-xl relative overflow-hidden backdrop-blur-sm shadow-inner text-left select-none">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[8px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  Bloqueado (D+{diffDays !== undefined && diffDays !== null ? diffDays : 7})
                </span>
                <span className="text-[7.5px] font-bold text-rose-300 bg-rose-500/20 px-1 py-0.5 rounded font-mono">
                  Dia {dueDay || 10}
                </span>
              </div>
              <p className="text-[8.5px] text-rose-200/90 mt-1 leading-snug font-medium">
                Fatura em atraso desde o dia <strong>{dueDay || 10}</strong>.
              </p>
              {isPlatformAdmin(profile?.email) && (
                <Link
                  href="/admin/billing"
                  className="mt-1 text-[8.5px] font-bold text-rose-400 hover:text-rose-300 transition-colors underline flex items-center gap-0.5"
                >
                  Cobrança SaaS →
                </Link>
              )}
            </div>
          )}

          {billingStatus === 'aviso_critico' && (
            <div className="mx-2 mb-1.5 p-2 bg-amber-500/15 border border-amber-500/30 rounded-xl relative overflow-hidden backdrop-blur-sm shadow-inner text-left select-none">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[8px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Aviso Crítico
                </span>
                <span className="text-[7.5px] font-bold text-amber-300 bg-amber-500/20 px-1 py-0.5 rounded font-mono">
                  D+{diffDays !== undefined && diffDays !== null ? diffDays : 5}
                </span>
              </div>
              <p className="text-[8.5px] text-amber-200/90 mt-1 leading-snug font-medium">
                Bloqueio em <span className="text-amber-300 font-bold">{billingSuspensionDate}</span>.
              </p>
              {isPlatformAdmin(profile?.email) && (
                <Link
                  href="/admin/billing"
                  className="mt-1 text-[8.5px] font-bold text-amber-400 hover:text-amber-300 transition-colors underline flex items-center gap-0.5"
                >
                  Cobrança SaaS →
                </Link>
              )}
            </div>
          )}

          {billingStatus === 'aviso_sutil' && Boolean(billingSuspensionDate) && (
            <div className="mx-2 mb-1.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl relative overflow-hidden backdrop-blur-sm shadow-inner text-left select-none">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[8px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Aviso Sutil
                </span>
                <span className="text-[7.5px] font-bold text-amber-400 bg-amber-500/20 px-1 py-0.5 rounded font-mono">
                  D+{diffDays !== undefined && diffDays !== null ? diffDays : 1}
                </span>
              </div>
              <p className="text-[8.5px] text-muted-foreground mt-0.5 leading-snug font-semibold">
                Fatura pendente ({diffDays !== undefined && diffDays !== null ? diffDays : 1}d atraso) até <span className="text-amber-400 font-bold">{billingSuspensionDate}</span>.
              </p>
              {isPlatformAdmin(profile?.email) && (
                <Link
                  href="/admin/billing"
                  className="mt-1 text-[8.5px] font-bold text-amber-400 hover:text-amber-300 transition-colors underline flex items-center gap-0.5"
                >
                  Cobrança SaaS →
                </Link>
              )}
            </div>
          )}
        </>
      )}

      {/* When collapsed and has billing issue */}
      {isCollapsed && billingStatus && billingStatus !== 'regular' && (
        <div className="flex justify-center mb-2" title={`Aviso Financeiro: ${billingStatus}`}>
          <div className={cn(
            "w-3 h-3 rounded-full animate-ping",
            billingStatus === 'bloqueado' ? "bg-rose-500" : "bg-amber-500"
          )} />
        </div>
      )}

      <nav 
        ref={navRef}
        onScroll={(e) => {
          sessionStorage.setItem('sidebar-scroll', String(e.currentTarget.scrollTop));
        }}
        className="flex-1 px-1.5 space-y-0.5 mt-0.5 overflow-y-auto scrollbar-thin"
      >
        {navItems.map((item) => {
          const isActive = item.href.includes('?') 
            ? pathname === item.href.split('?')[0] && currentTab === item.href.split('=')[1]
            : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={() => setIsMobileMenuOpen(false)}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-xs font-medium transition-all group relative",
                isCollapsed ? "justify-center p-2" : "gap-2 px-2.5 py-1.5",
                isActive 
                  ? "bg-primary/10 text-primary font-semibold" 
                  : "hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 shrink-0",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
              {item.label === "Mensagens" && unreadCount > 0 && (
                isCollapsed ? (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ring-2 ring-card" />
                ) : (
                  <span className="ml-auto flex h-4 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-sm animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )
              )}
            </Link>
          );
        })}
        
        <Link
          href="/settings"
          prefetch={true}
          onClick={() => setIsMobileMenuOpen(false)}
          title={isCollapsed ? "Configurações" : undefined}
          className={cn(
            "flex items-center rounded-lg text-xs font-medium transition-all group mt-0.5",
            isCollapsed ? "justify-center p-2" : "gap-2 px-2.5 py-1.5",
            pathname === "/settings" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/80 hover:text-foreground"
          )}
        >
          <Settings className={cn("w-4 h-4 shrink-0", pathname === "/settings" ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
          {!isCollapsed && <span className="truncate">Configurações</span>}
        </Link>

        {(profile?.role === 'Admin' || profile?.isAdmin || isPlatformAdmin(profile?.email)) && (
          <Link
            href="/audit"
            prefetch={true}
            onClick={() => setIsMobileMenuOpen(false)}
            title={isCollapsed ? "Auditoria & Segurança" : undefined}
            className={cn(
              "flex items-center rounded-lg text-xs font-medium transition-all group mt-0.5 font-semibold text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400",
              isCollapsed ? "justify-center p-2" : "gap-2 px-2.5 py-1.5",
              pathname === "/audit" ? "bg-emerald-500/15 text-emerald-400" : ""
            )}
          >
            <ShieldAlert className={cn("w-4 h-4 shrink-0 text-emerald-500 group-hover:text-emerald-400")} />
            {!isCollapsed && <span className="truncate">Auditoria</span>}
          </Link>
        )}

        {isPlatformAdmin(profile?.email) && (
          <Link
            href="/admin/billing"
            prefetch={true}
            onClick={() => setIsMobileMenuOpen(false)}
            title={isCollapsed ? "Gestão SaaS & Cobrança" : undefined}
            className={cn(
              "flex items-center rounded-lg text-xs font-medium transition-all group mt-0.5 font-semibold text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300",
              isCollapsed ? "justify-center p-2" : "gap-2 px-2.5 py-1.5",
              pathname === "/admin/billing" ? "bg-indigo-500/15 text-indigo-300" : ""
            )}
          >
            <CreditCard className={cn("w-4 h-4 shrink-0 text-indigo-400 group-hover:text-indigo-300")} />
            {!isCollapsed && <span className="truncate">Gestão SaaS & Cobrança</span>}
          </Link>
        )}
      </nav>

      <div className="mt-auto flex flex-col pt-1">
        {/* User Profile in Sidebar */}
        <div className="px-1.5 py-1 border-t border-border">
          {!isCollapsed ? (
            <div className="bg-background/50 rounded-xl p-1.5 flex items-center gap-2 border border-border">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center font-bold text-white text-xs overflow-hidden relative shadow-md shadow-primary/30 border border-border shrink-0">
                <Image 
                  src={profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || "U")}&background=0D8ABC&color=fff`} 
                  alt="User" 
                  fill 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  unoptimized
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate leading-tight">{profile?.displayName || "Usuário"}</p>
                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider truncate mt-0.5">{profile?.role || "Membro"}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title={`${profile?.displayName || "Usuário"} (${profile?.role || "Membro"})`}>
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center font-bold text-white text-xs overflow-hidden relative shadow-md shadow-primary/30 border border-border shrink-0">
                <Image 
                  src={profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || "U")}&background=0D8ABC&color=fff`} 
                  alt="User" 
                  fill 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  unoptimized
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-1.5 pb-2 pt-1">
          {!isCollapsed ? (
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors w-full rounded-lg"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          ) : (
            <div className="flex flex-col items-center">
              <button 
                onClick={handleLogout}
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
