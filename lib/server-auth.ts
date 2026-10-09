import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_TENANT_ID, isPlatformAdmin } from '@/lib/constants';
import { safeJsonParse } from '@/lib/safe-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from '@/lib/supabase-config';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;
const supabaseServiceKey = SUPABASE_SERVICE_ROLE_KEY;

export interface ServerAuthUser {
  id: string;
  email?: string;
  role?: string;
}

// In-memory tenant cache to avoid redundant profile queries during parallel API calls
// Map: cacheKey -> { tenantId: string | null, expiresAt: number }
const tenantCache = new Map<string, { tenantId: string | null; expiresAt: number }>();

export function invalidateTenantCache(userId?: string) {
  if (userId) {
    for (const key of tenantCache.keys()) {
      if (key.startsWith(userId)) {
        tenantCache.delete(key);
      }
    }
  } else {
    tenantCache.clear();
  }
}

/**
 * Returns a configured Supabase client for Server Route Handlers.
 */
export function getSupabase(req: NextRequest) {
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
}

/**
 * Fast in-process JWT validation and user payload extraction.
 * Avoids HTTP roundtrip requests to Supabase Auth endpoint (/auth/v1/user),
 * preventing rate limit errors (HTTP 429) and removing 200-500ms latency per request.
 */
export function getAuthenticatedUser(req: NextRequest): ServerAuthUser | null {
  const authHeader = req.headers.get('Authorization');
  let token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7).trim() : '';

  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        // Decode base64url payload
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const payload = safeJsonParse<any>(payloadJson);
        if (payload?.sub) {
          return {
            id: payload.sub,
            email: payload.email || payload.user_metadata?.email,
            role: payload.role || payload.user_metadata?.role
          };
        }
      }
    } catch (err) {
      // Continue to header fallback
    }
  }

  // Fallback to custom headers
  const xUserId = req.headers.get('x-user-id');
  const xUserEmail = req.headers.get('x-user-email');
  if (xUserId && xUserId.trim() && xUserId !== 'undefined' && xUserId !== 'null') {
    return {
      id: xUserId.trim(),
      email: xUserEmail?.trim() || undefined,
    };
  }

  return null;
}

/**
 * Resolves the active tenant ID for the user.
 * Supports x-tenant-id header, URL search params, and intelligent multi-tenant fallback.
 */
export async function getActiveTenantId(
  supabase: any, 
  user: ServerAuthUser | null, 
  req?: NextRequest
): Promise<string | null> {
  if (!user?.id) return null;

  // 1. Extrai tenant solicitado via Header ou Query Param
  let requestedTenantId: string | null = null;
  if (req) {
    const headerTenant = req.headers.get('x-tenant-id');
    if (headerTenant && headerTenant !== 'undefined' && headerTenant !== 'null' && headerTenant !== 'all') {
      requestedTenantId = headerTenant;
    } else {
      try {
        const url = new URL(req.url);
        const qTenant = url.searchParams.get('tenantId') || url.searchParams.get('tenant');
        if (qTenant && qTenant !== 'undefined' && qTenant !== 'null' && qTenant !== 'all') {
          requestedTenantId = qTenant;
        }
      } catch (e) {}
    }
  }

  const callerIsMaster = user.email ? isPlatformAdmin(user.email) : false;
  if (callerIsMaster && requestedTenantId && requestedTenantId !== DEFAULT_TENANT_ID) {
    return requestedTenantId;
  }

  const now = Date.now();
  const cacheKey = `${user.id}:${requestedTenantId || 'auto'}`;
  const cached = tenantCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.tenantId;
  }

  try {
    // 2. Consulta o perfil principal
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();

    // 3. Consulta associações multi-tenant
    const { data: assocs } = await supabase
      .from('profile_tenants')
      .select('tenant_id')
      .eq('profile_id', user.id);

    const allowedTenantIds = new Set<string>();
    if (profile?.tenant_id) allowedTenantIds.add(profile.tenant_id);
    if (assocs && Array.isArray(assocs)) {
      assocs.forEach((a: any) => {
        if (a.tenant_id) allowedTenantIds.add(a.tenant_id);
      });
    }

    // 4. Consulta se o usuário é proprietário/contato de alguma imobiliária
    if (user.email) {
      const { data: ownedTenants } = await supabase
        .from('tenants')
        .select('id')
        .eq('contact_email', user.email.toLowerCase());
      if (ownedTenants && Array.isArray(ownedTenants)) {
        ownedTenants.forEach((t: any) => {
          if (t.id) allowedTenantIds.add(t.id);
        });
      }
    }

    // Se o inquilino solicitado é válido e permitido para este usuário:
    if (requestedTenantId && (allowedTenantIds.has(requestedTenantId) || callerIsMaster)) {
      tenantCache.set(cacheKey, { tenantId: requestedTenantId, expiresAt: now + 30000 });
      return requestedTenantId;
    }

    // Se o profile tem tenant_id definido e NÃO é o default genérico, usa-o
    if (profile?.tenant_id && profile.tenant_id !== DEFAULT_TENANT_ID) {
      tenantCache.set(cacheKey, { tenantId: profile.tenant_id, expiresAt: now + 30000 });
      return profile.tenant_id;
    }

    // Se profile.tenant_id é default, mas o usuário pertence a uma imobiliária personalizada, prioriza a personalizada!
    const nonDefaultTenants = Array.from(allowedTenantIds).filter(id => id !== DEFAULT_TENANT_ID);
    if (nonDefaultTenants.length > 0) {
      const preferredTenant = nonDefaultTenants[0];
      tenantCache.set(cacheKey, { tenantId: preferredTenant, expiresAt: now + 30000 });
      return preferredTenant;
    }

    const tenantId = profile?.tenant_id || DEFAULT_TENANT_ID;
    tenantCache.set(cacheKey, { tenantId, expiresAt: now + 30000 });
    return tenantId;
  } catch (err) {
    return null;
  }
}

