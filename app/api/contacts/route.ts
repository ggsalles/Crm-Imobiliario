import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');
    const id = searchParams.get('id');

    // Fetch active tenant from profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user);

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
            role: data.type === 'equipe' ? data.role : "",
            temperature: data.type === 'cliente' ? (data.role || 'morno') : undefined,
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
      role: item.type === 'equipe' ? item.role : "",
      temperature: item.type === 'cliente' ? (item.role || 'morno') : undefined,
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
    
    // Map temperature to role for database storing
    if (data.type === 'cliente' && data.temperature) {
      data.role = data.temperature;
    }
    delete data.temperature;
    
    // Fetch active tenant from profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user);
    if (activeTenantId) {
      data.tenant_id = activeTenantId;
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

    // Map temperature to role for database updates
    if (data.temperature !== undefined) {
      data.role = data.temperature;
      delete data.temperature;
    }

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
