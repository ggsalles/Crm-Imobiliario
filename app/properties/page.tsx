"use client";

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
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { 
  getProperties,
  subscribeToProperties, 
  createProperty, 
  updateProperty, 
  deleteProperty, 
  uploadFile,
  Property,
  getContacts,
  Contact,
  createDeal,
  createTimelineEvent
} from "@/lib/db";
import { cn, formatCurrencyBRL, parseCurrencyBRLToNumber, formatCEP } from "@/lib/utils";
import Image from "next/image";
import { toast } from "sonner";

export default function PropertiesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<'list' | 'form'>('list');
  const [properties, setProperties] = useState<Property[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [title, setTitle] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [displayPrice, setDisplayPrice] = useState("");
  const [cep, setCep] = useState("");
  const [activeMapProperty, setActiveMapProperty] = useState<Property | null>(null);
  const [sharingProperty, setSharingProperty] = useState<Property | null>(null);
  const [sharingText, setSharingText] = useState("");

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

    return `✨ *OPORTUNIDADE IMOBILIÁRIA* ✨
🏡 *${property.title}*

📍 *Localização:* ${property.location}
💰 *Valor:* ${priceFormatted}

📐 *Área:* ${property.area} m²
🛏 *Quartos:* ${property.bedrooms} dormitórios
🚿 *Banheiros:* ${property.bathrooms} banheiros
🚗 *Vagas:* ${property.parkingSpots} vagas
✍️ *Tipo:* ${property.type.substring(0,1).toUpperCase() + property.type.substring(1)}
🏦 *Aceita Financiamento:* ${financingTxt}

📄 *Descrição do Imóvel:*
${property.description || "Consulte-nos para mais detalhes!"}
${photosText}

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
      setDisplayPrice(formatCurrencyBRL(editingProperty?.price || 0));
      setImageUrls(editingProperty?.imageUrls || []);
      setCep(formatCEP(editingProperty?.cep || ""));
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

  const filteredProperties = useMemo(() => {
    if (typeof window === 'undefined') return [];
    return properties.filter((p) => {
      const matchesSearch =
        (p.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.location || "").toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === "all" || p.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [properties, search, filterType]);

  const handleDelete = async (id: string) => {
    console.log(`[Properties] handleDelete: Executando exclusão do ID: ${id}`);
    setLoading(true);
    const toastId = toast.loading("Excluindo imóvel...");
    
    try {
      await deleteProperty(id);
      console.log(`[Properties] handleDelete: Sucesso ao excluir ID: ${id}`);
      toast.success("Imóvel excluído com sucesso.", { id: toastId });
    } catch (err: any) {
      console.error(`[Properties] handleDelete: Erro ao excluir ID: ${id}`, err);
      toast.error(`Erro ao excluir: ${err.message || "Falha técnica"}`, { id: toastId });
    } finally {
      setLoading(false);
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
  }, []);

  const handleEdit = useCallback((property: Property) => {
    setEditingProperty(property);
    setView('form');
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
        type: (formData.get("type") as any) || "apartamento",
        status: (formData.get("status") as any) || "disponível",
        price: Number(parseCurrencyBRLToNumber(String(formData.get("price") || "0"))),
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
        notes: String(formData.get("notes") || "").substring(0, 2000),
        description: String(formData.get("description") || "").substring(0, 5000),
        imageUrls: cleanUrls,
      };

      toastId = toast.loading(isEditing ? "Atualizando registro..." : "Salvando novo imóvel...");

      console.log("[Properties] Enviando para o banco de dados...");
      if (isEditing && currentPropertyId) {
        await updateProperty(currentPropertyId, data, user.id);
      } else {
        await createProperty(data, user.id);
      }
      
      console.log("[Properties] Sucesso absoluto!");
      clearTimeout(uiTimeoutId);
      toast.success(isEditing ? "Imóvel atualizado com sucesso!" : "Imóvel cadastrado com sucesso!", { id: toastId });
      
      setEditingProperty(null);
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
        <header className="h-20 bg-card border-b border-border pl-20 md:pl-8 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {view === 'form' && (
              <button 
                onClick={() => setView('list')}
                className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors border border-border"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight uppercase">
                {view === 'list' ? 'Inventário de Imóveis' : editingProperty ? 'Editar Unidade' : 'Cadastrar Unidade'}
              </h2>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em] mt-0.5">
                {view === 'list' ? `${properties.length} imóveis ativos` : 'Preencha as especificações técnicas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {view === 'list' && (
              <>
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center gap-2" title="Conexão em tempo real ativa">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-tighter hidden sm:inline">Ao Vivo</span>
                </div>
                <div className="relative hidden md:block">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por nome ou local..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64 pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <button 
  onClick={handleNew}
  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/30 hover:opacity-90 active:scale-[0.98] transition-all"
>
                  <Plus className="w-4 h-4" />
                  Novo Imóvel
                </button>
              </>
            )}
            {view === 'form' && (
              <button 
                onClick={() => setView('list')}
                className="px-6 py-2.5 bg-muted text-muted-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:bg-muted/80 transition-all"
              >
                Cancelar
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-muted/5">
          {view === 'list' ? (
            <div className="space-y-8">
              <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-hide">
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
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => setFilterType(type.id)}
                    className={cn(
                      "flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0",
                      filterType === type.id 
                        ? "bg-foreground text-background border-foreground shadow-lg" 
                        : "bg-card text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    <type.icon className="w-4 h-4" />
                    {type.label}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Sincronizando...
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
                <AnimatePresence>
                  {filteredProperties.map((property) => (
                    <PropertyCard 
                      key={property.id} 
                      property={property} 
                      onEdit={() => handleEdit(property)}
                      onDelete={() => handleDelete(property.id)}
                      onShowMap={() => setActiveMapProperty(property)}
                      onShare={() => setSharingProperty(property)}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {filteredProperties.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-border rounded-[40px]">
                  <Home className="w-16 h-16 text-muted-foreground/20 mb-6" />
                  <h3 className="text-xl font-black uppercase tracking-tight">Inventário Vazio</h3>
                  <p className="text-muted-foreground text-sm font-medium mt-2 max-w-sm">
                    Nenhum imóvel corresponde aos seus filtros. Experimente cadastrar uma nova unidade para começar.
                  </p>
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
                    key={editingProperty?.id || 'new-property'}
                    onSubmit={handleCreateOrUpdate} 
                    className={cn(
                      "bg-card border border-border rounded-[40px] shadow-2xl overflow-hidden pb-12 transition-opacity",
                      (isSaving || isUploading) && "opacity-80 cursor-wait"
                    )}
                  >
                <div className="p-10 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="md:col-span-2 space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Identificação do Imóvel</label>
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

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Preço de Venda (R$)</label>
                      <input 
                        name="price"
                        required
                        value={displayPrice}
                        onChange={(e) => setDisplayPrice(formatCurrencyBRL(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        placeholder="R$ 0,00"
                        className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-base font-black text-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      />
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
                        <input name="area" type="number" defaultValue={editingProperty?.area} className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none" />
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

                    <div className="md:col-span-2 flex items-center gap-3 p-6 bg-muted/20 border border-border rounded-3xl">
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
              className="bg-card w-full max-w-2xl rounded-[32px] border border-border shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/20">
                <div>
                  <h3 className="text-base font-black text-foreground uppercase tracking-tight line-clamp-1">{activeMapProperty.title}</h3>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1 flex items-center gap-1.5 flex-wrap">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    {activeMapProperty.street 
                      ? `${activeMapProperty.street}, ${activeMapProperty.number || "S/N"}${activeMapProperty.neighborhood ? ` - ${activeMapProperty.neighborhood}` : ""}, ${activeMapProperty.city} - ${activeMapProperty.state}` 
                      : activeMapProperty.location}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMapProperty(null)}
                  className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors border border-border shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="h-[400px] w-full bg-muted/25 relative">
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
              <div className="p-6 bg-muted/10 border-t border-border flex justify-end gap-3">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    (activeMapProperty.street 
                      ? `${activeMapProperty.street}, ${activeMapProperty.number || ""} ${activeMapProperty.neighborhood || ""} ${activeMapProperty.city || ""} ${activeMapProperty.state || ""} ${activeMapProperty.cep || ""}`
                      : activeMapProperty.location
                    ).trim()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-muted text-muted-foreground hover:bg-muted/80 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border border-border"
                >
                  Abrir no Google Maps
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setActiveMapProperty(null)}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-95 transition-all shadow-lg shadow-primary/20"
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
              className="bg-card w-full max-w-2xl rounded-[32px] border border-border shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-foreground uppercase tracking-tight">Gerador de Ficha de Imóvel</h3>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.15em] mt-1">Prepare ofertas personalizadas para WhatsApp</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSharingProperty(null)}
                  className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors border border-border shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh]">
                <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-start gap-3">
                  <span className="text-xl">💡</span>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-emerald-500 font-bold block mb-1">Dica do sistema:</strong>
                    Você pode alterar livremente o texto abaixo antes de copiar ou enviar. Adicione seu nome, dados de contato ou mensagens personalizadas.
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Visualização e Edição da Ficha</label>
                  <textarea
                    value={sharingText}
                    onChange={(e) => setSharingText(e.target.value)}
                    rows={12}
                    className="w-full px-5 py-4 rounded-2xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-mono leading-relaxed resize-y"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 bg-muted/10 border-t border-border flex flex-col sm:flex-row justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSharingProperty(null)}
                  className="px-6 py-3 bg-muted text-muted-foreground hover:bg-muted/80 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-border"
                >
                  Cancelar
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sharingText);
                    toast.success("Ficha do imóvel copiada!");
                  }}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-white fill-white" />
                  Copiar Texto
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PropertyCard({ property, onEdit, onDelete, onShowMap, onShare }: { property: Property; onEdit: () => void; onDelete: () => void; onShowMap: () => void; onShare: () => void }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  const images = property.imageUrls && property.imageUrls.length > 0 
    ? property.imageUrls 
    : ["https://picsum.photos/seed/realestate/800/600"];

  useEffect(() => {
    if (confirmDelete) {
      const timer = setTimeout(() => setConfirmDelete(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmDelete]);

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
      className="bg-card rounded-[32px] border border-border overflow-hidden group hover:shadow-2xl hover:shadow-primary/10 transition-all flex flex-col"
    >
      <div className="h-48 relative overflow-hidden shrink-0 group/img">
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
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
        </AnimatePresence>

        {/* Carousel Controls */}
        {images.length > 1 && (
          <>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 z-10">
              {images.map((_, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-300",
                    idx === currentImageIndex ? "bg-white w-4" : "bg-white/40"
                  )}
                />
              ))}
            </div>

            <div className="absolute inset-0 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-between px-3 pointer-events-none">
              <button 
                onClick={prevImage}
                className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70 transition-colors pointer-events-auto"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={nextImage}
                className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70 transition-colors pointer-events-auto"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10 pointer-events-none">
          <span className={cn(
            "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md border",
            property.status === 'disponível' ? "bg-emerald-500/80 text-white border-emerald-400" :
            property.status === 'reservado' ? "bg-amber-500/80 text-white border-amber-400" :
            "bg-slate-800/80 text-white border-slate-700"
          )}>
            {property.status}
          </span>
          <span className="px-3 py-1.5 bg-background/80 backdrop-blur-md text-foreground border border-border/40 rounded-xl text-[10px] font-black uppercase tracking-widest">
            {property.type}
          </span>
          {property.acceptsFinancing && (
            <span className="px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              Financia
            </span>
          )}
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="mb-4">
          <h4 className="text-base font-black text-foreground group-hover:text-primary transition-colors line-clamp-1 tracking-tight">{property.title}</h4>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onShowMap();
            }}
            className="flex items-center gap-1.5 text-muted-foreground mt-1 hover:text-primary transition-colors cursor-pointer group/loc text-left"
            title="Visualizar mapa completo"
          >
            <MapPin className="w-3 h-3 group-hover/loc:scale-110 group-hover/loc:text-primary transition-all" />
            <span className="text-[9px] font-black uppercase tracking-widest truncate group-hover/loc:underline">{property.location}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="flex items-center gap-2 bg-muted p-2.5 rounded-xl border border-border/50">
            <Bed className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-bold text-foreground">{property.bedrooms} Quartos</span>
          </div>
          <div className="flex items-center gap-2 bg-muted p-2.5 rounded-xl border border-border/50">
            <Square className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-bold text-foreground">{property.area}m²</span>
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Valor Venda</p>
            <p className="text-lg font-black text-foreground tracking-tight">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(property.price)}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }} 
                className="w-10 h-10 rounded-xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all"
                title="Editar imóvel"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log(`[PropertyCard] Clique no botão lixeira. Estado confirmDelete: ${confirmDelete}`);
                  if (confirmDelete) {
                    console.log("[PropertyCard] Segunda confirmação recebida. Chamando onDelete...");
                    onDelete();
                    setConfirmDelete(false);
                  } else {
                    console.log("[PropertyCard] Primeira confirmação. Ativando estado de confirmação.");
                    setConfirmDelete(true);
                  }
                }} 
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer z-20 relative border",
                  confirmDelete 
                    ? "bg-red-500 text-white border-red-600 scale-110 shadow-lg shadow-red-500/20" 
                    : "bg-muted text-muted-foreground border-transparent hover:bg-red-500/10 hover:text-red-500"
                )}
                title={confirmDelete ? "Clique novamente para confirmar" : "Excluir imóvel"}
              >
                {confirmDelete ? (
                  <Trash2 className="w-4 h-4 animate-pulse pointer-events-none" />
                ) : (
                  <Trash2 className="w-4 h-4 pointer-events-none" />
                )}
              </button>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onShare();
              }}
              className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm cursor-pointer"
              title="Gerar ficha para WhatsApp"
            >
              <Share2 className="w-4 h-4 pointer-events-none" />
            </button>
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onShowMap();
              }}
              className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all shadow-sm cursor-pointer"
              title="Visualizar mapa"
            >
              <MapPin className="w-5 h-5 pointer-events-none" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
