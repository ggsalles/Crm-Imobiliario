'use client';

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
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

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
  bathrooms?: number;
  parkingSpots?: number;
  acceptsFinancing?: boolean;
  notes?: string | null;
  description?: string | null;
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
        // 1. Fetch single property
        const res = await fetch(`/api/properties?id=${id}`);
        if (!res.ok) {
          throw new Error("Imóvel não encontrado");
        }
        const propData: Property = await res.json();
        
        if (!propData) {
          setProperty(null);
          setLoading(false);
          return;
        }

        setProperty(propData);

        // 2. Fetch broker profile
        if (propData.ownerId) {
          try {
            const brokerRes = await fetch(`/api/profiles?id=${propData.ownerId}`);
            if (brokerRes.ok) {
              const brokerData = await brokerRes.json();
              if (brokerData) {
                setBroker({
                  id: brokerData.id,
                  displayName: brokerData.displayName || brokerData.display_name || "Consultor de Vendas",
                  email: brokerData.email || "",
                  photoUrl: brokerData.photoUrl || brokerData.photo_url || undefined
                });
              }
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

      const response = await fetch('/api/public-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro ao registrar interesse");
      }

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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium animate-pulse">Carregando detalhes do imóvel...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md bg-white p-8 rounded-3xl border border-slate-200/50 shadow-xl space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">!</div>
          <h2 className="text-2xl font-black text-slate-800">Imóvel Indisponível</h2>
          <p className="text-muted-foreground text-sm">
            Este imóvel não foi encontrado ou não está mais ativo para visualização pública.
          </p>
          <button 
            onClick={() => router.push('/')}
            className="w-full bg-slate-800 text-white rounded-xl py-3 px-4 font-bold hover:bg-slate-700 transition"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  const images = property.imageUrls && property.imageUrls.length > 0 ? property.imageUrls : fallbackImages;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 selection:bg-primary/10 selection:text-primary">
      {/* Elegante Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 py-4 px-6 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-extrabold shadow-md shadow-primary/20">
              S
            </div>
            <div>
              <h1 className="font-bold text-slate-800 tracking-tight leading-none text-sm md:text-base">SalesScore CRM</h1>
              <p className="text-[10px] text-muted-foreground leading-none">Imóvel de Interesse do Cliente</p>
            </div>
          </div>
          <span className="text-xs font-bold uppercase py-1 px-3 bg-primary/10 text-primary border border-primary/20 rounded-full">
            Instagram Link Integrado
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Property Details (8 cols) */}
        <section className="lg:col-span-7 space-y-8">
          
          {/* Cover & Gallery Slider */}
          <div className="bg-white rounded-3xl border border-slate-200/50 shadow-sm overflow-hidden relative">
            <div className="relative h-[25rem] md:h-[32rem] w-full bg-slate-900 group">
              <Image 
                src={images[activeImage]} 
                alt={property.title} 
                fill 
                className="object-cover object-center transition-all duration-500 group-hover:scale-102"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />

              {/* Badges Overlay */}
              <div className="absolute top-6 left-6 flex flex-wrap gap-2">
                <span className="capitalize py-1 px-3 bg-white/90 backdrop-blur-sm text-slate-900 rounded-full text-xs font-extrabold shadow-sm">
                  {property.type}
                </span>
                <span className="py-1 px-3 bg-emerald-500 text-white rounded-full text-xs font-black tracking-wide uppercase shadow-md shadow-emerald-500/20">
                  {property.status === 'disponível' ? 'Disponível' : property.status}
                </span>
                {property.acceptsFinancing && (
                  <span className="py-1 px-4 bg-primary text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-md shadow-primary/25 flex items-center gap-1.5 border border-white/10">
                    <Coins className="w-3 h-3" /> Aceita Financiamento
                  </span>
                )}
              </div>

              {/* Slider Controllers */}
              {images.length > 1 && (
                <>
                  <button 
                    onClick={() => setActiveImage(prev => prev === 0 ? images.length - 1 : prev - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/95 rounded-full text-slate-800 shadow-lg hover:bg-white transition-all hover:scale-110 active:scale-95"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setActiveImage(prev => prev === images.length - 1 ? 0 : prev + 1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/95 rounded-full text-slate-800 shadow-lg hover:bg-white transition-all hover:scale-110 active:scale-95"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Title & Price Bottom Overlay */}
              <div className="absolute bottom-6 left-6 right-6 text-white text-left">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#60a5fa] leading-none mb-1">CÓD: {property.id.slice(0, 8).toUpperCase()}</span>
                  <h2 className="text-xl md:text-3xl font-black tracking-tight drop-shadow-sm leading-tight inline-flex items-center gap-1.5">{property.title}</h2>
                  <p className="text-lg md:text-2xl font-extrabold text-blue-300 tracking-tight leading-none mt-2">{formatPrice(property.price)}</p>
                </div>
              </div>
            </div>

            {/* Gallery Thumbnails List */}
            {images.length > 1 && (
              <div className="p-4 border-t border-slate-100 flex gap-2 overflow-x-auto scrollbar-hide">
                {images.map((img, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`relative w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all duration-300 ${activeImage === idx ? 'border-primary ring-2 ring-primary/20 scale-95' : 'border-transparent opacity-70 hover:opacity-100'}`}
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/50 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Square className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider leading-none mb-0.5">Área total</p>
                <p className="font-bold text-slate-800 text-sm leading-none">{property.area} m²</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200/50 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Bed className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider leading-none mb-0.5">Dormitórios</p>
                <p className="font-bold text-slate-800 text-sm leading-none">{property.bedrooms || 0} Quartos</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200/50 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Bath className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider leading-none mb-0.5">Sanitários</p>
                <p className="font-bold text-slate-800 text-sm leading-none">{property.bathrooms || 0} Banheiros</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200/50 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider leading-none mb-0.5">Vagas</p>
                <p className="font-bold text-slate-800 text-sm leading-none">{property.parkingSpots || 0} vagas</p>
              </div>
            </div>
          </div>

          {/* Description Card */}
          <div className="bg-white rounded-3xl border border-slate-200/50 p-6 md:p-8 shadow-sm space-y-6">
            <div>
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-wider mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Descrição do Imóvel
              </h3>
              <div className="h-0.5 w-12 bg-primary rounded-full" />
            </div>

            {property.description ? (
              <p className="text-slate-600 text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                {property.description}
              </p>
            ) : (
              <p className="text-muted-foreground italic text-sm">
                Nenhuma descrição detalhada foi informada para este imóvel. Para mais dados, envie sua solicitação no formulário lateral.
              </p>
            )}

            {/* Location block */}
            <div className="border-t border-slate-100 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 mt-0.5 flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider leading-none mb-1">Localização aproximada</p>
                  <p className="font-extrabold text-slate-800 text-base leading-tight">
                    {property.neighborhood ? `${property.neighborhood}, ` : ''}{property.city || 'Cidade não especificada'} - {property.state || ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">A localização exata é compartilhada apenas com clientes qualificados.</p>
                </div>
              </div>
              
              <div className="text-xs font-bold text-muted-foreground bg-slate-100 py-2 px-4 rounded-xl flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Transação Segura e Exclusiva
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
                className="bg-card rounded-3xl border border-border shadow-xl p-6 md:p-8 space-y-6 bg-gradient-to-b from-white to-slate-50"
              >
                {/* Header state */}
                <div className="text-start">
                  <span className="text-[9px] uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 py-1 px-3 rounded-full font-black mb-3 inline-block">Fale Conosco</span>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">Tenho Interesse!</h3>
                  <p className="text-xs text-muted-foreground mt-1.5">Preencha seus dados abaixo. Nossa equipe entrará em contato prontamente via WhatsApp para enviar a ficha técnica ou agendar uma visita.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider ml-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" /> Nome Completo *
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: João da Silva"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/5 bg-white text-sm outline-none transition font-medium"
                    />
                  </div>

                  {/* Email field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider ml-1 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" /> E-mail *
                    </label>
                    <input 
                      type="email" 
                      required
                      placeholder="exemplo@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/5 bg-white text-sm outline-none transition font-medium"
                    />
                  </div>

                  {/* Phone field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider ml-1 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" /> WhatsApp / Telefone *
                    </label>
                    <input 
                      type="tel" 
                      required
                      placeholder="(11) 99999-9999"
                      value={phone}
                      onChange={handlePhoneChange}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/5 bg-white text-sm outline-none transition font-medium"
                    />
                  </div>

                  {/* Message field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider ml-1 flex items-center gap-1">
                      <MessageSquareIcon className="w-3 h-3 text-slate-400" /> Mensagem Adicional (Opcional)
                    </label>
                    <textarea 
                      placeholder="Gostaria de agendar uma visita ou receber mais fotos..."
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/5 bg-white text-sm outline-none transition font-medium resize-none"
                    />
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-primary hover:bg-opacity-95 text-white rounded-xl py-3 px-4 font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition duration-300 disabled:opacity-50 text-sm mt-2"
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
                  <div className="border-t border-slate-200/60 pt-4 flex items-center gap-3.5 text-left">
                    <div className="relative w-11 h-11 rounded-full bg-primary/10 overflow-hidden flex-shrink-0 border border-slate-200">
                      {broker.photoUrl ? (
                        <Image 
                          src={broker.photoUrl} 
                          alt={broker.displayName} 
                          fill 
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-primary bg-primary/5">
                          {broker.displayName[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-black leading-none mb-0.5">Corretor Responsável</p>
                      <p className="font-bold text-slate-800 text-xs leading-tight mb-0.5">{broker.displayName}</p>
                      <p className="text-muted-foreground text-[10px] leading-none flex items-center gap-1">
                        <Mail className="w-2.5 h-2.5 text-slate-400" /> {broker.email}
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
                className="bg-white rounded-3xl border border-emerald-100 shadow-xl p-8 text-center space-y-6 relative overflow-hidden"
              >
                {/* Visual success background sparkles */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-500" />
                <div className="absolute -right-12 -top-12 w-32 h-32 bg-emerald-50/40 rounded-full blur-2xl" />

                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 leading-tight">Excelente, {name.split(" ")[0]}!</h3>
                  <p className="text-slate-600 text-sm leading-relaxed px-2">
                    Seus dados foram sincronizados instantaneamente ao nosso funil. Um especialista foi notificado de forma inteligente sobre seu interesse no <strong>{property.title}</strong>.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 text-xs font-medium border border-slate-100 text-slate-500 text-left space-y-2">
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Lead salvo em: <strong>Instagram - Captura Pública</strong></div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Negócio criado no funil: <strong>Estágio &quot;Novo Lead&quot;</strong></div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Valor do negócio: <strong>{formatPrice(property.price)}</strong></div>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleWhatsAppRedirect}
                    className="w-full bg-[#25D366] hover:bg-opacity-95 text-white rounded-xl py-3 px-4 font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 transition-all text-sm group"
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
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2.5 px-4 font-bold text-xs transition duration-300"
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
