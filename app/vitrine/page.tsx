'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
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
import { safeJsonParse } from '@/lib/safe-storage';
import { apiClient } from '@/lib/api-client';
import { ShowcasePropertyCard, VitrineProperty as Property } from '@/components/vitrine/PropertyCard';
import { ShowcaseFilters } from '@/components/vitrine/ShowcaseFilters';
import { UniversalPagination } from '@/components/properties/PropertyPagination';
import { CreateDealFromPropertyModal } from '@/components/properties/CreateDealFromPropertyModal';
import { matchSearchTerms } from '@/lib/search-utils';

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
  phone?: string;
  tenantId?: string;
}

import { PROPERTY_TYPES_LIST, matchPropertyType } from '@/lib/property-types';

const PROPERTY_TYPES = [
  { label: 'Todos os Tipos', value: 'all' },
  ...PROPERTY_TYPES_LIST.map((t) => ({ label: t.label, value: t.id })),
];

function VitrineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile } = useAuth();

  const isClientViewMode = searchParams.get('mode') === 'client';
  const showSidebar = !!user && !isClientViewMode;

  const tenantParam = searchParams.get('tenant') || searchParams.get('tenantId') || (showSidebar ? (profile?.tenantId || '') : '');
  const brokerParam = searchParams.get('broker') || searchParams.get('brokerId') || searchParams.get('ownerId') || '';
  const idsParam = searchParams.get('ids') || searchParams.get('imoveis') || '';
  const clientNameParam = searchParams.get('cliente') || searchParams.get('client') || '';

  const targetIds = useMemo(() => {
    if (!idsParam) return [];
    return idsParam.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }, [idsParam]);

  const isCuratedShowcase = targetIds.length > 0;

  const [properties, setProperties] = useState<Property[]>([]);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [broker, setBroker] = useState<BrokerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [minBedrooms, setMinBedrooms] = useState<number | 'all'>('all');
  const [minSuites, setMinSuites] = useState<number | 'all'>('all');
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(24);
  const crmScrollContainerRef = useRef<HTMLDivElement>(null);

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    if (crmScrollContainerRef.current) {
      crmScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handlePageSizeChange = useCallback((newSize: number | 'all') => {
    setPageSize(newSize);
    setCurrentPage(1);
    if (crmScrollContainerRef.current) {
      crmScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    // Ensure dark theme is applied on vitrine for all visitors (public link and CRM)
    document.documentElement.classList.add('dark');
    setMounted(true);
  }, []);

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
    let propUrl = `/api/properties?public=true&limit=10000&_t=${Date.now()}`;
    if (targetTenant) propUrl += `&tenantId=${encodeURIComponent(targetTenant)}`;
    if (brokerParam) propUrl += `&brokerId=${encodeURIComponent(brokerParam)}`;

    try {
      const propData = await apiClient.get<Property[]>(propUrl, { skipAuth: true });
      if (Array.isArray(propData)) {
        setProperties(propData);
        setLastSyncTime(new Date());
        toast.success("Vitrine sincronizada com o cadastro de imóveis!");
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
      apiClient.get<any>(`/api/tenants?id=${encodeURIComponent(targetTenant)}`, { skipAuth: true })
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
      apiClient.get<any>(`/api/profiles?id=${encodeURIComponent(brokerParam)}`, { skipAuth: true })
        .then(bData => {
          if (bData) {
            const brokerTenantId = bData.tenantId || bData.tenant_id;
            setBroker({
              id: bData.id,
              displayName: bData.displayName || bData.display_name || 'Consultor de Imóveis',
              email: bData.email,
              photoUrl: bData.photoUrl || bData.photo_url,
              phone: bData.phone,
              tenantId: brokerTenantId,
            });

            // Se targetTenant não veio na URL, resolve a imobiliária pelo cadastro do corretor!
            if (!targetTenant && brokerTenantId) {
              apiClient.get<any>(`/api/tenants?id=${encodeURIComponent(brokerTenantId)}`, { skipAuth: true })
                .then(tData => {
                  if (tData) {
                    setTenant({
                      id: tData.id,
                      name: tData.name || 'Imobiliária',
                      slug: tData.slug,
                      phone: tData.phone,
                      city: tData.city,
                      state: tData.state,
                    });
                  }
                })
                .catch(() => {});
            }
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
      // Curadoria VIP: se o link veio com imóveis específicos selecionados
      if (isCuratedShowcase) {
        const id = String(p.id).toLowerCase();
        const ref = String(p.referenceCode || (p as any).reference_code || '').toLowerCase();
        if (!targetIds.includes(id) && !targetIds.includes(ref)) {
          return false;
        }
      }

      // Search term
      if (searchTerm.trim()) {
        const fullTarget = [
          p.referenceCode || (p as any).reference_code || '',
          p.title,
          (p as any).street,
          (p as any).number,
          p.location,
          p.neighborhood,
          p.city,
          p.buildingName,
          p.description,
          ...(p.tags || [])
        ].filter(Boolean).join(' ');

        if (!matchSearchTerms(fullTarget, searchTerm)) {
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
        if (!matchPropertyType(p.type, selectedType)) return false;
      }

      // Status Comercial: A vitrine pública exibe ESTRITAMENTE imóveis disponíveis.
      // Imóveis reservados, vendidos ou alugados são ocultados automaticamente da vitrine.
      const pStatus = (p.status || 'disponível').toLowerCase().trim();
      const isAvailable = pStatus === 'disponível' || pStatus === 'disponivel' || pStatus === 'available' || !pStatus;
      if (!isAvailable) {
        return false;
      }

      // Bedrooms
      if (minBedrooms !== 'all') {
        if ((p.bedrooms || 0) < minBedrooms) return false;
      }

      // Suites
      if (minSuites !== 'all') {
        if ((p.suites || 0) < minSuites) return false;
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
  }, [properties, isCuratedShowcase, targetIds, searchTerm, selectedType, minBedrooms, minSuites, minParking, minPrice, maxPrice, selectedTags, onlyFeatured, sortBy]);

  // Clear filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedStatus('all');
    setMinBedrooms('all');
    setMinSuites('all');
    setMinParking('all');
    setMinPrice('');
    setMaxPrice('');
    setSelectedTags([]);
    setOnlyFeatured(false);
    setSortBy('relevance');
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType, selectedStatus, minBedrooms, minSuites, minParking, minPrice, maxPrice, selectedTags, onlyFeatured, sortBy]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    const size = typeof pageSize === 'number' ? pageSize : 24;
    return Math.max(1, Math.ceil(filteredProperties.length / size));
  }, [filteredProperties.length, pageSize]);

  const paginatedProperties = useMemo(() => {
    if (pageSize === 'all') return filteredProperties;
    const size = typeof pageSize === 'number' ? pageSize : 24;
    const start = (currentPage - 1) * size;
    return filteredProperties.slice(start, start + size);
  }, [filteredProperties, currentPage, pageSize]);

  const activeFiltersCount = [
    selectedType !== 'all',
    minBedrooms !== 'all',
    minSuites !== 'all',
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
    const rawPhone = broker?.phone || tenant?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const agencyName = tenant?.name || 'Imobiliária';
    const brokerName = broker?.displayName ? ` com o consultor ${broker.displayName}` : '';
    const text = encodeURIComponent(
      `Olá! Estou visitando a vitrine virtual da *${agencyName}*${brokerName} e gostaria de informações sobre os imóveis disponíveis.`
    );
    const waUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;
    window.open(waUrl, '_blank');
  };

  // Open property details
  const handleOpenProperty = (propertyId: string) => {
    router.push(`/p/${propertyId}`);
  };

  // Send WhatsApp inquiry for a specific property
  const handlePropertyWhatsapp = (e: React.MouseEvent, prop: Property) => {
    e.stopPropagation();
    const rawPhone = broker?.phone || tenant?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const agencyName = tenant?.name || 'Imobiliária';
    const ref = prop.referenceCode || (prop as any).reference_code;
    const clientIntro = clientNameParam.trim() ? `Olá! Sou *${clientNameParam.trim()}*. ` : 'Olá! ';
    const text = encodeURIComponent(
      `${clientIntro}Estou vendo o imóvel *${prop.title}*${ref ? ` (#${ref})` : ''} (${formatPrice(prop.price)}) da seleção que recebi na vitrine da *${agencyName}* e gostaria de agendar uma visita e tirar dúvidas.`
    );
    const waUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;
    window.open(waUrl, '_blank');
  };

  // Top Header Component
  const headerContent = (
    <header className={
      showSidebar 
        ? "h-16 shrink-0 bg-slate-900 border-b border-slate-800 pl-14 md:pl-6 px-4 md:px-6 flex items-center justify-between z-30 text-white" 
        : "sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md shadow-black/20 text-white"
    }>
      <div className={showSidebar ? "w-full flex items-center justify-between gap-4" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4"}>
        
        {/* Logo & Agency Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-600/30 shrink-0">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-white line-clamp-1">
                {tenant?.name || 'Vitrine de Imóveis'}
              </h1>
              <span 
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                title={mounted ? `Sincronizado em tempo real. Última checagem: ${lastSyncTime.toLocaleTimeString('pt-BR')}` : "Sincronizado em tempo real"}
                suppressHydrationWarning
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sincronizada ao Vivo
              </span>
              {showSidebar && (
                <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  <Sparkles className="w-3 h-3" /> CRM Ativo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 line-clamp-1">
              {broker?.displayName ? (
                <span>Atendimento com <strong className="text-slate-300">{broker.displayName}</strong></span>
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
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-60"
            title="Atualizar dados da vitrine diretamente do banco"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
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
              className="hidden sm:flex px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Abrir como cliente em nova aba"
            >
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>Ver como Cliente</span>
            </button>
          )}

          <button
            onClick={handleShareVitrine}
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Compartilhar Link da Vitrine"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{copiedLink ? 'Copiado!' : 'Compartilhar'}</span>
          </button>

          <button
            onClick={handleGeneralWhatsapp}
            className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98] cursor-pointer"
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
        <div className="bg-blue-600 text-white py-2 px-4 text-xs font-bold flex items-center justify-between shadow-md sticky top-0 z-50">
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

      {/* Hero Showcase Banner Dark */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-b border-slate-800/80 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          {isCuratedShowcase ? (
            <>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-primary/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/10">
                <Sparkles className="w-4 h-4 fill-amber-400" />
                <span>{clientNameParam ? `Seleção Exclusiva para ${clientNameParam}` : 'Curadoria Exclusiva de Imóveis'}</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                {clientNameParam ? `Imóveis Selecionados para ${clientNameParam}` : 'Seleção Personalizada de Imóveis'}
              </h2>

              <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
                {broker?.displayName
                  ? `Curadoria especial preparada por ${broker.displayName} da ${tenant?.name || 'nossa equipe'} com as oportunidades mais compatíveis com o seu perfil.`
                  : 'Reunimos aqui as melhores oportunidades selecionadas a dedo para atender às suas preferências e estilo de vida.'}
              </p>

              <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams.toString());
                    newParams.delete('ids');
                    newParams.delete('imoveis');
                    newParams.delete('cliente');
                    newParams.delete('client');
                    router.push(`/vitrine?${newParams.toString()}`);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Ver todo o catálogo da imobiliária"
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  Ver Todo o Catálogo ({properties.length} imóveis)
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Catálogo Oficial de Imóveis</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Encontre o Imóvel Perfeito para Você
              </h2>

              <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
                Explore nossa seleção completa de casas, apartamentos e lançamentos atualizados em tempo real com fotos de alta qualidade e atendimento direto.
              </p>
            </>
          )}

          {/* Search bar inside Hero */}
          <div className="pt-4 max-w-2xl mx-auto">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 absolute left-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por condomínio, bairro, cidade, rua..."
                className="w-full pl-12 pr-10 py-3.5 sm:py-4 rounded-2xl bg-slate-900/90 border-2 border-slate-700/80 focus:border-blue-500 text-white placeholder:text-slate-500 text-sm sm:text-base font-medium shadow-2xl transition-all outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
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
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-800'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${onlyFeatured ? 'fill-white text-white' : 'text-amber-400'}`} />
              <span>⭐ Oportunidades em Destaque</span>
            </button>

            {PROPERTY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setSelectedType(t.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  selectedType === t.value
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/30'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
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
        minSuites={minSuites}
        setMinSuites={setMinSuites}
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

      {/* Top Pagination Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 w-full">
        <UniversalPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalFiltered={filteredProperties.length}
          totalCatalog={properties.length}
          activeFiltersCount={activeFiltersCount}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onClearFilters={resetFilters}
          itemLabel="imóveis"
          variant="top"
          theme="dark"
        />
      </div>

      {/* Main Grid Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden animate-pulse">
                <div className="aspect-16/10 bg-slate-800" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-slate-800 rounded w-3/4" />
                  <div className="h-4 bg-slate-800 rounded w-1/2" />
                  <div className="h-6 bg-slate-800 rounded w-1/3 pt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center max-w-md mx-auto my-12 space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Home className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Nenhum imóvel encontrado
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Não encontramos imóveis disponíveis com os critérios selecionados no momento. Tente remover os filtros ou buscar por outro termo.
            </p>
            <button
              onClick={resetFilters}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/25 cursor-pointer"
            >
              Ver Todos os Imóveis
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedProperties.map((prop) => (
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

            {/* Bottom Full Pagination Suite */}
            {filteredProperties.length > 0 && (
              <UniversalPagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalFiltered={filteredProperties.length}
                totalCatalog={properties.length}
                activeFiltersCount={activeFiltersCount}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                onClearFilters={resetFilters}
                itemLabel="imóveis"
                variant="bottom"
                theme="dark"
                className="mt-8"
              />
            )}
          </>
        )}
      </main>

      {/* Create Deal Modal from Vitrine (when logged in) */}
      <CreateDealFromPropertyModal
        isOpen={!!propertyForDeal}
        property={propertyForDeal}
        contacts={contacts}
        onClose={() => setPropertyForDeal(null)}
      />

      {/* Footer Dark */}
      <footer className="bg-slate-900 border-t border-slate-800 mt-12 py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-400 space-y-2">
        <p className="font-semibold text-white">
          {tenant?.name || 'Vitrine Virtual de Imóveis'}
        </p>
        <p>
          Imóveis atualizados em tempo real diretamente pelo sistema de gestão imobiliária.
        </p>
        <p className="text-[10px] text-slate-500">
          Valores, disponibilidade e condições sujeitos a alteração sem aviso prévio.
        </p>
      </footer>
    </>
  );

  // If user is logged into the CRM, render with CRM Sidebar
  if (showSidebar) {
    return (
      <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {headerContent}
          <div ref={crmScrollContainerRef} className="flex-1 overflow-y-auto relative selection:bg-blue-600/30 selection:text-blue-200">
            {vitrineScrollableContent}
          </div>
        </div>
      </div>
    );
  }

  // Pure public view (for clients accessing the link or in client preview mode)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    }>
      <VitrineContent />
    </Suspense>
  );
}
