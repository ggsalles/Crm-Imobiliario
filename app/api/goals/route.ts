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
    const activeTenantId = await getActiveTenantId(supabase, user, req);

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
        revenue: Number(item.revenue || item.stage_goals?.closed || 0),
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
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    const cleanMonth = String(data.month || "").split('_')[0] || new Date().toISOString().substring(0, 7);
    const ownerId = data.owner_id || user?.id;

    if (!ownerId) {
      return NextResponse.json({ error: "Missing owner_id" }, { status: 400 });
    }

    const payload: any = {
      owner_id: ownerId,
      month: cleanMonth,
      stage_goals: data.stage_goals || {},
      updated_at: new Date().toISOString()
    };

    if (activeTenantId) {
      payload.tenant_id = activeTenantId;
    }

    // Check if goal already exists for this owner and month
    let checkQuery = supabase
      .from('goals')
      .select('id, month')
      .eq('owner_id', ownerId);

    if (activeTenantId) {
      checkQuery = checkQuery.eq('tenant_id', activeTenantId);
    }

    const { data: existingList, error: checkErr } = await checkQuery;
    if (checkErr) {
      console.warn("[API/Goals] check error:", checkErr);
    }

    const existingGoal = existingList?.find((g: any) => (g.month || "").startsWith(cleanMonth));

    if (existingGoal?.id) {
      console.log(`[API/Goals] Atualizando meta existente ID: ${existingGoal.id} para mês ${cleanMonth}`);
      let { error: updateErr } = await supabase
        .from('goals')
        .update(payload)
        .eq('id', existingGoal.id);

      if (updateErr) {
        console.error("[API/Goals] update error:", updateErr);
        throw updateErr;
      }
      return NextResponse.json({ id: existingGoal.id, success: true });
    } else {
      console.log(`[API/Goals] Inserindo nova meta para mês ${cleanMonth}`);
      let { data: inserted, error: insertErr } = await supabase
        .from('goals')
        .insert([payload])
        .select();

      if (insertErr) {
        console.error("[API/Goals] insert error:", insertErr);
        throw insertErr;
      }

      return NextResponse.json({ id: inserted?.[0]?.id, success: true });
    }
  } catch (error: any) {
    console.error("[API/Goals] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
