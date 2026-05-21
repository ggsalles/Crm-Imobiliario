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
  Trash2,
  Sparkles,
  Compass,
  X,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatCurrencyBRL, parseCurrencyBRLToNumber } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { 
  Contact, 
  Company, 
  Deal,
  Activity,
  Property,
  getContact, 
  getCompany, 
  deleteContact,
  getDealsByContact,
  getActivitiesByContact,
  createActivity,
  createTimelineEvent,
  getProperties,
  createDeal,
  updateContact
} from "@/lib/db";
import { Timeline } from "@/components/Timeline";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

interface InterestProfile {
  maxPrice: number | null;
  minBedrooms: number | null;
  propertyType: string;
  neighborhoods: string[];
}

const parseInterestProfile = (departmentText?: string): InterestProfile => {
  const defaultProfile: InterestProfile = {
    maxPrice: null,
    minBedrooms: null,
    propertyType: "todos",
    neighborhoods: [],
  };

  if (!departmentText) return defaultProfile;

  try {
    const data = JSON.parse(departmentText);
    return {
      maxPrice: typeof data.maxPrice === 'number' ? data.maxPrice : null,
      minBedrooms: typeof data.minBedrooms === 'number' ? data.minBedrooms : null,
      propertyType: typeof data.propertyType === 'string' ? data.propertyType : "todos",
      neighborhoods: Array.isArray(data.neighborhoods) ? data.neighborhoods : [],
    };
  } catch (e) {
    return defaultProfile;
  }
};

