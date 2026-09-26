"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Plus, 
  ChevronLeft, 
  Globe, 
  RotateCcw, 
  Home, 
  Loader2 
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { recordAuditEvent } from "@/lib/audit";
import { 
  subscribeToProperties, 
  deleteProperty, 
  togglePropertyFeatured,
  Property, 
  getContacts, 
  Contact 
} from "@/lib/db";
import { formatCurrencyBRL, parseCurrencyBRLToNumber } from "@/lib/utils";
import { toast } from "sonner";

// Modular Components
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyFilterBar } from "@/components/properties/PropertyFilterBar";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { PropertyMapModal } from "@/components/properties/PropertyMapModal";
import { PropertyShareModal } from "@/components/properties/PropertyShareModal";
import { VitrineShareModal } from "@/components/properties/VitrineShareModal";

export default function PropertiesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<'list' | 'form'>('list');
  const [properties, setProperties] = useState<Property[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Selection States
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [isDeletingProperty, setIsDeletingProperty] = useState(false);
  const [activeMapProperty, setActiveMapProperty] = useState<Property | null>(null);
  const [sharingProperty, setSharingProperty] = useState<Property | null>(null);
  const [sharingText, setSharingText] = useState("");
  const [isVitrineModalOpen, setIsVitrineModalOpen] = useState(false);

  // Filters State
  const [search, setSearch] = useState("");
  const [searchStreet, setSearchStreet] = useState("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("all");
  const [displayMinPrice, setDisplayMinPrice] = useState("");
  const [displayMaxPrice, setDisplayMaxPrice] = useState("");
  const [bedroomsFilter, setBedroomsFilter] = useState<string>("all");
  const [parkingFilter, setParkingFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  const [onlyFeaturedFilter, setOnlyFeaturedFilter] = useState(false);

  // WhatsApp Message Generator
  const generateWhatsappMessage = useCallback((property: Property) => {
    const priceFormatted = new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL', 
      maximumFractionDigits: 0 
    }).format(property.price);

    const financingTxt = property.acceptsFinancing ? "Sim" : "Não";
    
    let photosText = "";
    if (property.imageUrls && property.imageUrls.length > 0) {
      photosText = "\n📸 *Fotos do Imóvel:*\n" + property.imageUrls.map((url, i) => `Imagem ${i+1}: ${url}`).join("\n");
    }

    const publicUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/p/${property.id}`
      : `https://sales-score-crm.com/p/${property.id}`;

    return `✨ *OPORTUNIDADE IMOBILIÁRIA* ✨
🏡 *${property.title}*
${property.buildingName ? `🏢 *Edifício/Condomínio:* ${property.buildingName}\n` : ''}
📍 *Localização:* ${property.location}
💰 *Valor:* ${priceFormatted}
${property.condoFee && property.condoFee > 0 ? `🏢 *Condomínio:* ${formatCurrencyBRL(property.condoFee)}/mês\n` : ''}${property.iptu && property.iptu > 0 ? `🏛️ *IPTU:* ${formatCurrencyBRL(property.iptu)}/ano\n` : ''}
📐 *Área:* ${property.area} m²
🛏 *Quartos:* ${property.bedrooms} dormitórios
🚿 *Banheiros:* ${property.bathrooms} banheiros
🚗 *Vagas:* ${property.parkingSpots} vagas
✍️ *Tipo:* ${property.type.substring(0,1).toUpperCase() + property.type.substring(1)}
🏦 *Aceita Financiamento:* ${financingTxt}
${property.tags && property.tags.length > 0 ? `✨ *Diferenciais:* ${property.tags.join(', ')}\n` : ''}
📄 *Descrição do Imóvel:*
${property.description || "Consulte-nos para mais detalhes!"}
${photosText}

🔗 *Link Público de Captura (Instagram/Bio):*
${publicUrl}

---
Estou à disposição para agendarmos uma visita e simularmos as melhores condições! 🚀`;
  }, []);

  useEffect(() => {
    if (sharingProperty) {
      setSharingText(generateWhatsappMessage(sharingProperty));
    } else {
      setSharingText("");
    }
  }, [sharingProperty, generateWhatsappMessage]);

  // Auth protection & Realtime subscriptions
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (!user || !profile) return;
    
    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    const unsubscribe = subscribeToProperties((data) => {
      setProperties(data);
      setLoading(false);
    }, ownerId);

    getContacts(ownerId).then(data => {
      if (Array.isArray(data)) {
        setContacts(data);
      }
    }).catch(err => {
      console.error("Error loading contacts in properties page:", err);
    });

    return () => unsubscribe();
  }, [user, profile, authLoading, router]);

  // Safety timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading && properties.length === 0) {
        setLoading(false);
      }
    }, 7000);
    return () => clearTimeout(timer);
  }, [loading, properties.length]);

  // Neighborhoods Memo
  const availableNeighborhoods = useMemo(() => {
    const set = new Set<string>();
    properties.forEach(p => {
      if (p.neighborhood && p.neighborhood.trim()) {
        set.add(p.neighborhood.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [properties]);

  // Filtered Properties Memo
  const filteredProperties = useMemo(() => {
    if (typeof window === 'undefined') return [];
    
    const query = search.trim().toLowerCase();
    const streetQuery = searchStreet.trim().toLowerCase();
    const minPriceNum = displayMinPrice ? parseCurrencyBRLToNumber(displayMinPrice) : 0;
    const maxPriceNum = displayMaxPrice ? parseCurrencyBRLToNumber(displayMaxPrice) : 0;

    return properties.filter((p) => {
      if (onlyFeaturedFilter && !p.isFeatured) return false;

      if (query) {
        const matchesTitle = (p.title || "").toLowerCase().includes(query);
        const matchesBuilding = (p.buildingName || "").toLowerCase().includes(query);
        const matchesNeighborhood = (p.neighborhood || "").toLowerCase().includes(query);
        const matchesStreet = (p.street || "").toLowerCase().includes(query);
        const matchesLocation = (p.location || "").toLowerCase().includes(query);
        const matchesCity = (p.city || "").toLowerCase().includes(query);
        const matchesId = (p.id || "").toLowerCase().includes(query);
        const matchesTags = (p.tags || []).some(t => t.toLowerCase().includes(query));

        if (!matchesTitle && !matchesBuilding && !matchesNeighborhood && !matchesStreet && !matchesLocation && !matchesCity && !matchesId && !matchesTags) {
          return false;
        }
      }

      if (selectedFilterTags.length > 0) {
        const pTagsLower = (p.tags || []).map(t => t.toLowerCase());
        const pDescLower = (p.description || '').toLowerCase();
        const matchAllSelected = selectedFilterTags.every(tag => {
          const target = tag.toLowerCase();
          return pTagsLower.includes(target) || pDescLower.includes(target);
        });
        if (!matchAllSelected) return false;
      }

      if (streetQuery) {
        const pStreet = (p.street || "").toLowerCase();
        const pLocation = (p.location || "").toLowerCase();
        if (!pStreet.includes(streetQuery) && !pLocation.includes(streetQuery)) {
          return false;
        }
      }

      if (filterType !== "all" && p.type !== filterType) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;

      if (selectedNeighborhood !== "all") {
        const pNeigh = (p.neighborhood || "").trim().toLowerCase();
        if (pNeigh !== selectedNeighborhood.trim().toLowerCase()) return false;
      }

      const price = Number(p.price) || 0;
      if (minPriceNum > 0 && price < minPriceNum) return false;
      if (maxPriceNum > 0 && price > maxPriceNum) return false;

      if (bedroomsFilter !== "all") {
        const pBeds = Number(p.bedrooms) || 0;
        if (bedroomsFilter === "4+") {
          if (pBeds < 4) return false;
        } else {
          const reqBeds = Number(bedroomsFilter);
          if (pBeds < reqBeds) return false;
        }
      }

      if (parkingFilter !== "all") {
        const pSpots = Number(p.parkingSpots) || 0;
        if (parkingFilter === "2+") {
          if (pSpots < 2) return false;
        } else {
          const reqSpots = Number(parkingFilter);
          if (pSpots < reqSpots) return false;
        }
      }

      return true;
    });
  }, [
    properties,
    search,
    searchStreet,
    filterType,
    statusFilter,
    selectedNeighborhood,
    displayMinPrice,
    displayMaxPrice,
    bedroomsFilter,
    parkingFilter,
    selectedFilterTags,
    onlyFeaturedFilter
  ]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (searchStreet.trim()) count++;
    if (selectedNeighborhood !== "all") count++;
    if (displayMinPrice.trim()) count++;
    if (displayMaxPrice.trim()) count++;
    if (bedroomsFilter !== "all") count++;
    if (parkingFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    if (filterType !== "all") count++;
    if (onlyFeaturedFilter) count++;
    if (selectedFilterTags.length > 0) count += selectedFilterTags.length;
    return count;
  }, [
    search,
    searchStreet,
    selectedNeighborhood,
    displayMinPrice,
    displayMaxPrice,
    bedroomsFilter,
    parkingFilter,
    statusFilter,
    filterType,
    selectedFilterTags,
    onlyFeaturedFilter
  ]);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setSearchStreet("");
    setSelectedNeighborhood("all");
    setDisplayMinPrice("");
    setDisplayMaxPrice("");
    setBedroomsFilter("all");
    setParkingFilter("all");
    setStatusFilter("all");
    setFilterType("all");
    setSelectedFilterTags([]);
    setOnlyFeaturedFilter(false);
    recordAuditEvent({
      action: 'SEARCH_PROPERTIES',
      title: 'Limpeza de Filtros do Catálogo',
      content: 'Usuário limpou todos os filtros aplicados no catálogo de imóveis.',
      severity: 'low',
      category: 'modification'
    });
  }, []);

  const setPricePreset = useCallback((min: number | null, max: number | null) => {
    setDisplayMinPrice(min ? formatCurrencyBRL(min) : "");
    setDisplayMaxPrice(max ? formatCurrencyBRL(max) : "");
  }, []);

  const handleToggleFeatured = async (property: Property) => {
    const nextVal = !property.isFeatured;
    setProperties(prev => prev.map(p => p.id === property.id ? { ...p, isFeatured: nextVal } : p));
    try {
      await togglePropertyFeatured(property.id, nextVal);
      toast.success(nextVal ? "Imóvel marcado como Destaque!" : "Imóvel removido dos Destaques.");
      recordAuditEvent({
        action: 'UPDATE_PROPERTY',
        title: nextVal ? 'Imóvel Destacado' : 'Destaque Removido',
        content: `Imóvel "${property.title}" ${nextVal ? 'foi destacado na vitrine.' : 'teve o destaque removido.'}`,
        severity: 'low',
        entityId: property.id,
        entityType: 'property'
      });
    } catch {
      setProperties(prev => prev.map(p => p.id === property.id ? { ...p, isFeatured: property.isFeatured } : p));
      toast.error("Não foi possível atualizar o status de destaque.");
    }
  };

  const confirmDeleteProperty = async () => {
    if (!propertyToDelete) return;
    const target = propertyToDelete;
    const id = target.id;

    setIsDeletingProperty(true);
    const toastId = toast.loading("Excluindo imóvel...");
    setProperties(prev => prev.filter(p => p.id !== id));
    
    try {
      await deleteProperty(id);
      recordAuditEvent({
        action: 'DELETE_PROPERTY',
        title: 'Exclusão de Imóvel',
        content: `Imóvel "${target?.title || id}" foi excluído do catálogo.`,
        severity: 'high',
        category: 'deletion',
        relatedId: id,
        entityType: 'property',
        metadata: {
          title: target?.title,
          price: target?.price,
          location: target?.location
        }
      });
      toast.success("Imóvel excluído com sucesso.", { id: toastId });
      setPropertyToDelete(null);
    } catch (err: any) {
      setProperties(prev => [...prev, target]);
      toast.error(`Erro ao excluir: ${err.message || "Falha técnica"}`, { id: toastId });
    } finally {
      setIsDeletingProperty(false);
    }
  };

  const handleNew = useCallback(() => {
    setEditingProperty(null);
    setView('form');
  }, []);

  const handleEdit = useCallback((property: Property) => {
    setEditingProperty(property);
    setView('form');
    recordAuditEvent({
      action: 'VIEW_PROPERTY_DETAILS',
      title: 'Consulta a Ficha do Imóvel',
      content: `Usuário consultou os dados cadastrais do imóvel "${property.title}".`,
      severity: 'low',
      category: 'modification',
      relatedId: property.id,
      entityId: property.id,
      entityType: 'property',
      metadata: {
        title: property.title,
        price: property.price,
        location: property.location
      }
    });
  }, []);

  if (authLoading || (loading && properties.length === 0)) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-14 md:h-16 bg-card border-b border-border pl-14 md:pl-6 px-3 sm:px-4 md:px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {view === 'form' && (
              <button 
                type="button"
                onClick={() => setView('list')}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors border border-border cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base md:text-lg font-bold text-foreground tracking-tight uppercase">
                {view === 'list' ? 'Inventário de Imóveis' : editingProperty ? 'Editar Unidade' : 'Cadastrar Unidade'}
              </h2>
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                {view === 'list' ? `${properties.length} imóveis ativos` : 'Preencha as especificações técnicas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {view === 'list' && (
              <>
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5" title="Conexão em tempo real ativa">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  <span className="text-[9px] font-bold uppercase tracking-tight hidden sm:inline">Ao Vivo</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsVitrineModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold uppercase tracking-wider shadow-2xs transition-all cursor-pointer"
                  title="Abrir e compartilhar a Vitrine Pública de Imóveis com seus clientes"
                >
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Vitrine Pública</span>
                  <span className="sm:hidden">Vitrine</span>
                </button>
                <button 
                  type="button"
                  onClick={handleNew}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Imóvel
                </button>
              </>
            )}
            {view === 'form' && (
              <button 
                type="button"
                onClick={() => setView('list')}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-muted/80 transition-all cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-5 bg-muted/5">
          {view === 'list' ? (
            <div className="max-w-7xl mx-auto space-y-4 md:space-y-5">
              {/* Universal Filter and Search Bar Component */}
              <PropertyFilterBar
                search={search}
                setSearch={setSearch}
                searchStreet={searchStreet}
                setSearchStreet={setSearchStreet}
                selectedNeighborhood={selectedNeighborhood}
                setSelectedNeighborhood={setSelectedNeighborhood}
                availableNeighborhoods={availableNeighborhoods}
                bedroomsFilter={bedroomsFilter}
                setBedroomsFilter={setBedroomsFilter}
                parkingFilter={parkingFilter}
                setParkingFilter={setParkingFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                displayMinPrice={displayMinPrice}
                setDisplayMinPrice={setDisplayMinPrice}
                displayMaxPrice={displayMaxPrice}
                setDisplayMaxPrice={setDisplayMaxPrice}
                onlyFeaturedFilter={onlyFeaturedFilter}
                setOnlyFeaturedFilter={setOnlyFeaturedFilter}
                isFilterOpen={isFilterOpen}
                setIsFilterOpen={setIsFilterOpen}
                filterType={filterType}
                setFilterType={setFilterType}
                selectedFilterTags={selectedFilterTags}
                setSelectedFilterTags={setSelectedFilterTags}
                properties={properties}
                activeFiltersCount={activeFiltersCount}
                clearAllFilters={clearAllFilters}
                setPricePreset={setPricePreset}
              />

              {/* Counter and Results Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-muted-foreground px-1">
                <div className="flex items-center gap-2">
                  <span>
                    Exibindo <strong className="text-foreground">{filteredProperties.length}</strong> de <strong className="text-foreground">{properties.length}</strong> {properties.length === 1 ? 'imóvel' : 'imóveis'}
                  </span>
                  {activeFiltersCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">
                      (Filtro ativado)
                    </span>
                  )}
                </div>
                {filteredProperties.length < properties.length && activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Ver todos os {properties.length} imóveis</span>
                  </button>
                )}
              </div>

              {loading && (
                <div className="flex items-center gap-1.5 text-primary font-bold uppercase text-[9px] tracking-wider">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Sincronizando...
                </div>
              )}

              {/* Properties Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
                <AnimatePresence>
                  {filteredProperties.map((property) => (
                    <PropertyCard 
                      key={property.id} 
                      property={property} 
                      onEdit={() => handleEdit(property)}
                      onDelete={() => setPropertyToDelete(property)}
                      onShowMap={() => setActiveMapProperty(property)}
                      onShare={() => setSharingProperty(property)}
                      onToggleFeatured={() => handleToggleFeatured(property)}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {filteredProperties.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-border rounded-2xl bg-card/40">
                  <Home className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <h3 className="text-base font-bold uppercase tracking-tight">Nenhum imóvel encontrado</h3>
                  <p className="text-muted-foreground text-xs font-medium mt-1 max-w-md">
                    {activeFiltersCount > 0 
                      ? "Nenhum imóvel corresponde aos critérios de pesquisa e filtros selecionados. Tente ajustar a busca ou limpar os filtros."
                      : "Seu inventário de imóveis está vazio. Comece cadastrando sua primeira unidade."}
                  </p>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Limpar todos os filtros ({activeFiltersCount})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <PropertyForm
              editingProperty={editingProperty}
              properties={properties}
              contacts={contacts}
              user={user}
              onCancel={() => setView('list')}
              onSuccess={() => {
                setEditingProperty(null);
                setView('list');
              }}
            />
          )}
        </div>
      </main>

      {/* Map Modal */}
      <PropertyMapModal
        property={activeMapProperty}
        onClose={() => setActiveMapProperty(null)}
      />

      {/* WhatsApp Property Sheet Share Modal */}
      <PropertyShareModal
        property={sharingProperty}
        sharingText={sharingText}
        setSharingText={setSharingText}
        onClose={() => setSharingProperty(null)}
      />

      {/* Public Vitrine Share Modal */}
      <VitrineShareModal
        isOpen={isVitrineModalOpen}
        onClose={() => setIsVitrineModalOpen(false)}
        profile={profile}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!propertyToDelete}
        onClose={() => setPropertyToDelete(null)}
        onConfirm={confirmDeleteProperty}
        title="Excluir Imóvel"
        itemName={propertyToDelete ? `${propertyToDelete.title} - ${propertyToDelete.location}` : undefined}
        itemType="imóvel do catálogo"
        isDeleting={isDeletingProperty}
      />
    </div>
  );
}
