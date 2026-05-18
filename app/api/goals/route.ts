import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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
    const ownerId = searchParams.get('ownerId');

    let query = supabase.from('goals').select('*').order('month', { ascending: false });
    if (ownerId && ownerId !== 'undefined') {
      query = query.eq('owner_id', ownerId);
    }

    const { data: goals, error } = await query;
    console.log(`[API/Goals] GET: query returned ${goals?.length || 0} goals`);

    if (error) {
      console.error("[API/Goals] query error:", error);
      throw error;
    }
    if (!goals) return NextResponse.json([]);

    const items = goals.map((item: any) => ({
      id: item.id,
      month: item.month,
      revenue: item.revenue,
      stageGoals: item.stage_goals,
      ownerId: item.owner_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("[API/Goals] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json();
    
    const { data: result, error } = await supabase
      .from('goals')
      .upsert(data)
      .select();

    if (error) throw error;
    if (!result || result.length === 0) throw new Error("Failed to set goal");

    return NextResponse.json({ id: result[0].id });
  } catch (error: any) {
    console.error("[API/Goals] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
