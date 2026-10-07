import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const relatedId = searchParams.get('relatedId');
    const ownerId = searchParams.get('ownerId');

    // If neither is supplied, return empty list safely
    if (!relatedId && !category) {
      return NextResponse.json([]);
    }

    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    let query = supabase.from('timeline')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    if (category && category !== 'undefined' && category !== 'all') {
      query = query.eq('category', category);
    }
    if (relatedId && relatedId !== 'undefined' && relatedId !== 'all') {
      query = query.eq('related_id', relatedId);
    }
    if (ownerId && ownerId !== 'undefined' && ownerId !== 'null') {
      query = query.eq('owner_id', ownerId);
    }

    const { data: timeline, error } = await query;

    if (error) {
      console.warn("[API/Timeline] Supabase query error:", error);
      return NextResponse.json([]);
    }
    
    if (!timeline) return NextResponse.json([]);

    const items = timeline.map((item: any) => ({
      id: item.id,
      type: item.type || 'note',
      category: item.category || 'deal',
      relatedId: item.related_id,
      content: item.content || '',
      title: item.title || '',
      authorName: item.author_name || 'Usuário',
      ownerId: item.owner_id,
      createdBy: item.created_by,
      metadata: item.metadata || {},
      createdAt: item.created_at
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("[API/Timeline] GET Error:", error);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);
    const data = await req.json().catch(() => ({}));

    const authorName = data.author_name || data.authorName || user?.email || 'Sistema';
    const userId = user?.id || data.owner_id || data.created_by || null;

    const payload: Record<string, any> = {
      type: data.type || 'note',
      category: data.category || 'deal',
      related_id: data.related_id || data.relatedId,
      content: data.content || '',
      title: data.title || '',
      author_name: authorName,
      owner_id: data.owner_id || userId,
      created_by: data.created_by || userId,
      metadata: data.metadata || {}
    };

    if (activeTenantId) {
      payload.tenant_id = activeTenantId;
    }

    const { data: result, error } = await supabase
      .from('timeline')
      .insert([payload])
      .select('id');

    if (error) {
      console.error("[API/Timeline] Insert error:", error);
      throw error;
    }
    
    const newId = result && result.length > 0 ? result[0].id : `temp-${Date.now()}`;
    return NextResponse.json({ id: newId, success: true });
  } catch (error: any) {
    console.error("[API/Timeline] POST Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to create timeline item" }, { status: 500 });
  }
}
