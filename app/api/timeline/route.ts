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
    const category = searchParams.get('category');
    const relatedId = searchParams.get('relatedId');
    const ownerId = searchParams.get('ownerId');

    if (!category || !relatedId) {
      throw new Error("Category and relatedId are required");
    }

    let query = supabase.from('timeline')
      .select('*')
      .eq('category', category)
      .eq('related_id', relatedId)
      .order('created_at', { ascending: false });
    
    if (ownerId && ownerId !== 'undefined') {
      query = query.eq('owner_id', ownerId);
    }

    const { data: timeline, error } = await query;

    if (error) throw error;
    if (!timeline) return NextResponse.json([]);

    const items = timeline.map((item: any) => ({
      id: item.id,
      type: item.type,
      category: item.category,
      relatedId: item.related_id,
      content: item.content,
      title: item.title,
      authorName: item.author_name,
      ownerId: item.owner_id,
      createdBy: item.created_by,
      metadata: item.metadata,
      createdAt: item.created_at
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("[API/Timeline] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json();
    
    const { data: result, error } = await supabase
      .from('timeline')
      .insert([data])
      .select();

    if (error) throw error;
    if (!result || result.length === 0) throw new Error("Failed to create timeline event");

    return NextResponse.json({ id: result[0].id });
  } catch (error: any) {
    console.error("[API/Timeline] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
