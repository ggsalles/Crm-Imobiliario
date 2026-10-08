import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

const MESSAGE_SELECT_COLUMNS = '*';

// Server-side cache em memória para limitar leituras repetidas ao Supabase
interface ServerMessageCacheEntry {
  data: any[];
  timestamp: number;
}
const serverMessageCache = new Map<string, ServerMessageCacheEntry>();
const CACHE_TTL_MS = 10000; // 10 segundos

export function invalidateServerMessagesCache(conversationId?: string) {
  if (conversationId) {
    for (const key of serverMessageCache.keys()) {
      if (key.includes(conversationId)) {
        serverMessageCache.delete(key);
      }
    }
  } else {
    serverMessageCache.clear();
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    // Get current authenticated user (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const activeTenantId = await getActiveTenantId(supabase, user, req);
    const cacheKey = `messages:${activeTenantId || 'default'}:${conversationId}`;

    const cached = serverMessageCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return NextResponse.json(cached.data, { headers: NO_CACHE_HEADERS });
    }

    let query = supabase
      .from('messages')
      .select(MESSAGE_SELECT_COLUMNS)
      .eq('conversation_id', conversationId);

    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    const { data: messages, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;
    
    const formatted = messages || [];
    serverMessageCache.set(cacheKey, { data: formatted, timestamp: Date.now() });

    return NextResponse.json(formatted, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Messages] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json().catch(() => ({}));
    
    // Resolve active tenant of the user to securely assign it (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const activeTenantId = await getActiveTenantId(supabase, user, req);
    if (activeTenantId) {
      data.tenant_id = activeTenantId;
    }

    if (!data.created_at) {
      data.created_at = new Date().toISOString();
    }

    const { data: result, error } = await supabase
      .from('messages')
      .insert([data])
      .select(MESSAGE_SELECT_COLUMNS);

    if (error) throw error;

    const insertedMsg = result && result[0] ? result[0] : { ...data, id: Date.now().toString() };

    invalidateServerMessagesCache(data.conversation_id);

    return NextResponse.json(insertedMsg, { status: 201, headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Messages] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    // Secure multi-tenant check (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const activeTenantId = await getActiveTenantId(supabase, user, req);

    let query = supabase.from('messages').delete().eq('id', id);
    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }
    const { error } = await query;

    if (error) throw error;

    invalidateServerMessagesCache();

    return NextResponse.json({ success: true }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Messages] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
