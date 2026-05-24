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
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) throw new Error("conversationId required");

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

