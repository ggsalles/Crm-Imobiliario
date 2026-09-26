"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bed, 
  Square, 
  MapPin, 
  TrendingUp, 
  Sparkles, 
  Star, 
  Edit, 
  Trash2, 
  Share2, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { Property } from "@/lib/db";
import { cn, formatCurrencyBRL } from "@/lib/utils";

interface PropertyCardProps {
  property: Property;
  onEdit: () => void;
  onDelete: () => void;
  onShowMap: () => void;
  onShare: () => void;
  onToggleFeatured: () => void;
}

export function PropertyCard({ 
  property, 
  onEdit, 
  onDelete, 
  onShowMap, 
  onShare, 
  onToggleFeatured 
}: PropertyCardProps) {
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
                type="button"
                onClick={prevImage}
                className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70 transition-colors pointer-events-auto"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                type="button"
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
