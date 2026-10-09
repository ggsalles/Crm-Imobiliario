import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';
import { DEFAULT_TENANT_ID } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

const CONVERSATION_SELECT_COLUMNS = '*';

interface ServerConvCacheEntry {
  data: any;
  timestamp: number;
}
const serverConvCache = new Map<string, ServerConvCacheEntry>();
const CACHE_TTL_MS = 15000; // 15 segundos

export function invalidateServerConversationsCache() {
  serverConvCache.clear();
}

function toDbUnreadCount(val: any): number {
  if (typeof val === 'number') return Math.max(0, Math.floor(val));
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
    const values = Object.values(val) as any[];
    return values.reduce((sum, v) => sum + (Number(v) || 0), 0);
  }
  return 0;
}

function parseUnreadCount(val: any, participants?: string[]): Record<string, number> {
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
    return val;
  }
  const count = typeof val === 'number' ? val : (parseInt(val, 10) || 0);
  const result: Record<string, number> = {};
  if (Array.isArray(participants) && participants.length > 0) {
    participants.forEach((pId) => {
      result[pId] = count;
    });
  }
  return result;
}

function formatConversationDbRow(item: any) {
  if (!item) return null;
  const participants = Array.isArray(item.participants) 
    ? item.participants 
    : (item.contact_id ? [item.owner_id, item.contact_id].filter(Boolean) : []);
  const participantDetails = item.participant_details || item.participantDetails || (item.contact_id ? {
    [item.contact_id]: {
      name: item.contact_name || "Contato",
      photoURL: item.contact_avatar || null,
      email: ""
    }
  } : {});

  const unreadCountMap = parseUnreadCount(item.unread_count, participants);

  return {
    id: item.id,
    participants,
    participant_details: participantDetails,
    participantDetails,
    contactId: item.contact_id,
    contactName: item.contact_name,
    contactAvatar: item.contact_avatar,
    last_message: item.last_message,
    lastMessage: item.last_message,
    last_message_at: item.last_message_at,
    lastMessageAt: item.last_message_at,
    unread_count: unreadCountMap,
    unreadCount: unreadCountMap,
    type: item.type || (participants.length > 2 ? 'group' : 'direct'),
    category: item.category || 'client',
    owner_id: item.owner_id,
    ownerId: item.owner_id,
    tenant_id: item.tenant_id,
    tenantId: item.tenant_id,
    created_at: item.created_at,
    createdAt: item.created_at,
    updated_at: item.updated_at,
    updatedAt: item.updated_at
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');
    const category = searchParams.get('category');
    const id = searchParams.get('id');

    // Get current authenticated user (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const activeTenantId = await getActiveTenantId(supabase, user, req);

    if (id) {
      const singleCacheKey = `conv:${activeTenantId || 'default'}:id:${id}`;
      const cachedSingle = serverConvCache.get(singleCacheKey);
      if (cachedSingle && (Date.now() - cachedSingle.timestamp < CACHE_TTL_MS)) {
        return NextResponse.json(cachedSingle.data, { headers: NO_CACHE_HEADERS });
      }

      let query = supabase.from('conversations').select(CONVERSATION_SELECT_COLUMNS).eq('id', id);
      if (activeTenantId) {
        query = query.eq('tenant_id', activeTenantId);
      }
      const { data: item, error } = await query.maybeSingle();
      if (error) throw error;
      if (!item) return NextResponse.json(null, { headers: NO_CACHE_HEADERS });

      const formattedSingle = formatConversationDbRow(item);
      serverConvCache.set(singleCacheKey, { data: formattedSingle, timestamp: Date.now() });

      return NextResponse.json(formattedSingle, { headers: NO_CACHE_HEADERS });
    }

    const listCacheKey = `conv:${activeTenantId || 'default'}:${ownerId || 'all'}:${category || 'all'}`;
    const cachedList = serverConvCache.get(listCacheKey);
    if (cachedList && (Date.now() - cachedList.timestamp < CACHE_TTL_MS)) {
      return NextResponse.json(cachedList.data, { headers: NO_CACHE_HEADERS });
    }

    let query = supabase.from('conversations').select(CONVERSATION_SELECT_COLUMNS).order('last_message_at', { ascending: false });

    if (activeTenantId) {
      if (activeTenantId === DEFAULT_TENANT_ID) {
        query = query.or(`tenant_id.eq.${activeTenantId},tenant_id.is.null`);
      } else {
        query = query.eq('tenant_id', activeTenantId);
      }
    }

    if (ownerId && ownerId !== 'undefined') {
      const sanitizedOwnerId = ownerId.replace(/[^a-zA-Z0-9-]/g, '');
      query = query.or(`owner_id.eq.${sanitizedOwnerId},participants.cs.{"${sanitizedOwnerId}"}`);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data: rawData, error } = await query;
    if (error) throw error;

    const formattedList = (rawData || []).map(formatConversationDbRow);
    serverConvCache.set(listCacheKey, { data: formattedList, timestamp: Date.now() });

    return NextResponse.json(formattedList, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Conversations] GET Error:", error);
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

    if (!data.last_message_at) {
      data.last_message_at = new Date().toISOString();
    }

    // Ensure unread_count is integer for Postgres table compatibility
    data.unread_count = toDbUnreadCount(data.unread_count ?? data.unreadCount);
    delete data.unreadCount;

    const { data: result, error } = await supabase
      .from('conversations')
      .insert([data])
      .select(CONVERSATION_SELECT_COLUMNS);

    if (error) throw error;

    invalidateServerConversationsCache();
    const insertedFormatted = formatConversationDbRow(result && result[0] ? result[0] : { ...data, id: Date.now().toString() });

    return NextResponse.json(insertedFormatted, { status: 201, headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Conversations] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams = new URL(req.url).searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const data = await req.json().catch(() => ({}));

    // Ensure unread_count is integer for Postgres table compatibility if provided
    if (data.unread_count !== undefined || data.unreadCount !== undefined) {
      data.unread_count = toDbUnreadCount(data.unread_count ?? data.unreadCount);
      delete data.unreadCount;
    }

    // Secure multi-tenant check (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const activeTenantId = await getActiveTenantId(supabase, user, req);

    let query = supabase.from('conversations').update(data).eq('id', id).select(CONVERSATION_SELECT_COLUMNS);
    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    const { data: result, error } = await query;

    if (error) throw error;

    invalidateServerConversationsCache();
    const updatedFormatted = formatConversationDbRow(result && result[0] ? result[0] : { id, ...data });

    return NextResponse.json(updatedFormatted, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Conversations] PATCH Error:", error);
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

    // Clear messages first due to foreign key constraints if any
    await supabase.from('messages').delete().eq('conversation_id', id);

    // Delete conversation
    let query = supabase.from('conversations').delete().eq('id', id);
    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }
    const { error } = await query;

    if (error) throw error;

    invalidateServerConversationsCache();

    return NextResponse.json({ success: true }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Conversations] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
