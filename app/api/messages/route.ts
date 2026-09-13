import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) throw new Error("conversationId required");

    // Get current authenticated user (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const activeTenantId = await getActiveTenantId(supabase, user);

    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId);

    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    const { data: messages, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json(messages || []);
  } catch (error: any) {
    console.error("[API/Messages] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json();
    
    // Resolve active tenant of the user to securely assign it (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const activeTenantId = await getActiveTenantId(supabase, user);
    if (activeTenantId) {
      data.tenant_id = activeTenantId;
    }

    const { data: result, error } = await supabase
      .from('messages')
      .insert([data])
      .select();

    if (error) throw error;
    return NextResponse.json({ id: result[0].id });
  } catch (error: any) {
    console.error("[API/Messages] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) throw new Error("ID required");

    // Secure multi-tenant check (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const activeTenantId = await getActiveTenantId(supabase, user);

    let query = supabase.from('messages').delete().eq('id', id);
    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }
    const { error } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Messages] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
