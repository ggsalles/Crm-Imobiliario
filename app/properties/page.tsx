"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Plus, 
  Search, 
  Filter, 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Car,
  Home,
  Building,
  TreePine,
  Briefcase,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  X,
  Upload,
  Loader2,
  Sparkles,
  Compass,
  Zap,
  Check,
  Share2,
  Copy,
  MessageSquare,
  SlidersHorizontal,
  RotateCcw,
  Building2,
  Globe,
  Tag,
  Star
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { recordAuditEvent } from "@/lib/audit";
import { POPULAR_PROPERTY_TAGS, TAG_CATEGORIES } from "@/lib/property-tags";
import { 
  getProperties,
  subscribeToProperties, 
  createProperty, 
  updateProperty, 
  deleteProperty, 
  togglePropertyFeatured,
  uploadFile,
  Property,
  getContacts,
  Contact,
  createDeal,
  createTimelineEvent
} from "@/lib/db";
import { cn, formatCurrencyBRL, parseCurrencyBRLToNumber, formatCEP } from "@/lib/utils";
import { PropertyValuationCard, ValuationResult } from "@/components/PropertyValuationCard";
import Image from "next/image";
import { toast } from "sonner";

export default function PropertiesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<'list' | 'form'>('list');
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [isDeletingProperty, setIsDeletingProperty] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [title, setTitle] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [displayPrice, setDisplayPrice] = useState("");
  const [displayIptu, setDisplayIptu] = useState("");
  const [displayCondoFee, setDisplayCondoFee] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [cep, setCep] = useState("");
  const [areaInput, setAreaInput] = useState<string>("");
  const [isEstimatingPrice, setIsEstimatingPrice] = useState(false);
  const [valuationResult, setValuationResult] = useState<ValuationResult | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [activeMapProperty, setActiveMapProperty] = useState<Property | null>(null);
  const [sharingProperty, setSharingProperty] = useState<Property | null>(null);
  const [sharingText, setSharingText] = useState("");
  const [isVitrineModalOpen, setIsVitrineModalOpen] = useState(false);
  const [vitrineShareMode, setVitrineShareMode] = useState<'tenant' | 'broker'>('tenant');

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

  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!user || !profile) return;
    
    console.log("[Properties] Usuário autenticado, iniciando sincronização em tempo real...");
    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    
    const unsubscribe = subscribeToProperties((data) => {
      setProperties(data);
      setLoading(false);
    }, ownerId);

    // Fetch contacts for dual-directional matchmaking features
    getContacts(ownerId).then(data => {
      if (Array.isArray(data)) {
        setContacts(data);
      }
    }).catch(err => {
      console.error("Error loading contacts in properties page:", err);
    });

    return () => unsubscribe();
  }, [user, profile]);

  interface MatchingContact {
    contact: Contact;
    score: number;
  }

  const getMatchingContactsForProperty = (p: Property): MatchingContact[] => {
    return contacts
      .filter(c => c.type === 'cliente')
      .map(c => {
        let finalScore = 0;
        let possibleScore = 0;

        let profileOfInt: any = null;
        try {
          if (c.department) {
            profileOfInt = JSON.parse(c.department);
          }
        } catch (e) {}

        if (!profileOfInt) return { contact: c, score: 0 };

        const maxPrice = typeof profileOfInt.maxPrice === 'number' ? profileOfInt.maxPrice : null;
        const minBedrooms = typeof profileOfInt.minBedrooms === 'number' ? profileOfInt.minBedrooms : null;
        const propertyType = typeof profileOfInt.propertyType === 'string' ? profileOfInt.propertyType : "todos";
        const neighborhoods = Array.isArray(profileOfInt.neighborhoods) ? profileOfInt.neighborhoods : [];

        // 1. Price Match (budget limit check)
        if (maxPrice) {
          possibleScore += 25;
          if (p.price <= maxPrice) finalScore += 25;
          else if (p.price <= maxPrice * 1.15) finalScore += 10;
        }

        // 2. Type Match (type equal search)
        if (propertyType && propertyType !== 'todos') {
          possibleScore += 25;
          if (p.type === propertyType) finalScore += 25;
        }

        // 3. Bedrooms Match (at least bedrooms requested)
        if (minBedrooms) {
          possibleScore += 25;
          if (p.bedrooms && p.bedrooms >= minBedrooms) finalScore += 25;
        }

        // 4. Neighborhood tags Match
        if (neighborhoods && neighborhoods.length > 0) {
          possibleScore += 25;
          const propNeighborhoodClean = (p.neighborhood || "").trim().toLowerCase();
          const matches = neighborhoods.some(n => 
            propNeighborhoodClean.includes(n.trim().toLowerCase()) || 
            n.trim().toLowerCase().includes(propNeighborhoodClean)
          );
          if (matches) finalScore += 25;
        }

        const normScore = possibleScore > 0 ? Math.round((finalScore / possibleScore) * 100) : 0;

        return {
          contact: c,
          score: normScore
        };
      })
      .filter(mc => mc.score >= 40)
      .sort((a, b) => b.score - a.score);
  };

  const handleCreateDealFromPropertyMatch = async (contact: Contact, p: Property) => {
    if (!user) return;
    try {
      const dealTitle = `${p.title} - ${contact.name}`;
      const value = p.price;
      
      await createDeal({
        title: dealTitle,
        value: value,
        stage: 'lead',
        contactId: contact.id,
        propertyId: p.id,
        ownerId: user.id
      });

      await createTimelineEvent({
        type: 'system',
        category: 'contact',
        relatedId: contact.id,
        content: `Lead de imóvel cruzado na visão do Imóvel: associado ao imóvel "${p.title}" com preço de R$ ${p.price.toLocaleString('pt-BR')}.`,
        title: `Novo negócio de cruzamento`
      });

      toast.success("Cruzamento realizado! Novo negócio criado para o cliente.");
    } catch (e: any) {
      console.error("Error creating matching deal from property layout:", e);
      toast.error("Erro ao cruzar cliente e criar negócio.");
    }
  };

  useEffect(() => {
    if (view === 'form') {
      setTitle(editingProperty?.title || "");
      setBuildingName(editingProperty?.buildingName || "");
      setDisplayPrice(formatCurrencyBRL(editingProperty?.price || 0));
      setDisplayIptu(editingProperty?.iptu ? formatCurrencyBRL(editingProperty.iptu) : "");
      setDisplayCondoFee(editingProperty?.condoFee ? formatCurrencyBRL(editingProperty.condoFee) : "");
      setImageUrls(editingProperty?.imageUrls || []);
      setCep(formatCEP(editingProperty?.cep || ""));
      setAreaInput(editingProperty?.area ? String(editingProperty.area) : "");
      setSelectedTags(editingProperty?.tags || []);
      setIsFeatured(Boolean(editingProperty?.isFeatured));
      setCustomTagInput("");
      setValuationResult(null);
    }
    // Only reset when switching TO form view or editing a different property
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, editingProperty?.id]);

  // Address form states (for auto-fill)
  const [addressData, setAddressData] = useState({
    street: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  useEffect(() => {
    if (editingProperty) {
      setAddressData({
        street: editingProperty.street || "",
        neighborhood: editingProperty.neighborhood || "",
        city: editingProperty.city || "",
        state: editingProperty.state || "",
      });
    } else {
      setAddressData({ street: "", neighborhood: "", city: "", state: "" });
    }
  }, [editingProperty]);

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, "");
    if (cep.length !== 8) return;

    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setAddressData({
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
        });
      } else {
        toast.error("CEP não encontrado.");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleSuggestPrice = async () => {
    if (!formRef.current) return;
    const form = formRef.current;
    const formElements = form.elements as any;

    const propertyType = formElements.type?.value || editingProperty?.type || "apartamento";
    const neighborhood = addressData.neighborhood || formElements.neighborhood?.value || "";
    const city = addressData.city || formElements.city?.value || "";
    const state = addressData.state || formElements.state?.value || "";
    const area = parseFloat(areaInput || formElements.area?.value || "0") || 0;
    const bedrooms = parseInt(formElements.bedrooms?.value || "0") || 0;
    const bathrooms = parseInt(formElements.bathrooms?.value || "0") || 0;
    const parkingSpots = parseInt(formElements.parkingSpots?.value || "0") || 0;
    const acceptsFinancing = formElements.acceptsFinancing?.checked ?? true;
    const currentPriceNum = parseCurrencyBRLToNumber(displayPrice);

    if (!city && !neighborhood && area <= 0) {
      toast.warning("Para estimar o valor com precisão, preencha ao menos o Bairro/Cidade ou a Área (m²).");
      return;
    }

    setIsEstimatingPrice(true);
    const toastId = toast.loading("Consultando inteligência de mercado imobiliário...");

    try {
      // Calcular a média da carteira da imobiliária para este tipo/região
      const similarInPortfolio = properties.filter(p => 
        p.area > 0 && p.price > 0 && (
          (neighborhood && p.neighborhood?.toLowerCase() === neighborhood.toLowerCase()) ||
          (city && p.city?.toLowerCase() === city.toLowerCase()) ||
          p.type === propertyType
        )
      );

      let portfolioAvgM2: number | null = null;
      if (similarInPortfolio.length > 0) {
        const sumM2 = similarInPortfolio.reduce((acc, p) => acc + (p.price / p.area), 0);
        portfolioAvgM2 = Math.round(sumM2 / similarInPortfolio.length);
      }

      const res = await fetch("/api/properties/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: propertyType,
          neighborhood,
          city,
          state,
          area,
          bedrooms,
          bathrooms,
          parkingSpots,
          acceptsFinancing,
          currentPrice: currentPriceNum,
          condoFee: parseCurrencyBRLToNumber(displayCondoFee),
          iptu: parseCurrencyBRLToNumber(displayIptu),
          buildingName: buildingName.trim(),
          portfolioAverageM2: portfolioAvgM2
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Falha na estimativa de valor.");
      }

      const data: ValuationResult = await res.json();
      data.portfolioAvgM2 = portfolioAvgM2;
      data.matchingPropertiesCount = similarInPortfolio.length;

      setValuationResult(data);
      toast.success("Avaliação de mercado gerada com sucesso!", { id: toastId });
    } catch (err: any) {
      console.error("Erro na avaliação:", err);
      toast.error(err.message || "Não foi possível gerar a sugestão de preço.", { id: toastId });
    } finally {
      setIsEstimatingPrice(false);
    }
  };

  const handleApplyValuationPrice = (priceVal: number) => {
    setDisplayPrice(formatCurrencyBRL(priceVal));
  };

  useEffect(() => {
    // Safety timeout: force loading to false if it takes too long
    const timer = setTimeout(() => {
      if (loading && properties.length === 0) {
        console.warn("[Properties] Safety timeout (7s) triggered. Forcing loading false.");
        setLoading(false);
      }
    }, 7000);
    return () => clearTimeout(timer);
  }, [loading, properties.length]);

  useEffect(() => {
    console.log("[Properties] Auth State:", { authLoading, hasUser: !!user, hasProfile: !!profile });
    if (!authLoading && !user) {
      console.log("[Properties] Roteando para login...");
      router.push("/login");
    }
  }, [user, authLoading, profile, router]);

  const availableNeighborhoods = useMemo(() => {
    const set = new Set<string>();
    properties.forEach(p => {
      if (p.neighborhood && p.neighborhood.trim()) {
        set.add(p.neighborhood.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [properties]);

  const filteredProperties = useMemo(() => {
    if (typeof window === 'undefined') return [];
    
    const query = search.trim().toLowerCase();
    const streetQuery = searchStreet.trim().toLowerCase();
    const minPriceNum = displayMinPrice ? parseCurrencyBRLToNumber(displayMinPrice) : 0;
    const maxPriceNum = displayMaxPrice ? parseCurrencyBRLToNumber(displayMaxPrice) : 0;

    return properties.filter((p) => {
      // 0. Filtro de Imóveis em Destaque
      if (onlyFeaturedFilter && !p.isFeatured) {
        return false;
      }

      // 1. Universal Omni-Search (Title, Building/Condo, Street, Neighborhood, City, Code/ID)
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

      // 1.1 Selected Tags Filter (Characteristics / Amenities)
      if (selectedFilterTags.length > 0) {
        const pTagsLower = (p.tags || []).map(t => t.toLowerCase());
        const pDescLower = (p.description || '').toLowerCase();
        const matchAllSelected = selectedFilterTags.every(tag => {
          const target = tag.toLowerCase();
          return pTagsLower.includes(target) || pDescLower.includes(target);
        });
        if (!matchAllSelected) return false;
      }

      // 2. Specific Street Filter
      if (streetQuery) {
        const pStreet = (p.street || "").toLowerCase();
        const pLocation = (p.location || "").toLowerCase();
        if (!pStreet.includes(streetQuery) && !pLocation.includes(streetQuery)) {
          return false;
        }
      }

      // 3. Property Type (casa, apartamento, etc.)
      if (filterType !== "all" && p.type !== filterType) {
        return false;
      }

      // 4. Commercial Status (disponível, reservado, vendido, alugado)
      if (statusFilter !== "all" && p.status !== statusFilter) {
        return false;
      }

      // 5. Neighborhood Filter
      if (selectedNeighborhood !== "all") {
        const pNeigh = (p.neighborhood || "").trim().toLowerCase();
        if (pNeigh !== selectedNeighborhood.trim().toLowerCase()) {
          return false;
        }
      }

      // 6. Price Range
      const price = Number(p.price) || 0;
      if (minPriceNum > 0 && price < minPriceNum) {
        return false;
      }
      if (maxPriceNum > 0 && price > maxPriceNum) {
        return false;
      }

      // 7. Bedrooms (Minimum)
      if (bedroomsFilter !== "all") {
        const pBeds = Number(p.bedrooms) || 0;
        if (bedroomsFilter === "4+") {
          if (pBeds < 4) return false;
        } else {
          const reqBeds = Number(bedroomsFilter);
          if (pBeds < reqBeds) return false;
        }
      }

      // 8. Parking Spots (Minimum)
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

  const handleToggleFeatured = async (property: Property) => {
    const nextVal = !property.isFeatured;
    // Otimisticamente atualiza na tela
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
    } catch (err: any) {
      // Reverter atualização otimista em caso de erro
      setProperties(prev => prev.map(p => p.id === property.id ? { ...p, isFeatured: property.isFeatured } : p));
      toast.error("Não foi possível atualizar o status de destaque.");
    }
  };

  const setPricePreset = useCallback((min: number | null, max: number | null) => {
    setDisplayMinPrice(min ? formatCurrencyBRL(min) : "");
    setDisplayMaxPrice(max ? formatCurrencyBRL(max) : "");
  }, []);

  const confirmDeleteProperty = async () => {
    if (!propertyToDelete) return;
    const target = propertyToDelete;
    const id = target.id;

    console.log(`[Properties] confirmDeleteProperty: Executando exclusão do ID: ${id}`);
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

      console.log(`[Properties] confirmDeleteProperty: Sucesso ao excluir ID: ${id}`);
      toast.success("Imóvel excluído com sucesso.", { id: toastId });
      setPropertyToDelete(null);
    } catch (err: any) {
      console.error(`[Properties] confirmDeleteProperty: Erro ao excluir ID: ${id}`, err);
      setProperties(prev => [...prev, target]);
      toast.error(`Erro ao excluir: ${err.message || "Falha técnica"}`, { id: toastId });
    } finally {
      setIsDeletingProperty(false);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleNew = useCallback(() => {
    setEditingProperty(null);
    setView('form');
    setAddressData({ street: "", neighborhood: "", city: "", state: "" });
    setImageUrls([]);
    setTitle("");
    setDisplayPrice("");
    setCep("");
    setSelectedTags([]);
    setCustomTagInput("");
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

  const processFiles = useCallback(async (incomingFiles: FileList | File[]) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    const files = Array.from(incomingFiles);
    const totalFiles = files.length;
    let uploadedCount = 0;
    
    setIsUploading(true);
    const toastId = toast.loading(`Processando ${totalFiles} ${totalFiles === 1 ? 'imagem' : 'imagens'}...`);

    try {
      // Processamento sequencial para evitar travamentos em conexões instáveis ou limites de rede
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        toast.loading(`Enviando ${i + 1} de ${totalFiles}: ${file.name}`, { id: toastId });
        
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`Arquivo "${file.name}" excede 10MB.`, { duration: 3000 });
          continue;
        }

        try {
          // Pequeno delay para permitir que o browser processe as mensagens de toast e renderize o progresso
          await new Promise(resolve => setTimeout(resolve, 300));

          // Proteção contra arquivos vazios ou corrompidos
          if (file.size === 0) {
            toast.error(`Arquivo "${file.name}" está vazio.`, { duration: 3000 });
            continue;
          }

          // Timeout de 60 segundos por imagem (mais generoso para conexões lentas)
          const uploadTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout de 60s excedido")), 60000)
          );

          console.log(`[Properties] Iniciando upload ${i+1}/${totalFiles}: ${file.name} (${file.size} bytes)`);
          const uploadOp = uploadFile(file, 'property-images', user?.id);
          const result = await Promise.race([uploadOp, uploadTimeout]) as { url: string };
          
          if (result && result.url) {
            console.log(`[Properties] Upload concluído para ${file.name}: ${result.url}`);
            // Atualização incremental para feedback imediato
            setImageUrls(prev => [...prev, result.url]);
            uploadedCount++;
          }
        } catch (err: any) {
          console.error(`[Properties] Falha no upload da imagem ${i+1}:`, err);
          toast.error(`Não foi possível enviar: ${file.name}`, { duration: 3000 });
        }
      }

      if (uploadedCount > 0) {
        toast.success(`${uploadedCount} ${uploadedCount === 1 ? 'imagem enviada' : 'imagens enviadas'} com sucesso!`, { id: toastId });
      } else {
        toast.error("Nenhuma imagem foi enviada corretamente.", { id: toastId });
      }
    } catch (error: any) {
      console.error("[Properties] Erro fatal no processFiles:", error);
      toast.error("Erro ao processar lote de imagens.", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  }, [user?.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;
    const files = e.target.files;
    if (files) {
      await processFiles(files);
      e.target.value = ''; // Limpa o input
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  }, [processFiles, isUploading]);

  const handleCreateOrUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving || isUploading || isFetchingCep || isSubmittingRef.current) {
      console.warn("[Properties] Bloqueio de submissão:", { isSaving, isUploading, isFetchingCep, subRef: isSubmittingRef.current });
      if (isUploading) toast.error("Aguarde o upload das imagens terminar.");
      if (isFetchingCep) toast.error("Aguarde a busca do CEP terminar.");
      return;
    }

    console.log("[Properties] === INICIANDO SALVAMENTO ===");
    const formData = new FormData(e.currentTarget);
    setIsSaving(true);
    isSubmittingRef.current = true;

    // Timeout de segurança (UI) mais curto para feedback rápido (45s)
    const uiTimeoutId = setTimeout(() => {
      if (isSubmittingRef.current) {
        console.error("[Properties] Emergência: UI Timeout (45s) disparado.");
        setIsSaving(false);
        isSubmittingRef.current = false;
        toast.dismiss(); // Remove o loading se houver
        toast.error("O servidor demorou demais para responder. Tente novamente ou verifique se o registro foi salvo recarregando a página.");
      }
    }, 45000);
    
    let toastId: string | number = "saving-toast";
    
    try {
      if (!user) throw new Error("Sessão inválida ou expirada.");
      
      const neighborhood = String(formData.get("neighborhood") || "");
      const city = String(formData.get("city") || "");
      const state = String(formData.get("state") || "");
      const location = String(formData.get("location") || "") || `${neighborhood}, ${city} - ${state}`;

      const isEditing = !!editingProperty;
      const currentPropertyId = editingProperty?.id;

      // Sanitização final das URLs
      const cleanUrls = imageUrls.filter(url => 
        typeof url === 'string' &&
        url.trim() !== "" && 
        !url.startsWith('data:image')
      ).map(u => String(u).trim());

      const data: Partial<Property> = {
        title: String(formData.get("title") || "").substring(0, 200),
        buildingName: String(formData.get("buildingName") || "").trim().substring(0, 200),
        type: (formData.get("type") as any) || "apartamento",
        status: (formData.get("status") as any) || "disponível",
        price: Number(parseCurrencyBRLToNumber(String(formData.get("price") || "0"))),
        iptu: Number(parseCurrencyBRLToNumber(String(formData.get("iptu") || "0"))),
        condoFee: Number(parseCurrencyBRLToNumber(String(formData.get("condoFee") || "0"))),
        location: location.substring(0, 500),
        cep: String(formData.get("cep") || "").replace(/\D/g, "").substring(0, 8), // Salva apenas 8 dígitos
        street: String(formData.get("street") || "").substring(0, 200),
        neighborhood: neighborhood.substring(0, 100),
        city: city.substring(0, 100),
        state: state.substring(0, 2),
        number: String(formData.get("number") || "").substring(0, 20),
        complement: String(formData.get("complement") || "").substring(0, 200),
        area: Number(formData.get("area") || 0),
        bedrooms: Number(formData.get("bedrooms") || 0),
        bathrooms: Number(formData.get("bathrooms") || 0),
        parkingSpots: Number(formData.get("parkingSpots") || 0),
        acceptsFinancing: formData.get("acceptsFinancing") === "on",
        isFeatured: formData.get("isFeatured") === "on" || isFeatured,
        notes: String(formData.get("notes") || "").substring(0, 2000),
        description: String(formData.get("description") || "").substring(0, 5000),
        tags: selectedTags,
        imageUrls: cleanUrls,
      };

      toastId = toast.loading(isEditing ? "Atualizando registro..." : "Salvando novo imóvel...");

      console.log("[Properties] Enviando para o banco de dados...");
      if (isEditing && currentPropertyId) {
        await updateProperty(currentPropertyId, data, user.id);
        recordAuditEvent({
          action: 'UPDATE_PROPERTY',
          title: 'Edição de Imóvel',
          content: `Imóvel "${data.title}" foi editado e atualizado no catálogo.`,
          severity: 'medium',
          category: 'modification',
          relatedId: currentPropertyId,
          entityId: currentPropertyId,
          entityType: 'property',
          metadata: {
            title: data.title,
            price: data.price,
            location: data.location,
            type: data.type
          }
        });
      } else {
        const newId = await createProperty(data, user.id);
        recordAuditEvent({
          action: 'CREATE_PROPERTY',
          title: 'Cadastro de Novo Imóvel',
          content: `Novo imóvel "${data.title}" cadastrado com sucesso no catálogo.`,
          severity: 'info',
          category: 'modification',
          relatedId: newId || undefined,
          entityId: newId || undefined,
          entityType: 'property',
          metadata: {
            title: data.title,
            price: data.price,
            location: data.location,
            type: data.type
          }
        });
      }
      
      console.log("[Properties] Sucesso absoluto!");
      clearTimeout(uiTimeoutId);
      toast.success(isEditing ? "Imóvel atualizado com sucesso!" : "Imóvel cadastrado com sucesso!", { id: toastId });
      
      setEditingProperty(null);
      setSelectedTags([]);
      setIsFeatured(false);
      setCustomTagInput("");
      setImageUrls([]);
      setView('list');

    } catch (err: any) {
      console.error("[Properties] Falha crítica no salvamento:", err);
      clearTimeout(uiTimeoutId);
      toast.error(err.message || "Erro ao gravar dados.", { id: toastId });
    } finally {
      console.log("[Properties] Finalizando estado de carregamento.");
      setIsSaving(false);
      isSubmittingRef.current = false;
    }
  };

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
                onClick={() => setView('list')}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors border border-border"
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
                  onClick={() => setIsVitrineModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold uppercase tracking-wider shadow-2xs transition-all cursor-pointer"
                  title="Abrir e compartilhar a Vitrine Pública de Imóveis com seus clientes"
                >
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Vitrine Pública</span>
                  <span className="sm:hidden">Vitrine</span>
                </button>
                <button 
                  onClick={handleNew}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Imóvel
                </button>
              </>
            )}
            {view === 'form' && (
              <button 
                onClick={() => setView('list')}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-muted/80 transition-all"
              >
                Cancelar
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-5 bg-muted/5">
          {view === 'list' ? (
            <div className="max-w-7xl mx-auto space-y-4 md:space-y-5">
              
              {/* Barra de Busca Universal Inteligente & Filtros Avançados */}
              <div className="bg-card border border-border/80 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {/* Campo de Busca Universal (Omni-Search) */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="Buscar por nome, edifício/condomínio, rua, bairro, código..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && search.trim().length >= 2) {
                          recordAuditEvent({
                            action: 'SEARCH_PROPERTIES',
                            title: 'Busca Textual no Catálogo',
                            content: `Pesquisa realizada no catálogo de imóveis pelo termo: "${search.trim()}".`,
                            severity: 'low',
                            category: 'modification',
                            metadata: {
                              query: search.trim()
                            }
                          });
                        }
                      }}
                      className="w-full pl-10 pr-9 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                    {search && (
                      <button 
                        type="button" 
                        onClick={() => setSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                        title="Limpar busca"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Botões de Ação de Filtragem */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !onlyFeaturedFilter;
                        setOnlyFeaturedFilter(nextState);
                        if (nextState) {
                          recordAuditEvent({
                            action: 'SEARCH_PROPERTIES',
                            title: 'Pesquisa por Imóveis em Destaque',
                            content: 'Usuário aplicou o filtro de consulta para visualizar apenas Imóveis em Destaque.',
                            severity: 'low',
                            category: 'modification',
                            metadata: {
                              filter: 'onlyFeatured',
                              active: true
                            }
                          });
                        }
                      }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                        onlyFeaturedFilter
                          ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                          : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-amber-500 border-border"
                      )}
                      title={onlyFeaturedFilter ? "Exibindo apenas destaques (clique para ver todos)" : "Filtrar apenas imóveis em destaque / melhores oportunidades"}
                    >
                      <Star className={cn("w-3.5 h-3.5", onlyFeaturedFilter ? "fill-white text-white" : "text-amber-500")} />
                      <span className="hidden sm:inline">Destaques</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className={cn(
                        "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                        isFilterOpen || activeFiltersCount > 0
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/50 hover:bg-muted text-foreground border-border"
                      )}
                      title="Abrir painel de filtros detalhados"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Filtros</span>
                      {activeFiltersCount > 0 && (
                        <span className={cn(
                          "px-1.5 py-0.2 rounded-full text-[10px] font-black leading-none",
                          isFilterOpen || activeFiltersCount > 0
                            ? "bg-primary-foreground text-primary"
                            : "bg-primary text-primary-foreground"
                        )}>
                          {activeFiltersCount}
                        </span>
                      )}
                    </button>

                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 text-xs font-bold transition-all cursor-pointer"
                        title="Limpar todos os filtros aplicados"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Limpar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Painel Expansível de Filtros Avançados */}
                <AnimatePresence>
                  {isFilterOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-border/60 pt-3.5 space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        {/* 1. Bairro */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                            Bairro
                          </label>
                          <select
                            value={selectedNeighborhood}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedNeighborhood(val);
                              recordAuditEvent({
                                action: 'SEARCH_PROPERTIES',
                                title: val === 'all' ? 'Filtro de Bairro Removido' : `Filtro por Bairro: ${val}`,
                                content: val === 'all' 
                                  ? 'Filtro de localização por bairro desativado.' 
                                  : `Usuário filtrou imóveis situados no bairro: "${val}".`,
                                severity: 'low',
                                category: 'modification',
                                metadata: {
                                  neighborhood: val
                                }
                              });
                            }}
                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                          >
                            <option value="all">Todos os bairros ({availableNeighborhoods.length})</option>
                            {availableNeighborhoods.map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>

                        {/* 2. Rua / Logradouro */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                            Rua / Logradouro
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Ex: Av. Brasil, Rua 15..."
                              value={searchStreet}
                              onChange={(e) => setSearchStreet(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && searchStreet.trim().length >= 2) {
                                  recordAuditEvent({
                                    action: 'SEARCH_PROPERTIES',
                                    title: 'Filtro por Logradouro / Rua',
                                    content: `Filtro de rua aplicado: "${searchStreet.trim()}".`,
                                    severity: 'low',
                                    category: 'modification',
                                    metadata: {
                                      street: searchStreet.trim()
                                    }
                                  });
                                }
                              }}
                              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                            />
                            {searchStreet && (
                              <button 
                                type="button" 
                                onClick={() => setSearchStreet("")} 
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 3. Dormitórios / Quartos */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                            Quartos (Mínimo)
                          </label>
                          <div className="grid grid-cols-5 gap-1">
                            {[
                              { id: "all", label: "Todos" },
                              { id: "1", label: "1+" },
                              { id: "2", label: "2+" },
                              { id: "3", label: "3+" },
                              { id: "4+", label: "4+" },
                            ].map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  if (bedroomsFilter === item.id) return;
                                  setBedroomsFilter(item.id);
                                  recordAuditEvent({
                                    action: 'SEARCH_PROPERTIES',
                                    title: item.id === 'all' ? 'Filtro de Quartos Resetado' : `Filtro por Quartos: ${item.label}`,
                                    content: item.id === 'all'
                                      ? 'Filtro por dormitórios resetado.'
                                      : `Usuário filtrou imóveis com no mínimo ${item.label} dormitórios.`,
                                    severity: 'low',
                                    category: 'modification',
                                    metadata: {
                                      bedrooms: item.id
                                    }
                                  });
                                }}
                                className={cn(
                                  "py-1.5 rounded-lg text-xs font-bold transition-all text-center border cursor-pointer",
                                  bedroomsFilter === item.id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                )}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 4. Vagas de Garagem */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                            Vagas de Garagem
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            {[
                              { id: "all", label: "Todas" },
                              { id: "1", label: "1+" },
                              { id: "2+", label: "2+" },
                            ].map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  if (parkingFilter === item.id) return;
                                  setParkingFilter(item.id);
                                  recordAuditEvent({
                                    action: 'SEARCH_PROPERTIES',
                                    title: item.id === 'all' ? 'Filtro de Vagas Resetado' : `Filtro por Vagas: ${item.label}`,
                                    content: item.id === 'all'
                                      ? 'Filtro por vagas de garagem resetado.'
                                      : `Usuário filtrou imóveis com no mínimo ${item.label} vagas de garagem.`,
                                    severity: 'low',
                                    category: 'modification',
                                    metadata: {
                                      parking: item.id
                                    }
                                  });
                                }}
                                className={cn(
                                  "py-1.5 rounded-lg text-xs font-bold transition-all text-center border cursor-pointer",
                                  parkingFilter === item.id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                )}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 5. Faixa de Preço (De / Até) */}
                        <div className="sm:col-span-2 lg:col-span-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                              Faixa de Preço de Venda (R$)
                            </label>
                            {(displayMinPrice || displayMaxPrice) && (
                              <button
                                type="button"
                                onClick={() => { setDisplayMinPrice(""); setDisplayMaxPrice(""); }}
                                className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                              >
                                Resetar valores
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Valor mínimo (R$)"
                              value={displayMinPrice}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, "");
                                setDisplayMinPrice(raw ? formatCurrencyBRL(raw) : "");
                              }}
                              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold text-foreground placeholder:font-normal focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Valor máximo (R$)"
                              value={displayMaxPrice}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, "");
                                setDisplayMaxPrice(raw ? formatCurrencyBRL(raw) : "");
                              }}
                              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold text-foreground placeholder:font-normal focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                            />
                          </div>

                          {/* Atalhos Rápidos de Preço */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Atalhos:</span>
                            {[
                              { label: "Até 300k", min: null, max: 300000 },
                              { label: "300k - 600k", min: 300000, max: 600000 },
                              { label: "600k - 1.2M", min: 600000, max: 1200000 },
                              { label: "Acima de 1.2M", min: 1200000, max: null },
                            ].map((preset, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setPricePreset(preset.min, preset.max)}
                                className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all border border-border/50 cursor-pointer"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 6. Status Comercial */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                            Status Comercial
                          </label>
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                          >
                            <option value="all">Todos os status</option>
                            <option value="disponível">Disponível</option>
                            <option value="reservado">Reservado</option>
                            <option value="vendido">Vendido</option>
                            <option value="alugado">Alugado</option>
                          </select>
                        </div>

                        {/* 7. Busca & Filtro de Características / Tags */}
                        <div className="sm:col-span-2 lg:col-span-3 space-y-2 pt-2 border-t border-border/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5 text-primary" />
                              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                Filtrar por Características & Tags ({selectedFilterTags.length} selecionadas)
                              </label>
                            </div>
                            {selectedFilterTags.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedFilterTags([])}
                                className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                              >
                                Limpar tags
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                            {POPULAR_PROPERTY_TAGS.map((tag) => {
                              const isSelected = selectedFilterTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    setSelectedFilterTags(prev =>
                                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                    );
                                  }}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1",
                                    isSelected
                                      ? "bg-primary text-white border-primary shadow-xs"
                                      : "bg-background border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  )}
                                >
                                  {isSelected && <Check className="w-3 h-3" />}
                                  <span>{tag}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tags de Filtros Ativos (Remoção com um clique) */}
                {activeFiltersCount > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Filtros ativos:</span>
                    {onlyFeaturedFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/25">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        <span>Apenas Destaques</span>
                        <button type="button" onClick={() => setOnlyFeaturedFilter(false)} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {selectedFilterTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/15 text-primary text-[10px] font-bold border border-primary/20"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedFilterTags(prev => prev.filter(t => t !== tag))}
                          className="hover:opacity-70 cursor-pointer"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                    {search.trim() && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                        <span>Busca: &ldquo;{search}&rdquo;</span>
                        <button type="button" onClick={() => setSearch("")} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {selectedNeighborhood !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                        <span>Bairro: {selectedNeighborhood}</span>
                        <button type="button" onClick={() => setSelectedNeighborhood("all")} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {searchStreet.trim() && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                        <span>Rua: &ldquo;{searchStreet}&rdquo;</span>
                        <button type="button" onClick={() => setSearchStreet("")} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {displayMinPrice.trim() && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                        <span>Min: {displayMinPrice}</span>
                        <button type="button" onClick={() => setDisplayMinPrice("")} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {displayMaxPrice.trim() && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                        <span>Max: {displayMaxPrice}</span>
                        <button type="button" onClick={() => setDisplayMaxPrice("")} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {bedroomsFilter !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                        <span>{bedroomsFilter === "4+" ? "4+ Quartos" : `${bedroomsFilter}+ Quartos`}</span>
                        <button type="button" onClick={() => setBedroomsFilter("all")} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {parkingFilter !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                        <span>{parkingFilter === "2+" ? "2+ Vagas" : `${parkingFilter}+ Vagas`}</span>
                        <button type="button" onClick={() => setParkingFilter("all")} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {statusFilter !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                        <span>Status: {statusFilter}</span>
                        <button type="button" onClick={() => setStatusFilter("all")} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    )}
                    {filterType !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                        <span>Tipo: {filterType}</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            setFilterType("all");
                            recordAuditEvent({
                              action: 'SEARCH_PROPERTIES',
                              title: 'Filtro de Tipo Removido',
                              content: 'Filtro de categoria de imóvel desativado (exibindo todas as tipologias).',
                              severity: 'low',
                              category: 'modification'
                            });
                          }} 
                          className="hover:opacity-70"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Categorias / Tipos de Unidade */}
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pb-1">
                {[
                  { id: "all", label: "Todos", icon: Home },
                  { id: "casa", label: "Casas", icon: Home },
                  { id: "apartamento", label: "Apartamentos", icon: Building },
                  { id: "sobrado", label: "Sobrados", icon: Home },
                  { id: "cobertura", label: "Coberturas", icon: Building },
                  { id: "comercial", label: "Comercial", icon: Briefcase },
                  { id: "terreno", label: "Terrenos", icon: TreePine },
                  { id: "sítio", label: "Sítios", icon: TreePine },
                  { id: "chácara", label: "Chácaras", icon: TreePine },
                  { id: "fazenda", label: "Fazendas", icon: TreePine },
                  { id: "outros", label: "Outros", icon: Plus },
                ].map(type => {
                  const count = type.id === "all" 
                    ? properties.length 
                    : properties.filter(p => p.type === type.id).length;
                  const isActive = filterType === type.id;

                  return (
                    <button
                      key={type.id}
                      onClick={() => {
                        if (filterType === type.id) return;
                        setFilterType(type.id);
                        recordAuditEvent({
                          action: 'SEARCH_PROPERTIES',
                          title: type.id === 'all' ? 'Filtro por Tipo: Todos os Imóveis' : `Filtro por Categoria: ${type.label}`,
                          content: type.id === 'all'
                            ? 'Filtro de categoria resetado para exibir todas as tipologias de imóveis.'
                            : `Usuário aplicou filtro por tipo de unidade: "${type.label}" (${count} disponíveis no inventário).`,
                          severity: 'low',
                          category: 'modification',
                          metadata: {
                            category: type.id,
                            label: type.label,
                            count
                          }
                        });
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
                        isActive 
                          ? "bg-foreground text-background border-foreground shadow-xs" 
                          : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      <type.icon className="w-3 h-3 shrink-0" />
                      <span>{type.label}</span>
                      <span className={cn(
                        "text-[9px] px-1 py-0.2 rounded font-black shrink-0 transition-colors",
                        isActive 
                          ? "bg-background/20 text-background" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Barra de Contagem e Resultados */}
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
            <div className={cn(
              "mx-auto transition-all duration-500",
              editingProperty ? "max-w-7xl" : "max-w-4xl"
            )}>
              <div className={cn(
                "grid grid-cols-1 gap-8",
                editingProperty ? "xl:grid-cols-12" : "grid-cols-1"
              )}>
                <div className={cn(
                  editingProperty ? "xl:col-span-8" : "w-full"
                )}>
                  <form 
                    ref={formRef}
                    key={editingProperty?.id || 'new-property'}
                    onSubmit={handleCreateOrUpdate} 
                    className={cn(
                      "bg-card border border-border rounded-[40px] shadow-2xl overflow-hidden pb-12 transition-opacity",
                      (isSaving || isUploading) && "opacity-80 cursor-wait"
                    )}
                  >
                <div className="p-10 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Identificação / Título do Imóvel</label>
                      <input 
                        name="title"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex: Apartamento Vista Mar Premium"
                        className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center justify-between">
                        <span>Nome do Edifício ou Condomínio</span>
                        <span className="text-[9px] font-semibold text-muted-foreground lowercase">opcional</span>
                      </label>
                      <input 
                        name="buildingName"
                        value={buildingName}
                        onChange={(e) => setBuildingName(e.target.value)}
                        placeholder="Ex: Edifício Solar das Acácias / Cond. Alphaville"
                        className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Tipo de Unidade</label>
                      <select 
                        name="type"
                        defaultValue={editingProperty?.type || "apartamento"}
                        className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      >
                        <option value="casa">Casa</option>
                        <option value="sobrado">Sobrado</option>
                        <option value="apartamento">Apartamento</option>
                        <option value="cobertura">Cobertura</option>
                        <option value="comercial">Comercial</option>
                        <option value="terreno">Terreno</option>
                        <option value="sítio">Sítio</option>
                        <option value="chácara">Chácara</option>
                        <option value="fazenda">Fazenda</option>
                        <option value="outros">Outros</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Status Comercial</label>
                      <select 
                        name="status"
                        defaultValue={editingProperty?.status || "disponível"}
                        className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      >
                        <option value="disponível">Disponível</option>
                        <option value="reservado">Reservado</option>
                        <option value="vendido">Vendido</option>
                        <option value="alugado">Alugado</option>
                      </select>
                    </div>

                    {/* Bloco de Valores Financeiros e Encargos */}
                    <div className="md:col-span-2 p-6 sm:p-7 bg-muted/20 border border-border/70 rounded-3xl space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
                        <div>
                          <h4 className="text-sm font-bold text-foreground">Valores & Encargos Financeiros</h4>
                          <p className="text-xs text-muted-foreground">Preço de venda e despesas periódicas do imóvel (formatação monetária automática)</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSuggestPrice}
                          disabled={isEstimatingPrice}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all border border-primary/25 disabled:opacity-50 cursor-pointer shadow-xs self-start sm:self-auto"
                          title="Calcular estimativa de preço de mercado com base em dados imobiliários e IA"
                        >
                          {isEstimatingPrice ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                              <span>Analisando mercado...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-primary" />
                              <span>Sugerir Preço (IA)</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                            Preço de Venda (R$) *
                          </label>
                          <input 
                            name="price"
                            required
                            value={displayPrice}
                            onChange={(e) => setDisplayPrice(formatCurrencyBRL(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            placeholder="R$ 0,00"
                            className="w-full px-5 py-3.5 bg-background border border-border rounded-2xl text-base font-black text-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                          />
                          {parseFloat(areaInput || "0") > 0 && parseCurrencyBRLToNumber(displayPrice) > 0 ? (
                            <p className="text-[11px] font-medium text-muted-foreground pl-1 flex items-center gap-1.5">
                              <span>Média m²:</span>
                              <span className="font-bold text-foreground font-mono">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Math.round(parseCurrencyBRLToNumber(displayPrice) / parseFloat(areaInput)))} / m²
                              </span>
                            </p>
                          ) : (
                            <p className="text-[11px] font-medium text-muted-foreground pl-1">Valor de avaliação / venda</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center justify-between">
                            <span>Valor Condomínio (R$)</span>
                            <span className="text-[9px] font-semibold text-muted-foreground lowercase">mensal</span>
                          </label>
                          <input 
                            name="condoFee"
                            value={displayCondoFee}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "");
                              setDisplayCondoFee(raw ? formatCurrencyBRL(raw) : "");
                            }}
                            onFocus={(e) => e.target.select()}
                            placeholder="R$ 0,00"
                            className="w-full px-5 py-3.5 bg-background border border-border rounded-2xl text-base font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                          />
                          <p className="text-[11px] font-medium text-muted-foreground pl-1">Taxa mensal do condomínio</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center justify-between">
                            <span>IPTU (R$)</span>
                            <span className="text-[9px] font-semibold text-muted-foreground lowercase">anual / total</span>
                          </label>
                          <input 
                            name="iptu"
                            value={displayIptu}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "");
                              setDisplayIptu(raw ? formatCurrencyBRL(raw) : "");
                            }}
                            onFocus={(e) => e.target.select()}
                            placeholder="R$ 0,00"
                            className="w-full px-5 py-3.5 bg-background border border-border rounded-2xl text-base font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                          />
                          <p className="text-[11px] font-medium text-muted-foreground pl-1">Valor total anual ou cota única</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex justify-between">
                        CEP
                        {isFetchingCep && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                      </label>
                      <input 
                        name="cep"
                        value={cep}
                        onChange={(e) => setCep(formatCEP(e.target.value))}
                        onBlur={handleCepBlur}
                        required
                        placeholder="00000-000"
                        autoComplete="new-password"
                        className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-mono font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none autofill:shadow-[0_0_0_1000px_#111827_inset] autofill:text-white"
                        style={{ backgroundColor: '#111827' }}
                      />
                    </div>

                    {valuationResult && (
                      <div className="md:col-span-2">
                        <PropertyValuationCard
                          valuation={valuationResult}
                          currentPrice={parseCurrencyBRLToNumber(displayPrice)}
                          onApplyPrice={handleApplyValuationPrice}
                          onClose={() => setValuationResult(null)}
                          propertyTitle={title || "Novo Imóvel"}
                        />
                      </div>
                    )}

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="md:col-span-3 space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Logradouro</label>
                        <input 
                          name="street"
                          required
                          value={addressData.street}
                          onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                          className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Número</label>
                        <input 
                          name="number"
                          required
                          defaultValue={editingProperty?.number}
                          className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Bairro</label>
                        <input 
                          name="neighborhood"
                          required
                          value={addressData.neighborhood}
                          onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                          className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Cidade</label>
                        <input 
                          name="city"
                          required
                          value={addressData.city}
                          onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                          className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Estado (UF)</label>
                        <input 
                          name="state"
                          required
                          maxLength={2}
                          value={addressData.state}
                          onChange={(e) => setAddressData({ ...addressData, state: e.target.value })}
                          className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-black text-center uppercase focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                      </div>
                    </div>

                    {cep && cep.replace(/\D/g, "").length === 8 && (
                      <div className="md:col-span-2 space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Localização no Mapa</label>
                        <div className="w-full h-64 rounded-[32px] overflow-hidden border border-border bg-muted/10 shadow-inner relative">
                          <iframe
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(`${addressData.street || ""} ${addressData.neighborhood || ""} ${addressData.city || ""} ${addressData.state || ""} ${cep}`.trim())}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 md:col-span-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Área (m²)</label>
                        <input 
                          name="area" 
                          type="number" 
                          value={areaInput}
                          onChange={(e) => setAreaInput(e.target.value)}
                          placeholder="Ex: 85"
                          className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" 
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Dormitórios</label>
                        <input name="bedrooms" type="number" defaultValue={editingProperty?.bedrooms} className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Banheiros</label>
                        <input name="bathrooms" type="number" defaultValue={editingProperty?.bathrooms} className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none" />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Vagas</label>
                        <input name="parkingSpots" type="number" defaultValue={editingProperty?.parkingSpots} className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none" />
                      </div>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-5 bg-muted/20 border border-border rounded-3xl">
                        <input 
                          type="checkbox" 
                          name="acceptsFinancing" 
                          id="acceptsFinancing"
                          defaultChecked={editingProperty?.acceptsFinancing}
                          className="w-5 h-5 accent-primary cursor-pointer"
                        />
                        <label htmlFor="acceptsFinancing" className="text-sm font-bold cursor-pointer select-none">
                          Aceita Financiamento Bancário
                        </label>
                      </div>

                      <div 
                        onClick={() => setIsFeatured(!isFeatured)}
                        className={cn(
                          "flex items-center gap-3 p-5 border rounded-3xl transition-all cursor-pointer",
                          isFeatured 
                            ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400" 
                            : "bg-muted/20 border-border text-foreground hover:bg-muted/30"
                        )}
                      >
                        <input 
                          type="checkbox" 
                          name="isFeatured" 
                          id="isFeatured"
                          checked={isFeatured}
                          onChange={(e) => setIsFeatured(e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 accent-amber-500 cursor-pointer"
                        />
                        <label 
                          htmlFor="isFeatured" 
                          className="text-sm font-bold cursor-pointer select-none flex items-center gap-2" 
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Star className={cn("w-4 h-4", isFeatured ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
                          <span>Destaque / Melhores Oportunidades</span>
                        </label>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Descritivo Comercial</label>
                      <textarea 
                        name="description"
                        required
                        defaultValue={editingProperty?.description}
                        rows={4}
                        className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all resize-none outline-none"
                      />
                    </div>

                    {/* Bloco de Características, Comodidades & Tags (Diferenciais) */}
                    <div className="md:col-span-2 p-6 sm:p-7 bg-muted/20 border border-border/70 rounded-3xl space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Tag className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                              <span>Características, Diferenciais & Comodidades</span>
                              {selectedTags.length > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                                  {selectedTags.length} selecionado{selectedTags.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Adicione comodidades e tags para valorizar seu imóvel na vitrine e acelerar buscas
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Campo para Adicionar Tag Personalizada */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={customTagInput}
                            onChange={(e) => setCustomTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = customTagInput.trim();
                                if (val && !selectedTags.some(t => t.toLowerCase() === val.toLowerCase())) {
                                  setSelectedTags(prev => [...prev, val]);
                                  setCustomTagInput("");
                                }
                              }
                            }}
                            placeholder="Digite uma comodidade e tecle Enter (ex: Vista Panorâmica, Energia Solar, Reformado...)"
                            className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-xs font-medium text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                          />
                          {customTagInput && (
                            <button
                              type="button"
                              onClick={() => setCustomTagInput("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const val = customTagInput.trim();
                            if (val && !selectedTags.some(t => t.toLowerCase() === val.toLowerCase())) {
                              setSelectedTags(prev => [...prev, val]);
                              setCustomTagInput("");
                            }
                          }}
                          disabled={!customTagInput.trim()}
                          className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adicionar</span>
                        </button>
                      </div>

                      {/* Tags Ativas Atualmente no Imóvel */}
                      {selectedTags.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Tags ativas neste imóvel (clique no × para remover):
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs animate-in fade-in"
                              >
                                <span>{tag}</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                                  className="hover:bg-white/20 rounded-full p-0.5 transition-colors cursor-pointer"
                                  title="Remover tag"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sugestões Populares Agrupadas */}
                      <div className="space-y-3 pt-2 border-t border-border/50">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">
                          Comodidades Frequentes (clique para marcar/desmarcar):
                        </label>
                        <div className="space-y-2.5">
                          {TAG_CATEGORIES.map((cat, catIdx) => (
                            <div key={catIdx} className="space-y-1.5">
                              <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider block">
                                {cat.category}
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {cat.tags.map((tag) => {
                                  const isSelected = selectedTags.some(t => t.toLowerCase() === tag.toLowerCase());
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedTags(prev => prev.filter(t => t.toLowerCase() !== tag.toLowerCase()));
                                        } else {
                                          setSelectedTags(prev => [...prev, tag]);
                                        }
                                      }}
                                      className={cn(
                                        "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1",
                                        isSelected
                                          ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                                          : "bg-background border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                      )}
                                    >
                                      {isSelected ? <Check className="w-3 h-3 text-white" /> : <Plus className="w-2.5 h-2.5 opacity-60" />}
                                      <span>{tag}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-6">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Galeria de Imagens (Anexos)</label>
                      </div>

                      <div 
                        className={cn(
                          "relative p-8 border-2 border-dashed rounded-3xl bg-muted/10 group transition-all cursor-pointer flex flex-col items-center justify-center text-center",
                          isDragging ? "border-primary bg-primary/5 scale-[1.01] shadow-xl shadow-primary/5" : "border-border hover:bg-muted/20 hover:border-primary/50",
                          isUploading && "opacity-50 pointer-events-none"
                        )}
                        onClick={() => document.getElementById('file-upload')?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <input 
                          id="file-upload"
                          type="file" 
                          multiple 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleImageUpload} 
                        />
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                          {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                        </div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Clique ou arraste fotos aqui</h4>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-2">
                          Suporta múltiplos arquivos • Máximo 10MB por foto
                        </p>
                      </div>

                      {imageUrls.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {imageUrls.map((url, idx) => (
                            <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden border border-border group bg-muted/50">
                              <Image 
                                src={url} 
                                alt={`Property ${idx}`} 
                                fill
                                className="object-cover" 
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setImageUrls(imageUrls.filter((_, i) => i !== idx));
                                  }}
                                  className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                                  title="Remover imagem"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-10 py-8 bg-muted/30 border-t border-border flex flex-col md:flex-row gap-4">
                  <button 
                    type="submit" 
                    disabled={isSaving || isUploading}
                    className="flex-1 bg-primary text-primary-foreground py-5 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {(isSaving || isUploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isUploading ? "Processando Imagens..." : isSaving ? "Salvando..." : editingProperty ? 'Salvar Alterações' : 'Publicar no Inventário'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setView('list')}
                    className="flex-1 bg-card text-muted-foreground py-5 rounded-2xl text-sm font-black uppercase tracking-widest border border-border hover:bg-background transition-all"
                  >
                    Descartar e Sair
                  </button>
                </div>
              </form>
            </div>

            {editingProperty && (
              <div className="xl:col-span-4 space-y-8">
                {/* Clientes com Match */}
                <div className="bg-card border border-border rounded-[40px] p-8 shadow-2xl h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 justify-between mb-6 pb-4 border-b border-border/60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#00E5FF]/10 flex items-center justify-center text-[#00E5FF] animate-pulse">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground">Cruzamento Reverso</h3>
                          <p className="text-xs text-muted-foreground font-medium">Clientes compatíveis</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#00E5FF] px-2.5 py-1.5 bg-[#00E5FF]/10 rounded-xl border border-[#00E5FF]/20">
                        {getMatchingContactsForProperty(editingProperty).length} Match(es)
                      </span>
                    </div>

                    {(() => {
                      const matches = getMatchingContactsForProperty(editingProperty);
                      if (matches.length === 0) {
                        return (
                          <div className="py-16 text-center text-muted-foreground bg-muted/15 rounded-3xl border border-dashed border-border p-6 flex flex-col justify-center items-center">
                            <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/75 mb-1">Nenhum cliente compatível</p>
                            <p className="text-[11px] leading-relaxed max-w-sm mx-auto text-center">Nenhum cliente cadastrado no CRM possui critérios que correspondam às especificações deste imóvel.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 font-sans">
                          {matches.map(({ contact, score }) => (
                            <div key={contact.id} className="p-4 bg-muted/30 hover:bg-muted/70 border border-border rounded-2xl flex items-center justify-between transition-all hover:scale-[1.01] duration-300">
                              <div className="min-w-0 flex-1 pr-3">
                                <h4 className="font-bold text-xs text-foreground truncate">{contact.name}</h4>
                                <p className="text-[9px] font-black text-primary uppercase mt-0.5 tracking-wider">
                                  Origem: {contact.source || "Direto"}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1 px-2 py-0.5 bg-background border border-border/60 rounded-lg max-w-max font-mono truncate">
                                  <span>{contact.email}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-10 h-10 rounded-full border shadow-sm flex flex-col items-center justify-center text-[10px] font-black shrink-0",
                                  score >= 80 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" :
                                  score >= 60 ? "bg-primary/10 border-primary/30 text-primary" :
                                  "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                )}>
                                  <span>{score}%</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCreateDealFromPropertyMatch(contact, editingProperty)}
                                  className="w-8 h-8 rounded-lg bg-primary text-primary-foreground hover:opacity-95 transition-all flex items-center justify-center shadow shadow-primary/20 cursor-pointer"
                                  title="Vincular cliente a este imóvel via Negócio"
                                >
                                  <Zap className="w-3.5 h-3.5 fill-primary-foreground text-primary-foreground" />
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
          </div>
        </div>
      )}
        </div>
      </main>

      {/* Modal de visualização de mapa */}
      <AnimatePresence>
        {activeMapProperty && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-xl overflow-hidden"
            >
              <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
                <div>
                  <h3 className="text-sm md:text-base font-bold text-foreground uppercase tracking-tight line-clamp-1">{activeMapProperty.title}</h3>
                  <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5 flex items-center gap-1 flex-wrap">
                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                    {activeMapProperty.street 
                      ? `${activeMapProperty.street}, ${activeMapProperty.number || "S/N"}${activeMapProperty.neighborhood ? ` - ${activeMapProperty.neighborhood}` : ""}, ${activeMapProperty.city} - ${activeMapProperty.state}` 
                      : activeMapProperty.location}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMapProperty(null)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors border border-border shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="h-[320px] w-full bg-muted/25 relative">
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(
                    (activeMapProperty.street 
                      ? `${activeMapProperty.street}, ${activeMapProperty.number || ""} ${activeMapProperty.neighborhood || ""} ${activeMapProperty.city || ""} ${activeMapProperty.state || ""} ${activeMapProperty.cep || ""}`
                      : activeMapProperty.location
                    ).trim()
                  )}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                />
              </div>
              <div className="p-4 bg-muted/10 border-t border-border flex justify-end gap-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    (activeMapProperty.street 
                      ? `${activeMapProperty.street}, ${activeMapProperty.number || ""} ${activeMapProperty.neighborhood || ""} ${activeMapProperty.city || ""} ${activeMapProperty.state || ""} ${activeMapProperty.cep || ""}`
                      : activeMapProperty.location
                    ).trim()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all border border-border"
                >
                  Abrir no Google Maps
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={() => setActiveMapProperty(null)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-95 transition-all shadow-sm"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {sharingProperty && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-bold text-foreground uppercase tracking-tight">Gerador de Ficha de Imóvel</h3>
                    <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Prepare ofertas personalizadas para WhatsApp</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSharingProperty(null)}
                  className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors border border-border shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[55vh]">
                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex items-start gap-2.5">
                  <span className="text-base">💡</span>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-emerald-500 font-bold block mb-0.5">Dica do sistema:</strong>
                    Você pode alterar livremente o texto abaixo antes de copiar ou enviar. Adicione seu nome, dados de contato ou mensagens personalizadas.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pl-0.5">Visualização e Edição da Ficha</label>
                  <textarea
                    value={sharingText}
                    onChange={(e) => setSharingText(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-mono leading-relaxed resize-y"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-muted/10 border-t border-border flex flex-col sm:flex-row justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSharingProperty(null)}
                  className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-border"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (sharingProperty) {
                      const publicUrl = `${window.location.origin}/p/${sharingProperty.id}`;
                      navigator.clipboard.writeText(publicUrl);
                      toast.success("Link público de captura copiado!");
                      recordAuditEvent({
                        action: 'SHARE_PROPERTY_LINK',
                        title: 'Link Público Copiado',
                        content: `Link público da vitrine do imóvel "${sharingProperty.title}" copiado para divulgação.`,
                        severity: 'low',
                        category: 'modification',
                        relatedId: sharingProperty.id,
                        entityId: sharingProperty.id,
                        entityType: 'property',
                        metadata: {
                          propertyTitle: sharingProperty.title,
                          publicUrl
                        }
                      });
                    }
                  }}
                  className="px-4 py-2 bg-primary hover:bg-opacity-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white" />
                  Copiar Link
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sharingText);
                    toast.success("Ficha do imóvel copiada!");
                    if (sharingProperty) {
                      recordAuditEvent({
                        action: 'SHARE_PROPERTY_LINK',
                        title: 'Ficha WhatsApp Gerada',
                        content: `Ficha para WhatsApp do imóvel "${sharingProperty.title}" gerada e copiada.`,
                        severity: 'low',
                        category: 'modification',
                        relatedId: sharingProperty.id,
                        entityId: sharingProperty.id,
                        entityType: 'property',
                        metadata: {
                          propertyTitle: sharingProperty.title,
                          type: 'whatsapp'
                        }
                      });
                    }
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-white fill-white" />
                  Copiar Ficha WhatsApp
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Compartilhamento da Vitrine Pública */}
        {isVitrineModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-bold text-foreground uppercase tracking-tight flex items-center gap-2">
                      Vitrine Pública de Imóveis
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                        Ao Vivo
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Compartilhe seu catálogo virtual exclusivo com clientes e compradores
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsVitrineModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Selector Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    Tipo de Compartilhamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVitrineShareMode('tenant')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        vitrineShareMode === 'tenant'
                          ? 'bg-primary/5 border-primary text-foreground shadow-xs'
                          : 'bg-card border-border hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Building2 className={`w-4 h-4 ${vitrineShareMode === 'tenant' ? 'text-primary' : 'text-muted-foreground'}`} />
                        {vitrineShareMode === 'tenant' && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <h4 className="text-xs font-bold text-foreground">Imobiliária Geral</h4>
                      <p className="text-[10px] text-muted-foreground">Toda a carteira de imóveis da empresa</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVitrineShareMode('broker')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        vitrineShareMode === 'broker'
                          ? 'bg-primary/5 border-primary text-foreground shadow-xs'
                          : 'bg-card border-border hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Share2 className={`w-4 h-4 ${vitrineShareMode === 'broker' ? 'text-primary' : 'text-muted-foreground'}`} />
                        {vitrineShareMode === 'broker' && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <h4 className="text-xs font-bold text-foreground">Meu Link de Corretor</h4>
                      <p className="text-[10px] text-muted-foreground">Seu WhatsApp e contato em destaque</p>
                    </button>
                  </div>
                </div>

                {/* Link Preview and Copy */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                    Link da Vitrine
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={(() => {
                        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                        return vitrineShareMode === 'broker' && profile?.id
                          ? (profile?.tenantId ? `${baseUrl}/vitrine?tenant=${profile.tenantId}&broker=${profile.id}` : `${baseUrl}/vitrine?broker=${profile.id}`)
                          : (profile?.tenantId ? `${baseUrl}/vitrine?tenant=${profile.tenantId}` : `${baseUrl}/vitrine`);
                      })()}
                      className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs font-mono text-foreground outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                        const url = vitrineShareMode === 'broker' && profile?.id
                          ? (profile?.tenantId ? `${baseUrl}/vitrine?tenant=${profile.tenantId}&broker=${profile.id}` : `${baseUrl}/vitrine?broker=${profile.id}`)
                          : (profile?.tenantId ? `${baseUrl}/vitrine?tenant=${profile.tenantId}` : `${baseUrl}/vitrine`);
                        navigator.clipboard.writeText(url);
                        toast.success("Link da vitrine copiado!");
                        recordAuditEvent({
                          action: 'SHARE_PROPERTY_LINK',
                          title: 'Link da Vitrine Copiado',
                          content: `Link da vitrine pública de imóveis copiado (${vitrineShareMode === 'broker' ? 'modo corretor' : 'modo geral'}).`,
                          severity: 'low',
                          category: 'modification',
                          metadata: {
                            type: 'vitrine_url',
                            mode: vitrineShareMode,
                            url
                          }
                        });
                      }}
                      className="px-3.5 py-2 bg-primary text-white hover:opacity-90 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </button>
                  </div>
                </div>

                {/* Direct Action Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                      const url = vitrineShareMode === 'broker' && profile?.id
                        ? (profile?.tenantId ? `${baseUrl}/vitrine?tenant=${profile.tenantId}&broker=${profile.id}` : `${baseUrl}/vitrine?broker=${profile.id}`)
                        : (profile?.tenantId ? `${baseUrl}/vitrine?tenant=${profile.tenantId}` : `${baseUrl}/vitrine`);
                      
                      const msg = vitrineShareMode === 'broker'
                        ? `🏡 *Conheça meu Catálogo Exclusivo de Imóveis!*\n\nOlá! Selecionei as melhores opções disponíveis atualizadas em tempo real. Acesse e confira fotos, valores e detalhes:\n👉 ${url}\n\nFico à total disposição para agendarmos visitas!`
                        : `🏡 *Vitrine de Imóveis - Conheça Nossa Carteira!*\n\nConfira todos os imóveis disponíveis atualizados em tempo real com fotos em alta resolução e condições exclusivas:\n👉 ${url}`;
                      
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-2.5 text-left transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-5 h-5 shrink-0 fill-current" />
                    <div>
                      <h4 className="text-xs font-bold">Enviar no WhatsApp</h4>
                      <p className="text-[10px] text-muted-foreground">Mensagem pronta com link para seus contatos</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                      const url = vitrineShareMode === 'broker' && profile?.id
                        ? (profile?.tenantId ? `${baseUrl}/vitrine?tenant=${profile.tenantId}&broker=${profile.id}` : `${baseUrl}/vitrine?broker=${profile.id}`)
                        : (profile?.tenantId ? `${baseUrl}/vitrine?tenant=${profile.tenantId}` : `${baseUrl}/vitrine`);
                      window.open(url, '_blank');
                    }}
                    className="p-3 rounded-xl bg-muted/40 hover:bg-muted text-foreground border border-border flex items-center gap-2.5 text-left transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-5 h-5 shrink-0 text-primary" />
                    <div>
                      <h4 className="text-xs font-bold">Abrir Vitrine</h4>
                      <p className="text-[10px] text-muted-foreground">Ver como o cliente enxerga no navegador</p>
                    </div>
                  </button>
                </div>

                {/* Best Practice Tip */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-snug text-[11px]">
                    <strong>Dica de Alta Conversão:</strong> Adicione esse link na Bio do seu Instagram (ou no seu Linktree) e no status do WhatsApp. Seus clientes consultarão os imóveis sem precisar de site externo e os leads cairão direto no seu pipeline!
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-muted/10 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsVitrineModalOpen(false)}
                  className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-border cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão de Imóvel */}
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

function PropertyCard({ property, onEdit, onDelete, onShowMap, onShare, onToggleFeatured }: { 
  property: Property; 
  onEdit: () => void; 
  onDelete: () => void; 
  onShowMap: () => void; 
  onShare: () => void;
  onToggleFeatured: () => void;
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-card rounded-2xl border border-border overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all flex flex-col"
    >
      <div className="h-40 sm:h-44 relative overflow-hidden shrink-0 group/img">
        <AnimatePresence mode="wait">
              <motion.div
                key={currentImageIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0"
              >
                <Image 
                  src={images[currentImageIndex]} 
                  alt={property.title} 
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
        </AnimatePresence>

        {/* Carousel Controls */}
        {images.length > 1 && (
          <>
            <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1 z-10">
              {images.map((_, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "w-1 h-1 rounded-full transition-all duration-300",
                    idx === currentImageIndex ? "bg-white w-3" : "bg-white/40"
                  )}
                />
              ))}
            </div>

            <div className="absolute inset-0 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-between px-2 pointer-events-none">
              <button 
                onClick={prevImage}
                className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70 transition-colors pointer-events-auto"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={nextImage}
                className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70 transition-colors pointer-events-auto"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* Botão de Destaque Rápido */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFeatured();
          }}
          className={cn(
            "absolute top-2.5 right-2.5 z-20 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all shadow-md cursor-pointer",
            property.isFeatured
              ? "bg-amber-500 text-white shadow-amber-500/40 hover:scale-110 hover:bg-amber-600 ring-2 ring-white/50"
              : "bg-black/50 text-white/70 hover:text-amber-400 hover:bg-black/70 hover:scale-105"
          )}
          title={property.isFeatured ? "Remover dos Destaques" : "Marcar como Destaque / Melhor Oportunidade"}
        >
          <Star className={cn("w-4 h-4 transition-transform", property.isFeatured && "fill-white text-white")} />
        </button>

        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10 pointer-events-none">
          {property.isFeatured && (
            <span className="px-2 py-0.5 bg-amber-500 text-white border border-amber-300/40 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md shadow-amber-500/30">
              <Sparkles className="w-2.5 h-2.5 fill-white" /> Destaque
            </span>
          )}
          <span className={cn(
            "px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider backdrop-blur-md border",
            property.status === 'disponível' ? "bg-emerald-500/80 text-white border-emerald-400" :
            property.status === 'reservado' ? "bg-amber-500/80 text-white border-amber-400" :
            "bg-slate-800/80 text-white border-slate-700"
          )}>
            {property.status}
          </span>
          <span className="px-2 py-0.5 bg-background/80 backdrop-blur-md text-foreground border border-border/40 rounded-lg text-[9px] font-bold uppercase tracking-wider">
            {property.type}
          </span>
          {property.acceptsFinancing && (
            <span className="px-2 py-0.5 bg-primary text-primary-foreground rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-2.5 h-2.5" />
              Financia
            </span>
          )}
        </div>
      </div>

      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        <div className="mb-2.5">
          <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 tracking-tight">{property.title}</h4>
          {property.buildingName && (
            <p className="text-[10px] font-semibold text-primary line-clamp-1 flex items-center gap-1 mt-0.5">
              <span>🏢</span>
              <span className="truncate">{property.buildingName}</span>
            </p>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onShowMap();
            }}
            className="flex items-center gap-1 text-muted-foreground mt-0.5 hover:text-primary transition-colors cursor-pointer group/loc text-left"
            title="Visualizar mapa completo"
          >
            <MapPin className="w-2.5 h-2.5 group-hover/loc:scale-110 group-hover/loc:text-primary transition-all" />
            <span className="text-[9px] font-medium uppercase tracking-wider truncate group-hover/loc:underline">{property.location}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="flex items-center gap-1.5 bg-muted/60 p-2 rounded-lg border border-border/40">
            <Bed className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-foreground">{property.bedrooms} Quartos</span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/60 p-2 rounded-lg border border-border/40">
            <Square className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-foreground">{property.area}m²</span>
          </div>
        </div>

        {/* Tags / Diferenciais do Imóvel */}
        {property.tags && property.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {property.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md text-[9px] font-semibold bg-primary/10 text-primary border border-primary/15 truncate max-w-[120px]"
              >
                {tag}
              </span>
            ))}
            {property.tags.length > 3 && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-muted text-muted-foreground">
                +{property.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-2.5 border-t border-border flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Valor Venda</p>
              <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(property.price)}
              </p>
            </div>
            {property.area > 0 && property.price > 0 && (
              <div className="text-right">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Média m²</p>
                <p className="text-xs font-bold text-primary font-mono">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Math.round(property.price / property.area))}/m²
                </p>
              </div>
            )}
          </div>

          {/* Encargos Periódicos (Condomínio e IPTU) */}
          {((property.condoFee && property.condoFee > 0) || (property.iptu && property.iptu > 0)) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground font-medium pt-1 border-t border-border/40">
              {property.condoFee && property.condoFee > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <span>Cond.:</span>
                  <strong className="text-foreground">{formatCurrencyBRL(property.condoFee)}</strong>
                </span>
              ) : null}
              {property.condoFee && property.condoFee > 0 && property.iptu && property.iptu > 0 ? (
                <span className="text-border">•</span>
              ) : null}
              {property.iptu && property.iptu > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <span>IPTU:</span>
                  <strong className="text-foreground">{formatCurrencyBRL(property.iptu)}</strong>
                </span>
              ) : null}
            </div>
          )}

          <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-border/40">
            <div className="flex items-center gap-1">
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFeatured();
                }} 
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                  property.isFeatured
                    ? "bg-amber-500 text-white shadow-xs hover:bg-amber-600"
                    : "bg-muted text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500"
                )}
                title={property.isFeatured ? "Remover destaque" : "Marcar como destaque comercial"}
              >
                <Star className={cn("w-3.5 h-3.5", property.isFeatured && "fill-current")} />
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }} 
                className="w-7 h-7 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all"
                title="Editar imóvel"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                }} 
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer z-20 relative bg-muted text-muted-foreground border-transparent hover:bg-red-500/10 hover:text-red-500"
                title="Excluir imóvel"
              >
                <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onShare();
                }}
                className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-xs cursor-pointer"
                title="Gerar ficha para WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5 pointer-events-none" />
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onShowMap();
                }}
                className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all shadow-xs cursor-pointer"
                title="Visualizar mapa"
              >
                <MapPin className="w-3.5 h-3.5 pointer-events-none" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
