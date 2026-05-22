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
    const id = searchParams.get('id');

    // Fetch active tenant from profile as a software isolation safeguard
    const { data: { user } } = await supabase.auth.getUser();
    let activeTenantId: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.tenant_id) {
        activeTenantId = profile.tenant_id;
      }
    }

    if (id && id !== 'undefined' && id !== 'null') {
        let singleQuery = supabase.from('contacts').select('*').eq('id', id);
        if (activeTenantId) {
          singleQuery = singleQuery.eq('tenant_id', activeTenantId);
        }
        const { data, error } = await singleQuery.maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json(null);
        return NextResponse.json({
            id: data.id,
            name: data.name,
            role: data.role,
            email: data.email,
            phone: data.phone,
            type: data.type,
            department: data.department,
            companyId: data.company_id,
            source: data.source,
            ownerId: data.owner_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        });
    }

    let query = supabase.from('contacts').select('*').order('name', { ascending: true });
    
    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    if (ownerId && ownerId !== 'undefined') {
      query = query.eq('owner_id', ownerId);
    }

    const { data: contacts, error } = await query;
    console.log(`[API/Contacts] GET: query returned ${contacts?.length || 0} contacts for tenant ${activeTenantId}`);

    if (error) {
      console.error("[API/Contacts] query error:", error);
      throw error;
    }
    if (!contacts) return NextResponse.json([]);

    const items = contacts.map((item: any) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      email: item.email,
      phone: item.phone,
      type: item.type,
      department: item.department,
      companyId: item.company_id,
      source: item.source,
      ownerId: item.owner_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("[API/Contacts] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json();
    
    // Fetch active tenant from profile as a software isolation safeguard
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.tenant_id) {
        data.tenant_id = profile.tenant_id;
      }
    }

    const { data: result, error } = await supabase
      .from('contacts')
      .insert([data])
      .select();

    if (error) throw error;
    if (!result || result.length === 0) throw new Error("Failed to create contact");

    return NextResponse.json({ id: result[0].id });
  } catch (error: any) {
    console.error("[API/Contacts] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "Valid ID required for PATCH" }, { status: 400 });
    }

    const data = await req.json();

    const { error } = await supabase
      .from('contacts')
      .update(data)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Contacts] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "Valid ID required for DELETE" }, { status: 400 });
    }

    // Using .select() to confirm deletion as in original db.ts
    const { data, error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) throw new Error("No contact was deleted.");

    return NextResponse.json({ success: true, deleted: data[0] });
  } catch (error: any) {
    console.error("[API/Contacts] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
