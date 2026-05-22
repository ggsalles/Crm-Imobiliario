"use client";

import { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";

let isPageUnloading = false;
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    isPageUnloading = true;
    // Se o unload for abortado ou interceptado por soft-routing, recuperamos o estado em 2s
    setTimeout(() => {
      isPageUnloading = false;
    }, 2000);
  });
}

// Module-scoped globals to protect against React Strict Mode unmount/remount
// and duplicate authentication event loops.
let globalLastSyncedUserId: string | null = null;
let globalLastSyncTime = 0;
const globalActiveSyncPromises: Record<string, Promise<any>> = {};

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { UserProfile, updateUserProfile, clearLocalCache } from "@/lib/db";
import { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email?: string, password?: string) => Promise<void>;
  register: (email: string, password: string, name: string, companyName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  changeTenant: (tenantId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  resetPassword: async () => {},
  logout: async () => {},
  changeTenant: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const profileRef = useRef<UserProfile | null>(null);

  const setProfile = (p: UserProfile | null) => {
    profileRef.current = p;
    if (p && typeof window !== 'undefined') {
      try {
        // Garantir consistência absoluta entre o tenant ativamente selecionado e o perfil renderizado
        const storedActiveTenant = localStorage.getItem(`active-tenant-id:${p.id}`);
        if (storedActiveTenant && p.tenantId !== storedActiveTenant) {
          console.log(`[setProfile] Priorizando tenantId ativo do localStorage para ${p.id}: ${storedActiveTenant} em vez de ${p.tenantId}`);
          p.tenantId = storedActiveTenant;
        } else if (p.tenantId) {
          localStorage.setItem(`active-tenant-id:${p.id}`, p.tenantId);
        }

        localStorage.setItem(`local-profile:${p.id}`, JSON.stringify(p));
      } catch (e) {
        console.warn("Erro ao salvar cache de perfil local:", e);
      }
    }
    setProfileState(p);
  };
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const lastActivityTimeRef = useRef<number>(Date.now());
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const lastSyncTimeRef = useRef<number>(0);

  useEffect(() => {
    // Online/Offline status handling
    const handleOnline = () => {
      console.log("AuthProvider: App is online.");
      toast.success("Conexão restabelecida", { id: 'network-status' });
      // Force session refresh when coming back online
      supabase.auth.getSession();
    };

    const handleOffline = () => {
      console.warn("AuthProvider: App is offline.");
      toast.error("Sem conexão com a internet (verifique se está offline)", { id: 'network-status', duration: 4000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Safety timeout to prevent stuck loading state - raised to 15s for better reliability on cold-starts
    const timeout = setTimeout(() => {
      console.warn("AuthProvider: Safety timeout reached. Forcing loading to false.");
      setLoading(false);
    }, 15000);

    // Initial session loading
    setLoading(true);
    const authInitializedRef = { current: false };

    const handleInitialSession = async (session: any) => {
      if (authInitializedRef.current) return;
      authInitializedRef.current = true;
      
      console.log("AuthProvider: Handling initial session", !!session);
      if (session) {
        setUser(session.user);
        await syncProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
      clearTimeout(timeout);
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.warn("Initial auth getSession error:", error.message);
      handleInitialSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`AuthProvider: Event [${event}]`, !!session);
      
      if (event === 'SIGNED_OUT' || (event === 'USER_UPDATED' && !session)) {
        authInitializedRef.current = true;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'INITIAL_SESSION') {
        await handleInitialSession(session);
        return;
      }

      if (session) {
        if (!authInitializedRef.current) {
          await handleInitialSession(session);
          return;
        }

        // Already initialized. Only sync again if user changed.
        const currentProfile = profileRef.current;
        if (!currentProfile || currentProfile.id !== session.user.id) {
          console.log(`[AuthProvider] User session changed/mismatched. Re-syncing for user ${session.user.id}`);
          setUser(session.user);
          await syncProfile(session.user);
        } else {
          setUser(session.user);
        }
        setLoading(false);
      }
    });

    // Keep-alive heartbeat for Supabase Realtime
    // This helps prevent connection drops in proxy-heavy environments when idle
    const heartbeatChannel = supabase.channel('realtime-heartbeat');
    heartbeatChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log("AuthProvider: Realtime heartbeat channel subscribed.");
      }
    });

    const heartbeatInterval = setInterval(async () => {
      // Proactive session validation to keep connection "warm"
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Se tínhamos um usuário mas agora a sessão sumiu, ou houve um erro crítico de sessão
        if (user && !session) {
          console.warn("AuthProvider: Session lost during heartbeat. Logging out...");
          setUser(null);
          setProfile(null);
          return;
        }

        if (session) {
          console.log("AuthProvider: Session validated via heartbeat.");
        }
      } catch (err) {
        console.warn("AuthProvider: Heartbeat session validation error:", err);
      }

      if (heartbeatChannel.state === 'joined') {
        heartbeatChannel.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: new Date().toISOString() }
        });
      } else if (heartbeatChannel.state === 'errored' || heartbeatChannel.state === 'closed') {
        console.log("AuthProvider: Heartbeat channel in bad state, retrying subscription...");
        const state = heartbeatChannel.state as string;
        if (state !== 'joining' && state !== 'joined') {
          heartbeatChannel.subscribe();
        }
      }
    }, 15000); 

    // Handle global session expiry events from apiFetch
    const handleSessionExpired = () => {
      console.warn("AuthProvider: Session expired event received.");
      setUser(null);
      setProfile(null);
      toast.error("Sua sessão expirou. Por favor, faça login novamente.");
    };

    window.addEventListener('app-session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('app-session-expired', handleSessionExpired);
      subscription.unsubscribe();
      supabase.removeChannel(heartbeatChannel);
      clearInterval(heartbeatInterval);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    // Reset activity time upon mount or user change
    lastActivityTimeRef.current = Date.now();

    const handleActivity = () => {
      lastActivityTimeRef.current = Date.now();
    };

    // Register active user events
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    events.forEach(eventName => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    const intervalId = setInterval(() => {
      const isEnabled = localStorage.getItem("session_timeout_enabled") !== "false"; // default to true
      const minutes = Number(localStorage.getItem("session_timeout_minutes") || "15"); // default to 15 minutes as fallback
      const timeoutMs = minutes * 60 * 1000;

      const elapsed = Date.now() - lastActivityTimeRef.current;
      if (isEnabled && elapsed >= timeoutMs) {
        console.warn(`AuthProvider: Recurso de inatividade detectado por ${minutes} minutos. Desconectando...`);
        
        supabase.auth.signOut().then(() => {
          setUser(null);
          setProfile(null);
          toast.warning(`Sua sessão expirou devido a ${minutes} minutos de inatividade. Por favor, entre novamente.`);
          router.push("/login");
        });
      }
    }, 5000); // Check once every 5 seconds

    const handleSettingsUpdate = () => {
      lastActivityTimeRef.current = Date.now();
    };
    window.addEventListener("storage_timeout_updated", handleSettingsUpdate);

    return () => {
      events.forEach(eventName => {
        window.removeEventListener(eventName, handleActivity);
      });
      clearInterval(intervalId);
      window.removeEventListener("storage_timeout_updated", handleSettingsUpdate);
    };
  }, [user, router]);

  const syncProfile = async (user: User) => {
    // Evitar sincronizações duplicadas ou concorrentes rápidas para o mesmo usuário
    const nowTime = Date.now();
    
    // 1. Lock global por promessa ativa
    if (globalActiveSyncPromises[user.id]) {
      console.log(`[AuthProvider] Sincronização já em andamento globalmente para o usuário ${user.id}. Ignorando chamada paralela.`);
      return;
    }

    // 2. Lock global baseado em tempo decorrido
    if (globalLastSyncedUserId === user.id && (nowTime - globalLastSyncTime < 4500)) {
      console.log(`[AuthProvider] Sincronização recente (há menos de 4.5s) para o usuário ${user.id}. Ignorando deduplicação.`);
      return;
    }

    globalLastSyncedUserId = user.id;
    globalLastSyncTime = nowTime;

    // Atualiza também os estados de referência locais da instância ativa
    lastSyncedUserIdRef.current = user.id;
    lastSyncTimeRef.current = nowTime;

    // Ler o tenant escolhido no login/cadastro se houver
    let chosenTenantId: string | null = null;
    if (typeof window !== "undefined") {
      chosenTenantId = localStorage.getItem("login-chosen-tenant-id");
    }

    // Definimos um perfil provisório/imediato como fallback de segurança
    let fallbackProfile: UserProfile = {
      id: user.id,
      displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || "Usuário",
      email: user.email || "",
      photoURL: user.user_metadata?.avatar_url || "",
      role: user.email === 'ggsalles@gmail.com' ? 'Admin' : 'Membro',
      userType: 'funcionário',
      isAdmin: user.email === 'ggsalles@gmail.com',
      tenantId: chosenTenantId || user.user_metadata?.tenant_id || "11111111-1111-1111-1111-111111111111", // Default/selected tenant
      tenantIds: user.user_metadata?.tenant_ids || [chosenTenantId || user.user_metadata?.tenant_id || "11111111-1111-1111-1111-111111111111"]
    };

    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`local-profile:${user.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id === user.id) {
            fallbackProfile = parsed;
          }
        }
      } catch (e) {
        console.warn("Erro ao carregar perfil em cache local:", e);
      }
    }

    // Se o usuário selecionou uma imobiliária no login, force-a no fallback
    if (chosenTenantId) {
      fallbackProfile.tenantId = chosenTenantId;
      if (!fallbackProfile.tenantIds.includes(chosenTenantId)) {
        fallbackProfile.tenantIds = [chosenTenantId, ...fallbackProfile.tenantIds.filter(id => id !== "11111111-1111-1111-1111-111111111111")];
      }
    } else if (user.user_metadata?.tenant_id && fallbackProfile.tenantId === "11111111-1111-1111-1111-111111111111") {
      // Se o user_metadata do Supabase Auth tiver o tenant correto e o fallbackProfile estiver com o padrão de segurança, prioritize o metadata do GoTrue Auth
      fallbackProfile.tenantId = user.user_metadata.tenant_id;
      fallbackProfile.tenantIds = user.user_metadata.tenant_ids || [user.user_metadata.tenant_id];
    }

    // Configura o perfil de fallback imediatamente para liberar a UI de imediato e evitar bloqueios ou travamentos nas telas de carregamento
    setProfile(fallbackProfile);

    const performSync = async () => {
      if (typeof window !== "undefined" && isPageUnloading) return;
      // 1. Tentar primeiro via API Proxy (mais estável, roda server-side, passa imune a loops de RLS do cliente local)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        // Se o usuário selecionou uma imobiliária no login, atualizamos via APIPATCH antes da leitura para gravação de paridade perfeita no DB
        if (chosenTenantId) {
          console.log(`[AuthProvider] Gravando imobiliária selecionada no login no banco de dados via API: ${chosenTenantId}`);
          await fetch(`/api/profiles?id=${user.id}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant_id: chosenTenantId })
          });
        }

        const res = await fetch(`/api/profiles?id=${user.id}`, { headers });
        if (res.ok) {
          const apiProfile = await res.json();
          if (apiProfile && apiProfile.id) {
            console.log("AuthProvider: Perfil carregado e sincronizado via API Server-Side.");
            
            // Se o usuário selecionou algo no login, priorize a dele
            if (chosenTenantId) {
              apiProfile.tenantId = chosenTenantId;
            } else {
              // Garantir que se tivermos um tenant ID mais recente que o usuário ativamente trocou (e salvou no cache local), use-o
              const localCachedProfile = typeof window !== 'undefined' ? localStorage.getItem(`local-profile:${user.id}`) : null;
              if (localCachedProfile) {
                const parsed = JSON.parse(localCachedProfile);
                if (parsed && parsed.id === user.id && parsed.tenantId && apiProfile.tenantId !== parsed.tenantId) {
                  console.log(`AuthProvider: PRIORIZANDO tenantId ${parsed.tenantId} do cache local em vez de ${apiProfile.tenantId}`);
                  apiProfile.tenantId = parsed.tenantId;
                }
              }
            }

            // Limpa o login-chosen-tenant-id de forma limpa após sucesso
            if (typeof window !== 'undefined') {
              localStorage.removeItem('login-chosen-tenant-id');
              localStorage.setItem(`active-tenant-id:${user.id}`, apiProfile.tenantId);
            }

            setProfile(apiProfile);
            return;
          }
        }
      } catch (apiErr) {
        console.warn("AuthProvider: Falha ao buscar perfil via API Server-side. Tentando Supabase Client...", apiErr);
      }

      // Fetch associated tenants via Client Supabase (sujeito às políticas RLS do cliente local)
      let tenantIds: string[] = [];
      try {
        const { data: assoc, error: assocError } = await supabase
          .from('profile_tenants')
          .select('tenant_id')
          .eq('profile_id', user.id);
        if (!assocError && assoc && assoc.length > 0) {
          tenantIds = assoc.map((a: any) => a.tenant_id);
        }
      } catch (e) {
        console.warn("Erro ao buscar profile_tenants no syncProfile:", e);
      }

      // Try client-side profiles query
      const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.warn("Retrying profile sync due to fetch error:", fetchError);
      }

      const finalTenantIds = tenantIds.length > 0 
        ? tenantIds 
        : [profileData?.tenant_id || "11111111-1111-1111-1111-111111111111"];

      if (profileData) {
        // Garantir que priorizamos o tenantId ativo do cache se aplicável
        const localCachedProfile = typeof window !== 'undefined' ? localStorage.getItem(`local-profile:${user.id}`) : null;
        let finalTenantId = profileData.tenant_id;
        if (localCachedProfile) {
          const parsed = JSON.parse(localCachedProfile);
          if (parsed && parsed.id === user.id && parsed.tenantId && finalTenantId !== parsed.tenantId) {
            finalTenantId = parsed.tenantId;
          }
        }

        setProfile({
          id: profileData.id,
          displayName: profileData.display_name,
          email: profileData.email,
          photoURL: profileData.photo_url,
          role: profileData.role,
          userType: profileData.user_type,
          isAdmin: profileData.is_admin,
          tenantId: finalTenantId || finalTenantIds[0],
          tenantIds: finalTenantIds
        });
        return;
      }

      // Check if profile exists with this email (pre-registration)
      const { data: existingByEmail, error: emailError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', user.email?.toLowerCase())
        .maybeSingle();

      if (existingByEmail) {
        const oldId = existingByEmail.id;
        const newId = user.id;

        // Claim profile with different ID
        if (oldId !== newId) {
          console.log(`Transferring data from temp profile ${oldId} to new user ${newId}`);
          const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({ id: newId, updated_at: new Date().toISOString() })
            .eq('id', oldId);

          if (!updateProfileError) {
             try {
                await Promise.all([
                  supabase.from('deals').update({ owner_id: newId }).eq('owner_id', oldId),
                  supabase.from('contacts').update({ owner_id: newId }).eq('owner_id', oldId),
                  supabase.from('companies').update({ owner_id: newId }).eq('owner_id', oldId),
                  supabase.from('properties').update({ owner_id: newId }).eq('owner_id', oldId),
                  supabase.from('activities').update({ owner_id: newId }).eq('owner_id', oldId),
                  supabase.from('profile_tenants').update({ profile_id: newId }).eq('profile_id', oldId),
                ]);
             } catch (transferErr) {
                console.error("Data transfer partial failure:", transferErr);
             }
          }
        }

        const localCachedProfile = typeof window !== 'undefined' ? localStorage.getItem(`local-profile:${user.id}`) : null;
        let finalTenantId = existingByEmail.tenant_id;
        if (localCachedProfile) {
          const parsed = JSON.parse(localCachedProfile);
          if (parsed && parsed.id === user.id && parsed.tenantId && finalTenantId !== parsed.tenantId) {
            finalTenantId = parsed.tenantId;
          }
        }

        const updatedTenantIds = tenantIds.length > 0 
          ? tenantIds 
          : [finalTenantId || "11111111-1111-1111-1111-111111111111"];

        setProfile({
          id: newId,
          displayName: existingByEmail.display_name,
          email: existingByEmail.email,
          photoURL: existingByEmail.photo_url || user.user_metadata?.avatar_url,
          role: existingByEmail.role,
          userType: existingByEmail.user_type,
          isAdmin: existingByEmail.is_admin,
          tenantId: finalTenantId || updatedTenantIds[0],
          tenantIds: updatedTenantIds
        });
        return;
      }

      // If no profile exists at all, create a new one
      const newProfileInfo = {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
        email: user.email?.toLowerCase(),
        role: user.email === 'ggsalles@gmail.com' ? 'Admin' : 'Membro',
        user_type: 'funcionário',
        is_admin: user.email === 'ggsalles@gmail.com',
        tenant_id: chosenTenantId || user.user_metadata?.tenant_id || "11111111-1111-1111-1111-111111111111"
      };

      const { data: createdData, error: createError } = await supabase
        .from('profiles')
        .insert([newProfileInfo])
        .select()
        .single();

      if (createError) {
        console.log("Profile create notice:", createError.message);
        const { data: finalCheck } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', user.email?.toLowerCase())
          .maybeSingle();
          
        if (finalCheck) {
          setProfile({
            id: finalCheck.id,
            displayName: finalCheck.display_name || user.email?.split('@')[0],
            email: finalCheck.email,
            role: finalCheck.role,
            userType: finalCheck.user_type,
            isAdmin: finalCheck.is_admin,
            tenantId: finalCheck.tenant_id || tenantIds[0] || "11111111-1111-1111-1111-111111111111",
            tenantIds: tenantIds.length > 0 ? tenantIds : [finalCheck.tenant_id || "11111111-1111-1111-1111-111111111111"]
          });
        } else {
          console.warn("AuthProvider: Criando perfil local temporário devido a falha no banco.");
          setProfile(fallbackProfile);
        }
      } else if (createdData) {
        setProfile({
          id: createdData.id,
          displayName: createdData.display_name,
          email: createdData.email,
          role: createdData.role,
          userType: createdData.user_type,
          isAdmin: createdData.is_admin,
          tenantId: createdData.tenant_id || tenantIds[0] || "11111111-1111-1111-1111-111111111111",
          tenantIds: tenantIds.length > 0 ? tenantIds : [createdData.tenant_id || "11111111-1111-1111-1111-111111111111"]
        });
      } else {
        setProfile(fallbackProfile);
      }
    };

    // Criamos uma Promise de timeout interno secundário (10000ms) para a tarefa em segundo plano
    const timeoutPromise = new Promise<void>((_, reject) => 
      setTimeout(() => reject(new Error("Background Timeout")), 10000)
    );

    // Executa a sincronização de banco em segundo plano de forma silenciosa e resiliente, registrando a promessa no lock global
    const syncPromise = Promise.race([performSync(), timeoutPromise]).catch((error: any) => {
      console.log("AuthProvider: Sincronização em segundo plano concluída ou interrompida de forma segura:", error.message || error);
    }).finally(() => {
      setLoading(false);
      // Remove do lock global após a conclusão real da sincronização
      delete globalActiveSyncPromises[user.id];
    });

    globalActiveSyncPromises[user.id] = syncPromise;

    // Desativa o spinner de loading imediatamente, pois a UI já possui o perfil provisório/cacheado ativo
    setLoading(false);
  };

  const login = async (email?: string, password?: string) => {
    if (!email || !password) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      if (error.message.includes('rate limit')) {
        throw new Error("Limite de tentativas excedido. Por favor, aguarde alguns minutos.");
      }
      throw error;
    }
  };

  const resolveOrCreateTenant = async (email: string, companyName: string): Promise<string> => {
    const cleanEmail = email.trim().toLowerCase();
    const domain = cleanEmail.split("@")[1];
    if (!domain) return "11111111-1111-1111-1111-111111111111";

    const genericDomains = [
      "gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "live.com", 
      "icloud.com", "aol.com", "zoho.com", "protonmail.com", "yandex.com", 
      "globomail.com", "bol.com.br", "uol.com.br", "terra.com.br", "ig.com.br"
    ];
    const isGeneric = genericDomains.includes(domain);

    let targetSlug = "";
    let targetName = companyName.trim();

    if (!isGeneric) {
      targetSlug = domain.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      if (!targetName) {
        const domainName = domain.split(".")[0];
        targetName = domainName.charAt(0).toUpperCase() + domainName.slice(1);
      }
    } else {
      if (!targetName) {
        return "11111111-1111-1111-1111-111111111111";
      }
      targetSlug = targetName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    }

    try {
      const res = await fetch(`/api/tenants`);
      if (res.ok) {
        const allTenants = await res.json();
        if (Array.isArray(allTenants)) {
          const matchBySlug = allTenants.find((t: any) => t.slug === targetSlug);
          if (matchBySlug) return matchBySlug.id;

          const matchByName = allTenants.find((t: any) => t.name.toLowerCase() === targetName.toLowerCase());
          if (matchByName) return matchByName.id;
        }
      }

      console.log(`[resolveOrCreateTenant] Creating new tenant: ${targetName} (${targetSlug})`);
      const createRes = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: targetName, slug: targetSlug })
      });

      if (createRes.ok) {
        const newTenant = await createRes.json();
        if (newTenant && newTenant.id) return newTenant.id;
      }
    } catch (err) {
      console.error("[resolveOrCreateTenant] Error resolving/creating tenant:", err);
    }

    return "11111111-1111-1111-1111-111111111111";
  };

  const register = async (email: string, password: string, name: string, companyName?: string) => {
    if (password.length < 6) {
      throw new Error("A senha deve ter pelo menos 6 caracteres.");
    }
    const cleanEmail = email.trim().toLowerCase();

    let resolvedTenantId = "11111111-1111-1111-1111-111111111111";
    try {
      resolvedTenantId = await resolveOrCreateTenant(cleanEmail, companyName || "");
    } catch (err) {
      console.error("[AuthProvider] Failed resolving tenant during register:", err);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("login-chosen-tenant-id", resolvedTenantId);
    }

    const { error, data } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { 
        data: { 
          display_name: name,
          tenant_id: resolvedTenantId,
          tenant_ids: [resolvedTenantId]
        } 
      }
    });
    if (error) throw error;
    if (data.user && !data.session) {
      toast.info("Verifique seu e-mail para confirmar a conta.");
    }
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : "";
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    if (error) throw error;
    toast.success("Link de recuperação enviado.");
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const changeTenant = async (tenantId: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      // 0. Registrar imobiliária ativa síncronamente no localStorage para blindar a seleção contra concorrência
      if (typeof window !== "undefined") {
        localStorage.setItem(`active-tenant-id:${profile.id}`, tenantId);
      }

      // 1. Sincroniza e atualiza no banco de dados através da função updateUserProfile que faz o PATCH correto com skipResync=true
      await updateUserProfile(profile.id, { tenantId }, true);
      
      // 2. Limpa o cache in-memory local para evitar vazamento de dados antigos de outros inquilinos
      clearLocalCache();
      
      // 3. Se estiver na página de login, realiza uma transição de estado limpa SEM hard reload,
      // pois não há outros componentes de dashboard na tela que gerariam erros de fetch abortados.
      // Isso evita acionar o isPageUnloading via beforeunload, que travaria os fetches da barra lateral.
      if (typeof window !== "undefined" && window.location.pathname === "/login") {
        setProfile({ ...profile, tenantId });
        setLoading(false);
        return;
      }

      // 4. Redireciona/recarrega para limpar todos os estados das páginas de forma 100% segura.
      // Evitamos chamar setProfile(updatedProfile) aqui para evitar que outros componentes em renderização 
      // disparem novas requisições HTTP em segundo plano que seriam imediatamente abortadas no redirecionamento 
      // do navegador, resultando em "Failed to fetch" nos toasts.
      if (typeof window !== "undefined") {
        window.location.href = "/";
        return;
      }
    } catch (err: any) {
      console.error("Erro ao alternar tenant:", err);
      toast.error("Erro ao alternar de imobiliária.");
      setLoading(false);
      throw err;
    }
  };

  const contextValue = useMemo(() => ({
    user,
    profile,
    loading,
    login,
    register,
    resetPassword,
    logout,
    changeTenant
  }), [user, profile, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
