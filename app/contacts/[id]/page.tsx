"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Search, 
  Bell, 
  History, 
  Edit2, 
  MessageSquare, 
  MoreHorizontal, 
  Mail, 
  Phone, 
  MapPin, 
  Plus, 
  Calendar, 
  CheckSquare, 
  FileText, 
  ChevronRight,
  TrendingUp,
  Clock,
  ExternalLink,
  Filter,
  Users,
  Zap,
  Building2,
  ArrowLeft,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { Contact, Company, getContact, getCompany } from "@/lib/db";
import { Timeline } from "@/components/Timeline";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

export default function ContactDetail360Page() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchData() {
      if (!id || !user || !profile) return;
      
      // Basic UUID validation to prevent database errors for paths like /contacts/search
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        router.push("/contacts");
        return;
      }

      setLoading(true);
      try {
        const contactData = await getContact(id);
        if (contactData) {
          // Ownership Check for non-admins
          if (profile.role !== 'Admin' && contactData.ownerId !== user.id) {
            toast.error("Você não tem permissão para acessar este contato.");
            router.push("/contacts");
            return;
          }

          setContact(contactData);

          if (contactData.companyId) {
            const companyData = await getCompany(contactData.companyId);
            if (companyData) {
              setCompany(companyData);
            }
          }
        } else {
          router.push("/contacts");
        }
      } catch (error) {
        console.error("Error fetching contact detail:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, user, profile, router]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </main>
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans selection:bg-blue-100">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header / Global Search */}
        <header className="h-20 bg-white border-b px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/contacts" className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Pesquisar negócios, registros ou interações..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="relative text-slate-400 hover:text-slate-600 transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-500 p-0.5 relative">
              <Image 
                src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || "User"}&background=0D8ABC&color=fff`} 
                alt="Profile" 
                fill
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"
                unoptimized
              />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Main Card: Profile */}
          <section className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-blue-100 flex items-center justify-center text-4xl font-bold text-blue-600 uppercase">
                    {contact.name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full shadow-sm" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{contact.name}</h1>
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-blue-100">
                      {contact.type === 'cliente' ? 'CLIENTE' : 'MEMBRO'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Building2 className="w-4 h-4" />
                    <span>{contact.role} em {company?.name || contact.department || "Empresa Individual"}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {contact.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {contact.phone}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      São Paulo, BR
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 w-full lg:w-auto">
                <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all">
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
                <button 
                  onClick={() => router.push('/messages')}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-[#1e3a8a] text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-900/20"
                >
                  <MessageSquare className="w-4 h-4" />
                  Mensagem
                </button>
              </div>
            </div>
          </section>

          {/* Grid Layout for the rest */}
          <div className="grid grid-cols-12 gap-8">
            
            {/* Left Column: Stats & History */}
            <div className="col-span-12 lg:col-span-9 space-y-8">
              
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[ 
                  { label: "TOTAL EM NEGÓCIOS", value: "R$ 0", icon: TrendingUp },
                  { label: "ENGAJAMENTO", value: "Normal", icon: Users, color: "text-blue-600" },
                  { label: "ÚLTIMO CONTATO", value: "Recentemente", icon: Clock },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{stat.label}</div>
                    <div className={cn("text-2xl font-bold text-slate-900", stat.color)}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* History Section */}
              <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-8 border-b flex items-center justify-between bg-white sticky top-0 z-10">
                  <h2 className="text-xl font-bold text-slate-900">Histórico de Interações</h2>
                  <div className="flex items-center gap-4">
                    <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                      <Filter className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-8 pb-12">
                  <Timeline category="contact" relatedId={id} />
                </div>
              </div>

              {/* Active Deals Table - Empty for now */}
              <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-8 border-b flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">Negócios Ativos</h2>
                  <button className="text-blue-600 font-bold text-sm hover:text-blue-700">Ver todos</button>
                </div>
                <div className="p-20 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <TrendingUp className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="font-bold text-slate-700">Sem negócios ativos no momento</h3>
                  <p className="text-slate-400 text-sm mt-1">Crie um novo negócio para começar o pipeline.</p>
                </div>
              </div>
            </div>

            {/* Right Column: Quick Actions & Sidebar Widgets */}
            <div className="col-span-12 lg:col-span-3 space-y-8">
              
              {/* Quick Actions Card */}
              <div className="bg-[#1e3a8a] rounded-[32px] p-8 text-white shadow-xl shadow-blue-900/10">
                <div className="flex items-center gap-3 mb-8">
                  <Zap className="w-5 h-5 text-blue-300" />
                  <h3 className="text-lg font-bold">Ações Rápidas</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Reunião", icon: Calendar },
                    { label: "Tarefa", icon: CheckSquare },
                    { label: "Documento", icon: FileText },
                    { label: "Ligação", icon: Phone },
                  ].map((action, i) => (
                    <button key={i} className="bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <action.icon className="w-5 h-5 text-blue-200" />
                      </div>
                      <span className="text-xs font-semibold text-blue-100">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tasks & Reminders */}
              <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Tarefas & Lembretes</h3>
                <div className="py-8 text-center bg-slate-50 rounded-3xl border border-dashed">
                  <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sem tarefas</p>
                </div>
                <button className="w-full mt-6 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-all">Nova Tarefa</button>
              </div>

              {/* Location Widget */}
              <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-8 pb-4">
                  <h3 className="text-lg font-bold text-slate-900">Localização</h3>
                </div>
                <div className="relative h-64 bg-slate-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=600&h=400&fit=crop" 
                    alt="Map" 
                    fill 
                    className="w-full h-full object-cover opacity-50 grayscale" 
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white p-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-200">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Local não definido</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

