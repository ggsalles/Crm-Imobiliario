"use client";

import React from 'react';
import Image from 'next/image';
import { 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Car, 
  ArrowRight, 
  MessageCircle, 
  Sparkles, 
  TrendingUp,
  Briefcase 
} from 'lucide-react';

export interface VitrineProperty {
  id: string;
  title: string;
  type: string;
  status: string;
  price: number;
  location: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  street?: string;
  number?: string;
  cep?: string;
  area: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpots?: number;
  acceptsFinancing?: boolean;
  isFeatured?: boolean;
  condoFee?: number | null;
  iptu?: number | null;
  buildingName?: string | null;
  description?: string | null;
  tags?: string[];
  imageUrls?: string[];
  ownerId?: string;
  tenantId?: string;
  createdAt?: string;
}

export interface ShowcasePropertyCardProps {
  property: VitrineProperty;
  onOpen: (propertyId: string) => void;
  onWhatsapp?: (e: React.MouseEvent, property: VitrineProperty) => void;
  onCreateDeal?: (e: React.MouseEvent, property: VitrineProperty) => void;
}

export function ShowcasePropertyCard({
  property,
  onOpen,
  onWhatsapp,
  onCreateDeal
}: ShowcasePropertyCardProps) {
  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const coverPhoto = property.imageUrls && property.imageUrls.length > 0
    ? property.imageUrls[0]
    : 'https://picsum.photos/seed/vitrineimovel/800/600';

  const totalPhotos = property.imageUrls?.length || 0;

  return (
    <div
      onClick={() => onOpen(property.id)}
      className="group bg-card rounded-2xl border border-border/80 overflow-hidden shadow-xs hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col cursor-pointer"
    >
      {/* Photo Container */}
      <div className="relative aspect-16/10 overflow-hidden bg-muted">
        <Image
          src={coverPhoto}
          alt={property.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
              {property.type || 'Imóvel'}
            </span>
            {property.isFeatured && (
              <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow-md shadow-amber-500/30 flex items-center gap-1 border border-amber-300/40">
                <Sparkles className="w-2.5 h-2.5 fill-white" /> Destaque
              </span>
            )}
            {property.acceptsFinancing && (
              <span className="px-2 py-0.5 rounded-lg bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-xs flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5" /> Financia
              </span>
            )}
          </div>

          {(() => {
            const s = (property.status || 'disponível').toLowerCase().trim();
            if (s === 'reserved' || s === 'reservado') {
              return (
                <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-bold uppercase shadow-xs">
                  Reservado
                </span>
              );
            }
            if (s === 'vendido' || s === 'sold') {
              return (
                <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-white text-[10px] font-bold uppercase shadow-xs border border-white/20">
                  Vendido
                </span>
              );
            }
            if (s === 'alugado' || s === 'rented') {
              return (
                <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold uppercase shadow-xs">
                  Alugado
                </span>
              );
            }
            return (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold uppercase shadow-xs">
                Disponível
              </span>
            );
          })()}
        </div>

        {/* Bottom Photo Info */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="text-white">
            <span className="text-[10px] uppercase font-semibold opacity-90 block">Valor de Venda</span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight drop-shadow-sm">
                {formatPrice(property.price)}
              </span>
              {property.area > 0 && property.price > 0 && (
                <span className="text-[10px] font-bold opacity-80 font-mono">
                  ({formatPrice(Math.round(property.price / property.area))}/m²)
                </span>
              )}
            </div>
          </div>

          {totalPhotos > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-white/90 text-[10px] font-bold">
              📸 {totalPhotos} {totalPhotos === 1 ? 'foto' : 'fotos'}
            </span>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          {property.buildingName && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block line-clamp-1">
              🏢 {property.buildingName}
            </span>
          )}
          
          <h3 className="font-bold text-sm sm:text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {property.title}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground line-clamp-1">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/70" />
            <span>
              {property.neighborhood ? `${property.neighborhood}, ` : ''}
              {property.city || property.location || 'Localização sob consulta'}
            </span>
          </div>

          {/* Encargos Periódicos (Condomínio e IPTU) */}
          {((property.condoFee && property.condoFee > 0) || (property.iptu && property.iptu > 0)) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground font-medium pt-1">
              {property.condoFee && property.condoFee > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <span>Cond.:</span>
                  <strong className="text-foreground">{formatPrice(property.condoFee)}</strong>
                </span>
              ) : null}
              {property.condoFee && property.condoFee > 0 && property.iptu && property.iptu > 0 ? (
                <span className="text-border">•</span>
              ) : null}
              {property.iptu && property.iptu > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <span>IPTU:</span>
                  <strong className="text-foreground">{formatPrice(property.iptu)}</strong>
                </span>
              ) : null}
            </div>
          )}

          {/* Diferenciais / Tags Badges */}
          {property.tags && property.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {property.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/15 truncate max-w-[120px]"
                >
                  {tag}
                </span>
              ))}
              {property.tags.length > 3 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">
                  +{property.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Features Badges */}
        <div className="pt-2 border-t border-border/60 grid grid-cols-4 gap-1 text-center">
          <div className="bg-muted/40 rounded-lg p-1.5">
            <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] font-medium">
              <Bed className="w-3 h-3 text-primary/70" />
              <span>Qts</span>
            </div>
            <span className="text-xs font-bold text-foreground">
              {property.bedrooms || '-'}
            </span>
          </div>

          <div className="bg-muted/40 rounded-lg p-1.5">
            <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] font-medium">
              <Bath className="w-3 h-3 text-primary/70" />
              <span>Ban</span>
            </div>
            <span className="text-xs font-bold text-foreground">
              {property.bathrooms || '-'}
            </span>
          </div>

          <div className="bg-muted/40 rounded-lg p-1.5">
            <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] font-medium">
              <Car className="w-3 h-3 text-primary/70" />
              <span>Vagas</span>
            </div>
            <span className="text-xs font-bold text-foreground">
              {property.parkingSpots || '-'}
            </span>
          </div>

          <div className="bg-muted/40 rounded-lg p-1.5">
            <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] font-medium">
              <Square className="w-3 h-3 text-primary/70" />
              <span>Área</span>
            </div>
            <span className="text-xs font-bold text-foreground">
              {property.area ? `${property.area}m²` : '-'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(property.id);
            }}
            className="flex-1 py-2 px-3 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-95 transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span>Ver Detalhes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {onCreateDeal && (
            <button
              type="button"
              onClick={(e) => onCreateDeal(e, property)}
              className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20 transition-all cursor-pointer"
              title="Iniciar Negociação no Funil vinculando este imóvel"
            >
              <Briefcase className="w-4 h-4" />
            </button>
          )}

          {onWhatsapp && (
            <button
              type="button"
              onClick={(e) => onWhatsapp(e, property)}
              className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all cursor-pointer"
              title="Tirar dúvidas no WhatsApp"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShowcasePropertyCard;
