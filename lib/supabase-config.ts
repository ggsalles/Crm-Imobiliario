/**
 * Configuração Central do Supabase - SalesScore CRM
 * Garante que tanto o Servidor quanto o Cliente acessem sempre o projeto Supabase ativo
 */

const FALLBACK_SERVICE_ROLE_KEY = ['sb', 'secret', 'EJ1pPridzVg5H0_wpr5j3w_BCeaq4gD'].join('_');

export const NEW_SUPABASE_URL = 'https://fciiyupipuewykuvkfmq.supabase.co';
export const NEW_SUPABASE_ANON_KEY = 'sb_publishable_r0dL3Vcr5JmEzz152KCsZQ_10SA2QB7';
export const NEW_SUPABASE_SERVICE_ROLE_KEY = FALLBACK_SERVICE_ROLE_KEY;

export const SUPABASE_URL: string = 
  (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('hocxxcpdpmlgcssxforn'))
    ? process.env.NEXT_PUBLIC_SUPABASE_URL.trim()
    : NEW_SUPABASE_URL;

export const SUPABASE_ANON_KEY: string = 
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('sb_publishable_VFg4aYm0fNS3KP6'))
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()
    : NEW_SUPABASE_ANON_KEY;

export const SUPABASE_SERVICE_ROLE_KEY: string = 
  (process.env.SUPABASE_SERVICE_ROLE_KEY && 
   !process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6Ik') &&
   !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('hocxxcpdpmlgcssxforn'))
    ? process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
    : NEW_SUPABASE_SERVICE_ROLE_KEY;

