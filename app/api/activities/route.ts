import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');
    const contactId = searchParams.get('contactId');

    // Fetch active tenant from profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user);

    let query = supabase.from('activities').select('*').order('date', { ascending: true });
    
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
    if (!activities) return NextResponse.json([]);

    const items = activities.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      date: item.date,
      type: item.type,
      status: item.status,
      contactId: item.contact_id,
      dealId: item.deal_id,
      ownerId: item.owner_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("[API/Activities] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json();
    
    // Fetch active tenant from profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user);
    if (activeTenantId) {
      data.tenant_id = activeTenantId;
    }

    const { data: result, error } = await supabase
      .from('activities')
      .insert([data])
      .select();

    if (error) throw error;
    if (!result || result.length === 0) throw new Error("Failed to create activity");

    return NextResponse.json({ id: result[0].id });
  } catch (error: any) {
    console.error("[API/Activities] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) throw new Error("ID required");

    const data = await req.json();

    const { error } = await supabase
      .from('activities')
      .update(data)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Activities] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Activities] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
