"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { UserProfile } from "@/lib/db";
import { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email?: string, password?: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  resetPassword: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout to prevent stuck loading state
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        syncProfile(session.user);
      } else {
        setLoading(false);
      }
      clearTimeout(timeout);
    }).catch(err => {
      console.error("Auth session error:", err);
      setLoading(false);
      clearTimeout(timeout);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        await syncProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const syncProfile = async (user: User) => {
    try {
      // 1. First, try to get the profile by ID
      const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.warn("Retrying profile sync due to fetch error:", fetchError);
      }

      if (profileData) {
        setProfile({
          id: profileData.id,
          displayName: profileData.display_name,
          email: profileData.email,
          photoURL: profileData.photo_url,
          role: profileData.role,
          userType: profileData.user_type,
          isAdmin: profileData.is_admin
        });
        setLoading(false);
        return;
      }

      // 2. If not found by ID, it might be a pre-registered profile with a temp ID
      // We try an "upsert" approach which is more atomic in Supabase
      const newProfileInfo = {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
        email: user.email?.toLowerCase(),
        role: user.email === 'ggsalles@gmail.com' ? 'Admin' : 'Membro',
        user_type: 'funcionário',
        is_admin: user.email === 'ggsalles@gmail.com'
      };

      const { data: upsertedData, error: upsertError } = await supabase
        .from('profiles')
        .upsert(newProfileInfo, { onConflict: 'email' })
        .select()
        .single();

      if (upsertError) {
        // If upsert fails (likely RLS or PK constraint), it might be because the profile already exists
        // but we don't have update permissions yet, or it's currently being handled by a server trigger.
        console.log("Profile upsert notice (may be handled by server trigger):", upsertError.message);
        
        // Final fallback: try ONE more select to see if a trigger created it
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
            isAdmin: finalCheck.is_admin
          });
        }
      } else if (upsertedData) {
        setProfile({
          id: upsertedData.id,
          displayName: upsertedData.display_name,
          email: upsertedData.email,
          role: upsertedData.role,
          userType: upsertedData.user_type,
          isAdmin: upsertedData.is_admin
        });
      }
    } catch (error: any) {
      console.error("Error syncing profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email?: string, password?: string) => {
    if (!email || !password) {
      // Supabase Google Login
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
        throw new Error("Limite de tentativas excedido. Por favor, aguarde alguns minutos ou verifique as configurações de segurança do seu painel Supabase.");
      }
      if (error.message === 'Invalid login credentials') {
        throw new Error("E-mail ou senha incorretos. Se você acabou de se cadastrar, verifique se confirmou seu e-mail no link enviado.");
      }
      console.error("Login unexpected error:", error);
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    if (password.length < 6) {
      throw new Error("A senha deve ter pelo menos 6 caracteres.");
    }

    const cleanEmail = email.trim().toLowerCase();
    console.log(`Attempting registration for: "${cleanEmail}"`);

    const { error, data } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          display_name: name,
        }
      }
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('rate limit')) {
        throw new Error("Limite de e-mails/cadastros excedido pelo servidor. Aguarde 1 hora ou desative 'Confirm Email' no painel do Supabase para testes.");
      }
      if (msg.includes('already registered')) {
        throw new Error("Este e-mail já está em uso.");
      }
      console.error("Registration unexpected error:", error);
      throw error;
    }
    
    // Check if session exists (auto-login) or if verification is required
    if (data.user && !data.session) {
      toast.info("Cadastro realizado! Por favor, verifique seu e-mail para confirmar a conta e poder fazer login.", {
        duration: 10000,
      });
    } else if (data.session) {
      toast.success("Conta criada com sucesso!");
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    toast.success("Link de recuperação enviado para o seu e-mail.");
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
