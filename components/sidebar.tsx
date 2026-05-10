"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Sidebar() {
  const pathname = usePathname();
  const { user, profile, logout } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Pipeline", icon: Trello, href: "/pipeline" },
    { label: "Clientes", icon: Users, href: "/contacts" },
    { label: "Relatórios", icon: BarChart3, href: "/?tab=Relatórios" },
    { label: "Mensagens", icon: MessageSquare, href: "/messages" },
    { label: "Imóveis", icon: Home, href: "/properties" },
    { label: "Empresas", icon: Building2, href: "/companies" },
    { label: "Usuários", icon: UserCircle, href: "/users" },
  ];

  const SidebarContent = () => (
    <div className="w-64 bg-[#0f172a] h-full flex flex-col text-slate-400">
      <div className="p-8 flex items-center justify-between md:block">
        <Link href="/" className="group">
          <h1 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">SalesScore</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Enterprise Management</p>
        </Link>
        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
              pathname === item.href 
                ? "bg-blue-600/10 text-white" 
                : "hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5",
              pathname === item.href ? "text-blue-500" : "text-slate-500 group-hover:text-slate-300"
            )} />
            {item.label}
          </Link>
        ))}
        
        <Link
          href="/settings"
          onClick={() => setIsMobileMenuOpen(false)}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group mt-4",
            pathname === "/settings" ? "bg-blue-600/10 text-white" : "hover:bg-white/5 hover:text-white"
          )}
        >
          <Settings className="w-5 h-5 text-slate-500 group-hover:text-slate-300" />
          Configurações
        </Link>
      </nav>

      <div className="mt-auto flex flex-col">
        {/* User Profile in Sidebar */}
        <div className="px-4 py-6 border-t border-white/5">
          <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3 border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-xs overflow-hidden relative shadow-lg shadow-blue-900/40 border border-white/10">
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
              <p className="text-xs font-bold text-white truncate">{profile?.displayName || "Usuário"}</p>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{profile?.role || "Membro"}</p>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">
          <button 
            onClick={() => router.push("/pipeline?new=true")}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 hover:opacity-90 active:scale-[0.98] transition-all mb-4"
          >
            <Plus className="w-4 h-4" />
            Nova Oportunidade
          </button>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-slate-500 hover:text-red-400 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );

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
      <aside className="hidden md:flex w-64 bg-[#0f172a] h-screen sticky top-0 shrink-0 border-r border-white/5">
        <SidebarContent />
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
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
