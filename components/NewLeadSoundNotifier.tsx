"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { subscribeToDeals, Deal } from "@/lib/db";
import { playIcqSound, isSoundEnabled, setSoundEnabled, unlockAudio } from "@/lib/sound";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { Volume2, VolumeX, Sparkles, ArrowRight, MessageCircle } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export function NewLeadSoundNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const [soundActive, setSoundActive] = useState(true);
  const knownDealIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // Sync sound toggle state
  useEffect(() => {
    setSoundActive(isSoundEnabled());

    const handleToggle = (e: any) => {
      if (e?.detail?.enabled !== undefined) {
        setSoundActive(e.detail.enabled);
      } else {
        setSoundActive(isSoundEnabled());
      }
    };

    window.addEventListener("crm-sound-toggle", handleToggle);
    return () => window.removeEventListener("crm-sound-toggle", handleToggle);
  }, []);

  const triggerLeadAlert = useCallback((lead: any, totalCount: number) => {
    // Only alert if user is actively authenticated and sound is enabled
    if (!user) return;
    unlockAudio();
    playIcqSound();

    toast.custom((t) => (
      <div className="bg-card border-2 border-emerald-500/40 p-4 rounded-2xl shadow-2xl flex flex-col gap-2.5 max-w-sm w-full animate-in slide-in-from-top-4 duration-300">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs shrink-0">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Uh-oh! Novo Lead Recebido
              </span>
              <h4 className="text-xs font-bold text-foreground line-clamp-1">
                {lead.title || "Novo Lead no Funil"}
              </h4>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold shrink-0">
            {lead.value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(lead.value) : "Novo"}
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          Um cliente acabou de enviar solicitação através do link público. Responda rápido para garantir o atendimento prioritário!
        </p>

        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          <button
            onClick={() => {
              toast.dismiss(t);
              router.push("/pipeline");
            }}
            className="flex-1 py-1.5 px-3 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            Abrir no Funil
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    ), { duration: 8000 });
  }, [router, user]);

  // Reset tracking state whenever user ID or tenant ID changes
  useEffect(() => {
    knownDealIdsRef.current.clear();
    isInitialLoadRef.current = true;
  }, [user?.id, profile?.tenantId]);

  // Listen for new deals entering the pipeline
  useEffect(() => {
    // Strictly disable on public landing pages or auth screens or when not logged in
    const isPublicOrAuthPage = 
      !user || 
      pathname?.startsWith("/p/") || 
      pathname?.startsWith("/vitrine") || 
      pathname?.startsWith("/login") || 
      pathname?.startsWith("/register") || 
      pathname?.startsWith("/forgot-password") || 
      pathname?.startsWith("/reset-password");

    if (isPublicOrAuthPage) {
      knownDealIdsRef.current.clear();
      isInitialLoadRef.current = true;
      return;
    }

    const unsub = subscribeToDeals((deals: Deal[]) => {
      if (!deals || !Array.isArray(deals)) return;

      // On first load of current session, seed the known deals set without triggering audio
      if (isInitialLoadRef.current) {
        deals.forEach(d => {
          if (d.id) knownDealIdsRef.current.add(d.id);
        });
        isInitialLoadRef.current = false;
        return;
      }

      // Check for newly added deals that are in the "lead" stage
      const newLeads = deals.filter(d => 
        d.id && 
        !knownDealIdsRef.current.has(d.id) && 
        (d.stage === "lead" || !d.stage)
      );

      // Add all current deals to the known set
      deals.forEach(d => {
        if (d.id) knownDealIdsRef.current.add(d.id);
      });

      // If new leads arrived, trigger the ICQ Uh-oh!
      if (newLeads.length > 0) {
        const lead = newLeads[0];
        triggerLeadAlert(lead, newLeads.length);
      }
    });

    // Also listen for manual test / direct events
    const handleManualLeadEvent = (e: any) => {
      if (!user) return;
      const deal = e.detail?.deal || {
        title: "Lead Via Link Público - Carlos Eduardo (Edifício Horizon)",
        value: 1250000,
        stage: "lead"
      };
      triggerLeadAlert(deal, 1);
    };

    window.addEventListener("crm-new-lead-event", handleManualLeadEvent);

    return () => {
      unsub();
      window.removeEventListener("crm-new-lead-event", handleManualLeadEvent);
    };
  }, [pathname, user, profile?.tenantId, triggerLeadAlert]);

  return null;
}

/**
 * Sound Control Button to put in headers or top bars
 */
export function SoundControlButton({ className = "" }: { className?: string }) {
  const [enabled, setEnabled] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setEnabled(isSoundEnabled());
    const handleToggle = (e: any) => {
      if (e?.detail?.enabled !== undefined) setEnabled(e.detail.enabled);
    };
    window.addEventListener("crm-sound-toggle", handleToggle);
    return () => window.removeEventListener("crm-sound-toggle", handleToggle);
  }, []);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
    if (next) {
      playIcqSound();
      toast.success("Som ICQ ativado para novos leads!");
    } else {
      toast.info("Som ICQ silenciado.");
    }
  };

  const handleTest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaying(true);
    unlockAudio();
    await playIcqSound();
    
    window.dispatchEvent(new CustomEvent("crm-new-lead-event", {
      detail: {
        deal: {
          title: "Lead Teste ICQ - Marina Alencar (Condomínio Vista Real)",
          value: 890000,
          stage: "lead"
        }
      }
    }));

    setTimeout(() => setPlaying(false), 800);
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        title={enabled ? "Som ICQ ativado (clique para silenciar)" : "Som ICQ desativado (clique para ativar)"}
        className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
          enabled 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" 
            : "bg-muted border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>

      <button
        type="button"
        onClick={handleTest}
        title="Testar o clássico som ICQ Uh-oh!"
        className="px-2.5 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs"
      >
        <span className={`w-2 h-2 rounded-full bg-emerald-500 ${playing ? 'animate-ping' : ''}`} />
        <span>Testar Som ICQ</span>
      </button>
    </div>
  );
}
