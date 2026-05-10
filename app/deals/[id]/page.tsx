"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Search, 
  Bell, 
  History, 
  Edit2, 
  MessageSquare, 
  Mail, 
  Phone, 
  Plus, 
  Clock,
  TrendingUp,
  Building2,
  ArrowLeft,
  Loader2,
  Calendar,
  Zap,
  Target,
  User,
  DollarSign
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { Deal, Company, Contact, getDeal, getCompany, getContact } from "@/lib/db";
import { Timeline } from "@/components/Timeline";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

export default function DealDetailPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchData() {
      if (!id || !user || !profile) return;
      setLoading(true);
      try {
        const dealData = await getDeal(id);
        if (dealData) {
          // Ownership Check for non-admins
          if (profile.role !== 'Admin' && dealData.ownerId !== user.id) {
            toast.error("Você não tem permissão para acessar este negócio.");
            router.push("/pipeline");
            return;
          }

          setDeal(dealData);

          if (dealData.companyId) {
            const companyData = await getCompany(dealData.companyId);
            if (companyData) {
              setCompany(companyData);
            }
          }

          if (dealData.contactId) {
            const contactData = await getContact(dealData.contactId);
            if (contactData) {
              setContact(contactData);
            }
          }
        } else {
          router.push("/pipeline");
        }
      } catch (error) {
        console.error("Error fetching deal detail:", error);
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

  if (!deal) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans selection:bg-blue-100">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/pipeline" className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-bold text-slate-900 tracking-tight text-lg">Detalhes do Negócio</h1>
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
              />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Main Card: Deal Overview */}
          <section className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-3xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <DollarSign className="w-12 h-12" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{deal.title}</h2>
                    <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-green-100">
                      {deal.stage}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-500 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />
                      <span>{company?.name || "Empresa Individual"}</span>
                    </div>
                    {contact && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        <span>{contact.name}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-2xl font-bold text-slate-900 pt-2">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 w-full lg:w-auto">
                <button 
                  onClick={() => router.push(`/messages`)}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  Mensagem
                </button>
                <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-[#1e3a8a] text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-900/20">
                  <Zap className="w-4 h-4" />
                  Avançar Estágio
                </button>
              </div>
            </div>
          </section>

          {/* Grid Layout */}
          <div className="grid grid-cols-12 gap-8">
            
            {/* Left Column: Timeline */}
            <div className="col-span-12 lg:col-span-8">
              <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-8 border-b flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">Linha do Tempo & Notas</h3>
                  <Clock className="w-5 h-5 text-slate-400" />
                </div>
                <div className="p-8">
                  <Timeline category="deal" relatedId={id} />
                </div>
              </div>
            </div>

            {/* Right Column: Info Cards */}
            <div className="col-span-12 lg:col-span-4 space-y-8">
              {/* Linked Records */}
              <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Registros Vinculados</h3>
                
                <div className="space-y-4">
                  {company && (
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Building2 className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Empresa</p>
                        <p className="text-sm font-bold text-slate-900 truncate">{company.name}</p>
                      </div>
                    </div>
                  )}

                  {contact && (
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contato</p>
                        <p className="text-sm font-bold text-slate-900 truncate">{contact.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-[#1e3a8a] rounded-[32px] p-8 text-white shadow-xl shadow-blue-900/10">
                <div className="flex items-center gap-3 mb-6">
                  <Calendar className="w-5 h-5 text-blue-300" />
                  <h3 className="text-lg font-bold">Próximos Passos</h3>
                </div>
                <p className="text-sm text-blue-100 mb-6 leading-relaxed">
                  Agende uma reunião ou crie uma tarefa para manter este negócio em movimento.
                </p>
                <button className="w-full py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl font-bold text-xs uppercase tracking-widest transition-all">
                  Agendar Atividade
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
