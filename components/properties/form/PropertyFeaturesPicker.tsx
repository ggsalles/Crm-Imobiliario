"use client";

import { Tag, Plus, X, Check } from "lucide-react";
import { TAG_CATEGORIES } from "@/lib/property-tags";
import { cn } from "@/lib/utils";

export interface PropertyFeaturesPickerProps {
  selectedTags: string[];
  onSelectedTagsChange: (updater: (prev: string[]) => string[]) => void;
  customTagInput: string;
  onCustomTagInputChange: (value: string) => void;
}

export function PropertyFeaturesPicker({
  selectedTags,
  onSelectedTagsChange,
  customTagInput,
  onCustomTagInputChange,
}: PropertyFeaturesPickerProps) {
  const addTag = () => {
    const val = customTagInput.trim();
    if (val && !selectedTags.some((t) => t.toLowerCase() === val.toLowerCase())) {
      onSelectedTagsChange((prev) => [...prev, val]);
      onCustomTagInputChange("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    onSelectedTagsChange((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const toggleCategoryTag = (tag: string) => {
    const isSelected = selectedTags.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (isSelected) {
      onSelectedTagsChange((prev) =>
        prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
      );
    } else {
      onSelectedTagsChange((prev) => [...prev, tag]);
    }
  };

  return (
    <div className="md:col-span-2 p-6 sm:p-7 bg-muted/20 border border-border/70 rounded-3xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>Características, Diferenciais & Comodidades</span>
              {selectedTags.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                  {selectedTags.length} selecionado{selectedTags.length > 1 ? "s" : ""}
                </span>
              )}
            </h4>
            <p className="text-xs text-muted-foreground">
              Adicione comodidades e tags para valorizar seu imóvel na vitrine e acelerar buscas
            </p>
          </div>
        </div>
      </div>

      {/* Input de tag personalizada */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={customTagInput}
            onChange={(e) => onCustomTagInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                addTag();
              }
            }}
            placeholder="Digite uma comodidade e tecle Enter (ex: Vista Panorâmica, Energia Solar, Reformado...)"
            className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-xs font-medium text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 outline-none"
          />
          {customTagInput && (
            <button
              type="button"
              onClick={() => onCustomTagInputChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={addTag}
          disabled={!customTagInput.trim()}
          className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Adicionar</span>
        </button>
      </div>

      {/* Tags Selecionadas */}
      {selectedTags.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Tags ativas neste imóvel (clique no × para remover):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs animate-in fade-in"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:bg-white/20 rounded-full p-0.5 transition-colors cursor-pointer"
                  title="Remover tag"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Catálogo de Comodidades Pré-definidas */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">
          Comodidades Frequentes (clique para marcar/desmarcar):
        </label>
        <div className="space-y-2.5">
          {TAG_CATEGORIES.map((cat, catIdx) => (
            <div key={catIdx} className="space-y-1.5">
              <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider block">
                {cat.category}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {cat.tags.map((tag) => {
                  const isSelected = selectedTags.some(
                    (t) => t.toLowerCase() === tag.toLowerCase()
                  );
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleCategoryTag(tag)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                          : "bg-background border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {isSelected ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <Plus className="w-2.5 h-2.5 opacity-60" />
                      )}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
