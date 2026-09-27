'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Building2, 
  Search, 
  Share2, 
  X, 
  Check, 
  MessageCircle, 
  Sparkles, 
  Home, 
  Eye, 
  Star, 
  RefreshCw 
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { Sidebar } from '@/components/sidebar';
import { subscribeToShowcaseProperties, clearPropertiesCache, getContacts, Contact } from '@/lib/db';
import { ShowcasePropertyCard, VitrineProperty as Property } from '@/components/vitrine/PropertyCard';
import { ShowcaseFilters } from '@/components/vitrine/ShowcaseFilters';
import { CreateDealFromPropertyModal } from '@/components/properties/CreateDealFromPropertyModal';

interface TenantInfo {
  id: string;
  name: string;
  slug?: string;
  phone?: string;
  city?: string;
  state?: string;
}

interface BrokerInfo {
  id: string;
  displayName: string;
  email?: string;
  photoUrl?: string;
}

const PROPERTY_TYPES = [
  { label: 'Todos os Tipos', value: 'all' },
  { label: 'Apartamento', value: 'apartamento' },
  { label: 'Casa', value: 'casa' },
  { label: 'Cobertura', value: 'cobertura' },
  { label: 'Comercial', value: 'comercial' },
  { label: 'Terreno', value: 'terreno' },
];

function VitrineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile } = useAuth();

  const isClientViewMode = searchParams.get('mode') === 'client';
  const showSidebar = !!user && !isClientViewMode;

  const tenantParam = searchParams.get('tenant') || searchParams.get('tenantId') || (showSidebar ? (profile?.tenantId || '') : '');
  const brokerParam = searchParams.get('broker') || searchParams.get('brokerId') || searchParams.get('ownerId') || '';

  const [properties, setProperties] = useState<Property[]>([]);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [broker, setBroker] = useState<BrokerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [minBedrooms, setMinBedrooms] = useState<number | 'all'>('all');
  const [minParking, setMinParking] = useState<number | 'all'>('all');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'area_desc'>('relevance');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [propertyForDeal, setPropertyForDeal] = useState<any | null>(null);

  useEffect(() => {
    if (showSidebar && user) {
      const ownerId = profile?.role === 'Admin' ? undefined : user.id;
      getContacts(ownerId).then(data => {
        if (Array.isArray(data)) setContacts(data);
      }).catch(err => console.warn("Erro ao carregar contatos na vitrine:", err));
    }
  }, [showSidebar, user, profile]);

  // Manual sync handler to force immediate fresh fetch from server
  const handleManualSync = async () => {
    setIsRefreshing(true);
    clearPropertiesCache();
    const targetTenant = tenantParam || profile?.tenantId || '';
    let propUrl = `/api/properties?public=true&limit=150&_t=${Date.now()}`;
    if (targetTenant) propUrl += `&tenantId=${encodeURIComponent(targetTenant)}`;
    if (brokerParam) propUrl += `&ownerId=${encodeURIComponent(brokerParam)}`;

    try {
      const propRes = await fetch(propUrl, { cache: 'no-store' });
      if (propRes.ok) {
        const propData = await propRes.json();
        if (Array.isArray(propData)) {
          setProperties(propData);
          setLastSyncTime(new Date());
          toast.success("Vitrine sincronizada com o cadastro de imóveis!");
        }
      }
    } catch (err) {
      console.error("Erro na sincronização manual:", err);
      toast.error("Erro ao sincronizar vitrine.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Real-time synchronization: subscribe to properties changes (Supabase Realtime + forceDataResync events)
  useEffect(() => {
    setLoading(true);
    const targetTenant = tenantParam || profile?.tenantId || '';

    // Invalida cache residual de vitrine para garantir dados atualizados da imobiliária
    clearPropertiesCache();

    // 1. Subscribe to properties with Realtime WebSocket & visibility-aware poll
    const unsubscribe = subscribeToShowcaseProperties(
      (data) => {
        setProperties(data);
        setLastSyncTime(new Date());
        setLoading(false);
      },
      targetTenant || undefined,
      brokerParam || undefined
    );

    // 2. Fetch tenant info if provided
    if (targetTenant) {
      fetch(`/api/tenants?id=${encodeURIComponent(targetTenant)}`)
        .then(res => res.ok ? res.json() : null)
        .then(tData => {
          if (tData) {
            setTenant({
              id: tData.id,
              name: tData.name || profile?.company || 'Imobiliária',
              slug: tData.slug,
              phone: tData.phone,
              city: tData.city,
              state: tData.state,
            });
          } else if (profile?.company) {
            setTenant({
              id: targetTenant,
              name: profile.company,
            });
          }
        })
        .catch(err => console.warn('Erro ao carregar tenant na vitrine:', err));
    } else if (profile?.company) {
      setTenant({
        id: profile.tenantId || '',
        name: profile.company,
      });
    }

    // 3. Fetch broker info if provided
    if (brokerParam) {
      fetch(`/api/profiles?id=${encodeURIComponent(brokerParam)}`)
        .then(res => res.ok ? res.json() : null)
        .then(bData => {
          if (bData) {
            setBroker({
              id: bData.id,
              displayName: bData.displayName || bData.display_name || 'Consultor de Imóveis',
              email: bData.email,
              photoUrl: bData.photoUrl || bData.photo_url,
            });
          }
        })
        .catch(err => console.warn('Erro ao carregar broker na vitrine:', err));
    }

    return () => {
      unsubscribe();
    };
  }, [tenantParam, brokerParam, profile?.tenantId, profile?.company]);

  // Format currency
  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Filtered & Sorted properties
  const filteredProperties = useMemo(() => {
    let result = properties.filter((p) => {
      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = p.title?.toLowerCase().includes(q);
        const matchLoc = p.location?.toLowerCase().includes(q);
        const matchNeigh = p.neighborhood?.toLowerCase().includes(q);
        const matchCity = p.city?.toLowerCase().includes(q);
        const matchBuilding = p.buildingName?.toLowerCase().includes(q);
        const matchDesc = p.description?.toLowerCase().includes(q);
        const matchTags = (p.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchTitle && !matchLoc && !matchNeigh && !matchCity && !matchBuilding && !matchDesc && !matchTags) {
          return false;
        }
      }

      // Selected Tags Filter (Characteristics / Amenities)
      if (selectedTags.length > 0) {
        const pTagsLower = (p.tags || []).map(t => t.toLowerCase());
        const pDescLower = (p.description || '').toLowerCase();
        const matchAllSelectedTags = selectedTags.every(tag => {
          const target = tag.toLowerCase();
          return pTagsLower.includes(target) || pDescLower.includes(target);
        });
        if (!matchAllSelectedTags) return false;
      }

      // Type
      if (selectedType !== 'all') {
        const pType = (p.type || '').toLowerCase();
        if (!pType.includes(selectedType)) return false;
      }

      // Commercial Status
      const pStatus = (p.status || 'disponível').toLowerCase().trim();
      const isAvailable = pStatus === 'disponível' || pStatus === 'disponivel' || pStatus === 'available' || !pStatus;
      const isReserved = pStatus === 'reservado' || pStatus === 'reserved';
      
      if (selectedStatus === 'all') {
        // Vitrine padrão: exibe imóveis ativos (disponíveis e reservados)
        if (!isAvailable && !isReserved) return false;
      } else if (selectedStatus === 'disponível') {
        if (!isAvailable) return false;
      } else if (selectedStatus === 'reservado') {
        if (!isReserved) return false;
      } else if (selectedStatus === 'vendido') {
        if (pStatus !== 'vendido' && pStatus !== 'sold') return false;
      } else if (selectedStatus === 'alugado') {
        if (pStatus !== 'alugado' && pStatus !== 'rented') return false;
      }

      // Bedrooms
      if (minBedrooms !== 'all') {
        if ((p.bedrooms || 0) < minBedrooms) return false;
      }

      // Parking
      if (minParking !== 'all') {
        if ((p.parkingSpots || 0) < minParking) return false;
      }

      // Min price
      if (minPrice && Number(minPrice) > 0) {
        if (p.price < Number(minPrice)) return false;
      }

      // Max price
      if (maxPrice && Number(maxPrice) > 0) {
        if (p.price > Number(maxPrice)) return false;
      }

      // Only Featured
      if (onlyFeatured && !p.isFeatured) {
        return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'area_desc') return (b.area || 0) - (a.area || 0);

      // Prioritize featured properties!
      const aFeatured = a.isFeatured ? 1 : 0;
      const bFeatured = b.isFeatured ? 1 : 0;
      if (bFeatured !== aFeatured) return bFeatured - aFeatured;

      return 0; // relevance / default order
    });

    return result;
  }, [properties, searchTerm, selectedType, selectedStatus, minBedrooms, minParking, minPrice, maxPrice, selectedTags, onlyFeatured, sortBy]);

  // Clear filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedStatus('all');
    setMinBedrooms('all');
    setMinParking('all');
    setMinPrice('');
    setMaxPrice('');
    setSelectedTags([]);
    setOnlyFeatured(false);
    setSortBy('relevance');
  };

  const activeFiltersCount = [
    selectedType !== 'all',
    selectedStatus !== 'all',
    minBedrooms !== 'all',
    minParking !== 'all',
    minPrice !== '',
    maxPrice !== '',
    onlyFeatured,
    selectedTags.length > 0,
    sortBy !== 'relevance'
  ].filter(Boolean).length;

  // Handle Share Vitrine
  const handleShareVitrine = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const targetTenant = tenantParam || profile?.tenantId || '';
    const shareUrl = targetTenant 
      ? `${origin}/vitrine?tenant=${targetTenant}` 
      : `${origin}/vitrine`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      toast.success('Link público da vitrine copiado para a área de transferência!');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Compose general WhatsApp message
  const handleGeneralWhatsapp = () => {
    const agencyName = tenant?.name || 'Imobiliária';
    const brokerName = broker?.displayName ? ` com o consultor ${broker.displayName}` : '';
    const text = encodeURIComponent(
      `Olá! Estou visitando a vitrine virtual da *${agencyName}*${brokerName} e gostaria de informações sobre os imóveis disponíveis.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Open property details
  const handleOpenProperty = (propertyId: string) => {
    router.push(`/p/${propertyId}`);
  };

  // Send WhatsApp inquiry for a specific property
  const handlePropertyWhatsapp = (e: React.MouseEvent, prop: Property) => {
    e.stopPropagation();
    const agencyName = tenant?.name || 'Imobiliária';
    const text = encodeURIComponent(
      `Olá! Vi o imóvel *${prop.title}* (${formatPrice(prop.price)}) na vitrine da *${agencyName}* e gostaria de agendar uma visita e tirar dúvidas.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Top Header Component
  const headerContent = (
    <header className={
      showSidebar 
        ? "h-16 shrink-0 bg-card border-b border-border pl-14 md:pl-6 px-4 md:px-6 flex items-center justify-between z-30" 
        : "sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border shadow-xs"
    }>
      <div className={showSidebar ? "w-full flex items-center justify-between gap-4" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4"}>
        
        {/* Logo & Agency Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white flex items-center justify-center font-black shadow-md shadow-primary/25 shrink-0">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight line-clamp-1">
                {tenant?.name || 'Vitrine de Imóveis'}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title={`Sincronizado em tempo real. Última checagem: ${lastSyncTime.toLocaleTimeString('pt-BR')}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sincronizada ao Vivo
              </span>
              {showSidebar && (
                <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  <Sparkles className="w-3 h-3" /> CRM Ativo
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {broker?.displayName ? (
                <span>Atendimento com <strong>{broker.displayName}</strong></span>
              ) : (
                <span>{tenant?.city ? `${tenant.city} - ${tenant.state || 'Brasil'}` : 'Carteira Exclusiva de Imóveis'}</span>
              )}
            </p>
          </div>
        </div>

        {/* Action buttons on header */}
        <div className="flex items-center gap-2">
          {/* Botão de Sincronização Manual */}
          <button
            onClick={handleManualSync}
            disabled={isRefreshing}
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
            title="Atualizar dados da vitrine diretamente do banco"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Sincronizando...' : 'Atualizar'}</span>
          </button>

          {showSidebar && (
            <button
              onClick={() => {
                const origin = typeof window !== 'undefined' ? window.location.origin : '';
                const targetTenant = tenantParam || profile?.tenantId || '';
                const url = targetTenant ? `${origin}/vitrine?tenant=${targetTenant}&mode=client` : `${origin}/vitrine?mode=client`;
                window.open(url, '_blank');
              }}
              className="hidden sm:flex px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Abrir como cliente em nova aba"
            >
              <Eye className="w-3.5 h-3.5 text-primary" />
              <span>Ver como Cliente</span>
            </button>
          )}

          <button
            onClick={handleShareVitrine}
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title="Compartilhar Link da Vitrine"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{copiedLink ? 'Copiado!' : 'Compartilhar'}</span>
          </button>

          <button
            onClick={handleGeneralWhatsapp}
            className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 shrink-0 fill-current" />
            <span className="hidden sm:inline">Falar no WhatsApp</span>
            <span className="sm:hidden">WhatsApp</span>
          </button>
        </div>
      </div>
    </header>
  );

  const vitrineScrollableContent = (
    <>
      {/* Top Notification if in Client Preview Mode */}
      {isClientViewMode && !!user && (
        <div className="bg-primary text-white py-2 px-4 text-xs font-bold flex items-center justify-between shadow-xs sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" />
            <span>Visualização da Vitrine como Cliente Final</span>
          </div>
          <button 
            onClick={() => router.push('/vitrine')}
            className="underline font-bold text-white hover:opacity-90 cursor-pointer"
          >
            Voltar ao Modo CRM com Menu
          </button>
        </div>
      )}

      {/* Hero Showcase Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-card to-background border-b border-border/60 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Catálogo Oficial de Imóveis</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Encontre o Imóvel Perfeito para Você
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Explore nossa seleção completa de casas, apartamentos e lançamentos atualizados em tempo real com fotos de alta qualidade e atendimento direto.
          </p>

          {/* Search bar inside Hero */}
          <div className="pt-4 max-w-2xl mx-auto">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 absolute left-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por condomínio, bairro, cidade, rua..."
                className="w-full pl-12 pr-10 py-3.5 sm:py-4 rounded-2xl bg-card border-2 border-border focus:border-primary text-sm sm:text-base font-medium shadow-lg transition-all outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Category Chips */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap pt-2">
            <button
              onClick={() => setOnlyFeatured(!onlyFeatured)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                onlyFeatured
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/25 ring-2 ring-amber-500/20'
                  : 'bg-card border-border/80 text-muted-foreground hover:text-amber-500 hover:bg-muted'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${onlyFeatured ? 'fill-white text-white' : 'text-amber-500'}`} />
              <span>⭐ Oportunidades em Destaque</span>
            </button>

            {PROPERTY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setSelectedType(t.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  selectedType === t.value
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-card border-border/80 text-muted-foreground hover:bg-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Filter and Control Bar */}
      <ShowcaseFilters
        filteredCount={filteredProperties.length}
        loading={loading}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        minBedrooms={minBedrooms}
        setMinBedrooms={setMinBedrooms}
        minParking={minParking}
        setMinParking={setMinParking}
        minPrice={minPrice}
        setMinPrice={setMinPrice}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        sortBy={sortBy}
        setSortBy={setSortBy}
        resetFilters={resetFilters}
        isFilterDrawerOpen={isFilterDrawerOpen}
        setIsFilterDrawerOpen={setIsFilterDrawerOpen}
        activeFiltersCount={activeFiltersCount}
        showSidebar={showSidebar}
      />

      {/* Main Grid Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
                <div className="aspect-16/10 bg-muted" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-6 bg-muted rounded w-1/3 pt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-12 text-center max-w-md mx-auto my-12 space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
              <Home className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              Nenhum imóvel encontrado
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Não encontramos imóveis disponíveis com os critérios selecionados no momento. Tente remover os filtros ou buscar por outro termo.
            </p>
            <button
              onClick={resetFilters}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-all shadow-xs cursor-pointer"
            >
              Ver Todos os Imóveis
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map((prop) => (
              <ShowcasePropertyCard
                key={prop.id}
                property={prop}
                onOpen={handleOpenProperty}
                onWhatsapp={handlePropertyWhatsapp}
                onCreateDeal={showSidebar ? (e, p) => {
                  e.stopPropagation();
                  setPropertyForDeal(p as any);
                } : undefined}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Deal Modal from Vitrine (when logged in) */}
      <CreateDealFromPropertyModal
        isOpen={!!propertyForDeal}
        property={propertyForDeal}
        contacts={contacts}
        onClose={() => setPropertyForDeal(null)}
      />

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-12 py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">
          {tenant?.name || 'Vitrine Virtual de Imóveis'}
        </p>
        <p>
          Imóveis atualizados em tempo real diretamente pelo sistema de gestão imobiliária.
        </p>
        <p className="text-[10px] text-muted-foreground/80">
          Valores, disponibilidade e condições sujeitos a alteração sem aviso prévio.
        </p>
      </footer>
    </>
  );

  // If user is logged into the CRM, render with CRM Sidebar
  if (showSidebar) {
    return (
      <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {headerContent}
          <div className="flex-1 overflow-y-auto relative selection:bg-primary/20">
            {vitrineScrollableContent}
          </div>
        </div>
      </div>
    );
  }

  // Pure public view (for clients accessing the link or in client preview mode)
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {headerContent}
      <div className="flex-1 flex flex-col">
        {vitrineScrollableContent}
      </div>
    </div>
  );
}

export default function VitrinePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    }>
      <VitrineContent />
    </Suspense>
  );
}
