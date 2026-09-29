"use client";

import { Property } from "@/lib/db";
import { Compass, Edit2, Sparkles, MapPin, Zap } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface InterestProfile {
  maxPrice: number | null;
  minBedrooms: number | null;
  propertyType: string;
  neighborhoods: string[];
}

interface MatchResult {
  property: Property;
  score: number;
  criteria: string[];
}

interface ContactInterestSectionProps {
  interestProfile: InterestProfile;
  matchingProperties: MatchResult[];
  onOpenModal: () => void;
  onCreateDealFromMatch: (property: Property) => void;
}

export function ContactInterestSection({
  interestProfile,
  matchingProperties,
  onOpenModal,
  onCreateDealFromMatch
}: ContactInterestSectionProps) {
  const hasProfile = interestProfile.maxPrice || interestProfile.minBedrooms || (interestProfile.propertyType && interestProfile.propertyType !== "todos") || interestProfile.neighborhoods.length > 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Perfil de Interesse Card */}
      <div className="bg-card rounded-[32px] border border-border p-8 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Compass className="w-5 h-5 animate-spin-slow-subtle" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Perfil de Interesse</h3>
                <p className="text-xs text-muted-foreground">Filtros de preferência do cliente</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onOpenModal}
              className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center transition-all border border-border cursor-pointer group"
              title="Editar Perfil de Interesse"
            >
              <Edit2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>

          {!hasProfile ? (
            <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border p-5">
              <Compass className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Sem critérios definidos</p>
              <p className="text-[11px] leading-relaxed max-w-xs mx-auto">Configure as preferências de busca para que o sistema cruze com as propriedades disponíveis.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 border border-border/80 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1">Orçamento Limite</span>
                  <span className="font-extrabold text-sm text-foreground">
                    {interestProfile.maxPrice ? `R$ ${interestProfile.maxPrice.toLocaleString('pt-BR')}` : "Qualquer valor"}
                  </span>
                </div>
                
                <div className="bg-muted/30 border border-border/80 rounded-2xl p-4 flex flex-col justify-center">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1">Qtd. Mín. Quartos</span>
                  <span className="font-extrabold text-sm text-foreground">
                    {interestProfile.minBedrooms ? `${interestProfile.minBedrooms}+ Quartos` : "Livre"}
                  </span>
                </div>

                <div className="bg-muted/30 border border-border/80 rounded-2xl p-4 flex flex-col justify-center col-span-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Tipo de Propriedade</span>
                    <span className="font-extrabold text-xs text-primary capitalize bg-primary/10 px-2.5 py-1 rounded-lg">
                      {interestProfile.propertyType && interestProfile.propertyType !== 'todos' ? interestProfile.propertyType : "Todos"}
                    </span>
                  </div>
                </div>
              </div>

              {interestProfile.neighborhoods.length > 0 && (
                <div className="space-y-1.5 bg-muted/20 border border-border/50 rounded-2xl p-4">
                  <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1">Bairros de Preferência</div>
                  <div className="flex flex-wrap gap-1.5">
                    {interestProfile.neighborhoods.map((n, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-background border border-border rounded-lg text-[9px] font-extrabold uppercase text-muted-foreground tracking-wide">
                        {n.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-border mt-6">
          <button
            type="button"
            onClick={onOpenModal}
            className="w-full py-3 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all gap-2 flex items-center justify-center border border-primary/20 cursor-pointer"
          >
            <Compass className="w-4 h-4 text-inherit" />
            Definir Parâmetros de Busca
          </button>
        </div>
      </div>

      {/* Cruzamento Inteligente Card */}
      <div className="bg-card rounded-[32px] border border-border p-8 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 animate-pulse">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Cruzamento Inteligente</h3>
                <p className="text-xs text-muted-foreground">Matchmaking automatizado de imóveis</p>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#00E5FF] px-2.5 py-1.5 bg-[#00E5FF]/10 rounded-xl border border-[#00E5FF]/20">
              {matchingProperties.length} Match(es)
            </span>
          </div>

          {matchingProperties.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground bg-muted/15 rounded-2xl border border-dashed border-border p-6 flex flex-col justify-center items-center">
              <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/75 mb-1">Nenhum imóvel compatível</p>
              <p className="text-[11px] leading-relaxed max-w-sm mx-auto text-center">Configure filtros no Perfil de Interesse buscando bairros/preço que dêem match com o seu catálogo.</p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[295px] overflow-y-auto pr-1">
              {matchingProperties.map(({ property, score }) => (
                <div key={property.id} className="p-4 bg-muted/30 hover:bg-muted/65 rounded-2xl border border-border flex gap-4 transition-all hover:scale-[1.01] duration-300 relative group">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-muted/10">
                    {property.imageUrls && property.imageUrls.length > 0 ? (
                      <Image
                        src={property.imageUrls[0]}
                        alt={property.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary text-xs font-bold">
                        IMÓVEL
                      </div>
                    )}
                    <div className="absolute top-1 left-1 bg-black/75 backdrop-blur-sm text-[8px] font-black px-1.5 py-0.5 rounded text-amber-400 uppercase tracking-widest">
                      {property.type}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 pr-12">
                    <h4 className="font-bold text-xs text-foreground truncate">{property.title}</h4>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate">{property.neighborhood ? `${property.neighborhood}, ${property.city}` : property.location}</span>
                    </p>
                    
                    <div className="flex items-center gap-2 mt-2 font-mono text-[10px] text-muted-foreground">
                      <span className="font-extrabold text-foreground">R$ {property.price.toLocaleString('pt-BR')}</span>
                      <span>•</span>
                      <span>{property.bedrooms || 0}Q</span>
                    </div>
                  </div>

                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
                    <div className={cn(
                      "w-12 h-12 rounded-full border shadow-sm flex flex-col items-center justify-center select-none shrink-0",
                      score >= 80 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" :
                      score >= 60 ? "bg-primary/10 border-primary/30 text-primary" :
                      "bg-amber-500/10 border-amber-500/30 text-amber-500"
                    )}>
                      <span className="text-xs font-black leading-none">{score}%</span>
                      <span className="text-[6px] font-black uppercase tracking-widest mt-0.5 opacity-80">Match</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onCreateDealFromMatch(property)}
                      className="w-10 h-10 rounded-xl bg-primary text-primary-foreground hover:opacity-95 transition-all flex items-center justify-center shadow shadow-primary/20 cursor-pointer"
                      title="Iniciar Negócio com este Imóvel"
                    >
                      <Zap className="w-4 h-4 fill-primary-foreground text-primary-foreground shrink-0" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
