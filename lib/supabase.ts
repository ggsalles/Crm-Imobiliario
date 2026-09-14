import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não estão definidos!");
}

export const AUTH_STORAGE_KEY = 'crm-imob-session-v5';

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove = [
      AUTH_STORAGE_KEY,
      'crm-imob-session-v5',
      'crm-imob-session-v4',
      'crm-imob-session-v3',
      'crm-imob-session-v2',
      'crm-imob-session-v1',
      'supabase.auth.token'
    ];
    keysToRemove.forEach((k) => {
      try { window.localStorage.removeItem(k); } catch {}
      try { window.sessionStorage.removeItem(k); } catch {}
    });

    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && (key.includes('crm-imob-session') || (key.startsWith('sb-') && key.endsWith('-auth-token')) || key.startsWith('active-tenant-id:') || key.startsWith('local-profile:'))) {
        window.localStorage.removeItem(key);
      }
    }
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const key = window.sessionStorage.key(i);
      if (key && (key.includes('crm-imob-session') || (key.startsWith('sb-') && key.endsWith('-auth-token')) || key.startsWith('active-tenant-id:') || key.startsWith('local-profile:'))) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {}
}

// Limpa tokens residuais antigos do localStorage na inicialização para garantir
// que o navegador dependa exclusivamente do ciclo de vida do sessionStorage
if (typeof window !== 'undefined') {
  try {
    const legacyKeys = [
      'crm-imob-session-v4',
      'crm-imob-session-v3',
      'crm-imob-session-v2',
      'crm-imob-session-v1',
      'supabase.auth.token'
    ];
    legacyKeys.forEach((k) => {
      try { window.localStorage.removeItem(k); } catch {}
    });
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && (key.includes('crm-imob-session') || (key.startsWith('sb-') && key.endsWith('-auth-token')))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {}
}

// Intercept harmless and expected token refresh errors in browser
if (typeof window !== 'undefined') {
  // 1. Filter out known "Invalid Refresh Token" from console.error so it doesn't crash the UI or trigger false alarm error overlays
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: any[]) => {
    const errorText = args
      .map((arg) => {
        if (!arg) return '';
        if (typeof arg === 'string') return arg;
        if (arg?.message) return String(arg.message);
        if (arg?.error_description) return String(arg.error_description);
        try { return JSON.stringify(arg); } catch { return String(arg); }
      })
      .join(' ');

    const lower = errorText.toLowerCase();
    if (
      lower.includes('invalid refresh token') ||
      lower.includes('refresh token not found') ||
      lower.includes('refresh_token_not_found')
    ) {
      console.warn('[Supabase Auth] Sessão expirada ou refresh token inválido detectado. Limpando credenciais locais...', errorText);
      clearAuthSession();
      window.dispatchEvent(new CustomEvent('app-session-expired'));
      return;
    }

    originalConsoleError(...args);
  };

  // 2. Catch unhandled promise rejections related to expired refresh tokens
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (
      reason?.message ||
      reason?.error_description ||
      (typeof reason === 'string' ? reason : '') ||
      ''
    ).toLowerCase();

    if (
      msg.includes('invalid refresh token') ||
      msg.includes('refresh token not found') ||
      msg.includes('refresh_token_not_found')
    ) {
      event.preventDefault();
      console.warn('[Supabase Auth] Rejeição não tratada de refresh token expirado interceptada com segurança.');
      clearAuthSession();
      window.dispatchEvent(new CustomEvent('app-session-expired'));
    }
  });
}

const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {}
  }
};

export const supabase = createClient(
  supabaseUrl || "", 
  supabaseAnonKey || "",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: AUTH_STORAGE_KEY, 
      storage: safeStorage,
    },
    realtime: {
      params: {
        events_per_second: 10
      }
    },
    global: {
      headers: { 'x-application-name': 'crm-imobiliario' }
    }
  }
);
