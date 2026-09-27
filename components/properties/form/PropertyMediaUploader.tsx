"use client";

import Image from "next/image";
import { Upload, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PropertyMediaUploaderProps {
  imageUrls: string[];
  onRemoveImage: (index: number) => void;
  isUploading: boolean;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function PropertyMediaUploader({
  imageUrls,
  onRemoveImage,
  isUploading,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onImageUpload,
}: PropertyMediaUploaderProps) {
  return (
    <div className="md:col-span-2 space-y-6">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
          Galeria de Imagens (Anexos)
        </label>
        {imageUrls.length > 0 && (
          <span className="text-[10px] font-bold text-muted-foreground">
            {imageUrls.length} {imageUrls.length === 1 ? "foto anexada" : "fotos anexadas"}
          </span>
        )}
      </div>

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
          Suporta múltiplos arquivos • Máximo 10MB por foto
        </p>
      </div>

      {imageUrls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {imageUrls.map((url, idx) => (
            <div
              key={idx}
              className="relative aspect-video rounded-2xl overflow-hidden border border-border group bg-muted/50"
            >
              <Image
                src={url}
                alt={`Foto ${idx + 1}`}
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage(idx);
                  }}
                  className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer"
                  title="Remover imagem"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
