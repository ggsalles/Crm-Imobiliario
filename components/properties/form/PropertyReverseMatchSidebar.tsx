"use client";

import { Sparkles, Zap } from "lucide-react";
import { Property, Contact } from "@/lib/db";
import { cn } from "@/lib/utils";

export interface PropertyReverseMatchSidebarProps {
  property: Property;
  contacts: Contact[];
  onCreateDeal: (contact: Contact, property: Property) => void;
}

export function PropertyReverseMatchSidebar({
  property,
  contacts,
  onCreateDeal,
}: PropertyReverseMatchSidebarProps) {
  const getMatchingContactsForProperty = (p: Property) => {
    return contacts
      .map((c) => {
        let finalScore = 0;
        let possibleScore = 0;

        let profileOfInt: any = null;
        try {
          if (c.department) {
            profileOfInt = JSON.parse(c.department);
          }
        } catch {}

        if (!profileOfInt) return { contact: c, score: 0 };

        const maxPrice = typeof profileOfInt.maxPrice === "number" ? profileOfInt.maxPrice : null;
        const minBedrooms = typeof profileOfInt.minBedrooms === "number" ? profileOfInt.minBedrooms : null;
        const propertyType = typeof profileOfInt.propertyType === "string" ? profileOfInt.propertyType : "todos";
        const neighborhoods = Array.isArray(profileOfInt.neighborhoods) ? profileOfInt.neighborhoods : [];

        if (maxPrice) {
          possibleScore += 25;
          if (p.price <= maxPrice) finalScore += 25;
          else if (p.price <= maxPrice * 1.15) finalScore += 10;
        }

        if (propertyType && propertyType !== "todos") {
          possibleScore += 25;
          if (p.type === propertyType) finalScore += 25;
        }

        if (minBedrooms) {
          possibleScore += 25;
          if (p.bedrooms && p.bedrooms >= minBedrooms) finalScore += 25;
        }

        if (neighborhoods && neighborhoods.length > 0) {
          possibleScore += 25;
          const propNeighborhoodClean = (p.neighborhood || "").trim().toLowerCase();
          const matches = neighborhoods.some(
            (n: string) =>
              propNeighborhoodClean.includes(n.trim().toLowerCase()) ||
              n.trim().toLowerCase().includes(propNeighborhoodClean)
          );
          if (matches) finalScore += 25;
        }

        const normScore = possibleScore > 0 ? Math.round((finalScore / possibleScore) * 100) : 0;
        return { contact: c, score: normScore };
      })
      .filter((mc) => mc.score >= 40)
      .sort((a, b) => b.score - a.score);
  };

  const matches = getMatchingContactsForProperty(property);

  return (
    <div className="xl:col-span-4 space-y-8">
      <div className="bg-card border border-border rounded-[40px] p-8 shadow-2xl h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 justify-between mb-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00E5FF]/10 flex items-center justify-center text-[#00E5FF] animate-pulse">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Cruzamento Reverso</h3>
                <p className="text-xs text-muted-foreground font-medium">Clientes compatíveis</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#00E5FF] px-2.5 py-1.5 bg-[#00E5FF]/10 rounded-xl border border-[#00E5FF]/20">
              {matches.length} Match(es)
            </span>
          </div>

          {matches.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground bg-muted/15 rounded-3xl border border-dashed border-border p-6 flex flex-col justify-center items-center">
              <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/75 mb-1">
                Nenhum cliente compatível
              </p>
              <p className="text-[11px] leading-relaxed max-w-sm mx-auto text-center">
                Nenhum cliente cadastrado no CRM possui critérios que correspondam às especificações deste imóvel.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 font-sans">
              {matches.map(({ contact, score }) => (
                <div
                  key={contact.id}
                  className="p-4 bg-muted/30 hover:bg-muted/70 border border-border rounded-2xl flex items-center justify-between transition-all hover:scale-[1.01] duration-300"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <h4 className="font-bold text-xs text-foreground truncate">{contact.name}</h4>
                    <p className="text-[9px] font-black text-primary uppercase mt-0.5 tracking-wider">
                      Origem: {contact.source || "Direto"}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1 px-2 py-0.5 bg-background border border-border/60 rounded-lg max-w-max font-mono truncate">
                      <span>{contact.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full border shadow-sm flex flex-col items-center justify-center text-[10px] font-black shrink-0",
                        score >= 80
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                          : score >= 60
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-500"
                      )}
                    >
                      <span>{score}%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onCreateDeal(contact, property)}
                      className="w-8 h-8 rounded-lg bg-primary text-primary-foreground hover:opacity-95 transition-all flex items-center justify-center shadow shadow-primary/20 cursor-pointer"
                      title="Vincular cliente a este imóvel via Negócio"
                    >
                      <Zap className="w-3.5 h-3.5 fill-primary-foreground text-primary-foreground" />
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
