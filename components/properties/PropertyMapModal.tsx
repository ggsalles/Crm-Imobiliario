"use client";

import { motion } from "motion/react";
import { MapPin, X, ExternalLink } from "lucide-react";
import { Property } from "@/lib/db";

interface PropertyMapModalProps {
  property: Property | null;
  onClose: () => void;
}

export function PropertyMapModal({ property, onClose }: PropertyMapModalProps) {
  if (!property) return null;

  const fullAddress = property.street
    ? `${property.street}, ${property.number || "S/N"}${property.neighborhood ? ` - ${property.neighborhood}` : ""}, ${property.city || ""} - ${property.state || ""}`
    : property.location;

  const searchQuery = (property.street
    ? `${property.street}, ${property.number || ""} ${property.neighborhood || ""} ${property.city || ""} ${property.state || ""} ${property.cep || ""}`
    : property.location
  ).trim();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-xl overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div>
            <h3 className="text-sm md:text-base font-bold text-foreground uppercase tracking-tight line-clamp-1">
              {property.title}
            </h3>
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5 flex items-center gap-1 flex-wrap">
              <MapPin className="w-3 h-3 text-primary shrink-0" />
              {fullAddress}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors border border-border shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-[320px] w-full bg-muted/25 relative">
          <iframe
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(searchQuery)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
          />
        </div>

        <div className="p-4 bg-muted/10 border-t border-border flex justify-end gap-2">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all border border-border"
          >
            Abrir no Google Maps
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-95 transition-all shadow-sm cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
