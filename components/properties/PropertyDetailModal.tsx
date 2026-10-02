"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { 
  X, 
  MapPin, 
  Bed, 
  Bath, 
  Car, 
  Square, 
  Star, 
  Sparkles, 
  TrendingUp, 
  Building2, 
  Share2, 
  Edit, 
  Trash2, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink,
  Crown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Property } from "@/lib/db";
import { cn, formatCurrencyBRL } from "@/lib/utils";

interface PropertyDetailModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowMap: () => void;
  onShare: () => void;
  onCreateDeal?: () => void;
  onToggleFeatured?: () => void;
}

const FALLBACK_IMAGE = "https://picsum.photos/seed/realestate/1200/800";

export function PropertyDetailModal({
  property,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onShowMap,
  onShare,
  onCreateDeal,
  onToggleFeatured,
}: PropertyDetailModalProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imgError, setImgError] = useState(false);

  // Safely extract and normalize images array from any input format
  const images = useMemo(() => {
    if (!property) return [FALLBACK_IMAGE];
    let rawList: any[] = [];
    if (Array.isArray(property.imageUrls)) {
      rawList = property.imageUrls;
    } else if (typeof property.imageUrls === 'string') {
      try {
        const parsed = JSON.parse(property.imageUrls);
        rawList = Array.isArray(parsed) ? parsed : [property.imageUrls];
      } catch {
        rawList = [property.imageUrls];
      }
    } else if (property.image_url) {
      try {
        const parsed = typeof property.image_url === 'string' && property.image_url.startsWith('[')
          ? JSON.parse(property.image_url)
          : [property.image_url];
        rawList = Array.isArray(parsed) ? parsed : [property.image_url];
      } catch {
        rawList = [property.image_url];
      }
    }

    const cleaned = rawList
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('[') && !u.endsWith(']'))
      .map(u => u.trim());

    return cleaned.length > 0 ? cleaned : [FALLBACK_IMAGE];
  }, [property]);

  // Safely extract tags array
  const safeTags = useMemo(() => {
    if (!property) return [];
    if (Array.isArray(property.tags)) return property.tags;
    if (typeof property.tags === 'string') {
      try {
        const parsed = JSON.parse(property.tags);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return property.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    return [];
  }, [property]);

  if (!isOpen || !property) return null;

  const nextImage = () => {
    setImgError(false);
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setImgError(false);
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const formattedAddress = [
    property.street ? `${property.street}${property.number ? `, ${property.number}` : ''}` : '',
    property.complement,
    property.neighborhood,
    property.city ? `${property.city}${property.state ? ` - ${property.state}` : ''}` : '',
    property.cep ? `CEP: ${property.cep}` : ''
  ].filter(Boolean).join(" • ");

  const numPrice = Number(property.price) || 0;
  const numArea = Number(property.area) || 0;
  const pricePerM2 = (numPrice > 0 && numArea > 0) ? Math.round(numPrice / numArea) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-card w-full max-w-4xl max-h-[92vh] rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Top Floating Close Bar */}
        <div className="px-5 py-3.5 border-b border-border bg-muted/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Ficha Técnica do Imóvel
            </span>
            <span className="text-border">•</span>
            <span className="text-xs font-bold text-foreground truncate max-w-xs sm:max-w-md">
              {property.title}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onToggleFeatured && (
              <button
                type="button"
                onClick={onToggleFeatured}
                className={cn(
                  "p-1.5 rounded-lg border transition-all cursor-pointer",
                  property.isFeatured 
                    ? "bg-amber-500 text-white border-amber-600 shadow-xs" 
                    : "bg-card text-muted-foreground hover:text-amber-500 border-border"
                )}
                title={property.isFeatured ? "Remover dos Destaques" : "Marcar como Destaque"}
              >
                <Star className={cn("w-4 h-4", property.isFeatured && "fill-current")} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* 1. Photo Gallery Hero */}
          <div className="space-y-2.5">
            <div className="relative h-64 sm:h-80 md:h-96 rounded-2xl overflow-hidden bg-black/40 border border-border group">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeImageIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0"
                >
                  <Image
                    src={imgError ? FALLBACK_IMAGE : (images[activeImageIndex] || FALLBACK_IMAGE)}
                    alt={property.title || "Imóvel"}
                    fill
                    className="object-cover"
                    referrerPolicy="no-referrer"
                    unoptimized
                    onError={() => setImgError(true)}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Status and Type Pills Overlay */}
              <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                <span className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md border",
                  property.status === 'disponível' ? "bg-emerald-500/90 text-white border-emerald-400" :
                  property.status === 'reservado' ? "bg-amber-500/90 text-white border-amber-400" :
                  "bg-slate-800/90 text-white border-slate-700"
                )}>
                  {property.status}
                </span>

                <span className="px-2.5 py-1 bg-background/90 backdrop-blur-md text-foreground border border-border/40 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm">
                  {property.type}
                </span>

                {property.isFeatured && (
                  <span className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md shadow-amber-500/30">
                    <Sparkles className="w-3 h-3 fill-white" /> Destaque
                  </span>
                )}

                {property.acceptsFinancing && (
                  <span className="px-2.5 py-1 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <TrendingUp className="w-3 h-3" /> Aceita Financiamento
                  </span>
                )}
              </div>

              {/* Carousel Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-all shadow-lg cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-all shadow-lg cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {/* Photo Counter */}
                  <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-bold">
                    {activeImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setImgError(false);
                      setActiveImageIndex(idx);
                    }}
                    className={cn(
                      "w-16 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden relative shrink-0 border-2 transition-all cursor-pointer",
                      idx === activeImageIndex 
                        ? "border-primary ring-2 ring-primary/20 scale-105" 
                        : "border-border opacity-60 hover:opacity-100"
                    )}
                  >
                    <Image
                      src={img}
                      alt={`Foto ${idx + 1}`}
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                      unoptimized
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Title, Building & Financial Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-muted/30 border border-border/80 rounded-2xl">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                {property.title}
              </h2>
              {property.buildingName && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary mt-1">
                  <Building2 className="w-4 h-4" />
                  <span>Edifício / Condomínio: {property.buildingName}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-muted-foreground text-xs mt-1">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{property.location || "Endereço sob consulta"}</span>
              </div>
            </div>

            <div className="md:text-right shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">
                Valor de Venda
              </span>
              <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight text-primary">
                {formatCurrencyBRL(numPrice)}
              </div>
              {pricePerM2 !== null && (
                <span className="text-xs font-semibold text-muted-foreground">
                  Média: {formatCurrencyBRL(pricePerM2)}/m²
                </span>
              )}
            </div>
          </div>

          {/* 3. Specs Grid (Quartos, Suítes, Banheiros, Vagas, Área, IPTU, Condomínio) */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Especificações do Imóvel
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {/* Área */}
              <div className="p-3.5 bg-card border border-border rounded-xl shadow-xs text-center">
                <Square className="w-5 h-5 mx-auto text-primary mb-1" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Área Útil</span>
                <span className="text-sm font-black text-foreground">{numArea || 0} m²</span>
              </div>

              {/* Dormitórios */}
              <div className="p-3.5 bg-card border border-border rounded-xl shadow-xs text-center">
                <Bed className="w-5 h-5 mx-auto text-primary mb-1" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Dormitórios</span>
                <span className="text-sm font-black text-foreground">{property.bedrooms || 0}</span>
              </div>

              {/* Suítes (DESTAQUE) */}
              <div className="p-3.5 bg-primary/5 border border-primary/30 rounded-xl shadow-xs text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-primary/10 rounded-bl-xl flex items-center justify-center">
                  <Crown className="w-3 h-3 text-primary" />
                </div>
                <Crown className="w-5 h-5 mx-auto text-primary mb-1" />
                <span className="text-[10px] font-black text-primary uppercase block">Suítes</span>
                <span className="text-sm font-black text-foreground">{property.suites ?? 0}</span>
              </div>

              {/* Banheiros */}
              <div className="p-3.5 bg-card border border-border rounded-xl shadow-xs text-center">
                <Bath className="w-5 h-5 mx-auto text-primary mb-1" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Banheiros</span>
                <span className="text-sm font-black text-foreground">{property.bathrooms || 0}</span>
              </div>

              {/* Vagas */}
              <div className="p-3.5 bg-card border border-border rounded-xl shadow-xs text-center">
                <Car className="w-5 h-5 mx-auto text-primary mb-1" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Vagas</span>
                <span className="text-sm font-black text-foreground">{property.parkingSpots || 0}</span>
              </div>

              {/* Encargos / Condomínio */}
              <div className="p-3.5 bg-card border border-border rounded-xl shadow-xs text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block mt-1">Condomínio</span>
                <span className="text-xs font-black text-foreground block truncate">
                  {property.condoFee ? formatCurrencyBRL(property.condoFee) : "Isento"}
                </span>
                <span className="text-[9px] text-muted-foreground block truncate">
                  IPTU: {property.iptu ? formatCurrencyBRL(property.iptu) : "Isento"}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Amenities / Tags */}
          {safeTags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Diferenciais & Comodidades
              </h3>
              <div className="flex flex-wrap gap-2">
                {safeTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold"
                  >
                    ✨ {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 5. Full Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Descrição Detalhada do Imóvel
            </h3>
            <div className="p-4 bg-muted/20 border border-border rounded-2xl text-xs sm:text-sm text-foreground/90 whitespace-pre-line leading-relaxed font-normal">
              {property.description || "Nenhuma descrição detalhada cadastrada para este imóvel."}
            </div>
          </div>

          {/* 6. Address & Location Details */}
          <div className="p-4 bg-muted/30 border border-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                Localização & Endereço
              </span>
              <p className="text-xs font-semibold text-foreground">
                {formattedAddress || property.location || "Endereço sob consulta com o corretor."}
              </p>
            </div>

            <button
              type="button"
              onClick={onShowMap}
              className="px-3 py-1.5 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer self-start sm:self-center"
            >
              <MapPin className="w-3.5 h-3.5 text-primary" />
              Ver no Mapa
            </button>
          </div>

        </div>

        {/* Modal Action Bar (Footer) */}
        <div className="px-5 py-4 border-t border-border bg-muted/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDelete}
              className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-red-500/20"
              title="Excluir imóvel"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onEdit}
              className="px-3 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5 text-muted-foreground" />
              Editar Imóvel
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onShare}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              WhatsApp / PDF
            </button>

            {onCreateDeal && (
              <button
                type="button"
                onClick={onCreateDeal}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-md hover:shadow-primary/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5" />
                Iniciar Negociação
              </button>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
