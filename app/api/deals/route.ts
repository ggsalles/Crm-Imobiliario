import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const ownerId = searchParams.get('ownerId');
    const contactId = searchParams.get('contactId');

    if (id && id !== 'undefined' && id !== 'null') {
      const { data: item, error } = await supabase.from('deals').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!item) return NextResponse.json(null);
      return NextResponse.json({
        id: item.id,
        title: item.title === 'EM CONSTRUÇÃO' ? 'Em Construção' : item.title,
        value: Number(item.value || 0),
        stage: item.stage,
        probability: item.probability,
        status: item.status,
        companyId: item.company_id,
        contactId: item.contact_id,
        propertyId: item.property_id,
        expectedCloseDate: item.expected_close_date,
        priority: item.priority,
        ownerId: item.owner_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      });
    }

    let query = supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (ownerId && ownerId !== 'undefined') {
      query = query.eq('owner_id', ownerId);
    }
    
    if (contactId && contactId !== 'undefined') {
      query = query.eq('contact_id', contactId);
    }

    const { data: deals, error } = await query;
    console.log(`[API/Deals] GET: query returned ${deals?.length || 0} deals`);

    if (error) {
      console.error("[API/Deals] query error:", error);
      throw error;
    }
    if (!deals) return NextResponse.json([]);

    const items = deals.map((item: any) => ({
      id: item.id,
      title: item.title === 'EM CONSTRUÇÃO' ? 'Em Construção' : item.title,
      value: Number(item.value || 0),
      stage: item.stage,
      probability: item.probability,
      status: item.status,
      companyId: item.company_id,
      contactId: item.contact_id,
      propertyId: item.property_id,
      expectedCloseDate: item.expected_close_date,
      priority: item.priority,
      ownerId: item.owner_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("[API/Deals] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json();
    
    // Sanitize body data UUIDs
    const sanitizeId = (val: any) => (val && val !== 'undefined' && val !== 'null') ? val : null;
    if (data.company_id !== undefined) data.company_id = sanitizeId(data.company_id);
    if (data.contact_id !== undefined) data.contact_id = sanitizeId(data.contact_id);
    if (data.property_id !== undefined) data.property_id = sanitizeId(data.property_id);
    if (data.owner_id !== undefined) data.owner_id = sanitizeId(data.owner_id);

    const { data: result, error } = await supabase
      .from('deals')
      .insert([data])
      .select();

    if (error) throw error;
    if (!result || result.length === 0) throw new Error("Failed to create deal");

    return NextResponse.json({ id: result[0].id });
  } catch (error: any) {
    console.error("[API/Deals] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "Valid ID required" }, { status: 400 });
    }

    const data = await req.json();

    // Sanitize body data UUIDs
    const sanitizeId = (val: any) => (val && val !== 'undefined' && val !== 'null') ? val : null;
    if (data.company_id !== undefined) data.company_id = sanitizeId(data.company_id);
    if (data.contact_id !== undefined) data.contact_id = sanitizeId(data.contact_id);
    if (data.property_id !== undefined) data.property_id = sanitizeId(data.property_id);
    if (data.owner_id !== undefined) data.owner_id = sanitizeId(data.owner_id);

    const { error } = await supabase
      .from('deals')
      .update(data)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Deals] PATCH Error:", error);
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
      .from('deals')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Deals] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