export default function ContactDetail360Page() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  
  // Custom states for Interest Profile & Matchmaking
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  // Form states for profile editing
  const [formMaxPrice, setFormMaxPrice] = useState("");
  const [formMinBedrooms, setFormMinBedrooms] = useState("");
  const [formPropertyType, setFormPropertyType] = useState("todos");
  const [formNeighborhoodsText, setFormNeighborhoodsText] = useState("");

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
          
          const [dealsData, activitiesData, propertiesData] = await Promise.all([
            getDealsByContact(id),
            getActivitiesByContact(id),
            getProperties()
          ]);
          
          setDeals(dealsData);
          setActivities(activitiesData);
          setProperties(propertiesData);

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

  interface MatchingProperty {
    property: Property;
    score: number;
    criteria: {
      price: boolean;
      type: boolean;
      bedrooms: boolean;
      neighborhood: boolean;
    };
  }

  const getMatchingProperties = (): MatchingProperty[] => {
    if (!contact || contact.type !== 'cliente') return [];
    
    const profileOfInt = parseInterestProfile(contact.department);
    
    const isEmptyProfile = !profileOfInt.maxPrice && !profileOfInt.minBedrooms && profileOfInt.propertyType === 'todos' && profileOfInt.neighborhoods.length === 0;
    if (isEmptyProfile) return [];

    return properties
      .filter(p => p.status === 'disponível')
      .map(p => {
        let finalScore = 0;
        let possibleScore = 0;
        
        if (profileOfInt.maxPrice) {
          possibleScore += 25;
          if (p.price <= profileOfInt.maxPrice) finalScore += 25;
          else if (p.price <= profileOfInt.maxPrice * 1.15) finalScore += 10;
        }
        
        if (profileOfInt.propertyType && profileOfInt.propertyType !== 'todos') {
          possibleScore += 25;
          if (p.type === profileOfInt.propertyType) finalScore += 25;
        }
        
        if (profileOfInt.minBedrooms) {
          possibleScore += 25;
          if (p.bedrooms && p.bedrooms >= profileOfInt.minBedrooms) finalScore += 25;
        }
        
        if (profileOfInt.neighborhoods && profileOfInt.neighborhoods.length > 0) {
          possibleScore += 25;
          const propNeighborhoodClean = (p.neighborhood || "").trim().toLowerCase();
          const matches = profileOfInt.neighborhoods.some(n => 
            propNeighborhoodClean.includes(n.trim().toLowerCase()) || 
            n.trim().toLowerCase().includes(propNeighborhoodClean)
          );
          if (matches) finalScore += 25;
        }

        const normScore = possibleScore > 0 ? Math.round((finalScore / possibleScore) * 100) : 0;

        return {
          property: p,
          score: normScore,
          criteria: {
            price: profileOfInt.maxPrice ? p.price <= profileOfInt.maxPrice : true,
            type: (profileOfInt.propertyType && profileOfInt.propertyType !== 'todos') ? p.type === profileOfInt.propertyType : true,
            bedrooms: profileOfInt.minBedrooms ? (p.bedrooms ? p.bedrooms >= profileOfInt.minBedrooms : false) : true,
            neighborhood: (profileOfInt.neighborhoods && profileOfInt.neighborhoods.length > 0) ? (p.neighborhood ? profileOfInt.neighborhoods.some(n => p.neighborhood!.trim().toLowerCase().includes(n.trim().toLowerCase()) || n.trim().toLowerCase().includes(p.neighborhood!.trim().toLowerCase())) : false) : true
          }
        };
      })
      .filter(mp => mp.score >= 40)
      .sort((a, b) => b.score - a.score);
  };

  const handleCreateDealFromMatch = async (property: Property) => {
    if (!contact || !user) return;
    
    try {
      const dealTitle = `${property.title} - ${contact.name}`;
      const value = property.price;
      
      await createDeal({
        title: dealTitle,
        value: value,
        stage: 'lead',
        contactId: contact.id,
        propertyId: property.id,
        ownerId: user.id
      });

      await createTimelineEvent({
        type: 'system',
        category: 'contact',
        relatedId: contact.id,
        content: `Lead de imóvel cruzado inteligentemente: associado ao imóvel "${property.title}" com preço de R$ ${property.price.toLocaleString('pt-BR')}.`,
        title: `Novo negócio criado de cruzamento`
      });

      toast.success("Cruzamento realizado! Novo negócio criado com sucesso.");
      
      const dealsUpdated = await getDealsByContact(contact.id);
      setDeals(dealsUpdated);
    } catch (e: any) {
      console.error("Error creating deal from match:", e);
      toast.error("Erro ao cruzar imóvel e criar negócio.");
    }
  };

  const handleSaveInterestProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) return;

    setIsUpdatingProfile(true);
    try {
      const neighborhoods = formNeighborhoodsText
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

      const parsedPrice = parseCurrencyBRLToNumber(formMaxPrice);
      const maxPrice = parsedPrice > 0 ? parsedPrice : null;
      const minBedrooms = formMinBedrooms ? Number(formMinBedrooms) : null;
      
      const payloadProfile = {
        maxPrice,
        minBedrooms,
        propertyType: formPropertyType,
        neighborhoods,
      };

      const departmentText = JSON.stringify(payloadProfile);
      
      await updateContact(contact.id, { department: departmentText });

      const refreshed = await getContact(id);
      setContact(refreshed);
      
      toast.success("Perfil de interesse atualizado com sucesso!");
      setIsProfileModalOpen(false);

      await createTimelineEvent({
        type: 'system',
        category: 'contact',
        relatedId: contact.id,
        content: `Preferências de busca atualizadas: Orçamento máximo de R$ ${maxPrice?.toLocaleString('pt-BR') || 'Ilimitado'}, tipo: ${formPropertyType}, bairros: ${neighborhoods.join(', ') || 'qualquer'}.`,
        title: `Preferências atualizadas`
      });

    } catch (error: any) {
      console.error("Error saving interest profile:", error);
      toast.error("Erro ao salvar perfil de interesse.");
    } finally {
      setIsUpdatingProfile(false);
    }
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

              {/* Perfil de Interesse & Cruzamento Inteligente */}
              {contact.type === 'cliente' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* Perfil de Interesse Card */}
                  <div className="bg-card rounded-[32px] border border-border p-8 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <Compass className="w-5 h-5 animate-spin-slow-subtle" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground">Perfil de Interesse</h3>
                            <p className="text-xs text-muted-foreground">Filtros de preferência do cliente</p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const currentProfile = parseInterestProfile(contact.department);
                            setFormMaxPrice(currentProfile.maxPrice ? formatCurrencyBRL(currentProfile.maxPrice) : "");
                            setFormMinBedrooms(currentProfile.minBedrooms ? String(currentProfile.minBedrooms) : "");
                            setFormPropertyType(currentProfile.propertyType || "todos");
                            setFormNeighborhoodsText(currentProfile.neighborhoods ? currentProfile.neighborhoods.join(", ") : "");
                            setIsProfileModalOpen(true);
                          }}
                          className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center transition-all border border-border cursor-pointer group"
                          title="Melhorar Perfil de Interesse"
                        >
                          <Edit2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                      </div>

                      {(() => {
                        const profileOfInt = parseInterestProfile(contact.department);
                        const hasProfile = profileOfInt.maxPrice || profileOfInt.minBedrooms || (profileOfInt.propertyType && profileOfInt.propertyType !== "todos") || profileOfInt.neighborhoods.length > 0;
                        
                        if (!hasProfile) {
                          return (
                            <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border p-5">
                              <Compass className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Sem critérios definidos</p>
                              <p className="text-[11px] leading-relaxed max-w-xs mx-auto">Configure as preferências de busca para que o sistema cruze com as propriedades disponíveis.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-muted/30 border border-border/80 rounded-2xl p-4 flex flex-col justify-center">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1">Orçamento Limite</span>
                                <span className="font-extrabold text-sm text-foreground">
                                  {profileOfInt.maxPrice ? `R$ ${profileOfInt.maxPrice.toLocaleString('pt-BR')}` : "Qualquer valor"}
                                </span>
                              </div>
                              
                              <div className="bg-muted/30 border border-border/80 rounded-2xl p-4 flex flex-col justify-center">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1">Qtd. Mín. Quartos</span>
                                <span className="font-extrabold text-sm text-foreground">
                                  {profileOfInt.minBedrooms ? `${profileOfInt.minBedrooms}+ Quartos` : "Livre"}
                                </span>
                              </div>

                              <div className="bg-muted/30 border border-border/80 rounded-2xl p-4 flex flex-col justify-center col-span-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Tipo de Propriedade</span>
                                  <span className="font-extrabold text-xs text-primary capitalize bg-primary/10 px-2.5 py-1 rounded-lg">
                                    {profileOfInt.propertyType && profileOfInt.propertyType !== 'todos' ? profileOfInt.propertyType : "Todos"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {profileOfInt.neighborhoods.length > 0 && (
                              <div className="space-y-1.5 bg-muted/20 border border-border/50 rounded-2xl p-4">
                                <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1">Bairros de Preferência</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {profileOfInt.neighborhoods.map((n, idx) => (
                                    <span key={idx} className="px-2.5 py-1 bg-background border border-border rounded-lg text-[9px] font-extrabold uppercase text-muted-foreground tracking-wide">
                                      {n.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="pt-6 border-t border-border mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          const currentProfile = parseInterestProfile(contact.department);
                          setFormMaxPrice(currentProfile.maxPrice ? formatCurrencyBRL(currentProfile.maxPrice) : "");
                          setFormMinBedrooms(currentProfile.minBedrooms ? String(currentProfile.minBedrooms) : "");
                          setFormPropertyType(currentProfile.propertyType || "todos");
                          setFormNeighborhoodsText(currentProfile.neighborhoods ? currentProfile.neighborhoods.join(", ") : "");
                          setIsProfileModalOpen(true);
                        }}
                        className="w-full py-3 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all gap-2 flex items-center justify-center border border-primary/20 cursor-pointer"
                      >
                        <Compass className="w-4 h-4 text-inherit" />
                        Definir Parâmetros de Busca
                      </button>
                    </div>
                  </div>

                  {/* Cruzamento Inteligente Card */}
                  <div className="bg-card rounded-[32px] border border-border p-8 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 animate-pulse">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground">Cruzamento Inteligente</h3>
                            <p className="text-xs text-muted-foreground">Matchmaking automatizado de imóveis</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#00E5FF] px-2.5 py-1.5 bg-[#00E5FF]/10 rounded-xl border border-[#00E5FF]/20">
                          {getMatchingProperties().length} Match(es)
                        </span>
                      </div>

                      {(() => {
                        const matches = getMatchingProperties();
                        if (matches.length === 0) {
                          return (
                            <div className="py-12 text-center text-muted-foreground bg-muted/15 rounded-2xl border border-dashed border-border p-6 flex flex-col justify-center items-center">
                              <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/75 mb-1">Nenhum imóvel compatível</p>
                              <p className="text-[11px] leading-relaxed max-w-sm mx-auto text-center">Configure filtros no Perfil de Interesse buscando bairros/preço que dêem match com o seu catálogo.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3.5 max-h-[295px] overflow-y-auto pr-1">
                            {matches.map(({ property, score, criteria }) => (
                              <div key={property.id} className="p-4 bg-muted/30 hover:bg-muted/65 rounded-2xl border border-border flex gap-4 transition-all hover:scale-[1.01] duration-300 relative group">
                                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-muted/10">
                                  {property.imageUrls && property.imageUrls.length > 0 ? (
                                    <Image
                                      src={property.imageUrls[0]}
                                      alt={property.title}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary text-xs font-bold">
                                      IMÓVEL
                                    </div>
                                  )}
                                  <div className="absolute top-1 left-1 bg-black/75 backdrop-blur-sm text-[8px] font-black px-1.5 py-0.5 rounded text-amber-400 uppercase tracking-widest">
                                    {property.type}
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0 pr-12">
                                  <h4 className="font-bold text-xs text-foreground truncate">{property.title}</h4>
                                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                                    <span className="truncate">{property.neighborhood ? `${property.neighborhood}, ${property.city}` : property.location}</span>
                                  </p>
                                  
                                  <div className="flex items-center gap-2 mt-2 font-mono text-[10px] text-muted-foreground">
                                    <span className="font-extrabold text-foreground">R$ {property.price.toLocaleString('pt-BR')}</span>
                                    <span>•</span>
                                    <span>{property.bedrooms || 0}Q</span>
                                  </div>
                                </div>

                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
                                  {/* Score Circle */}
                                  <div className={cn(
                                    "w-12 h-12 rounded-full border shadow-sm flex flex-col items-center justify-center select-none shrink-0",
                                    score >= 80 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" :
                                    score >= 60 ? "bg-primary/10 border-primary/30 text-primary" :
                                    "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                  )}>
                                    <span className="text-xs font-black leading-none">{score}%</span>
                                    <span className="text-[6px] font-black uppercase tracking-widest mt-0.5 opacity-80">Match</span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleCreateDealFromMatch(property)}
                                    className="w-10 h-10 rounded-xl bg-primary text-primary-foreground hover:opacity-95 transition-all flex items-center justify-center shadow shadow-primary/20 cursor-pointer"
                                    title="Iniciar Negócio com este Imóvel"
                                  >
                                    <Zap className="w-4 h-4 fill-primary-foreground text-primary-foreground shrink-0" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

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
                  <Timeline category="contact" relatedId={id} searchQuery={searchQuery} />
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
                            <div className="text-sm text-muted-foreground font-medium">Estágio: <span className="text-primary uppercase text-[10px] bg-primary/10 px-2 py-0.5 rounded-md font-bold">{
                              deal.stage === 'lead' ? 'Novo Lead' :
                              deal.stage === 'qualification' ? 'Qualificação' :
                              deal.stage === 'proposal' ? 'Proposta' :
                              deal.stage === 'negotiation' ? 'Análise Jurídica' :
                              deal.stage === 'closed' ? 'Vendido/Alugado' : deal.stage
                            }</span></div>
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

            </div>
          </div>

        </div>
      </main>

      {/* Modal Profile Edit */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-xl rounded-[32px] border border-border shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <Compass className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Filtros de Perfil de Interesse</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-all border border-border cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveInterestProfile} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 block mb-1.5">Orçamento Máximo (R$)</label>
                    <input
                      type="text"
                      placeholder="R$ 0,00"
                      value={formMaxPrice}
                      onChange={(e) => setFormMaxPrice(formatCurrencyBRL(e.target.value))}
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 block mb-1.5">Mínimo de Quartos</label>
                    <input
                      type="number"
                      placeholder="Ex: 3"
                      value={formMinBedrooms}
                      onChange={(e) => setFormMinBedrooms(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 block mb-1.5">Tipo de Imóvel</label>
                    <select
                      value={formPropertyType}
                      onChange={(e) => setFormPropertyType(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold font-sans"
                    >
                      <option value="todos">Todos os Tipos</option>
                      <option value="casa">Casa</option>
                      <option value="apartamento">Apartamento</option>
                      <option value="terreno">Terreno</option>
                      <option value="comercial">Comercial</option>
                      <option value="sobrado">Sobrado</option>
                      <option value="cobertura">Cobertura</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 block mb-1.5">Bairros de Interesse (Separados por vírgula)</label>
                    <input
                      type="text"
                      placeholder="Ex: Icaraí, Centro, Cambuí"
                      value={formNeighborhoodsText}
                      onChange={(e) => setFormNeighborhoodsText(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold"
                    />
                    <p className="text-[9px] text-muted-foreground font-medium mt-1.5 pl-1 leading-normal">O cruzamento vai buscar imóveis cujo bairro contenha alguma dessas palavras-chave.</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border bg-muted/5 -mx-8 -mb-8 p-6">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="px-6 py-3 bg-muted hover:bg-muted/80 border border-border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="px-6 py-3 bg-primary text-primary-foreground hover:opacity-95 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isUpdatingProfile ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Salvar Perfil
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

