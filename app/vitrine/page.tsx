'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Search, 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Car, 
  Phone, 
  Share2, 
  SlidersHorizontal, 
  X, 
  Check, 
  ArrowRight, 
  ExternalLink,
  MessageCircle,
  Sparkles,
  ArrowUpDown,
  Home,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  Filter,
  Eye,
  Copy,
  Tag,
  Star,
  TrendingUp,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { Sidebar } from '@/components/sidebar';
import { POPULAR_PROPERTY_TAGS } from '@/lib/property-tags';
import { subscribeToShowcaseProperties, clearPropertiesCache } from '@/lib/db';

interface Property {
  id: string;
  title: string;
  type: string;
  status: string;
  price: number;
  location: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  street?: string;
  number?: string;
  cep?: string;
  area: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpots?: number;
  acceptsFinancing?: boolean;
  isFeatured?: boolean;
  condoFee?: number | null;
  iptu?: number | null;
  buildingName?: string | null;
  description?: string | null;
  tags?: string[];
  imageUrls?: string[];
  ownerId?: string;
  tenantId?: string;
  createdAt?: string;
}

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
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'area_desc'>('relevance');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
      const pStatus = (p.status || '').toLowerCase().trim();
      const isAvailable = pStatus === 'disponível' || pStatus === 'disponivel' || pStatus === 'available' || !pStatus;
      if (selectedStatus === 'all') {
        // Vitrine padrão: exibe única e exclusivamente imóveis disponíveis
        if (!isAvailable) return false;
      } else if (selectedStatus === 'disponível') {
        if (!isAvailable) return false;
      } else if (selectedStatus === 'reservado') {
        if (pStatus !== 'reservado' && pStatus !== 'reserved') return false;
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
  }, [properties, searchTerm, selectedType, selectedStatus, minBedrooms, minParking, maxPrice, selectedTags, onlyFeatured, sortBy]);

  // Clear filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedStatus('all');
    setMinBedrooms('all');
    setMinParking('all');
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
      <section className={
        showSidebar 
          ? "sticky top-0 z-20 bg-card border-b border-border py-3 px-4 sm:px-6 lg:px-8 shadow-2xs" 
          : "bg-card/90 border-b border-border py-3 px-4 sm:px-6 lg:px-8 relative z-10"
      }>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          
          {/* Results count */}
          <div className="text-xs sm:text-sm font-semibold text-muted-foreground">
            {loading ? (
              <span>Carregando imóveis...</span>
            ) : (
              <span>
                Mostrando <strong className="text-foreground">{filteredProperties.length}</strong> {filteredProperties.length === 1 ? 'imóvel disponível' : 'imóveis disponíveis'}
              </span>
            )}
          </div>

          {/* Filter Trigger & Sort dropdown */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeFiltersCount > 0 || isFilterDrawerOpen
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-card border-border text-foreground hover:bg-muted'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-primary text-[10px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Quick Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl border border-border bg-card text-foreground text-xs font-medium outline-none cursor-pointer"
            >
              <option value="relevance">Destaques</option>
              <option value="price_asc">Menor Preço</option>
              <option value="price_desc">Maior Preço</option>
              <option value="area_desc">Maior Metragem</option>
            </select>
          </div>
        </div>

        {/* Expandable Filter Drawer */}
        <AnimatePresence>
          {isFilterDrawerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 pb-2 border-t border-border/80 mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 max-w-7xl mx-auto">
                {/* Status Comercial */}
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Status Comercial
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: 'all', label: 'Todos' },
                      { id: 'disponível', label: 'Disp.' },
                      { id: 'reservado', label: 'Reserv.' },
                      { id: 'vendido', label: 'Vend.' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSelectedStatus(st.id)}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          selectedStatus === st.id
                            ? 'bg-primary text-white border-primary'
                            : 'bg-card border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dormitórios */}
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Quartos / Dormitórios
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {['all', 1, 2, 3, 4].map((beds) => (
                      <button
                        key={String(beds)}
                        onClick={() => setMinBedrooms(beds as any)}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          minBedrooms === beds
                            ? 'bg-primary text-white border-primary'
                            : 'bg-card border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {beds === 'all' ? 'Todos' : `${beds}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vagas de Garagem */}
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Vagas de Garagem
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {['all', 1, 2, 3].map((spots) => (
                      <button
                        key={String(spots)}
                        onClick={() => setMinParking(spots as any)}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          minParking === spots
                            ? 'bg-primary text-white border-primary'
                            : 'bg-card border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {spots === 'all' ? 'Todos' : `${spots}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preço Máximo */}
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Preço Máximo (R$)
                  </label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Ex: 1.500.000"
                    className="w-full px-3 py-1.5 rounded-xl border border-border bg-card text-foreground text-xs font-medium outline-none focus:border-primary"
                  />
                </div>

                {/* Limpar Filtros */}
                <div className="flex items-end">
                  <button
                    onClick={resetFilters}
                    className="w-full py-1.5 rounded-xl border border-dashed border-border hover:border-destructive hover:text-destructive text-muted-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpar Todos os Filtros
                  </button>
                </div>
              </div>

              {/* Diferenciais & Comodidades (Tags) */}
              <div className="pt-3 border-t border-border/80 mt-3 max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Diferenciais & Comodidades ({selectedTags.length} selecionados)
                    </span>
                  </div>
                  {selectedTags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTags([])}
                      className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      Limpar tags
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {POPULAR_PROPERTY_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSelectedTags(prev =>
                            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tags de Filtros Ativos na Barra */}
        {selectedTags.length > 0 && (
          <div className="pt-3 border-t border-border/70 mt-2 flex flex-wrap items-center gap-1.5 max-w-7xl mx-auto">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-primary" /> Tags ativas:
            </span>
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-bold border border-primary/20"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                  className="hover:opacity-70 cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setSelectedTags([])}
              className="text-[10px] font-bold text-muted-foreground hover:text-destructive hover:underline cursor-pointer ml-1"
            >
              Remover todas
            </button>
          </div>
        )}
      </section>

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
            {filteredProperties.map((prop) => {
              const coverPhoto = prop.imageUrls && prop.imageUrls.length > 0
                ? prop.imageUrls[0]
                : 'https://picsum.photos/seed/vitrineimovel/800/600';

              const totalPhotos = prop.imageUrls?.length || 0;

              return (
                <div
                  key={prop.id}
                  onClick={() => handleOpenProperty(prop.id)}
                  className="group bg-card rounded-2xl border border-border/80 overflow-hidden shadow-xs hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col cursor-pointer"
                >
                  {/* Photo Container */}
                  <div className="relative aspect-16/10 overflow-hidden bg-muted">
                    <Image
                      src={coverPhoto}
                      alt={prop.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    
                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                          {prop.type || 'Imóvel'}
                        </span>
                        {prop.isFeatured && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow-md shadow-amber-500/30 flex items-center gap-1 border border-amber-300/40">
                            <Sparkles className="w-2.5 h-2.5 fill-white" /> Destaque
                          </span>
                        )}
                        {prop.acceptsFinancing && (
                          <span className="px-2 py-0.5 rounded-lg bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-xs flex items-center gap-1">
                            <TrendingUp className="w-2.5 h-2.5" /> Financia
                          </span>
                        )}
                      </div>

                      {(() => {
                        const s = (prop.status || 'disponível').toLowerCase().trim();
                        if (s === 'reserved' || s === 'reservado') {
                          return (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-bold uppercase shadow-xs">
                              Reservado
                            </span>
                          );
                        }
                        if (s === 'vendido' || s === 'sold') {
                          return (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-white text-[10px] font-bold uppercase shadow-xs border border-white/20">
                              Vendido
                            </span>
                          );
                        }
                        if (s === 'alugado' || s === 'rented') {
                          return (
                            <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold uppercase shadow-xs">
                              Alugado
                            </span>
                          );
                        }
                        return (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold uppercase shadow-xs">
                            Disponível
                          </span>
                        );
                      })()}
                    </div>

                    {/* Bottom Photo Info */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                      <div className="text-white">
                        <span className="text-[10px] uppercase font-semibold opacity-90 block">Valor de Venda</span>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-lg sm:text-xl font-extrabold tracking-tight drop-shadow-sm">
                            {formatPrice(prop.price)}
                          </span>
                          {prop.area > 0 && prop.price > 0 && (
                            <span className="text-[10px] font-bold opacity-80 font-mono">
                              ({formatPrice(Math.round(prop.price / prop.area))}/m²)
                            </span>
                          )}
                        </div>
                      </div>

                      {totalPhotos > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-white/90 text-[10px] font-bold">
                          📸 {totalPhotos} {totalPhotos === 1 ? 'foto' : 'fotos'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      {prop.buildingName && (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary block line-clamp-1">
                          🏢 {prop.buildingName}
                        </span>
                      )}
                      
                      <h3 className="font-bold text-sm sm:text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {prop.title}
                      </h3>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground line-clamp-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/70" />
                        <span>
                          {prop.neighborhood ? `${prop.neighborhood}, ` : ''}
                          {prop.city || prop.location || 'Localização sob consulta'}
                        </span>
                      </div>

                      {/* Encargos Periódicos (Condomínio e IPTU) */}
                      {((prop.condoFee && prop.condoFee > 0) || (prop.iptu && prop.iptu > 0)) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground font-medium pt-1">
                          {prop.condoFee && prop.condoFee > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <span>Cond.:</span>
                              <strong className="text-foreground">{formatPrice(prop.condoFee)}</strong>
                            </span>
                          ) : null}
                          {prop.condoFee && prop.condoFee > 0 && prop.iptu && prop.iptu > 0 ? (
                            <span className="text-border">•</span>
                          ) : null}
                          {prop.iptu && prop.iptu > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <span>IPTU:</span>
                              <strong className="text-foreground">{formatPrice(prop.iptu)}</strong>
                            </span>
                          ) : null}
                        </div>
                      )}

                      {/* Diferenciais / Tags Badges */}
                      {prop.tags && prop.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {prop.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/15 truncate max-w-[120px]"
                            >
                              {tag}
                            </span>
                          ))}
                          {prop.tags.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">
                              +{prop.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Features Badges */}
                    <div className="pt-2 border-t border-border/60 grid grid-cols-4 gap-1 text-center">
                      <div className="bg-muted/40 rounded-lg p-1.5">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] font-medium">
                          <Bed className="w-3 h-3 text-primary/70" />
                          <span>Qts</span>
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          {prop.bedrooms || '-'}
                        </span>
                      </div>

                      <div className="bg-muted/40 rounded-lg p-1.5">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] font-medium">
                          <Bath className="w-3 h-3 text-primary/70" />
                          <span>Ban</span>
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          {prop.bathrooms || '-'}
                        </span>
                      </div>

                      <div className="bg-muted/40 rounded-lg p-1.5">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] font-medium">
                          <Car className="w-3 h-3 text-primary/70" />
                          <span>Vagas</span>
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          {prop.parkingSpots || '-'}
                        </span>
                      </div>

                      <div className="bg-muted/40 rounded-lg p-1.5">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] font-medium">
                          <Square className="w-3 h-3 text-primary/70" />
                          <span>Área</span>
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          {prop.area ? `${prop.area}m²` : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProperty(prop.id);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-95 transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <span>Ver Detalhes</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handlePropertyWhatsapp(e, prop)}
                        className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all cursor-pointer"
                        title="Tirar dúvidas no WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

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
