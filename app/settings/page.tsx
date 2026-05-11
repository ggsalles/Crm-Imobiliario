"use client";

import { Sidebar } from "@/components/sidebar";
import { useTheme } from "@/providers/theme-provider";
import { Palette, Check, Layout, Sparkles, Smartphone, Monitor } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const colors: { name: string; value: "blue" | "emerald" | "orange" | "purple" | "rose" | "indigo"; hex: string }[] = [
  { name: "Ocean Blue", value: "blue", hex: "#3b82f6" },
  { name: "Forest Green", value: "emerald", hex: "#10b981" },
  { name: "Sunset Orange", value: "orange", hex: "#f97316" },
  { name: "Royal Purple", value: "purple", hex: "#a855f7" },
  { name: "Velvet Rose", value: "rose", hex: "#f43f5e" },
  { name: "Deep Indigo", value: "indigo", hex: "#6366f1" },
];

export default function SettingsPage() {
  const { primaryColor, setPrimaryColor, appearance, setAppearance } = useTheme();

  return (
    <div className="flex min-h-screen bg-background transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 lg:p-12">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-2">Personalize sua experiência e gerencie sua conta.</p>
        </header>

        <div className="max-w-4xl">
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="bg-card rounded-[32px] p-6 md:p-8 border border-border shadow-sm space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Palette className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-bold text-foreground">Aparência do CRM</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Personalize a identidade visual e o modo de exibição do seu sistema.</p>
                </div>
                <button
                  onClick={() => {
                    setPrimaryColor("blue");
                    setAppearance("system");
                  }}
                  className="px-6 py-2.5 bg-muted text-foreground rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all border border-border shadow-sm"
                >
                  Restaurar Padrões
                </button>
              </div>

              {/* Background Mode Selection */}
              <div>
                <h4 className="text-sm font-bold mb-4">Tema do Sistema</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { id: "system", label: "Sistema", icon: Monitor, bg: "bg-slate-200", border: "border-slate-300" },
                    { id: "light", label: "Claro", icon: Sparkles, bg: "bg-slate-50", border: "border-slate-200" },
                    { id: "dark", label: "Escuro", icon: Layout, bg: "bg-slate-900", border: "border-slate-800" },
                    { id: "neutral", label: "Minimalist", icon: Smartphone, bg: "bg-white", border: "border-slate-100" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setAppearance(mode.id as any)}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                        appearance === mode.id 
                          ? "border-primary bg-primary/5 shadow-sm" 
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className={cn("w-full h-12 rounded-xl mb-1 flex items-center justify-center overflow-hidden border", mode.bg, mode.border)}>
                        <mode.icon className="w-5 h-5 opacity-40" />
                      </div>
                      <span className="text-xs font-bold">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <h4 className="text-sm font-bold mb-4">Cores de Destaque</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setPrimaryColor(color.value)}
                      className={cn(
                        "relative group h-24 rounded-2xl border-2 transition-all overflow-hidden p-4 flex flex-col justify-end",
                        primaryColor === color.value 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div 
                        className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all bg-card shadow-sm"
                        style={{ color: color.hex }}
                      >
                        {primaryColor === color.value ? <Check className="w-4 h-4 stroke-[3px]" /> : null}
                      </div>
                      <div 
                        className="w-4 h-4 rounded-full mb-2"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className={cn(
                        "text-xs font-bold transition-colors",
                        primaryColor === color.value ? "text-primary" : "text-muted-foreground"
                      )}>
                        {color.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="bg-card rounded-[32px] p-6 md:p-8 border border-border shadow-sm space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">Customização Visual</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border group hover:border-primary/30 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-foreground">Modo Compacto</p>
                      <p className="text-xs text-muted-foreground">Reduz o espaçamento para mostrar mais dados.</p>
                    </div>
                    <div className="w-12 h-6 bg-muted rounded-full relative p-1 cursor-pointer">
                      <div className="w-4 h-4 bg-card rounded-full shadow-sm" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border group hover:border-primary/30 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-foreground">Animações de Transição</p>
                      <p className="text-xs text-muted-foreground">Habilita efeitos suaves entre telas.</p>
                    </div>
                    <div className="w-12 h-6 bg-primary rounded-full relative p-1 cursor-pointer">
                      <div className="w-4 h-4 bg-card rounded-full shadow-sm ml-auto" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
