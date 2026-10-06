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
  Briefcase,
  Crown
} from 'lucide-react';

export interface VitrineProperty {
  id: string;
  referenceCode?: string;
  reference_code?: string;
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
  suites?: number;
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
      className="group bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-black/60 hover:border-blue-500/50 transition-all duration-300 flex flex-col cursor-pointer"
    >
      {/* Photo Container */}
      <div className="relative aspect-16/10 overflow-hidden bg-slate-950">
        <Image
          src={coverPhoto}
          alt={property.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
          unoptimized
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-90" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(property.referenceCode || property.reference_code) && (
              <span className="px-2.5 py-1 rounded-xl bg-black/95 backdrop-blur-md text-amber-300 text-xs sm:text-sm font-mono font-black uppercase tracking-wider shadow-lg border-2 border-amber-400 ring-1 ring-black/50">
                #{property.referenceCode || property.reference_code}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-lg bg-slate-950/70 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow-xs border border-white/10">
              {property.type || 'Imóvel'}
            </span>
            {property.isFeatured && (
              <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow-md shadow-amber-500/30 flex items-center gap-1 border border-amber-300/40">
                <Sparkles className="w-2.5 h-2.5 fill-white" /> Destaque
              </span>
            )}
            {property.acceptsFinancing && (
              <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs flex items-center gap-1">
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
            <span className="text-[10px] uppercase font-semibold text-slate-300 block">Valor de Venda</span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight drop-shadow-sm text-blue-400">
                {formatPrice(property.price)}
              </span>
              {property.area > 0 && property.price > 0 && (
                <span className="text-[10px] font-bold text-slate-300 font-mono">
                  ({formatPrice(Math.round(property.price / property.area))}/m²)
                </span>
              )}
            </div>
          </div>

          {totalPhotos > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-slate-950/70 backdrop-blur-sm text-white/90 text-[10px] font-bold border border-white/10">
              📸 {totalPhotos} {totalPhotos === 1 ? 'foto' : 'fotos'}
            </span>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          {(property.referenceCode || property.reference_code) && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-black text-amber-400 bg-amber-400/15 border border-amber-400/30 px-2.5 py-0.5 rounded-md tracking-wider">
                REF: #{property.referenceCode || property.reference_code}
              </span>
              {property.buildingName && (
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 truncate">
                  🏢 {property.buildingName}
                </span>
              )}
            </div>
          )}
          {!property.referenceCode && !property.reference_code && property.buildingName && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block line-clamp-1">
              🏢 {property.buildingName}
            </span>
          )}
          
          <h3 className="font-bold text-sm sm:text-base text-white line-clamp-1 group-hover:text-blue-400 transition-colors">
            {property.title}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 line-clamp-1">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-blue-400" />
            <span>
              {property.neighborhood ? `${property.neighborhood}, ` : ''}
              {property.city || property.location || 'Localização sob consulta'}
            </span>
          </div>

          {/* Encargos Periódicos (Condomínio e IPTU) */}
          {((property.condoFee && property.condoFee > 0) || (property.iptu && property.iptu > 0)) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400 font-medium pt-1">
              {property.condoFee && property.condoFee > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <span>Cond.:</span>
                  <strong className="text-slate-200">{formatPrice(property.condoFee)}</strong>
                </span>
              ) : null}
              {property.condoFee && property.condoFee > 0 && property.iptu && property.iptu > 0 ? (
                <span className="text-slate-700">•</span>
              ) : null}
              {property.iptu && property.iptu > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <span>IPTU:</span>
                  <strong className="text-slate-200">{formatPrice(property.iptu)}</strong>
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
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 truncate max-w-[120px]"
                >
                  {tag}
                </span>
              ))}
              {property.tags.length > 3 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  +{property.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Features Badges */}
        <div className="pt-2 border-t border-slate-800 grid grid-cols-5 gap-1 text-center">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-1.5">
            <div className="flex items-center justify-center gap-0.5 text-slate-400 text-[10px] font-medium">
              <Bed className="w-3 h-3 text-blue-400" />
              <span>Qts</span>
            </div>
            <span className="text-xs font-bold text-white">
              {property.bedrooms || '-'}
            </span>
          </div>

          <div className="bg-slate-800/80 border border-amber-500/30 rounded-lg p-1.5 bg-gradient-to-b from-amber-500/5 to-transparent">
            <div className="flex items-center justify-center gap-0.5 text-amber-400/90 text-[10px] font-medium">
              <Crown className="w-3 h-3 text-amber-400" />
              <span>Sts</span>
            </div>
            <span className="text-xs font-bold text-white">
              {property.suites !== undefined && property.suites !== null && property.suites > 0 ? property.suites : '-'}
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-1.5">
            <div className="flex items-center justify-center gap-0.5 text-slate-400 text-[10px] font-medium">
              <Bath className="w-3 h-3 text-cyan-400" />
              <span>Ban</span>
            </div>
            <span className="text-xs font-bold text-white">
              {property.bathrooms || '-'}
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-1.5">
            <div className="flex items-center justify-center gap-0.5 text-slate-400 text-[10px] font-medium">
              <Car className="w-3 h-3 text-emerald-400" />
              <span>Vagas</span>
            </div>
            <span className="text-xs font-bold text-white">
              {property.parkingSpots || '-'}
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-1.5">
            <div className="flex items-center justify-center gap-0.5 text-slate-400 text-[10px] font-medium">
              <Square className="w-3 h-3 text-blue-400" />
              <span>Área</span>
            </div>
            <span className="text-xs font-bold text-white">
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
            className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <span>Ver Detalhes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {onCreateDeal && (
            <button
              type="button"
              onClick={(e) => onCreateDeal(e, property)}
              className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/20 transition-all cursor-pointer"
              title="Iniciar Negociação no Funil vinculando este imóvel"
            >
              <Briefcase className="w-4 h-4" />
            </button>
          )}

          {onWhatsapp && (
            <button
              type="button"
              onClick={(e) => onWhatsapp(e, property)}
              className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all cursor-pointer"
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
