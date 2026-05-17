"use client";

import { useState, useEffect, useMemo } from "react";
import { Building2, Home, MapPin, DollarSign, Sparkles, MoveRight, Loader2, CheckCircle2 } from "lucide-react";
import { Property, Deal, Contact, getProperties, updateDeal } from "@/lib/db";
import { safeAiCall } from "@/lib/ai";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { toast } from "sonner";
interface PropertyMatcherProps {
  deal: Deal;
  contact?: Contact | null;
  onUpdate?: () => void;
}

export function PropertyMatcher({ deal, contact, onUpdate }: PropertyMatcherProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingResults, setMatchingResults] = useState<Record<string, string>>({});
  const [matchLoadingId, setMatchLoadingId] = useState<string | null>(null);
  const [associatingId, setAssociatingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProps() {
      try {
        const data = await getProperties();
        setProperties(data.filter((p: Property) => p.status === 'disponível'));
      } catch (error) {
        console.error("Error fetching properties:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProps();
  }, []);

  const normalize = (str: string) => 
    str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const topMatches = useMemo(() => {
    const dealTitle = normalize(deal.title);
    
    return properties
      .map(p => {
        let score = 0;
        
        // Price proximity (within 30%)
        const priceDiff = Math.abs(p.price - deal.value) / deal.value;
        if (priceDiff < 0.1) score += 50;
        else if (priceDiff < 0.2) score += 30;
        else if (priceDiff < 0.3) score += 10;

        // Type match
        const pType = normalize(p.type);
        if (dealTitle.includes(pType)) score += 20;

        // Location match (Check city and neighborhood)
        const pLoc = normalize(p.location);
        const pCity = normalize(p.city || "");
        const pNeighborhood = normalize(p.neighborhood || "");

        if (dealTitle.includes(pCity) && pCity.length > 2) score += 30;
        if (dealTitle.includes(pNeighborhood) && pNeighborhood.length > 2) score += 40;
        if (dealTitle.includes(pLoc) && pLoc.length > 2) score += 20;

        // Cap score at 100
        return { property: p, score: Math.min(score, 99) };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [properties, deal]);

  const handleAssociate = async (propertyId: string) => {
    setAssociatingId(propertyId);
    try {
      await updateDeal(deal.id, { propertyId });
      toast.success("Imóvel associado ao negócio com sucesso!");
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error associating property:", error);
      toast.error("Erro ao associar imóvel.");
    } finally {
      setAssociatingId(null);
    }
  };

  const generateExplainMatch = async (property: Property) => {
    setMatchLoadingId(property.id);
    try {
      const prompt = `Explique em UMA frase curta e vendedora por que este imóvel (${property.title}, R$ ${property.price}, ${property.location}) é perfeito para este interesse de compra (${deal.title}, Orçamento: R$ ${deal.value}). Seja persuasivo.`;
      
      const result = await safeAiCall(prompt, "Excelente custo-benefício e localização privilegiada para este perfil.");

      if (result.isError) {
        if (result.errorType === 'quota') {
          toast.error("Limite de uso da IA atingido.");
        } else if (result.errorType === 'missing_key') {
          toast.error("IA não configurada.");
        }
      }

      setMatchingResults(prev => ({ ...prev, [property.id]: result.text }));
    } catch (error: any) {
      console.error("Gemini Match Error:", error);
      setMatchingResults(prev => ({ ...prev, [property.id]: "Excelente oportunidade de investimento." }));
    } finally {
      setMatchLoadingId(null);
    }
  };

  if (loading) return (
    <div className="flex justify-center p-8">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="bg-card rounded-[32px] border border-border p-8 shadow-md transition-colors">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Match de Imóveis</h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">IA Recomendação</p>
        </div>
        <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
      </div>

      <div className="space-y-4">
        {topMatches.length > 0 ? topMatches.map(({ property, score }) => (
          <div 
            key={property.id}
            className="group relative bg-muted/30 p-4 rounded-2xl border border-border/50 hover:bg-muted/50 transition-all cursor-pointer overflow-hidden"
          >
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden relative shrink-0">
                <Image 
                  src={property.imageUrls?.[0] || "https://picsum.photos/seed/prop/400/400"} 
                  alt={property.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-foreground truncate pr-2">{property.title}</h4>
                  <span className="text-[10px] font-black text-primary px-1.5 py-0.5 bg-primary/10 rounded-md shrink-0">
                    {score}% Match
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold mb-2 uppercase">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{property.location}</span>
                </div>
                <div className="text-sm font-black text-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price)}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border/50">
              <AnimatePresence mode="wait">
                {matchingResults[property.id] ? (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-emerald-600 font-medium italic leading-snug"
                  >
                    &quot;{matchingResults[property.id]}&quot;
                  </motion.p>
                ) : (
                  <button 
                    onClick={() => generateExplainMatch(property)}
                    disabled={matchLoadingId === property.id}
                    className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                  >
                    {matchLoadingId === property.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    Por que este imóvel?
                  </button>
                )}
              </AnimatePresence>
            </div>
            
            <button 
              onClick={() => handleAssociate(property.id)}
              disabled={associatingId === property.id || deal.propertyId === property.id}
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all p-2 rounded-full translate-x-4 group-hover:translate-x-0 shadow-lg",
                deal.propertyId === property.id 
                  ? "bg-emerald-500 text-white cursor-default opacity-100 translate-x-0 shadow-emerald-500/20" 
                  : "bg-primary text-white shadow-primary/20"
              )}
              title={deal.propertyId === property.id ? "Imóvel já associado" : "Associar ao negócio"}
            >
              {associatingId === property.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : deal.propertyId === property.id ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <MoveRight className="w-4 h-4" />
              )}
            </button>
          </div>
        )) : (
          <div className="text-center py-8">
            <Home className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-10" />
            <p className="text-xs font-bold text-muted-foreground uppercase opacity-50">Nenhum match encontrado</p>
          </div>
        )}
      </div>

      <button className="w-full mt-6 py-3 border border-border text-[10px] font-black text-muted-foreground uppercase tracking-widest rounded-xl hover:bg-muted transition-all">
        Buscar Manualmente
      </button>
    </div>
  );
}
