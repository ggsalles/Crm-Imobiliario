"use client";

export const dynamic = 'force-dynamic';

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
  DollarSign,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { Deal, Company, Contact, getDeal, getCompany, getContact, updateDeal, getUserProfile, UserProfile, createActivity, createTimelineEvent } from "@/lib/db";
import { Timeline } from "@/components/Timeline";
import { formatCurrencyBRL } from "@/lib/utils";
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
  const [owner, setOwner] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Activity scheduling states
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityType, setActivityType] = useState<'meeting' | 'call' | 'task' | 'other'>('task');
  const [activityDate, setActivityDate] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [isSavingActivity, setIsSavingActivity] = useState(false);

  const handleOpenActivityModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const hours = String(tomorrow.getHours()).padStart(2, '0');
    const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
    
    setActivityDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    
    // Pre-populate with beautiful title
    const clientSuffix = contact?.name ? ` com ${contact.name}` : "";
    setActivityTitle(`Revisar negócio "${deal?.title || ""}"${clientSuffix}`);
    setActivityDescription("");
    setActivityType("task");
    setIsActivityModalOpen(true);
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityTitle.trim() || !user || !profile || !deal) return;

    setIsSavingActivity(true);
    try {
      await createActivity({
        title: activityTitle,
        type: activityType,
        date: new Date(activityDate).toISOString(),
        status: 'pending',
        contactId: deal.contactId || null,
        dealId: deal.id,
        description: activityDescription
      });

      // Log in deal timeline
      await createTimelineEvent({
        type: 'system',
        category: 'deal',
        relatedId: deal.id,
        content: `Nova ${
          activityType === 'meeting' ? 'reunião' : 
          activityType === 'task' ? 'tarefa' : 
          activityType === 'call' ? 'ligação' : 'atividade'
        } agendada para ${new Date(activityDate).toLocaleDateString('pt-BR')} às ${new Date(activityDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
        title: activityTitle,
        author_name: profile.displayName || profile.email
      });

      if (deal.contactId) {
        // Also log in contact timeline if exists
        try {
          await createTimelineEvent({
            type: 'system',
            category: 'contact',
            relatedId: deal.contactId,
            content: `Nova ${
              activityType === 'meeting' ? 'reunião' : 
              activityType === 'task' ? 'tarefa' : 
              activityType === 'call' ? 'ligação' : 'atividade'
            } agendada sob o negócio: "${deal.title}".`,
            title: activityTitle,
            author_name: profile.displayName || profile.email
          });
        } catch (contactTimelineErr) {
          console.warn("Could not log to contact timeline:", contactTimelineErr);
        }
      }

      toast.success("Atividade agendada com sucesso!");
      setIsActivityModalOpen(false);
      
      // Refresh deal details which will trigger updating UI and states
      await refreshData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao agendar atividade.");
    } finally {
      setIsSavingActivity(false);
    }
  };

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

        if (dealData.ownerId) {
          const ownerData = await getUserProfile(dealData.ownerId);
          setOwner(ownerData);
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
                      {
                        deal.stage === 'lead' ? 'Novo Lead' :
                        deal.stage === 'qualification' ? 'Qualificação' :
                        deal.stage === 'proposal' ? 'Proposta' :
                        deal.stage === 'negotiation' ? 'Análise Jurídica' :
                        deal.stage === 'closed' ? 'Vendido/Alugado' : deal.stage
                      }
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
                    {owner && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded-md text-[10px] font-black uppercase tracking-widest border border-border/50">
                        <div className="w-4 h-4 rounded-full overflow-hidden relative">
                           <Image 
                             src={owner.photoURL || `https://ui-avatars.com/api/?name=${owner.displayName}&background=6366f1&color=fff`}
                             alt={owner.displayName}
                             fill
                             className="object-cover"
                           />
                        </div>
                        <span className="text-muted-foreground">{owner.displayName}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-2xl font-black text-foreground pt-2">
                    {formatCurrencyBRL(deal.value)}
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
                <button 
                  disabled={loading}
                  onClick={async () => {
                    const STAGES = [
                      { id: 'lead', title: 'Novo Lead' },
                      { id: 'qualification', title: 'Qualificação / Visita' },
                      { id: 'proposal', title: 'Proposta' },
                      { id: 'negotiation', title: 'Análise Jurídica' },
                      { id: 'closed', title: 'Vendido / Alugado' }
                    ];
                    const currentIndex = STAGES.findIndex(s => s.id === deal.stage);
                    if (currentIndex < STAGES.length - 1) {
                      const nextStage = STAGES[currentIndex + 1];
                      try {
                        setLoading(true);
                        await updateDeal(deal.id, { stage: nextStage.id });
                        toast.success(`Estágio avançado para: ${nextStage.title}`);
                        await refreshData();
                      } catch (err) {
                        toast.error("Erro ao avançar estágio.");
                      } finally {
                        setLoading(false);
                      }
                    } else {
                      toast.info("Este negócio já está no último estágio.");
                    }
                  }}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-black uppercase tracking-widest text-xs hover:opacity-90 transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {loading ? "Processando..." : "Avançar Estágio"}
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
                <button 
                  onClick={handleOpenActivityModal}
                  className="w-full py-3 bg-primary-foreground/10 hover:bg-primary-foreground/20 backdrop-blur-md rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                >
                  Agendar Atividade
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Activity Scheduler Modal Overlay */}
      <AnimatePresence>
        {isActivityModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop with backdrop-blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsActivityModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            {/* Modal Body Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="relative w-full max-w-lg bg-card border border-border rounded-[32px] overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
              
              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-muted/20 relative shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground uppercase tracking-tight font-mono">Agendar Atividade</h3>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-black mt-0.5">Criar Nova Ação de Vendas</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setIsActivityModalOpen(false)}
                  className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content - Content scrollable inside maximum boundaries */}
              <form onSubmit={handleSaveActivity} className="flex-1 overflow-y-auto p-8 space-y-6">
                
                {/* Title */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground font-mono">
                    Título da Atividade
                  </label>
                  <input
                    type="text"
                    required
                    value={activityTitle}
                    onChange={(e) => setActivityTitle(e.target.value)}
                    placeholder="Ex: Ligar para apresentar proposta comercial"
                    className="w-full bg-muted/50 border border-border hover:border-border/80 focus:border-primary focus:outline-none rounded-2xl px-5 py-3.5 text-xs font-semibold text-foreground transition-all focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                {/* Grid Type / Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Activity Type Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground font-mono">
                      Tipo de Atividade
                    </label>
                    <select
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value as any)}
                      className="w-full bg-muted/50 border border-border hover:border-border/80 focus:border-primary focus:outline-none rounded-2xl px-4 py-3.5 text-xs font-bold text-foreground transition-all cursor-pointer font-sans"
                    >
                      <option value="task">📝 Tarefa</option>
                      <option value="call">📞 Ligação</option>
                      <option value="meeting">🤝 Reunião</option>
                      <option value="other">✨ Outro</option>
                    </select>
                  </div>

                  {/* Activity Date/Time */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground font-mono">
                      Data & Hora Limite
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={activityDate}
                      onChange={(e) => setActivityDate(e.target.value)}
                      className="w-full bg-muted/50 border border-border hover:border-border/80 focus:border-primary focus:outline-none rounded-2xl px-4 py-3 text-xs font-bold text-foreground transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Description input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground font-mono">
                    Descrição / Observações (Opcional)
                  </label>
                  <textarea
                    value={activityDescription}
                    onChange={(e) => setActivityDescription(e.target.value)}
                    placeholder="Insira notas adicionais, detalhes de contato ou links importantes para orientar a ação..."
                    className="w-full bg-muted/50 border border-border hover:border-border/80 focus:border-primary focus:outline-none rounded-2xl px-5 py-4 text-xs font-semibold text-foreground transition-all focus:ring-1 focus:ring-primary/20 h-28 resize-none"
                  />
                </div>

                {/* Action CTA Buttons */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={isSavingActivity}
                    onClick={() => setIsActivityModalOpen(false)}
                    className="order-last sm:order-first flex-1 py-3 px-4 border border-border rounded-xl font-bold uppercase tracking-wider text-[9px] text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingActivity || !activityTitle.trim()}
                    className="flex-1 py-3 px-6 bg-primary text-primary-foreground font-black rounded-xl text-[9px] uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSavingActivity ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Confirmar Agendamento"
                    )}
                  </button>
                </div>

              </form>

              {/* Footer */}
              <div className="px-8 py-3.5 border-t border-border bg-muted/10 text-center select-none shrink-0">
                <span className="text-[8px] text-muted-foreground/60 font-mono tracking-widest uppercase font-black">
                  SALESSCORE ACTION SCHEDULER
                </span>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
