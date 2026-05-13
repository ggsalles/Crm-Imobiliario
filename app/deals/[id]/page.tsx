"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Search, 
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
import { useCallback } from "react";

import { AISalesAssistant } from "@/components/AISalesAssistant";
import { PropertyMatcher } from "@/components/PropertyMatcher";

export default function DealDetailPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    if (!id || !user || !profile) return;
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
          const contactId = dealData.contactId; // Use local variable for safety
          const contactData = await getContact(contactId);
          if (contactData) {
            setContact(contactData);
          }
        }
      } else {
        router.push("/pipeline");
      }
    } catch (error) {
      console.error("Error fetching deal detail:", error);
    }
  }, [id, user, profile, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await refreshData();
      setLoading(false);
    }
    init();
  }, [refreshData]);

  if (authLoading || (loading && !user)) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!deal) return null;

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500 font-sans selection:bg-primary/20">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-card border-b border-border px-8 flex items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-4">
            <Link href="/pipeline" className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-black text-foreground tracking-tight text-lg uppercase tracking-widest">Detalhes do Negócio</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-muted relative">
              <Image 
                src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || "User"}&background=6366f1&color=fff`} 
                alt="Profile" 
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Main Card: Deal Overview */}
          <section className="bg-card rounded-[32px] border border-border p-8 shadow-md transition-colors">
            <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center text-primary">
                  <DollarSign className="w-12 h-12" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-black text-foreground tracking-tight">{deal.title}</h2>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-500/20">
                      {deal.stage}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground text-sm font-medium">
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
                  
                  <div className="text-2xl font-black text-foreground pt-2">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 w-full lg:w-auto">
                <button 
                  onClick={() => router.push(`/messages`)}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl font-black uppercase tracking-widest text-xs text-foreground hover:bg-muted transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  Mensagem
                </button>
                <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-black uppercase tracking-widest text-xs hover:opacity-90 transition-all shadow-lg shadow-primary/30">
                  <Zap className="w-4 h-4" />
                  Avançar Estágio
                </button>
              </div>
            </div>
          </section>

          {/* AI Sales Assistant */}
          <div id="ai-assistant">
            <AISalesAssistant deal={deal} contact={contact} company={company} />
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-12 gap-8">
            
            {/* Left Column: Timeline */}
            <div className="col-span-12 lg:col-span-8">
              <div className="bg-card rounded-[32px] border border-border overflow-hidden shadow-md transition-colors">
                <div className="p-8 border-b border-border flex items-center justify-between bg-muted/30">
                  <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Linha do Tempo & Notas</h3>
                  <Clock className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="p-8">
                  <Timeline category="deal" relatedId={id} />
                </div>
              </div>
            </div>

            {/* Right Column: Info Cards */}
            <div className="col-span-12 lg:col-span-4 space-y-8">
              {/* Linked Records */}
              <div className="bg-card rounded-[32px] border border-border p-8 shadow-md transition-colors">
                <h3 className="text-lg font-black text-foreground mb-6 uppercase tracking-tight">Registros Vinculados</h3>
                
                <div className="space-y-4">
                  {company && (
                    <div className="flex items-center gap-4 p-4 bg-muted rounded-2xl border border-border/50">
                      <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center shadow-sm">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Empresa</p>
                        <p className="text-sm font-bold text-foreground truncate">{company.name}</p>
                      </div>
                    </div>
                  )}

                  {contact && (
                    <div className="flex items-center gap-4 p-4 bg-muted rounded-2xl border border-border/50">
                      <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center shadow-sm">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Contato</p>
                        <p className="text-sm font-bold text-foreground truncate">{contact.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Smart Property Matching */}
              <PropertyMatcher deal={deal} contact={contact} onUpdate={refreshData} />

              {/* Next Steps */}
              <div className="bg-primary rounded-[32px] p-8 text-primary-foreground shadow-xl shadow-primary/30">
                <div className="flex items-center gap-3 mb-6">
                  <Calendar className="w-5 h-5 text-primary-foreground/60" />
                  <h3 className="text-lg font-black uppercase tracking-tight">Próximos Passos</h3>
                </div>
                <p className="text-sm text-primary-foreground/80 mb-6 leading-relaxed font-medium">
                  Agende uma reunião ou crie uma tarefa para manter este negócio em movimento.
                </p>
                <button className="w-full py-3 bg-primary-foreground/10 hover:bg-primary-foreground/20 backdrop-blur-md rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
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
