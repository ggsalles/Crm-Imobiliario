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
  ChevronRight,
  TrendingUp,
  X
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
  Property 
} from "@/lib/db";
import { cn } from "@/lib/utils";
import Image from "next/image";

export default function PropertiesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const fetchData = async () => {
    if (!user || !profile) return;
    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    const data = await getProperties(ownerId);
    setProperties(data);
  };

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

  const handleCreateOrUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Auto-generate location summary if not provided
    const neighborhood = formData.get("neighborhood") as string;
    const city = formData.get("city") as string;
    const state = formData.get("state") as string;
    const location = formData.get("location") as string || `${neighborhood}, ${city} - ${state}`;

    const data: Partial<Property> = {
      title: formData.get("title") as string,
      type: formData.get("type") as any,
      status: formData.get("status") as any,
      price: Number(formData.get("price")),
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
      imageUrl: (formData.get("imageUrl") as string) || `https://picsum.photos/seed/${Math.random()}/800/600`,
    };

    if (editingProperty) {
      await updateProperty(editingProperty.id, data as any);
    } else {
      await createProperty(data as any);
    }
    await fetchData();
    setIsModalOpen(false);
    setEditingProperty(null);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#fafbfc] font-sans overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-auto md:h-20 bg-white border-b border-slate-100 px-4 md:px-8 py-4 md:py-0 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">Inventário de Imóveis</h2>
            <p className="text-[10px] md:text-xs text-slate-400 font-medium">Gerencie seu portfólio imobiliário</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2.5 md:py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <button 
              onClick={() => {
                setEditingProperty(null);
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo Imóvel
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 space-y-6 overflow-y-auto flex-1">
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
                  "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider border transition-all",
                  filterType === type.id 
                    ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10" 
                    : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
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
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Home className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Nenhum imóvel encontrado</h3>
              <p className="text-slate-400 text-sm max-w-xs mt-2">
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
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-t-[32px] md:rounded-[32px] shadow-2xl overflow-y-auto max-h-[95vh] md:max-h-auto"
            >
              <div className="p-6 md:p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-slate-900">{editingProperty ? "Editar Imóvel" : "Novo Imóvel"}</h3>
                  <p className="text-xs md:text-sm text-slate-400 font-medium">Preencha os detalhes da unidade imobiliária</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Título do Imóvel</label>
                    <input 
                      name="title"
                      required
                      defaultValue={editingProperty?.title}
                      placeholder="Ex: Apartamento Vista Mar Premium"
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-2 text-start">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Tipo</label>
                    <select 
                      name="type"
                      defaultValue={editingProperty?.type || "apartamento"}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all appearance-none font-medium"
                    >
                      <option value="casa">Casa</option>
                      <option value="apartamento">Apartamento</option>
                      <option value="comercial">Comercial</option>
                      <option value="terreno">Terreno</option>
                    </select>
                  </div>

                  <div className="space-y-2 text-start">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Status</label>
                    <select 
                      name="status"
                      defaultValue={editingProperty?.status || "disponível"}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all appearance-none font-medium"
                    >
                      <option value="disponível">Disponível</option>
                      <option value="reservado">Reservado</option>
                      <option value="vendido">Vendido</option>
                      <option value="alugado">Alugado</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Preço (R$)</label>
                    <input 
                      name="price"
                      type="number"
                      required
                      defaultValue={editingProperty?.price}
                      placeholder="0.00"
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 flex justify-between">
                      CEP
                      {isFetchingCep && <span className="animate-pulse text-blue-500 lowercase">buscando...</span>}
                    </label>
                    <input 
                      name="cep"
                      onBlur={handleCepBlur}
                      required
                      defaultValue={editingProperty?.cep}
                      placeholder="00000-000"
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                    />
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Rua / Logradouro</label>
                      <input 
                        name="street"
                        required
                        value={addressData.street}
                        onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Número</label>
                      <input 
                        name="number"
                        required
                        defaultValue={editingProperty?.number}
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Bairro</label>
                      <input 
                        name="neighborhood"
                        required
                        value={addressData.neighborhood}
                        onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Cidade</label>
                      <input 
                        name="city"
                        required
                        value={addressData.city}
                        onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">UF</label>
                      <input 
                        name="state"
                        required
                        maxLength={2}
                        value={addressData.state}
                        onChange={(e) => setAddressData({ ...addressData, state: e.target.value })}
                        className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all uppercase text-center font-bold"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Complemento / Descrição Curta de Localização</label>
                    <input 
                      name="complement"
                      defaultValue={editingProperty?.complement}
                      placeholder="Ex: Próximo ao Shopping X"
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 md:col-span-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Área (m²)</label>
                      <input name="area" type="number" defaultValue={editingProperty?.area} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Quartos</label>
                      <input name="bedrooms" type="number" defaultValue={editingProperty?.bedrooms} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Banheiros</label>
                      <input name="bathrooms" type="number" defaultValue={editingProperty?.bathrooms} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Vagas</label>
                      <input name="parkingSpots" type="number" defaultValue={editingProperty?.parkingSpots} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium" />
                    </div>
                  </div>

                  <div className="md:col-span-2 flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <input 
                      type="checkbox" 
                      name="acceptsFinancing" 
                      id="acceptsFinancing"
                      defaultChecked={editingProperty?.acceptsFinancing}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="acceptsFinancing" className="text-sm font-bold text-slate-700 cursor-pointer">
                      Aceita Financiamento Bancário?
                    </label>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Observações Internas (Não visível ao cliente)</label>
                    <textarea 
                      name="notes"
                      defaultValue={editingProperty?.notes}
                      placeholder="Notas sobre proprietário, chaves, comissão ou pendências..."
                      rows={3}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all resize-none font-medium text-slate-600"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">URL da Imagem</label>
                    <input 
                      name="imageUrl"
                      defaultValue={editingProperty?.imageUrl}
                      placeholder="https://exemplo.com/foto.jpg"
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse md:flex-row gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    {editingProperty ? "Salvar Alterações" : "Criar Imóvel"}
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
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white rounded-[32px] border border-slate-100 overflow-hidden group hover:shadow-2xl hover:shadow-slate-200/50 transition-all flex flex-col"
    >
      <div className="h-48 relative overflow-hidden shrink-0">
        <Image 
          src={property.imageUrl || "https://picsum.photos/seed/realestate/800/600"} 
          alt={property.title} 
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-700"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4 flex gap-2">
          <span className={cn(
            "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest backdrop-blur-md border",
            property.status === 'disponível' ? "bg-emerald-500/80 text-white border-emerald-400" :
            property.status === 'reservado' ? "bg-amber-500/80 text-white border-amber-400" :
            "bg-slate-800/80 text-white border-slate-700"
          )}>
            {property.status}
          </span>
          <span className="px-3 py-1.5 bg-white/80 backdrop-blur-md text-slate-900 border border-white/40 rounded-xl text-[10px] font-bold uppercase tracking-widest">
            {property.type}
          </span>
          {property.acceptsFinancing && (
            <span className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              Financia
            </span>
          )}
        </div>
        <div className="absolute top-4 right-4 animate-in fade-in zoom-in duration-300 opacity-0 group-hover:opacity-100 transition-opacity">
           <div className="flex gap-1">
             <button onClick={onEdit} className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-600 shadow-lg ring-1 ring-black/5">
                <Edit className="w-4 h-4" />
             </button>
             <button onClick={onDelete} className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-600 hover:text-red-600 shadow-lg ring-1 ring-black/5">
                <Trash2 className="w-4 h-4" />
             </button>
           </div>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="mb-4">
          <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">{property.title}</h4>
          <div className="flex items-center gap-1.5 text-slate-400 mt-1">
            <MapPin className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest truncate">{property.location}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <Bed className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-600">{property.bedrooms} Quartos</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <Square className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-600">{property.area}m²</span>
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Valor Venda</p>
            <p className="text-lg font-black text-slate-900 tracking-tight">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(property.price)}
            </p>
          </div>
          <button className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
