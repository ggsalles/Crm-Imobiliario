'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bed, 
  Bath, 
  Square, 
  Car, 
  MapPin, 
  Check, 
  Send, 
  ChevronLeft, 
  ChevronRight, 
  Phone, 
  Mail, 
  User, 
  Coins, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Crown
} from 'lucide-react';
import { toast } from 'sonner';
import { safeJsonParse } from '@/lib/safe-storage';
import { apiClient } from '@/lib/api-client';

interface Property {
  id: string;
  title: string;
  type: string;
  status: string;
  price: number;
  location: string;
  cep?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  number?: string;
  complement?: string | null;
  area: number;
  bedrooms?: number;
  suites?: number;
  bathrooms?: number;
  parkingSpots?: number;
  acceptsFinancing?: boolean;
  isFeatured?: boolean;
  buildingName?: string | null;
  condoFee?: number | null;
  iptu?: number | null;
  notes?: string | null;
  description?: string | null;
  tags?: string[];
  imageUrls?: string[];
  ownerId: string;
  tenantId?: string;
  createdAt?: string;
}

interface Broker {
  id: string;
  displayName: string;
  email: string;
  photoUrl?: string;
}

export default function PublicPropertyCapturePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [property, setProperty] = useState<Property | null>(null);
  const [broker, setBroker] = useState<Broker | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  // Loaded default fallbacks
  const fallbackImages = [
    "https://picsum.photos/seed/imovel1/1200/800",
    "https://picsum.photos/seed/imovel2/1200/800",
    "https://picsum.photos/seed/imovel3/1200/800"
  ];

  useEffect(() => {
    if (!id) return;

    async function loadData() {
      try {
        setLoading(true);
        // 1. Fetch single property with no-store
        const propData = await apiClient.get<Property>(`/api/properties?id=${id}&_t=${Date.now()}`, { 
          cache: 'no-store',
          skipAuth: true 
        });
        
        if (!propData) {
          setProperty(null);
          setLoading(false);
          return;
        }

        setProperty(propData);

        // 2. Fetch broker profile
        if (propData.ownerId) {
          try {
            const brokerData = await apiClient.get<any>(`/api/profiles?id=${propData.ownerId}`, { skipAuth: true });
            if (brokerData) {
              setBroker({
                id: brokerData.id,
                displayName: brokerData.displayName || brokerData.display_name || "Consultor de Vendas",
                email: brokerData.email || "",
                photoUrl: brokerData.photoUrl || brokerData.photo_url || undefined
              });
            }
          } catch (brokerErr) {
            console.warn("Erro ao buscar dados do corretor:", brokerErr);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar página de captura pública:", err);
        toast.error("Não foi possível carregar os detalhes do imóvel.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    // Format (XX) XXXXX-XXXX
    if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    setPhone(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !property) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    try {
      setSubmitting(true);
      
      const payload = {
        propertyId: property.id,
        name,
        email,
        phone: phone.replace(/\D/g, ""), // clean non-digits for database
        message: message.trim() || undefined
      };

      await apiClient.post('/api/public-capture', payload, { skipAuth: true });

      setSuccess(true);
      toast.success("Interesse registrado com sucesso! Entraremos em contato.");
    } catch (err: any) {
      console.error("Erro ao registrar lead público:", err);
      toast.error(err.message || "Houve um erro ao enviar seus dados. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsAppRedirect = () => {
    if (!property) return;
    const cleanPhone = phone.replace(/\D/g, "");
    // Use an elegant text to message the agent/broker or start contact
    const textMessage = `Olá! Me chamo ${encodeURIComponent(name)} e acabei de acessar o imóvel "${encodeURIComponent(property.title)}" (Valor: R$ ${encodeURIComponent(property.price.toLocaleString('pt-BR'))}) através do Instagram. Tenho interesse em receber mais detalhes!`;
    const waUrl = `https://api.whatsapp.com/send?text=${textMessage}`;
    window.open(waUrl, '_blank');
  };

  const formatPrice = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 font-medium animate-pulse">Carregando detalhes do imóvel...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-red-500/15 border border-red-500/30 text-red-400 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">!</div>
          <h2 className="text-2xl font-black text-white">Imóvel Indisponível</h2>
          <p className="text-slate-400 text-sm">
            Este imóvel não foi encontrado ou não está mais ativo para visualização pública.
          </p>
          <button 
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 px-4 font-bold transition shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  const images = property.imageUrls && property.imageUrls.length > 0 ? property.imageUrls : fallbackImages;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 overflow-x-hidden selection:bg-blue-600/30 selection:text-blue-200">
      {/* Elegante Header Dark */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 py-4 px-6 sticky top-0 z-40 shadow-md shadow-black/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-blue-600/30">
              S
            </div>
            <div>
              <h1 className="font-bold text-white tracking-tight leading-none text-sm md:text-base">SalesScore CRM</h1>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">Imóvel de Interesse do Cliente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const targetUrl = property?.tenantId ? `/vitrine?tenant=${property.tenantId}` : '/vitrine';
                router.push(targetUrl);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Voltar para a vitrine com todos os imóveis disponíveis"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Ver Todos os Imóveis</span>
            </button>
            <span className="hidden sm:inline-block text-xs font-bold uppercase py-1 px-3 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full">
              Vitrine Conectada
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Property Details (8 cols) */}
        <section className="lg:col-span-7 space-y-8">
          
          {/* Cover & Gallery Slider */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden relative">
            <div className="relative h-[25rem] md:h-[32rem] w-full bg-slate-950 group">
              <Image 
                src={images[activeImage]} 
                alt={property.title} 
                fill 
                className="object-cover object-center transition-all duration-500 group-hover:scale-102"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

              {/* Badges Overlay */}
              <div className="absolute top-6 left-6 flex flex-wrap gap-2">
                {property.isFeatured && (
                  <span className="py-1 px-3.5 bg-amber-500 text-white rounded-full text-xs font-black tracking-wide uppercase shadow-lg shadow-amber-500/30 flex items-center gap-1.5 border border-white/20">
                    <Sparkles className="w-3.5 h-3.5 fill-white" /> Destaque
                  </span>
                )}
                <span className="capitalize py-1 px-3 bg-slate-900/90 backdrop-blur-sm text-slate-100 rounded-full text-xs font-extrabold shadow-sm border border-slate-700/60">
                  {property.type}
                </span>
                {(() => {
                  const s = (property.status || 'disponível').toLowerCase().trim();
                  if (s === 'reservado' || s === 'reserved') {
                    return (
                      <span className="py-1 px-3 bg-amber-500 text-white rounded-full text-xs font-black tracking-wide uppercase shadow-md shadow-amber-500/20">
                        Reservado
                      </span>
                    );
                  }
                  if (s === 'vendido' || s === 'sold') {
                    return (
                      <span className="py-1 px-3 bg-slate-800 text-white rounded-full text-xs font-black tracking-wide uppercase shadow-md border border-white/20">
                        Vendido
                      </span>
                    );
                  }
                  if (s === 'alugado' || s === 'rented') {
                    return (
                      <span className="py-1 px-3 bg-blue-600 text-white rounded-full text-xs font-black tracking-wide uppercase shadow-md">
                        Alugado
                      </span>
                    );
                  }
                  return (
                    <span className="py-1 px-3 bg-emerald-500 text-white rounded-full text-xs font-black tracking-wide uppercase shadow-md shadow-emerald-500/20">
                      Disponível
                    </span>
                  );
                })()}
                {property.acceptsFinancing && (
                  <span className="py-1 px-4 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-md shadow-blue-600/25 flex items-center gap-1.5 border border-white/10">
                    <Coins className="w-3 h-3" /> Aceita Financiamento
                  </span>
                )}
              </div>

              {/* Slider Controllers */}
              {images.length > 1 && (
                <>
                  <button 
                    onClick={() => setActiveImage(prev => prev === 0 ? images.length - 1 : prev - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-slate-900/80 backdrop-blur-sm rounded-full text-white border border-slate-700 shadow-lg hover:bg-slate-800 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setActiveImage(prev => prev === images.length - 1 ? 0 : prev + 1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-slate-900/80 backdrop-blur-sm rounded-full text-white border border-slate-700 shadow-lg hover:bg-slate-800 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Title & Price Bottom Overlay */}
              <div className="absolute bottom-6 left-6 right-6 text-white text-left">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-blue-400 leading-none mb-1">CÓD: {property.id.slice(0, 8).toUpperCase()}</span>
                  <h2 className="text-xl md:text-3xl font-black tracking-tight drop-shadow-sm leading-tight inline-flex items-center gap-1.5">{property.title}</h2>
                  {property.buildingName && (
                    <p className="text-xs md:text-sm font-semibold text-slate-300 mt-0.5 flex items-center gap-1.5">
                      <span>🏢</span>
                      <span>{property.buildingName}</span>
                    </p>
                  )}
                  <p className="text-lg md:text-2xl font-extrabold text-blue-400 tracking-tight leading-none mt-2">{formatPrice(property.price)}</p>
                </div>
              </div>
            </div>

            {/* Gallery Thumbnails List */}
            {images.length > 1 && (
              <div className="p-4 border-t border-slate-800/80 bg-slate-900/90 flex gap-2 overflow-x-auto scrollbar-hide">
                {images.map((img, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`relative w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all duration-300 cursor-pointer ${activeImage === idx ? 'border-blue-500 ring-2 ring-blue-500/30 scale-95' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <Image 
                      src={img} 
                      alt="" 
                      fill 
                      className="object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Key Characteristics Panel (Bento row) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 shadow-md hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Square className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider leading-none mb-1 truncate">Área total</p>
                <p className="font-bold text-white text-sm leading-none truncate">{property.area || 0} m²</p>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 shadow-md hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Bed className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider leading-none mb-1 truncate">Dormitórios</p>
                <p className="font-bold text-white text-sm leading-none truncate">
                  {property.bedrooms || 0} {property.bedrooms === 1 ? 'Quarto' : 'Quartos'}
                </p>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-3.5 flex items-center gap-3 shadow-md bg-gradient-to-br from-amber-500/10 to-transparent relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-amber-400/90 font-black uppercase tracking-wider leading-none mb-1 truncate">Suítes</p>
                <p className="font-bold text-white text-sm leading-none truncate">
                  {property.suites !== undefined && property.suites !== null && property.suites > 0
                    ? `${property.suites} ${property.suites === 1 ? 'Suíte' : 'Suítes'}`
                    : (property.suites === 0 ? '0 Suítes' : '—')}
                </p>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 shadow-md hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                <Bath className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider leading-none mb-1 truncate">Sanitários</p>
                <p className="font-bold text-white text-sm leading-none truncate">
                  {property.bathrooms || 0} {property.bathrooms === 1 ? 'Banheiro' : 'Banheiros'}
                </p>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 shadow-md col-span-2 sm:col-span-1 xl:col-span-1 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Car className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider leading-none mb-1 truncate">Vagas</p>
                <p className="font-bold text-white text-sm leading-none truncate">
                  {property.parkingSpots || 0} {property.parkingSpots === 1 ? 'Vaga' : 'Vagas'}
                </p>
              </div>
            </div>
          </div>

          {/* Encargos Periódicos (Condomínio e IPTU) */}
          {((property.condoFee && property.condoFee > 0) || (property.iptu && property.iptu > 0)) && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                  R$
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider leading-none">Encargos Periódicos</p>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">Despesas adicionais do imóvel</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                {property.condoFee && property.condoFee > 0 ? (
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Condomínio</p>
                    <p className="text-sm sm:text-base font-extrabold text-white">
                      {formatPrice(property.condoFee)}
                      <span className="text-[10px] font-normal text-slate-400">/mês</span>
                    </p>
                  </div>
                ) : null}
                {property.iptu && property.iptu > 0 ? (
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">IPTU</p>
                    <p className="text-sm sm:text-base font-extrabold text-white">
                      {formatPrice(property.iptu)}
                      <span className="text-[10px] font-normal text-slate-400">/ano</span>
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Diferenciais & Comodidades (Tags) */}
          {property.tags && property.tags.length > 0 && (
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 md:p-8 shadow-md space-y-4">
              <div>
                <h3 className="font-black text-white text-lg uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-400" /> Diferenciais & Comodidades
                </h3>
                <div className="h-0.5 w-12 bg-blue-500 rounded-full" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {property.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 font-bold text-xs border border-blue-500/25 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description Card */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 md:p-8 shadow-md space-y-6">
            <div>
              <h3 className="font-black text-white text-lg uppercase tracking-wider mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" /> Descrição do Imóvel
              </h3>
              <div className="h-0.5 w-12 bg-blue-500 rounded-full" />
            </div>

            {property.description ? (
              <p className="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                {property.description}
              </p>
            ) : (
              <p className="text-slate-500 italic text-sm">
                Nenhuma descrição detalhada foi informada para este imóvel. Para mais dados, envie sua solicitação no formulário lateral.
              </p>
            )}

            {/* Location block */}
            <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mt-0.5 flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider leading-none mb-1">Localização aproximada</p>
                  <p className="font-extrabold text-white text-base leading-tight">
                    {property.neighborhood ? `${property.neighborhood}, ` : ''}{property.city || 'Cidade não especificada'} - {property.state || ''}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">A localização exata é compartilhada apenas com clientes qualificados.</p>
                </div>
              </div>
              
              <div className="text-xs font-bold text-slate-300 bg-slate-800/80 border border-slate-700 py-2 px-4 rounded-xl flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Transação Segura e Exclusiva
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Capture Form Card (5 cols) */}
        <section className="lg:col-span-5 lg:sticky lg:top-24">
          
          <AnimatePresence mode="wait">
            {!success ? (
              <motion.div 
                key="form-container"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl shadow-slate-950/50 p-6 md:p-8 space-y-6 relative overflow-hidden text-white"
              >
                {/* Subtle decorative glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

                {/* Header state */}
                <div className="text-start relative z-10">
                  <span className="text-[10px] uppercase tracking-widest bg-blue-500/15 text-blue-400 border border-blue-500/30 py-1 px-3 rounded-full font-black mb-3 inline-block shadow-sm">
                    Fale Conosco
                  </span>
                  <h3 className="text-xl md:text-2xl font-black text-white leading-tight tracking-tight">Tenho Interesse!</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Preencha seus dados abaixo. Nossa equipe entrará em contato prontamente via WhatsApp para enviar a ficha técnica ou agendar uma visita.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                  {/* Name field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase text-slate-300 tracking-wider ml-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-400" /> Nome Completo *
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: João da Silva"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-white placeholder:text-slate-500 text-sm outline-none transition duration-200 font-medium"
                    />
                  </div>

                  {/* Email field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase text-slate-300 tracking-wider ml-1 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-400" /> E-mail *
                    </label>
                    <input 
                      type="email" 
                      required
                      placeholder="exemplo@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-white placeholder:text-slate-500 text-sm outline-none transition duration-200 font-medium"
                    />
                  </div>

                  {/* Phone field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase text-slate-300 tracking-wider ml-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-blue-400" /> WhatsApp / Telefone *
                    </label>
                    <input 
                      type="tel" 
                      required
                      placeholder="(11) 99999-9999"
                      value={phone}
                      onChange={handlePhoneChange}
                      className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-white placeholder:text-slate-500 text-sm outline-none transition duration-200 font-medium"
                    />
                  </div>

                  {/* Message field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase text-slate-300 tracking-wider ml-1 flex items-center gap-1.5">
                      <MessageSquareIcon className="w-3.5 h-3.5 text-blue-400" /> Mensagem Adicional (Opcional)
                    </label>
                    <textarea 
                      placeholder="Gostaria de agendar uma visita ou receber mais fotos..."
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-white placeholder:text-slate-500 text-sm outline-none transition duration-200 font-medium resize-none"
                    />
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-xl py-3.5 px-4 font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 transition-all duration-200 disabled:opacity-50 text-sm mt-3 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Salvando interesse...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Quero Mais Informações
                      </>
                    )}
                  </button>
                </form>

                {/* Broker profile integration if present */}
                {broker && (
                  <div className="border-t border-slate-800 pt-4 flex items-center gap-3.5 text-left relative z-10">
                    <div className="relative w-11 h-11 rounded-full bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700">
                      {broker.photoUrl ? (
                        <Image 
                          src={broker.photoUrl} 
                          alt={broker.displayName} 
                          fill 
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-blue-400 bg-blue-500/10">
                          {broker.displayName[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[8px] text-slate-400 uppercase tracking-widest font-black leading-none mb-0.5">Corretor Responsável</p>
                      <p className="font-bold text-white text-xs leading-tight mb-0.5">{broker.displayName}</p>
                      <p className="text-slate-400 text-[10px] leading-none flex items-center gap-1">
                        <Mail className="w-2.5 h-2.5 text-slate-500" /> {broker.email}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="success-container"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl shadow-slate-950/50 p-8 text-center space-y-6 relative overflow-hidden text-white"
              >
                {/* Visual success background sparkles */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                <div className="absolute -right-12 -top-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white leading-tight">Excelente, {name.split(" ")[0]}!</h3>
                  <p className="text-slate-300 text-sm leading-relaxed px-2">
                    Seus dados foram sincronizados instantaneamente ao nosso funil. Um especialista foi notificado sobre seu interesse no <strong>{property.title}</strong>.
                  </p>
                </div>

                <div className="bg-slate-800/80 rounded-2xl p-4 text-xs font-medium border border-slate-700/80 text-slate-300 text-left space-y-2.5">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> Lead salvo em: <strong className="text-white">Instagram - Captura Pública</strong></div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-400 rounded-full" /> Negócio criado no funil: <strong className="text-white">Estágio &quot;Novo Lead&quot;</strong></div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-400 rounded-full" /> Valor do negócio: <strong className="text-white">{formatPrice(property.price)}</strong></div>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleWhatsAppRedirect}
                    className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl py-3.5 px-4 font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/25 transition-all text-sm group cursor-pointer"
                  >
                    <Phone className="w-4 h-4 fill-white group-hover:scale-110 transition-transform" />
                    Falar Agora no WhatsApp
                  </button>

                  <button
                    onClick={() => {
                      setSuccess(false);
                      setName('');
                      setEmail('');
                      setPhone('');
                      setMessage('');
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl py-2.5 px-4 font-bold text-xs border border-slate-700 transition duration-300 cursor-pointer"
                  >
                    Enviar outra proposta
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </section>

      </main>
    </div>
  );
}

// Styled message icon fallback since we have MessageSquare in import
function MessageSquareIcon({ className }: { className?: string }) {
  return <Mail className={className} />;
}
