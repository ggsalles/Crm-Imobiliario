import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const activeTenantId = await getActiveTenantId(supabase, user);

    if (id) {
      let query = supabase.from('conversations').select('*').eq('id', id);
      if (activeTenantId) {
        query = query.eq('tenant_id', activeTenantId);
      }
      const { data: item, error } = await query.maybeSingle();
      if (error) throw error;
      if (!item) return NextResponse.json(null);

      const participants = Array.isArray(item.participants) 
        ? item.participants 
        : (item.contact_id ? [item.owner_id, item.contact_id].filter(Boolean) : []);
      const participantDetails = item.participant_details || item.participantDetails || {};

      return NextResponse.json({
        ...item,
        participants,
        participant_details: participantDetails,
        participantDetails,
        lastMessage: item.last_message,
        lastMessageAt: item.last_message_at,
        unreadCount: item.unread_count || {},
        unread_count: item.unread_count || {},
      });
    }

    let query = supabase.from('conversations').select('*').order('last_message_at', { ascending: false });

    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
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

    const data = (rawData || []).map((item: any) => {
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
        unread_count: item.unread_count || {},
        unreadCount: item.unread_count || {},
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
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API/Conversations] GET Error:", error);
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
      .from('conversations')
      .insert([data])
      .select();

    if (error) throw error;
    return NextResponse.json({ id: result[0].id });
  } catch (error: any) {
    console.error("[API/Conversations] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams = new URL(req.url).searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) throw new Error("ID required");

    const data = await req.json();

    // Secure multi-tenant check (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const activeTenantId = await getActiveTenantId(supabase, user);

    let query = supabase.from('conversations').update(data).eq('id', id);
    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    const { error } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Conversations] PATCH Error:", error);
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

    // Clear messages first due to foreign key constraints if any
    let deleteMessagesQuery = supabase.from('messages').delete().eq('conversation_id', id);
    if (activeTenantId) {
      deleteMessagesQuery = deleteMessagesQuery.eq('tenant_id', activeTenantId);
    }
    await deleteMessagesQuery;

    let deleteConvQuery = supabase.from('conversations').delete().eq('id', id);
    if (activeTenantId) {
      deleteConvQuery = deleteConvQuery.eq('tenant_id', activeTenantId);
    }
    const { error } = await deleteConvQuery;

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Conversations] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
