"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Search, 
  History, 
  Edit2, 
  MessageSquare, 
  MoreHorizontal, 
  Mail, 
  Phone, 
  MapPin, 
  Plus, 
  Tag, 
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
  Loader2,
  Trash2
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { 
  Contact, 
  Company, 
  Deal,
  Activity,
  getContact, 
  getCompany, 
  deleteContact,
  getDealsByContact,
  getActivitiesByContact,
  createActivity,
  createTimelineEvent
} from "@/lib/db";
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
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
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
          
          const [dealsData, activitiesData] = await Promise.all([
            getDealsByContact(id),
            getActivitiesByContact(id)
          ]);
          
          setDeals(dealsData);
          setActivities(activitiesData);

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

  const handleDelete = async () => {
    if (!id) return;
    if (confirm("Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.")) {
      try {
        await deleteContact(id);
        toast.success("Contato excluído com sucesso!");
        router.push("/contacts");
      } catch (err: any) {
        console.error("Error deleting contact:", err);
        const errorMessage = err.message || "Erro ao excluir contato.";
        toast.error(`Erro: ${errorMessage}`);
      }
    }
  };

  const handleEdit = () => {
    // For now we just go back to the list and open the modal
    // In a real app we might have a dedicated edit page or pass state
    router.push("/contacts?edit=" + id);
  };

  const handleQuickAction = async (type: 'call' | 'meeting' | 'task' | 'other') => {
    if (!user || !profile || !contact) return;
    
    const titles = {
      call: "Ligação com " + contact.name,
      meeting: "Reunião com " + contact.name,
      task: "Tarefa para " + contact.name,
      other: "Outra atividade com " + contact.name
    };

    try {
      await createActivity({
        title: titles[type],
        type: type === 'meeting' ? 'meeting' : (type === 'task' ? 'task' : (type === 'call' ? 'call' : 'other')),
        date: new Date().toISOString(),
        status: 'pending',
        contactId: contact.id
      });

      await createTimelineEvent({
        type: 'system',
        category: 'contact',
        relatedId: contact.id,
        content: `Nova ${type === 'meeting' ? 'reunião' : (type === 'task' ? 'tarefa' : (type === 'call' ? 'ligação' : 'atividade'))} agendada.`,
        title: titles[type]
      });

      toast.success("Ação registrada com sucesso!");
      // Refresh activities
      const updated = await getActivitiesByContact(contact.id);
      setActivities(updated);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar ação.");
    }
  };

  const getEngagementLevel = () => {
    const total = activities.length;
    if (total > 8) return { label: "Muito Alto", color: "text-emerald-500" };
    if (total > 5) return { label: "Alto", color: "text-primary" };
    if (total > 2) return { label: "Normal", color: "text-blue-500" };
    return { label: "Baixo", color: "text-orange-500" };
  };

  const getLastContactDate = () => {
    if (activities.length === 0) return "Nenhum";
    const sorted = [...activities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastDate = new Date(sorted[0].date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `Há ${diffDays} dias`;
    if (diffDays < 30) return `Há ${Math.floor(diffDays/7)} sem.`;
    return lastDate.toLocaleDateString('pt-BR');
  };

  if (authLoading || (loading && !user)) {
    return (
      <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div className="flex min-h-screen bg-background font-sans selection:bg-primary/10 text-foreground transition-colors duration-500">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header / Global Search */}
        <header className="h-20 bg-card border-b border-border px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/contacts" className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Pesquisar negócios, registros ou interações..."
                className="w-full pl-12 pr-4 py-3 bg-muted border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-sm text-foreground"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary p-0.5 relative">
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
          
          {/* Page Title */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Visão 360</h2>
            <div className="text-sm text-muted-foreground font-medium bg-card px-4 py-2 rounded-xl border border-border">
              ID: {contact.id.substring(0, 8)}...
            </div>
          </div>
          
          {/* Main Card: Profile */}
          <section className="bg-card rounded-[32px] border border-border p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-xl border-4 border-card bg-primary/10 flex items-center justify-center text-4xl font-bold text-primary uppercase">
                    {contact.name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-card rounded-full shadow-sm" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">{contact.name}</h1>
                    <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-lg border border-primary/20">
                      {contact.type === 'cliente' ? 'CLIENTE' : 'MEMBRO'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    {contact.type === 'cliente' ? (
                      <>
                        <Tag className="w-4 h-4" />
                        <span>Origem: {contact.source || "Não informada"}</span>
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4" />
                        <span>{contact.role} em {contact.department || "Empresa"}</span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex items-center gap-2 text-sm text-foreground bg-muted/30 px-3 py-1.5 rounded-xl border border-border">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {contact.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-foreground bg-muted/30 px-3 py-1.5 rounded-xl border border-border">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      {contact.phone}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-foreground bg-muted/30 px-3 py-1.5 rounded-xl border border-border">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      São Paulo, BR
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 w-full lg:w-auto">
                <button 
                  onClick={handleEdit}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl font-bold text-foreground hover:bg-muted transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-red-500/20 rounded-xl font-bold text-red-500 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
                {contact.type === 'equipe' && (
                  <button 
                    onClick={() => router.push('/messages')}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Mensagem
                  </button>
                )}
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
                  { label: "TOTAL EM NEGÓCIOS", value: `R$ ${deals.reduce((acc, deal) => acc + (deal.value || 0), 0).toLocaleString('pt-BR')}`, icon: TrendingUp },
                  { label: "ENGAJAMENTO", value: getEngagementLevel().label, icon: Users, color: getEngagementLevel().color },
                  { label: "ÚLTIMO CONTATO", value: getLastContactDate(), icon: Clock },
                ].map((stat, i) => (
                  <div key={i} className="bg-card p-8 rounded-[32px] border border-border shadow-sm">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{stat.label}</div>
                    <div className={cn("text-2xl font-bold text-foreground", stat.color)}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* History Section */}
              <div className="bg-card rounded-[32px] border border-border overflow-hidden shadow-sm">
                <div className="p-8 border-b border-border flex items-center justify-between bg-card sticky top-0 z-10">
                  <h2 className="text-xl font-bold text-foreground">Histórico de Interações</h2>
                  <div className="flex items-center gap-4">
                    <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                      <Filter className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-8 pb-12">
                  <Timeline category="contact" relatedId={id} />
                </div>
              </div>

              {/* Active Deals Table */}
              <div className="bg-card rounded-[32px] border border-border overflow-hidden shadow-sm">
                <div className="p-8 border-b border-border flex items-center justify-between text-foreground bg-card sticky top-0 z-10">
                  <h2 className="text-xl font-bold">Negócios Ativos</h2>
                  <button onClick={() => router.push('/pipeline')} className="text-primary font-bold text-sm hover:opacity-80">Ver todos</button>
                </div>
                {deals.length > 0 ? (
                  <div className="divide-y divide-border">
                    {deals.map((deal) => (
                      <div key={deal.id} className="p-6 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <TrendingUp className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-foreground">{deal.title}</h4>
                            <div className="text-sm text-muted-foreground font-medium">Estágio: <span className="text-primary uppercase text-[10px] bg-primary/10 px-2 py-0.5 rounded-md font-bold">{deal.stage}</span></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-foreground">R$ {deal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div className="text-xs text-muted-foreground">{new Date(deal.createdAt || '').toLocaleDateString('pt-BR')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-20 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <TrendingUp className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-bold text-foreground">Sem negócios ativos no momento</h3>
                    <p className="text-muted-foreground text-sm mt-1">Crie um novo negócio para começar o pipeline.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Quick Actions & Sidebar Widgets */}
            <div className="col-span-12 lg:col-span-3 space-y-8">
              
              {/* Quick Actions Card */}
              <div className="bg-primary rounded-[32px] p-8 text-white shadow-xl shadow-primary/10">
                <div className="flex items-center gap-3 mb-8">
                  <Zap className="w-5 h-5 text-white/70" />
                  <h3 className="text-lg font-bold">Ações Rápidas</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Reunião", icon: Calendar, type: 'meeting' },
                    { label: "Tarefa", icon: CheckSquare, type: 'task' },
                    { label: "Documento", icon: FileText, type: 'other' },
                    { label: "Ligação", icon: Phone, type: 'call' },
                  ].map((action, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleQuickAction(action.type as any)}
                      className="bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center gap-2 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <action.icon className="w-5 h-5 text-white/80" />
                      </div>
                      <span className="text-xs font-semibold text-white/90">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tasks & Reminders */}
              <div className="bg-card rounded-[32px] border border-border p-8 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-6">Tarefas & Lembretes</h3>
                {activities.filter(a => a.type === 'task').length > 0 ? (
                  <div className="space-y-4">
                    {activities.filter(a => a.type === 'task').slice(0, 3).map(task => (
                      <div key={task.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-2xl border border-border">
                        <div className={cn("w-5 h-5 rounded-md border-2 mt-0.5", task.status === 'completed' ? "bg-primary border-primary flex items-center justify-center" : "border-border")}>
                          {task.status === 'completed' && <CheckSquare className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <p className={cn("text-xs font-bold", task.status === 'completed' ? "text-muted-foreground line-through" : "text-foreground")}>{task.title}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(task.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center bg-muted/50 rounded-3xl border border-dashed border-border">
                    <CheckSquare className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sem tarefas</p>
                  </div>
                )}
              </div>

              {/* Location Widget */}
              <div className="bg-card rounded-[32px] border border-border overflow-hidden shadow-sm">
                <div className="p-8 pb-4">
                  <h3 className="text-lg font-bold text-foreground">Localização</h3>
                </div>
                <div className="relative h-64 bg-muted">
                  <Image 
                    src="https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=600&h=400&fit=crop" 
                    alt="Map" 
                    fill 
                    className="w-full h-full object-cover opacity-50 grayscale invert dark:opacity-30" 
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-card p-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-border">
                      <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-bold text-foreground whitespace-nowrap">Local não definido</span>
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

