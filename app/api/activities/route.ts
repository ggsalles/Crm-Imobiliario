import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

const ACTIVITY_SELECT_COLUMNS = 'id, tenant_id, title, description, date, type, status, contact_id, deal_id, owner_id, created_at, updated_at';

interface ActivitiesCacheEntry {
  data: any[];
  timestamp: number;
}
const serverActivitiesCache = new Map<string, ActivitiesCacheEntry>();
const CACHE_TTL_MS = 60000; // 60s in-memory server cache to optimize Supabase Free tier egress

export function invalidateServerActivitiesCache() {
  serverActivitiesCache.clear();
}

function toDbStatus(status?: string): string {
  if (!status) return 'pendente';
  const s = status.toLowerCase().trim();
  if (s === 'completed' || s === 'concluida' || s === 'concluída') return 'concluida';
  if (s === 'cancelled' || s === 'cancelada') return 'cancelada';
  return 'pendente';
}

function toAppStatus(status?: string): 'pending' | 'completed' | 'cancelled' {
  if (!status) return 'pending';
  const s = status.toLowerCase().trim();
  if (s === 'concluida' || s === 'concluída' || s === 'completed') return 'completed';
  if (s === 'cancelada' || s === 'cancelled') return 'cancelled';
  return 'pending';
}

function formatActivityDbRow(item: any) {
  return {
    id: item.id,
    title: item.title,
    description: item.description || undefined,
    date: item.date,
    type: item.type || 'task',
    status: toAppStatus(item.status),
    contactId: item.contact_id || undefined,
    dealId: item.deal_id || undefined,
    ownerId: item.owner_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');
    const contactId = searchParams.get('contactId');

    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    const cacheKey = `${activeTenantId || 'default'}:${ownerId || 'all'}:${contactId || 'all'}`;
    const cached = serverActivitiesCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return NextResponse.json(cached.data, { headers: NO_CACHE_HEADERS });
    }

    let query = supabase.from('activities').select(ACTIVITY_SELECT_COLUMNS).order('date', { ascending: true });
    
    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    if (ownerId && ownerId !== 'undefined') {
      query = query.eq('owner_id', ownerId);
    }
    
    if (contactId && contactId !== 'undefined') {
      query = query.eq('contact_id', contactId);
    }

    const { data: activities, error } = await query;

    if (error) throw error;
    if (!activities) return NextResponse.json([], { headers: NO_CACHE_HEADERS });

    const items = activities.map(formatActivityDbRow);
    serverActivitiesCache.set(cacheKey, { data: items, timestamp: now });

    return NextResponse.json(items, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Activities] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json().catch(() => ({}));
    
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);
    if (activeTenantId) {
      data.tenant_id = activeTenantId;
    }

    if (!data.owner_id && user?.id) {
      data.owner_id = user.id;
    }

    // Convert frontend status ('pending', 'completed', 'cancelled') to DB allowed values ('pendente', 'concluida', 'cancelada')
    data.status = toDbStatus(data.status);

    // Sanitize optional UUID relations to avoid empty-string uuid violations
    if (data.contact_id === "" || data.contactId === "") data.contact_id = null;
    if (data.deal_id === "" || data.dealId === "") data.deal_id = null;
    if (data.contactId && !data.contact_id) data.contact_id = data.contactId;
    if (data.dealId && !data.deal_id) data.deal_id = data.dealId;
    delete data.contactId;
    delete data.dealId;

    // Safeguard 1: Prevent scheduling new pending appointments in the past
    if (data.date && data.status === 'pendente') {
      const activityTime = new Date(data.date).getTime();
      const nowWithGrace = Date.now() - 2 * 60 * 1000; // 2 min grace period for clock drift
      if (activityTime < nowWithGrace) {
        return NextResponse.json(
          { error: "Não é possível agendar um compromisso com data ou horário no passado." },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
    }

    // Safeguard 2: Anti-duplicate check (rapid double clicks within 10 seconds)
    if (data.owner_id && data.title) {
      const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
      const { data: recentDuplicate } = await supabase
        .from('activities')
        .select(ACTIVITY_SELECT_COLUMNS)
        .eq('owner_id', data.owner_id)
        .eq('title', data.title)
        .gte('created_at', tenSecondsAgo)
        .limit(1);

      if (recentDuplicate && recentDuplicate.length > 0) {
        console.warn("[API/Activities] Prevented rapid duplicate activity insertion:", recentDuplicate[0].id);
        const dupItem = formatActivityDbRow(recentDuplicate[0]);
        return NextResponse.json({ success: true, id: recentDuplicate[0].id, activity: dupItem }, { headers: NO_CACHE_HEADERS });
      }
    }

    const { data: result, error } = await supabase
      .from('activities')
      .insert([data])
      .select(ACTIVITY_SELECT_COLUMNS);

    if (error) throw error;
    if (!result || result.length === 0) throw new Error("Failed to create activity");

    invalidateServerActivitiesCache();

    const createdActivity = formatActivityDbRow(result[0]);
    return NextResponse.json({ 
      success: true, 
      id: result[0].id, 
      activity: createdActivity 
    }, { status: 201, headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Activities] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) throw new Error("ID required");

    const data = await req.json().catch(() => ({}));
    data.updated_at = new Date().toISOString();

    if (data.status !== undefined) {
      data.status = toDbStatus(data.status);
    }
    if (data.contact_id === "" || data.contactId === "") data.contact_id = null;
    if (data.deal_id === "" || data.dealId === "") data.deal_id = null;
    if (data.contactId && !data.contact_id) data.contact_id = data.contactId;
    if (data.dealId && !data.deal_id) data.deal_id = data.dealId;
    delete data.contactId;
    delete data.dealId;

    const { data: updated, error } = await supabase
      .from('activities')
      .update(data)
      .eq('id', id)
      .select(ACTIVITY_SELECT_COLUMNS);

    if (error) throw error;

    invalidateServerActivitiesCache();

    const updatedActivity = updated && updated.length > 0 ? formatActivityDbRow(updated[0]) : null;

    return NextResponse.json({ 
      success: true, 
      activity: updatedActivity 
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Activities] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) throw new Error("ID required");

    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id);

    if (error) throw error;

    invalidateServerActivitiesCache();

    return NextResponse.json({ success: true, id }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Activities] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
