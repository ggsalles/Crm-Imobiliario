"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Search, 
  ArrowLeft, 
  Loader2, 
  TrendingUp, 
  Users, 
  Clock, 
  Filter 
} from "lucide-react";
import { cn, formatCurrencyBRL, parseCurrencyBRLToNumber } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { recordAuditEvent } from "@/lib/audit";
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

import { ContactHeaderCard } from "@/components/contacts/detail/ContactHeaderCard";
import { ContactInterestSection, InterestProfile } from "@/components/contacts/detail/ContactInterestSection";
import { ContactDealsTable } from "@/components/contacts/detail/ContactDealsTable";
import { ContactActivitiesSidebar } from "@/components/contacts/detail/ContactActivitiesSidebar";
import { ContactInterestModal } from "@/components/contacts/detail/ContactInterestModal";

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
  const [, setCompany] = useState<Company | null>(null);
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
  const [formTemperature, setFormTemperature] = useState<'auto' | 'quente' | 'morno' | 'frio'>('auto');

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setLoading(true);
      try {
        const contactData = await getContact(id);
        setContact(contactData);
        
        if (contactData) {
          recordAuditEvent({
            action: 'VIEW_CONTACT_DETAILS',
            title: 'Consulta a Visão 360 do Contato',
            content: `Usuário abriu os detalhes do contato "${contactData.name}".`,
            severity: 'low',
            category: 'modification',
            relatedId: contactData.id,
            entityId: contactData.id,
            entityType: 'contact',
            metadata: {
              contactName: contactData.name,
              contactEmail: contactData.email
            }
          });

          if (contactData.companyId) {
            const companyData = await getCompany(contactData.companyId);
            setCompany(companyData);
          }
          
          const [dealsData, activitiesData, propertiesData] = await Promise.all([
            getDealsByContact(id),
            getActivitiesByContact(id),
            getProperties()
          ]);
          
          setDeals(dealsData);
          setActivities(activitiesData);
          setProperties(propertiesData);
        }
      } catch (err) {
        console.error("Error loading contact detail data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const interestProfile = useMemo(() => {
    return parseInterestProfile(contact?.department);
  }, [contact?.department]);

  // Matchmaking Algorithm
  const matchingProperties = useMemo(() => {
    if (!contact || contact.type !== 'cliente' || properties.length === 0) return [];

    const availableProps = properties.filter(p => p.status === 'disponível');
    const { maxPrice, minBedrooms, propertyType, neighborhoods } = interestProfile;

    const hasAnyCriteria = maxPrice !== null || minBedrooms !== null || (propertyType && propertyType !== 'todos') || neighborhoods.length > 0;
    if (!hasAnyCriteria) return [];

    const scored = availableProps.map(prop => {
      let score = 0;
      let matchedCriteria: string[] = [];
      const criteriaWeights = { price: 35, bedrooms: 25, type: 20, location: 20 };
      let totalPossibleWeight = 0;

      if (maxPrice !== null && maxPrice > 0) {
        totalPossibleWeight += criteriaWeights.price;
        if (prop.price <= maxPrice) {
          score += criteriaWeights.price;
          matchedCriteria.push("Preço dentro do orçamento");
        } else if (prop.price <= maxPrice * 1.15) {
          score += criteriaWeights.price * 0.5;
          matchedCriteria.push("Preço próximo (até +15%)");
        }
      }

      if (minBedrooms !== null && minBedrooms > 0) {
        totalPossibleWeight += criteriaWeights.bedrooms;
        if ((prop.bedrooms || 0) >= minBedrooms) {
          score += criteriaWeights.bedrooms;
          matchedCriteria.push(`${prop.bedrooms || 0} quartos (mín. ${minBedrooms})`);
        }
      }

      if (propertyType && propertyType !== "todos") {
        totalPossibleWeight += criteriaWeights.type;
        if (prop.type?.toLowerCase() === propertyType.toLowerCase()) {
          score += criteriaWeights.type;
          matchedCriteria.push(`Tipo: ${prop.type}`);
        }
      }

      if (neighborhoods.length > 0) {
        totalPossibleWeight += criteriaWeights.location;
        const propLoc = `${prop.neighborhood || ''} ${prop.city || ''} ${prop.location || ''}`.toLowerCase();
        const hasNeighborhoodMatch = neighborhoods.some(n => propLoc.includes(n.toLowerCase()));
        if (hasNeighborhoodMatch) {
          score += criteriaWeights.location;
          matchedCriteria.push("Bairro compatível");
        }
      }

      const finalPercentage = totalPossibleWeight > 0 ? Math.round((score / totalPossibleWeight) * 100) : 0;
      return { property: prop, score: finalPercentage, criteria: matchedCriteria };
    });

    return scored
      .filter(item => item.score >= 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [contact, properties, interestProfile]);

  const handleEdit = useCallback(() => {
    router.push(`/contacts?edit=${id}`);
  }, [router, id]);

  const handleDelete = useCallback(async () => {
    if (!contact) return;
    if (confirm(`Tem certeza que deseja excluir o contato ${contact.name}?`)) {
      try {
        await deleteContact(contact.id);
        toast.success("Contato excluído com sucesso!");
        router.push('/contacts');
      } catch (err) {
        console.error(err);
        toast.error("Erro ao excluir contato.");
      }
    }
  }, [contact, router]);

  const handleCreateDealFromMatch = useCallback(async (matchedProperty: Property) => {
    if (!user || !contact) return;
    try {
      const dealTitle = `${matchedProperty.title} - ${contact.name}`;
      const value = matchedProperty.price;

      const newDealId = await createDeal({
        title: dealTitle,
        value: value,
        stage: 'lead',
        contactId: contact.id,
        propertyId: matchedProperty.id,
        ownerId: user.id
      });

      recordAuditEvent({
        action: 'CREATE_DEAL_FROM_MATCH',
        title: 'Criação de Negócio via Cruzamento Inteligente',
        content: `Negócio "${dealTitle}" criado via match do imóvel "${matchedProperty.title}" com o contato "${contact.name}".`,
        severity: 'info',
        category: 'modification',
        relatedId: typeof newDealId === 'string' ? newDealId : undefined,
        entityType: 'deal',
        metadata: {
          dealTitle,
          contactId: contact.id,
          propertyId: matchedProperty.id,
          value
        }
      });

      await createTimelineEvent({
        type: 'system',
        category: 'contact',
        relatedId: contact.id,
        content: `Lead de imóvel cruzado: associado ao imóvel "${matchedProperty.title}" no valor de R$ ${value.toLocaleString('pt-BR')}.`,
        title: `Novo negócio de cruzamento`
      });

      toast.success("Negócio criado no funil com sucesso!");
      const updatedDeals = await getDealsByContact(contact.id);
      setDeals(updatedDeals);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar negócio a partir do cruzamento.");
    }
  }, [user, contact]);

  const handleSaveInterestProfile = useCallback(async (e: React.FormEvent) => {
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
      const tempUpdated = contact.temperature !== formTemperature;
      
      await updateContact(contact.id, { 
        department: departmentText,
        temperature: formTemperature
      });

      recordAuditEvent({
        action: 'UPDATE_CONTACT',
        title: 'Atualização de Perfil de Interesse',
        content: `Perfil de busca e preferências do contato "${contact.name}" foram atualizados.`,
        severity: 'medium',
        category: 'modification',
        relatedId: contact.id,
        entityId: contact.id,
        entityType: 'contact',
        metadata: {
          contactName: contact.name,
          temperature: formTemperature
        }
      });

      const refreshed = await getContact(id);
      setContact(refreshed);

      toast.success("Perfil de interesse atualizado com sucesso!");
      setIsProfileModalOpen(false);

      if (tempUpdated) {
        const tempLabels: Record<string, string> = {
          auto: "🤖 Inteligente (Calculado pelo Funil)",
          quente: "🔥 Quente",
          morno: "⚡ Morno",
          frio: "❄️ Frio"
        };
        const newLabel = tempLabels[formTemperature] || '🤖 Inteligente';
        await createTimelineEvent({
          type: 'system',
          category: 'contact',
          relatedId: contact.id,
          content: `Temperatura do Lead atualizada para: ${newLabel}`,
          title: 'Temperatura Atualizada',
          metadata: { type: 'temperature_update', from: contact.temperature, to: formTemperature }
        });
      }

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
  }, [contact, id, formNeighborhoodsText, formMaxPrice, formMinBedrooms, formPropertyType, formTemperature]);

  const handleQuickAction = useCallback(async (type: 'call' | 'meeting' | 'task' | 'other') => {
    if (!user || !profile || !contact) return;
    
    const titles = {
      call: "Ligação com " + contact.name,
      meeting: "Reunião com " + contact.name,
      task: "Tarefa para " + contact.name,
      other: "Outra atividade com " + contact.name
    };

    try {
      const newActId = await createActivity({
        title: titles[type],
        type: type === 'meeting' ? 'meeting' : (type === 'task' ? 'task' : (type === 'call' ? 'call' : 'other')),
        date: new Date().toISOString(),
        status: 'pending',
        contactId: contact.id
      });

      recordAuditEvent({
        action: 'CREATE_ACTIVITY',
        title: 'Criação de Atividade para o Contato',
        content: `Atividade "${titles[type]}" vinculada ao contato "${contact.name}".`,
        severity: 'info',
        category: 'modification',
        relatedId: typeof newActId === 'string' ? newActId : undefined,
        entityType: 'activity',
        metadata: {
          title: titles[type],
          contactId: contact.id,
          contactName: contact.name,
          type
        }
      });

      await createTimelineEvent({
        type: 'system',
        category: 'contact',
        relatedId: contact.id,
        content: `Nova ${type === 'meeting' ? 'reunião' : (type === 'task' ? 'tarefa' : (type === 'call' ? 'ligação' : 'atividade'))} agendada.`,
        title: titles[type]
      });

      toast.success("Ação registrada com sucesso!");
      const updated = await getActivitiesByContact(contact.id);
      setActivities(updated);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar ação.");
    }
  }, [user, profile, contact]);

  // Memoized Stats
  const totalDealsValue = useMemo(() => {
    return deals.reduce((acc, deal) => acc + (deal.value || 0), 0);
  }, [deals]);

  const engagementLevel = useMemo(() => {
    const total = activities.length;
    if (total > 8) return { label: "Muito Alto", color: "text-emerald-500" };
    if (total > 5) return { label: "Alto", color: "text-primary" };
    if (total > 2) return { label: "Normal", color: "text-blue-500" };
    return { label: "Baixo", color: "text-orange-500" };
  }, [activities.length]);

  const lastContactDate = useMemo(() => {
    if (activities.length === 0) return "Nenhum";
    const sorted = [...activities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastDate = new Date(sorted[0].date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `Há ${diffDays} dias`;
    if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} sem.`;
    return lastDate.toLocaleDateString('pt-BR');
  }, [activities]);

  const tasks = useMemo(() => {
    return activities.filter(a => a.type === 'task');
  }, [activities]);

  const filteredDeals = useMemo(() => {
    if (!searchQuery.trim()) return deals;
    const q = searchQuery.toLowerCase().trim();
    return deals.filter(d => 
      (d.title || "").toLowerCase().includes(q) ||
      (d.stage || "").toLowerCase().includes(q)
    );
  }, [deals, searchQuery]);

  const statCards = useMemo(() => [ 
    { label: "TOTAL EM NEGÓCIOS", value: `R$ ${totalDealsValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp },
    { label: "ENGAJAMENTO", value: engagementLevel.label, icon: Users, color: engagementLevel.color },
    { label: "ÚLTIMO CONTATO", value: lastContactDate, icon: Clock },
  ], [totalDealsValue, engagementLevel, lastContactDate]);

  const openEditProfileModal = useCallback(() => {
    setFormMaxPrice(interestProfile.maxPrice ? formatCurrencyBRL(interestProfile.maxPrice) : "");
    setFormMinBedrooms(interestProfile.minBedrooms ? String(interestProfile.minBedrooms) : "");
    setFormPropertyType(interestProfile.propertyType || "todos");
    setFormNeighborhoodsText(interestProfile.neighborhoods ? interestProfile.neighborhoods.join(", ") : "");
    setFormTemperature(
      (contact as any)?.rawRole === 'manual_quente' ? 'quente' :
      (contact as any)?.rawRole === 'manual_morno' ? 'morno' :
      (contact as any)?.rawRole === 'manual_frio' ? 'frio' : 'auto'
    );
    setIsProfileModalOpen(true);
  }, [interestProfile, contact]);

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
          <ContactHeaderCard
            contact={contact}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          {/* Grid Layout for the rest */}
          <div className="grid grid-cols-12 gap-8">
            
            {/* Left Column: Stats, Interest & History */}
            <div className="col-span-12 lg:col-span-9 space-y-8">
              
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {statCards.map((stat, i) => (
                  <div key={i} className="bg-card p-8 rounded-[32px] border border-border shadow-sm">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{stat.label}</div>
                    <div className={cn("text-2xl font-bold text-foreground", stat.color)}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Perfil de Interesse & Cruzamento Inteligente */}
              {contact.type === 'cliente' && (
                <ContactInterestSection
                  interestProfile={interestProfile}
                  matchingProperties={matchingProperties}
                  onOpenModal={openEditProfileModal}
                  onCreateDealFromMatch={handleCreateDealFromMatch}
                />
              )}

              {/* History Section */}
              <div className="bg-card rounded-[32px] border border-border overflow-hidden shadow-sm">
                <div className="p-8 border-b border-border flex items-center justify-between bg-card sticky top-0 z-10">
                  <h2 className="text-xl font-bold text-foreground">Histórico de Interações</h2>
                  <div className="flex items-center gap-4">
                    <button className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <Filter className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-8 pb-12">
                  <Timeline category="contact" relatedId={id} searchQuery={searchQuery} />
                </div>
              </div>

              {/* Active Deals Table */}
              <ContactDealsTable deals={filteredDeals} />
            </div>

            {/* Right Column: Quick Actions & Sidebar Widgets */}
            <div className="col-span-12 lg:col-span-3">
              <ContactActivitiesSidebar
                tasks={tasks}
                onQuickAction={handleQuickAction}
              />
            </div>
          </div>

        </div>
      </main>

      {/* Modal Profile Edit */}
      <ContactInterestModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        formMaxPrice={formMaxPrice}
        setFormMaxPrice={setFormMaxPrice}
        formMinBedrooms={formMinBedrooms}
        setFormMinBedrooms={setFormMinBedrooms}
        formPropertyType={formPropertyType}
        setFormPropertyType={setFormPropertyType}
        formTemperature={formTemperature}
        setFormTemperature={setFormTemperature}
        formNeighborhoodsText={formNeighborhoodsText}
        setFormNeighborhoodsText={setFormNeighborhoodsText}
        isUpdatingProfile={isUpdatingProfile}
        onSubmit={handleSaveInterestProfile}
      />
    </div>
  );
}
