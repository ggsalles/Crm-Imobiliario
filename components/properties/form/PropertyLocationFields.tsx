"use client";

import { Loader2 } from "lucide-react";
import { Property } from "@/lib/db";
import { formatCEP } from "@/lib/utils";

export interface AddressData {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface PropertyLocationFieldsProps {
  editingProperty: Property | null;
  cep: string;
  onCepChange: (value: string) => void;
  onCepBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  isFetchingCep: boolean;
  addressData: AddressData;
  onAddressDataChange: (updater: (prev: AddressData) => AddressData) => void;
}

export function PropertyLocationFields({
  editingProperty,
  cep,
  onCepChange,
  onCepBlur,
  isFetchingCep,
  addressData,
  onAddressDataChange,
}: PropertyLocationFieldsProps) {
  return (
    <>
      {/* Campo de CEP */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex justify-between">
          <span>CEP</span>
          {isFetchingCep && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
        </label>
        <input
          name="cep"
          value={cep}
          onChange={(e) => onCepChange(formatCEP(e.target.value))}
          onBlur={onCepBlur}
          placeholder="00000-000"
          autoComplete="new-password"
          className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-mono font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground"
        />
      </div>

      {/* Logradouro e Número */}
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
            Logradouro
          </label>
          <input
            name="street"
            value={addressData.street}
            onChange={(e) =>
              onAddressDataChange((prev) => ({ ...prev, street: e.target.value }))
            }
            className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground"
          />
        </div>
        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center justify-between">
            <span>Número</span>
            <span className="text-[9px] font-semibold text-muted-foreground lowercase">opcional</span>
          </label>
          <input
            name="number"
            defaultValue={editingProperty?.number}
            className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground"
          />
        </div>
      </div>

      {/* Bairro, Cidade, Estado */}
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
            Bairro
          </label>
          <input
            name="neighborhood"
            value={addressData.neighborhood}
            onChange={(e) =>
              onAddressDataChange((prev) => ({ ...prev, neighborhood: e.target.value }))
            }
            className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground"
          />
        </div>
        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
            Cidade
          </label>
          <input
            name="city"
            value={addressData.city}
            onChange={(e) =>
              onAddressDataChange((prev) => ({ ...prev, city: e.target.value }))
            }
            className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground"
          />
        </div>
        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
            Estado (UF)
          </label>
          <input
            name="state"
            maxLength={2}
            value={addressData.state}
            onChange={(e) =>
              onAddressDataChange((prev) => ({ ...prev, state: e.target.value }))
            }
            className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-black text-center uppercase focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground"
          />
        </div>
      </div>

      {/* Mapa do Google Embed */}
      {cep && cep.replace(/\D/g, "").length === 8 && (
        <div className="md:col-span-2 space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
            Localização no Mapa
          </label>
          <div className="w-full h-64 rounded-[32px] overflow-hidden border border-border bg-muted/10 shadow-inner relative">
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(
                `${addressData.street || ""} ${addressData.neighborhood || ""} ${addressData.city || ""} ${addressData.state || ""} ${cep}`.trim()
              )}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
            />
          </div>
        </div>
      )}
    </>
  );
}
