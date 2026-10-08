"use client";

import Image from "next/image";
import { Upload, Loader2, X, ShieldCheck, Sparkles, Sliders, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface PropertyMediaUploaderProps {
  imageUrls: string[];
  onRemoveImage: (index: number) => void;
  onSetCoverImage?: (index: number) => void;
  onMoveImage?: (fromIndex: number, toIndex: number) => void;
  isUploading: boolean;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  applyWatermark?: boolean;
  setApplyWatermark?: (val: boolean) => void;
  watermarkCompany?: string;
  setWatermarkCompany?: (val: string) => void;
  watermarkPosition?: 'center' | 'bottom-right' | 'bottom-left' | 'top-right';
  setWatermarkPosition?: (val: 'center' | 'bottom-right' | 'bottom-left' | 'top-right') => void;
}

export function PropertyMediaUploader({
  imageUrls,
  onRemoveImage,
  onSetCoverImage,
  onMoveImage,
  isUploading,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onImageUpload,
  applyWatermark = true,
  setApplyWatermark,
  watermarkCompany = "Chiarelli",
  setWatermarkCompany,
  watermarkPosition = "center",
  setWatermarkPosition,
}: PropertyMediaUploaderProps) {
  const [showWatermarkConfig, setShowWatermarkConfig] = useState(false);

  return (
    <div className="md:col-span-2 space-y-4">
      {/* Header & Watermark Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-card/60 border border-border p-3.5 rounded-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Marca d&apos;Água Chiarelli Imóveis</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider">
                Automática
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Aplica a tipografia oficial centralizada (&ldquo;Chiarelli IMÓVEIS&rdquo;) diretamente sobre as fotos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {setApplyWatermark && (
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-background cursor-pointer hover:border-primary/50 transition-all text-xs font-semibold">
              <input
                type="checkbox"
                checked={applyWatermark}
                onChange={(e) => setApplyWatermark(e.target.checked)}
                className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
              />
              <span>{applyWatermark ? "Marca Ativada" : "Sem Marca"}</span>
            </label>
          )}

          {applyWatermark && (
            <button
              type="button"
              onClick={() => setShowWatermarkConfig(!showWatermarkConfig)}
              className="px-2.5 py-1.5 rounded-xl border border-border bg-background hover:bg-muted/40 text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              title="Ajustar dados da marca"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configurar</span>
            </button>
          )}
        </div>
      </div>

      {/* Watermark Config Panel (Collapsible) */}
      {showWatermarkConfig && applyWatermark && (
        <div className="p-3.5 bg-background border border-primary/20 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
              Nome da Marca / Imobiliária
            </label>
            <input
              type="text"
              value={watermarkCompany}
              onChange={(e) => setWatermarkCompany && setWatermarkCompany(e.target.value)}
              placeholder="Ex: Chiarelli"
              className="w-full mt-1 px-3 py-1.5 bg-muted/20 border border-border rounded-xl text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
              Posicionamento na Foto
            </label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => setWatermarkPosition && setWatermarkPosition("center")}
                className={cn(
                  "py-1.5 px-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer",
                  watermarkPosition === "center"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/10 border-border text-muted-foreground hover:text-foreground"
                )}
              >
                Centro (Padrão)
              </button>
              <button
                type="button"
                onClick={() => setWatermarkPosition && setWatermarkPosition("bottom-right")}
                className={cn(
                  "py-1.5 px-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer",
                  watermarkPosition === "bottom-right"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/10 border-border text-muted-foreground hover:text-foreground"
                )}
              >
                Canto Inferior
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop Zone */}
      <div
        className={cn(
          "relative p-8 border-2 border-dashed rounded-3xl bg-muted/10 group transition-all cursor-pointer flex flex-col items-center justify-center text-center",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01] shadow-xl shadow-primary/5"
            : "border-border hover:bg-muted/20 hover:border-primary/50",
          isUploading && "opacity-50 pointer-events-none"
        )}
        onClick={() => document.getElementById("property-file-upload")?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          id="property-file-upload"
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={onImageUpload}
        />
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary transition-all">
          {isUploading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <Upload className="w-8 h-8" />
          )}
        </div>
        <h4 className="text-sm font-black uppercase tracking-tight text-foreground">
          Clique ou arraste fotos aqui
        </h4>
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-2">
          {applyWatermark 
            ? `Marca d'água "${watermarkCompany || "Chiarelli"}" será aplicada automaticamente • Máximo 10MB`
            : "Suporta múltiplos arquivos • Máximo 10MB por foto"
          }
        </p>
      </div>

      {/* Image Previews */}
      {imageUrls.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Fotos Cadastradas ({imageUrls.length})
            </span>
            <span className="text-[10px] text-muted-foreground">
              A 1ª foto com badge dourada é a **Foto de Capa** da vitrine.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {imageUrls.map((url, idx) => (
              <div
                key={idx}
                className={cn(
                  "relative aspect-video rounded-2xl overflow-hidden border group bg-muted/50 shadow-xs transition-all",
                  idx === 0 
                    ? "border-amber-500 border-2 ring-2 ring-amber-500/20" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <Image
                  src={url}
                  alt={`Foto ${idx + 1}`}
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />

                {/* Badge Capa Principal */}
                {idx === 0 && (
                  <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-lg bg-amber-500 text-amber-950 font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-md">
                    <Star className="w-3 h-3 fill-amber-950" />
                    <span>Foto de Capa</span>
                  </div>
                )}

                {/* Overlay de Ações */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5 z-20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/80 bg-black/40 px-1.5 py-0.5 rounded-md">
                      #{idx + 1}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveImage(idx);
                      }}
                      className="w-7 h-7 rounded-xl bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center shadow-md hover:scale-110 transition-all cursor-pointer"
                      title="Remover foto"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-1.5">
                    {/* Botão Mover Esquerda */}
                    {idx > 0 && onMoveImage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveImage(idx, idx - 1);
                        }}
                        className="w-7 h-7 rounded-xl bg-white/20 hover:bg-white/40 text-white flex items-center justify-center shadow-sm cursor-pointer"
                        title="Mover para esquerda"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}

                    {/* Botão Definir como Capa */}
                    {idx !== 0 && onSetCoverImage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetCoverImage(idx);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 text-[11px] font-black flex items-center gap-1 shadow-lg hover:scale-105 transition-all cursor-pointer"
                        title="Definir esta foto como capa principal"
                      >
                        <Star className="w-3 h-3 fill-amber-950" />
                        <span>Tornar Capa</span>
                      </button>
                    )}

                    {/* Botão Mover Direita */}
                    {idx < imageUrls.length - 1 && onMoveImage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveImage(idx, idx + 1);
                        }}
                        className="w-7 h-7 rounded-xl bg-white/20 hover:bg-white/40 text-white flex items-center justify-center shadow-sm cursor-pointer"
                        title="Mover para direita"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PropertyMediaUploader;
