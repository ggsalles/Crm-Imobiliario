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
  ChevronDown,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useState, useEffect, Suspense } from "react";
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

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="fixed top-4 left-4 z-40 md:hidden">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-3 bg-[#0f172a] text-white rounded-xl shadow-xl border border-white/10"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-card h-screen sticky top-0 shrink-0 border-r border-border z-[100]">
        <Suspense fallback={<div className="w-64 bg-card h-full" />}>
          <SidebarContent 
            pathname={pathname} 
            setIsMobileMenuOpen={setIsMobileMenuOpen} 
            logout={logout}
            profile={profile}
            changeTenant={changeTenant}
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
                />
              </Suspense>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarContent({ pathname, setIsMobileMenuOpen, logout, profile, changeTenant }: any) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [tenants, setTenants] = useState<any[]>([]);
  const [activeTenant, setActiveTenant] = useState<any | null>(null);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [isSwitchingTenantId, setIsSwitchingTenantId] = useState<string | null>(null);
  const { billingStatus, billingSuspensionDate } = useAuth();

  useEffect(() => {
    const unsub = subscribeToTotalUnreadMessages(setUnreadCount);
    return unsub;
  }, []);

  useEffect(() => {
    async function loadTenants() {
      try {
        const allTenants = await getTenants();
        if (profile) {
          const isAdmin = profile.role?.toLowerCase() === 'admin' || profile.isAdmin || profile.email?.toLowerCase() === 'ggsalles@gmail.com';
          const userTenantIds = Array.from(new Set([...(profile.tenantIds || []), profile.tenantId].filter(Boolean)));
          const filtered = isAdmin ? allTenants : allTenants.filter((t: any) => userTenantIds.includes(t.id));
          const active = allTenants.find((t: any) => t.id === profile.tenantId) || { id: profile.tenantId, name: "SalesScore" };
          
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
    <div className="w-64 bg-card h-full flex flex-col text-muted-foreground transition-colors duration-500">
      <div className="p-6 md:p-8 flex items-center justify-between md:block">
        <Link href="/" className="group">
          <h1 className="text-xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">SalesScore</h1>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Enterprise Management</p>
        </Link>
        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-muted-foreground hover:text-foreground">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Tenant Indicator (Static Display Only) */}
      {profile && (
        <div className="px-4 mb-4 select-none relative z-50">
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 px-1 flex justify-between items-center">
            <span>Imobiliária Ativa</span>
          </div>
          
          <div
            className="w-full flex items-center gap-3 px-3.5 py-3 bg-[#1e293b]/30 border border-slate-800/80 rounded-xl relative overflow-hidden backdrop-blur-sm shadow-inner text-left select-none"
          >
            {/* Elegant glowing background highlight */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full blur-xl pointer-events-none" />
            
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20 shadow-sm relative z-10">
              {activeTenant ? (
                activeTenant.name?.[0]?.toUpperCase() || "I"
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              )}
            </div>
            
            <div className="min-w-0 flex-1 relative z-10">
              {activeTenant ? (
                <span className="text-xs font-bold text-foreground truncate block select-none">
                  {activeTenant.name}
                </span>
              ) : (
                <span className="text-xs font-medium text-muted-foreground truncate block animate-pulse">
                  Carregando...
                </span>
              )}
              <span className="text-[9px] text-muted-foreground/60 block uppercase font-bold tracking-wider mt-0.5 select-none font-mono">
                Acesso Autorizado
              </span>
            </div>
          </div>
        </div>
      )}

      {billingStatus === 'aviso_sutil' && (
        <div className="mx-4 mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl relative overflow-hidden backdrop-blur-sm shadow-inner text-left select-none">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-lg pointer-events-none" />
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pendência Financeira
          </span>
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed font-semibold">
            Identificamos um atraso na sua fatura. Por favor, regularize para evitar a suspensão do serviço até <span className="text-amber-400 font-bold">{billingSuspensionDate}</span>.
          </p>
        </div>
      )}

      <nav className="flex-1 px-4 space-y-1 mt-2 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = item.href.includes('?') 
            ? pathname === item.href.split('?')[0] && currentTab === item.href.split('=')[1]
            : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all group",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )} />
              {item.label}
              {item.label === "Mensagens" && unreadCount > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg shadow-red-500/30 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
        
        <Link
          href="/settings"
          onClick={() => setIsMobileMenuOpen(false)}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all group mt-2",
            pathname === "/settings" ? "bg-primary/10 text-primary" : "hover:bg-muted/80 hover:text-foreground"
          )}
        >
          <Settings className={cn("w-5 h-5", pathname === "/settings" ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
          Configurações
        </Link>

        {profile?.email?.toLowerCase() === 'ggsalles@gmail.com' && (
          <Link
            href="/admin/billing"
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all group mt-1 font-semibold text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300",
              pathname === "/admin/billing" ? "bg-indigo-500/15 text-indigo-300" : ""
            )}
          >
            <CreditCard className={cn("w-5 h-5 text-indigo-400 group-hover:text-indigo-300")} />
            Financeiro SaaS (ggsalles)
          </Link>
        )}
      </nav>

      <div className="mt-auto flex flex-col">
        {/* User Profile in Sidebar */}
        <div className="px-4 py-4 border-t border-border">
          <div className="bg-background/50 rounded-2xl p-4 flex items-center gap-3 border border-border">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-bold text-white text-xs overflow-hidden relative shadow-lg shadow-primary/40 border border-border">
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
              <p className="text-xs font-bold text-foreground truncate">{profile?.displayName || "Usuário"}</p>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">{profile?.role || "Membro"}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 mt-2">
          <button 
            onClick={() => router.push("/pipeline?new=true")}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all mb-3"
          >
            <Plus className="w-4 h-4" />
            Nova Oportunidade
          </button>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-red-400 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
