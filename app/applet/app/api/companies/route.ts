import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';
import { DEFAULT_TENANT_ID } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');
    const tenantParam = searchParams.get('tenantId');
    const id = searchParams.get('id');

    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);
    const effectiveTenantId = tenantParam || activeTenantId;

    if (id) {
        let singleQuery = supabase.from('companies').select('*').eq('id', id);
        if (effectiveTenantId) {
          singleQuery = singleQuery.eq('tenant_id', effectiveTenantId);
        }
        const { data, error } = await singleQuery.maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json(null);
        return NextResponse.json({
            id: data.id,
            name: data.name,
            industry: data.industry,
            website: data.website,
            ownerId: data.owner_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        });
    }

    let query = supabase.from('companies').select('*').order('name', { ascending: true });
    if (effectiveTenantId && effectiveTenantId !== 'undefined') {
      query = query.eq('tenant_id', effectiveTenantId);
    } else if (ownerId && ownerId !== 'undefined') {
      query = query.eq('owner_id', ownerId);
    }

    const { data: companies, error } = await query;

    if (error) throw error;
    if (!companies) return NextResponse.json([]);

    const items = companies.map((item: any) => ({
      id: item.id,
      name: item.name,
      industry: item.industry,
      website: item.website,
      ownerId: item.owner_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("[API/Companies] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json();
    
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    const insertData: any = { ...data };
    if (data.tenantId && !data.tenant_id) {
      insertData.tenant_id = data.tenantId;
      delete insertData.tenantId;
    }

    if (!insertData.tenant_id && activeTenantId) {
      insertData.tenant_id = activeTenantId;
    }

    const { data: result, error } = await supabase
      .from('companies')
      .insert([insertData])
      .select();

    if (error) throw error;
    if (!result || result.length === 0) throw new Error("Failed to create company");

    return NextResponse.json({ id: result[0].id });
  } catch (error: any) {
    console.error("[API/Companies] POST Error:", error);
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

    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    const data = await req.json();

    let query = supabase
      .from('companies')
      .update(data)
      .eq('id', id);

    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Companies] PATCH Error:", error);
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

    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    let query = supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Companies] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
