import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || '';

export interface ServerAuthUser {
  id: string;
  email?: string;
  role?: string;
}

// In-memory tenant cache to avoid redundant profile queries during parallel API calls
// Map: userId -> { tenantId: string | null, expiresAt: number }
const tenantCache = new Map<string, { tenantId: string | null; expiresAt: number }>();

export function invalidateTenantCache(userId?: string) {
  if (userId) {
    tenantCache.delete(userId);
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
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode base64url payload
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    // Validate expiration
    if (payload.exp && typeof payload.exp === 'number') {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp < nowInSeconds) {
        return null;
      }
    }

    if (!payload.sub) return null;

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
  } catch (err) {
    return null;
  }
}

/**
 * Resolves the active tenant ID for the user.
 * Employs a 30-second in-memory cache to deduplicate simultaneous requests.
 */
export async function getActiveTenantId(supabase: any, user: ServerAuthUser | null): Promise<string | null> {
  if (!user?.id) return null;

  const now = Date.now();
  const cached = tenantCache.get(user.id);
  if (cached && cached.expiresAt > now) {
    return cached.tenantId;
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();

    const tenantId = profile?.tenant_id || null;
    tenantCache.set(user.id, { tenantId, expiresAt: now + 30000 }); // 30 seconds
    return tenantId;
  } catch (err) {
    return null;
  }
}
