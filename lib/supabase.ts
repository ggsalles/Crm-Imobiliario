import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não estão definidos!");
  if (typeof window !== 'undefined') {
    console.warn("Configuração do Supabase ausente. Verifique as variáveis de ambiente.");
  }
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
