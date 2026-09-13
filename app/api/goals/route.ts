import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');

    // Fetch active tenant from user profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user);

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

    // Fetch active tenant from user profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user);

    if (activeTenantId) {
      data.tenant_id = activeTenantId;
      if (data.month && !data.month.includes('_')) {
        data.month = `${data.month}_${activeTenantId}`;
      }
    }

    if (data.id) {
      delete data.id;
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
