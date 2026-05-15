"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
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

      // 2. If not found by ID, check if a profile exists with this email (pre-registration)
      const { data: existingByEmail, error: emailError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', user.email?.toLowerCase())
        .maybeSingle();

      if (existingByEmail) {
        const oldId = existingByEmail.id;
        const newId = user.id;

        // If the candidate profile has a different ID, we need to "claim" it
        if (oldId !== newId) {
          console.log(`Transferring data from temp profile ${oldId} to new user ${newId}`);
          
          // First update the profile ID
          const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({ id: newId, updated_at: new Date().toISOString() })
            .eq('id', oldId);

          if (!updateProfileError) {
             // Now transfer related data - Deals, Contacts, Companies, etc.
             // We use a series of updates. In a production app, these might be handled by a DB function/trigger
             // but here we do it from the client for simplicity.
             try {
                await Promise.all([
                  supabase.from('deals').update({ owner_id: newId }).eq('owner_id', oldId),
                  supabase.from('contacts').update({ owner_id: newId }).eq('owner_id', oldId),
                  supabase.from('companies').update({ owner_id: newId }).eq('owner_id', oldId),
                  supabase.from('properties').update({ owner_id: newId }).eq('owner_id', oldId),
                  supabase.from('activities').update({ owner_id: newId }).eq('owner_id', oldId),
                ]);
             } catch (transferErr) {
                console.error("Data transfer partial failure:", transferErr);
             }
          }
        }

        setProfile({
          id: newId,
          displayName: existingByEmail.display_name,
          email: existingByEmail.email,
          photoURL: existingByEmail.photo_url || user.user_metadata?.avatar_url,
          role: existingByEmail.role,
          userType: existingByEmail.user_type,
          isAdmin: existingByEmail.is_admin
        });
        setLoading(false);
        return;
      }

      // 3. If no profile exists at all, create a new one
      const newProfileInfo = {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
        email: user.email?.toLowerCase(),
        role: user.email === 'ggsalles@gmail.com' ? 'Admin' : 'Membro',
        user_type: 'funcionário',
        is_admin: user.email === 'ggsalles@gmail.com'
      };

      const { data: createdData, error: createError } = await supabase
        .from('profiles')
        .insert([newProfileInfo])
        .select()
        .single();

      if (createError) {
        console.log("Profile create notice:", createError.message);
        
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
      } else if (createdData) {
        setProfile({
          id: createdData.id,
          displayName: createdData.display_name,
          email: createdData.email,
          role: createdData.role,
          userType: createdData.user_type,
          isAdmin: createdData.is_admin
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

  const register = async (email: string, password: string, name: string) => {
    if (password.length < 6) {
      throw new Error("A senha deve ter pelo menos 6 caracteres.");
    }
    const cleanEmail = email.trim().toLowerCase();
    const { error, data } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { display_name: name } }
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

  const contextValue = useMemo(() => ({
    user,
    profile,
    loading,
    login,
    register,
    resetPassword,
    logout
  }), [user, profile, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
