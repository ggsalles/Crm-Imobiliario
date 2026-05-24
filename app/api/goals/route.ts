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

    // Fetch active tenant from user profile as a software isolation safeguard
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

    let query = supabase.from('goals').select('*').order('month', { ascending: false });
    if (ownerId && ownerId !== 'undefined') {
      query = query.eq('owner_id', ownerId);
    }
    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    const { data: goals, error } = await query;
    console.log(`[API/Goals] GET: query returned ${goals?.length || 0} goals for tenant: ${activeTenantId}`);

    if (error) {
      console.error("[API/Goals] query error:", error);
      throw error;
    }
    if (!goals) return NextResponse.json([]);

    const items = goals.map((item: any) => {
      let cleanMonth = item.month;
      if (cleanMonth && cleanMonth.includes('_')) {
        cleanMonth = cleanMonth.split('_')[0];
      }
      return {
        id: item.id,
        month: cleanMonth,
        revenue: item.revenue,
        stageGoals: item.stage_goals,
        ownerId: item.owner_id,
        tenantId: item.tenant_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      };
    });

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

    // Fetch active tenant from user profile as a software isolation safeguard
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

    if (activeTenantId) {
      data.tenant_id = activeTenantId;
      if (data.month && !data.month.includes('_')) {
        data.month = `${data.month}_${activeTenantId}`;
      }
    }
    
    const { data: result, error } = await supabase
      .from('goals')
      .upsert(data, { onConflict: 'owner_id,month' })
      .select();

    if (error) throw error;
    if (!result || result.length === 0) throw new Error("Failed to set goal");

    return NextResponse.json({ id: result[0].id });
  } catch (error: any) {
    console.error("[API/Goals] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
