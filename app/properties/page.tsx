"use client";

import { useState, useEffect } from "react";
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

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [displayPrice, setDisplayPrice] = useState("");

  const fetchData = async () => {
    if (!user || !profile) return;
    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    const data = await getProperties(ownerId);
    setProperties(data);
  };
  
  useEffect(() => {
    if (isModalOpen) {
      setDisplayPrice(formatCurrencyBRL(editingProperty?.price || 0));
      setImageUrls(editingProperty?.imageUrls || []);
    }
  }, [isModalOpen, editingProperty]);

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
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;
    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    const unsub = subscribeToProperties((data) => {
      setProperties(data);
      setLoading(false);
    }, ownerId);
    return () => unsub();
  }, [user, profile]);

  const filteredProperties = properties.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || p.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente excluir este imóvel?")) {
      await deleteProperty(id);
      await fetchData();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadFile(file);
      setImageUrls(prev => [...prev, result.url]);
      toast.success("Imagem enviada com sucesso!");
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao enviar imagem. Verifique se os 'buckets' do Supabase estão configurados.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);
    setIsSaving(true);
    
    try {
      // Auto-generate location summary if not provided
      const neighborhood = formData.get("neighborhood") as string;
      const city = formData.get("city") as string;
      const state = formData.get("state") as string;
      const location = formData.get("location") as string || `${neighborhood}, ${city} - ${state}`;

      const filteredUrls = imageUrls.filter(url => url.trim() !== "");
      
      // Check for extremely long URLs (like base64) that might break DB columns
      const tooLongUrl = filteredUrls.find(url => url.length > 2000);
      if (tooLongUrl) {
        toast.error("Uma das imagens é muito grande (provavelmente link base64). Use o botão 'Carregar Foto' para enviar o arquivo.");
        setIsSaving(false);
        return;
      }

      const data: Partial<Property> = {
        title: formData.get("title") as string,
        type: formData.get("type") as any,
        status: formData.get("status") as any,
        price: parseCurrencyBRLToNumber(formData.get("price") as string),
        location,
        cep: formData.get("cep") as string,
        street: formData.get("street") as string,
        neighborhood,
        city,
        state,
        number: formData.get("number") as string,
        complement: formData.get("complement") as string,
        area: Number(formData.get("area")),
        bedrooms: Number(formData.get("bedrooms")),
        bathrooms: Number(formData.get("bathrooms")),
        parkingSpots: Number(formData.get("parkingSpots")),
        acceptsFinancing: formData.get("acceptsFinancing") === "on",
        notes: formData.get("notes") as string,
        description: formData.get("description") as string,
        imageUrls: filteredUrls,
      };

      if (!data.imageUrls || data.imageUrls.length === 0) {
        data.imageUrls = [`https://picsum.photos/seed/${Math.random()}/800/600`];
      }

      if (editingProperty) {
        await updateProperty(editingProperty.id, data as any);
        toast.success("Imóvel atualizado com sucesso!");
      } else {
        await createProperty(data as any);
        toast.success("Imóvel cadastrado com sucesso!");
      }
      
      await fetchData();
      setIsModalOpen(false);
      setEditingProperty(null);
    } catch (err: any) {
      console.error("Erro ao salvar imóvel:", err);
      toast.error(`Erro ao salvar imóvel: ${err.message || 'Verifique sua conexão'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || (loading && !user)) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden transition-colors duration-500">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-auto md:h-20 bg-card border-b border-border px-4 md:px-8 py-4 md:py-0 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 transition-colors">
          <div>
            <h2 className="text-lg md:text-xl font-black text-foreground tracking-tight uppercase tracking-widest">Inventário de Imóveis</h2>
            <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-[0.2em] mt-1">Gerencie seu portfólio imobiliário</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Buscar imóveis..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2.5 md:py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-bold text-foreground"
              />
            </div>
            <button 
              onClick={() => {
                setEditingProperty(null);
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/30 hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo Imóvel
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 space-y-6 overflow-y-auto flex-1 bg-muted/5">
          {/* Filters - Horizontal scroll on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            {[
              { id: "all", label: "Todos", icon: Home },
              { id: "casa", label: "Casas", icon: Home },
              { id: "apartamento", label: "Apartamentos", icon: Building },
              { id: "comercial", label: "Comercial", icon: Briefcase },
              { id: "terreno", label: "Terrenos", icon: TreePine },
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setFilterType(type.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all",
                  filterType === type.id 
                    ? "bg-foreground text-background border-foreground shadow-lg shadow-foreground/10" 
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                <type.icon className="w-3.5 h-3.5" />
                {type.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {filteredProperties.map((property) => (
                <PropertyCard 
                  key={property.id} 
                  property={property} 
                  onEdit={() => {
                    setEditingProperty(property);
                    setIsModalOpen(true);
                  }}
                  onDelete={() => handleDelete(property.id)}
                />
              ))}
            </AnimatePresence>
          </div>

          {filteredProperties.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <Home className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Nenhum imóvel encontrado</h3>
              <p className="text-muted-foreground text-sm font-medium max-w-xs mt-2">
                Comece adicionando seu primeiro imóvel ao inventário para gerenciar negociações.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-card border border-border rounded-t-[32px] md:rounded-[32px] shadow-2xl overflow-y-auto max-h-[95vh]"
            >
              <div className="p-6 md:p-8 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-foreground tracking-tight uppercase">{editingProperty ? "Editar Imóvel" : "Novo Imóvel"}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground font-medium mt-1">Preencha os detalhes da unidade imobiliária</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 font-medium text-start">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Título do Imóvel</label>
                    <input 
                      name="title"
                      required
                      defaultValue={editingProperty?.title}
                      placeholder="Ex: Apartamento Vista Mar Premium"
                      className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-bold text-foreground"
                    />
                  </div>

                  <div className="space-y-2 text-start">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Tipo</label>
                    <select 
                      name="type"
                      defaultValue={editingProperty?.type || "apartamento"}
                      className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all appearance-none font-bold text-foreground bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em]"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                    >
                      <option value="casa" className="bg-card">Casa</option>
                      <option value="apartamento" className="bg-card">Apartamento</option>
                      <option value="comercial" className="bg-card">Comercial</option>
                      <option value="terreno" className="bg-card">Terreno</option>
                    </select>
                  </div>

                  <div className="space-y-2 text-start">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Status</label>
                    <select 
                      name="status"
                      defaultValue={editingProperty?.status || "disponível"}
                      className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all appearance-none font-bold text-foreground bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em]"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                    >
                      <option value="disponível" className="bg-card">Disponível</option>
                      <option value="reservado" className="bg-card">Reservado</option>
                      <option value="vendido" className="bg-card">Vendido</option>
                      <option value="alugado" className="bg-card">Alugado</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Preço (R$)</label>
                    <input 
                      name="price"
                      type="text"
                      required
                      value={displayPrice}
                      onChange={(e) => setDisplayPrice(formatCurrencyBRL(e.target.value))}
                      placeholder="R$ 0,00"
                      className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-bold text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex justify-between items-center">
                      CEP
                      {isFetchingCep && <span className="animate-pulse text-primary lowercase font-medium">buscando...</span>}
                    </label>
                    <input 
                      name="cep"
                      onBlur={handleCepBlur}
                      required
                      defaultValue={editingProperty?.cep}
                      placeholder="00000-000"
                      className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-mono font-bold text-foreground"
                    />
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Rua / Logradouro</label>
                      <input 
                        name="street"
                        required
                        value={addressData.street}
                        onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                        className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-bold text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Número</label>
                      <input 
                        name="number"
                        required
                        defaultValue={editingProperty?.number}
                        className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-bold text-foreground"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Bairro</label>
                      <input 
                        name="neighborhood"
                        required
                        value={addressData.neighborhood}
                        onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                        className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-bold text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Cidade</label>
                      <input 
                        name="city"
                        required
                        value={addressData.city}
                        onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                        className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">UF</label>
                      <input 
                        name="state"
                        required
                        maxLength={2}
                        value={addressData.state}
                        onChange={(e) => setAddressData({ ...addressData, state: e.target.value })}
                        className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all uppercase text-center font-black"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Complemento / Descrição Curta de Localização</label>
                    <input 
                      name="complement"
                      defaultValue={editingProperty?.complement}
                      placeholder="Ex: Próximo ao Shopping X"
                      className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 md:col-span-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Área (m²)</label>
                      <input name="area" type="number" defaultValue={editingProperty?.area} className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm font-bold text-foreground" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Quartos</label>
                      <input name="bedrooms" type="number" defaultValue={editingProperty?.bedrooms} className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm font-bold text-foreground" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Banheiros</label>
                      <input name="bathrooms" type="number" defaultValue={editingProperty?.bathrooms} className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm font-bold text-foreground" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Vagas</label>
                      <input name="parkingSpots" type="number" defaultValue={editingProperty?.parkingSpots} className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm font-bold text-foreground" />
                    </div>
                  </div>

                  <div className="md:col-span-2 flex items-center gap-3 p-4 bg-muted/40 rounded-2xl border border-border/50">
                    <input 
                      type="checkbox" 
                      name="acceptsFinancing" 
                      id="acceptsFinancing"
                      defaultChecked={editingProperty?.acceptsFinancing}
                      className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="acceptsFinancing" className="text-sm font-black text-foreground cursor-pointer uppercase tracking-tight">
                      Aceita Financiamento Bancário?
                    </label>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Observações Internas (Não visível ao cliente)</label>
                    <textarea 
                      name="notes"
                      defaultValue={editingProperty?.notes}
                      placeholder="Notas sobre proprietário, chaves, comissão ou pendências..."
                      rows={3}
                      className="w-full px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all resize-none font-bold text-foreground"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Imagens do Imóvel</label>
                      <div className="flex gap-4">
                        <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline cursor-pointer">
                          {isUploading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Upload className="w-3 h-3" />
                          )}
                          Carregar Foto
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageUpload}
                            disabled={isUploading}
                          />
                        </label>
                        <button 
                          type="button" 
                          onClick={() => setImageUrls([...imageUrls, ""])}
                          className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline"
                        >
                          <Plus className="w-3 h-3" />
                          Link de Foto
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {imageUrls.map((url, index) => (
                        <div key={index} className="flex gap-2">
                          <input 
                            value={url}
                            onChange={(e) => {
                              const newUrls = [...imageUrls];
                              newUrls[index] = e.target.value;
                              setImageUrls(newUrls);
                            }}
                            placeholder="https://exemplo.com/foto.jpg"
                            className="flex-1 px-5 py-3.5 bg-muted/30 border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-bold text-foreground"
                          />
                          <button 
                            type="button"
                            onClick={() => setImageUrls(imageUrls.filter((_, i) => i !== index))}
                            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      {imageUrls.length === 0 && (
                        <div 
                          onClick={() => setImageUrls([""])}
                          className="w-full py-10 border-2 border-dashed border-border rounded-[32px] flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-all group"
                        >
                          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Plus className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nenhuma imagem adicionada</p>
                          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-widest mt-1">Clique para inserir links de fotos</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse md:flex-row gap-4 pt-4">
                  {editingProperty && (
                    <button 
                      type="button" 
                      onClick={() => { handleDelete(editingProperty.id); setIsModalOpen(false); }} 
                      className="px-6 py-4 font-black text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors border border-red-500/20 flex items-center justify-center"
                      title="Excluir imóvel"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-muted text-muted-foreground rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/30 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                    {editingProperty ? (isSaving ? "Salvando..." : "Salvar Alterações") : (isSaving ? "Criando..." : "Criar Imóvel")}
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

function PropertyCard({ property, onEdit, onDelete }: { property: Property; onEdit: () => void; onDelete: () => void }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = property.imageUrls && property.imageUrls.length > 0 
    ? property.imageUrls 
    : ["https://picsum.photos/seed/realestate/800/600"];

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
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }} 
                className="w-10 h-10 rounded-xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }} 
                className="w-10 h-10 rounded-xl bg-muted text-muted-foreground hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <button className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all shadow-sm">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
