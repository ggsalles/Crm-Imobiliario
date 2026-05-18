"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { 
  getProperties,
  subscribeToProperties, 
  createProperty, 
  updateProperty, 
  deleteProperty, 
  uploadFile,
  Property
} from "@/lib/db";
import { cn, formatCurrencyBRL, parseCurrencyBRLToNumber } from "@/lib/utils";
import Image from "next/image";
import { toast } from "sonner";

export default function PropertiesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<'list' | 'form'>('list');
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [displayPrice, setDisplayPrice] = useState("");
  const isSubmittingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      console.log("[Properties] Sincronizando inventário para usuário:", user.id);
      const ownerId = profile.role === 'Admin' ? undefined : user.id;
      const data = await getProperties(ownerId);
      setProperties(data);
    } catch (error) {
      console.error("Erro ao buscar imóveis:", error);
      toast.error("Não foi possível atualizar a lista de imóveis.");
    } finally {
      setLoading(false);
    }
  }, [user, profile]);
  
  useEffect(() => {
    if (view === 'form') {
      setDisplayPrice(formatCurrencyBRL(editingProperty?.price || 0));
      setImageUrls(editingProperty?.imageUrls || []);
    }
  }, [view, editingProperty]);

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
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf,
        });
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

  useEffect(() => {
    if (!user || !profile) return;
    
    console.log("[Properties] Usuário autenticado, iniciando busca de dados...");
    fetchData();
  }, [user, profile, fetchData]);

  const filteredProperties = properties.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || p.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleDelete = async (id: string) => {
    console.log(`[Properties] handleDelete: Executando exclusão do ID: ${id}`);
    setLoading(true);
    const toastId = toast.loading("Excluindo imóvel...");
    
    try {
      await deleteProperty(id);
      console.log(`[Properties] handleDelete: Sucesso ao excluir ID: ${id}`);
      toast.success("Imóvel excluído com sucesso.", { id: toastId });
      await fetchData();
    } catch (err: any) {
      console.error(`[Properties] handleDelete: Erro ao excluir ID: ${id}`, err);
      toast.error(`Erro ao excluir: ${err.message || "Falha técnica"}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const totalFiles = files.length;
    let uploadedCount = 0;
    
    setIsUploading(true);
    const toastId = toast.loading(`Enviando ${totalFiles} ${totalFiles === 1 ? 'imagem' : 'imagens'}...`);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`Arquivo "${file.name}" é muito grande (Máx 10MB).`);
        }
        
        try {
          const result = await uploadFile(file);
          uploadedCount++;
          return result.url;
        } catch (err: any) {
          console.error(`Erro ao subir ${file.name}:`, err);
          throw err;
        }
      });

      const urls = await Promise.all(uploadPromises);
      setImageUrls(prev => [...prev, ...urls]);
      toast.success(`${uploadedCount} ${uploadedCount === 1 ? 'imagem enviada' : 'imagens enviadas'} com sucesso!`, { id: toastId });
    } catch (error: any) {
      console.error("Erro no upload múltiplo:", error);
      toast.error(error.message || "Erro no envio de uma ou mais imagens.", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      await processFiles(files);
      e.target.value = ''; // Limpa o input
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving || isSubmittingRef.current) {
      console.warn("[Properties] Já existe uma operação de salvamento em curso.");
      return;
    }

    console.log("[Properties] 1. Iniciado handleCreateOrUpdate");
    const formData = new FormData(e.currentTarget);
    setIsSaving(true);
    isSubmittingRef.current = true;

    // Trava de segurança: Reset automático após 15 segundos se o banco travar
    const uiTimeoutId = setTimeout(() => {
      if (isSubmittingRef.current) {
        console.error("[Properties] CRITICAL: UI Timeout (15s) - Destravando manual.");
        setIsSaving(false);
        isSubmittingRef.current = false;
        toast.error("O banco de dados demorou muito a responder. A interface foi liberada, mas verifique se a operação foi concluída no inventário.");
      }
    }, 15000);
    
    try {
      if (!user) {
        console.error("[Properties] handleCreateOrUpdate: Usuário não autenticado");
        throw new Error("Sessão inválida.");
      }
      
      const neighborhood = String(formData.get("neighborhood") || "");
      const city = String(formData.get("city") || "");
      const state = String(formData.get("state") || "");
      const location = String(formData.get("location") || "") || `${neighborhood}, ${city} - ${state}`;

      const isEditing = !!editingProperty;
      const currentPropertyId = editingProperty?.id;

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
        cep: String(formData.get("cep") || "").substring(0, 20),
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

      console.log("[Properties] Preparando payload final para o servidor...", { isEditing, propertyData: data });

      // Deep clone rigoroso
      const dataToSave = JSON.parse(JSON.stringify(data));

      console.log("[Properties] Chamando lib/db -> create/updateProperty...");
      const toastId = toast.loading(isEditing ? "Atualizando registro..." : "Salvando novo imóvel...");

      try {
        if (isEditing && currentPropertyId) {
          console.log(`[Properties] Executando UPDATE no ID: ${currentPropertyId}`);
          await updateProperty(currentPropertyId, dataToSave, user.id);
        } else {
          console.log("[Properties] Executando INSERT de novo imóvel");
          await createProperty(dataToSave, user.id);
        }
        
        console.log("[Properties] Resposta de SUCESSO recebida do banco de dados.");
        clearTimeout(uiTimeoutId);
        toast.success(isEditing ? "Imóvel atualizado com sucesso!" : "Imóvel cadastrado com sucesso!", { id: toastId });
        
        setEditingProperty(null);
        setImageUrls([]);
        setView('list');
        
        setTimeout(() => fetchData(), 800);

      } catch (err: any) {
        console.error("[Properties] 6. Erro DB:", err);
        clearTimeout(uiTimeoutId);
        const errorMessage = err.message || "Erro ao gravar dados.";
        toast.error(`Falha: ${errorMessage}`, { id: toastId });
      } finally {
        setIsSaving(false);
        isSubmittingRef.current = false;
      }
    } catch (saveErr: any) {
      console.error("[Properties] 7. Erro Fatal:", saveErr);
      clearTimeout(uiTimeoutId);
      setIsSaving(false);
      isSubmittingRef.current = false;
      toast.error(`Erro técnico: ${saveErr.message || "Falha técnica"}`);
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
        <header className="h-20 bg-card border-b border-border px-8 flex items-center justify-between shrink-0">
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
                <button 
                  onClick={fetchData}
                  disabled={loading}
                  className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground transition-all border border-border"
                  title="Sincronizar dados"
                >
                  <Loader2 className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
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
                  onClick={() => {
                    setEditingProperty(null);
                    setView('form');
                  }}
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
                      onEdit={() => {
                        setEditingProperty(property);
                        setView('form');
                      }}
                      onDelete={() => handleDelete(property.id)}
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
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleCreateOrUpdate} className="bg-card border border-border rounded-[40px] shadow-2xl overflow-hidden pb-12">
                <div className="p-10 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="md:col-span-2 space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Identificação do Imóvel</label>
                      <input 
                        name="title"
                        required
                        defaultValue={editingProperty?.title}
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
                        onBlur={handleCepBlur}
                        required
                        defaultValue={editingProperty?.cep}
                        placeholder="00000-000"
                        className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-mono font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
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
                    disabled={isSaving}
                    className="flex-1 bg-primary text-primary-foreground py-5 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingProperty ? 'Salvar Alterações' : 'Publicar no Inventário'}
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
          )}
        </div>
      </main>
    </div>
  );
}

function PropertyCard({ property, onEdit, onDelete }: { property: Property; onEdit: () => void; onDelete: () => void }) {
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
          <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
            <MapPin className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase tracking-widest truncate">{property.location}</span>
          </div>
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
              className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
