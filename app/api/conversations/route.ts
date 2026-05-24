import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || "";

function getSupabase(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');

  if (supabaseServiceKey) {
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    return createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers },
      auth: { persistSession: false }
    });
  }

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

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');
    const category = searchParams.get('category');
    const id = searchParams.get('id');

    // Get current authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    // Resolve tenant ID visually active inside user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();
    const activeTenantId = profile?.tenant_id;

    if (id) {
      let query = supabase.from('conversations').select('*').eq('id', id);
      if (activeTenantId) {
        query = query.eq('tenant_id', activeTenantId);
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return NextResponse.json(data);
    }

    let query = supabase.from('conversations').select('*').order('last_message_at', { ascending: false });
    
    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    if (ownerId) {
      query = query.contains('participants', [ownerId]);
    }
    
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("[API/Conversations] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json();
    
    // Resolve active tenant of the user to securely assign it
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();
    
    if (profile?.tenant_id) {
      data.tenant_id = profile.tenant_id;
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
    const { searchParams = new URL(req.url).searchParams } = new URL(req.url); // Use searchParams fallback
    const id = searchParams.get('id');
    if (!id) throw new Error("ID required");

    const data = await req.json();

    // Secure multi-tenant check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();
    const activeTenantId = profile?.tenant_id;

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

    // Secure multi-tenant check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();
    const activeTenantId = profile?.tenant_id;

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

