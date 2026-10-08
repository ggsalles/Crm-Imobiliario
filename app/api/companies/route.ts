import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

const COMPANY_SELECT_COLUMNS = 'id, tenant_id, name, industry, website, owner_id, created_at, updated_at';

interface CompaniesCacheEntry {
  data: any[];
  timestamp: number;
}
const serverCompaniesCache = new Map<string, CompaniesCacheEntry>();
const CACHE_TTL_MS = 60000; // 60s in-memory server cache to optimize Supabase Free tier egress

export function invalidateServerCompaniesCache() {
  serverCompaniesCache.clear();
}

function formatCompanyDbRow(item: any) {
  return {
    id: item.id,
    name: item.name,
    industry: item.industry || undefined,
    website: item.website || undefined,
    ownerId: item.owner_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

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
      let singleQuery = supabase.from('companies').select(COMPANY_SELECT_COLUMNS).eq('id', id);
      if (effectiveTenantId) {
        singleQuery = singleQuery.eq('tenant_id', effectiveTenantId);
      }
      const { data, error } = await singleQuery.maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json(null, { headers: NO_CACHE_HEADERS });
      return NextResponse.json(formatCompanyDbRow(data), { headers: NO_CACHE_HEADERS });
    }

    const cacheKey = `${effectiveTenantId || 'default'}:${ownerId || 'all'}`;
    const cached = serverCompaniesCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return NextResponse.json(cached.data, { headers: NO_CACHE_HEADERS });
    }

    let query = supabase.from('companies').select(COMPANY_SELECT_COLUMNS).order('name', { ascending: true });
    if (effectiveTenantId && effectiveTenantId !== 'undefined') {
      query = query.eq('tenant_id', effectiveTenantId);
    } else if (ownerId && ownerId !== 'undefined') {
      query = query.eq('owner_id', ownerId);
    }

    const { data: companies, error } = await query;

    if (error) throw error;
    if (!companies) return NextResponse.json([], { headers: NO_CACHE_HEADERS });

    const items = companies.map(formatCompanyDbRow);
    serverCompaniesCache.set(cacheKey, { data: items, timestamp: now });

    return NextResponse.json(items, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Companies] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json().catch(() => ({}));
    
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    const name = String(data.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: "Nome da empresa é obrigatório." }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const insertData: any = {
      name,
      industry: data.industry ? String(data.industry).trim() : null,
      website: data.website ? String(data.website).trim() : null,
      owner_id: data.owner_id || user?.id || null
    };

    if (data.tenantId && !data.tenant_id) {
      insertData.tenant_id = data.tenantId;
    } else if (data.tenant_id) {
      insertData.tenant_id = data.tenant_id;
    }

    if (!insertData.tenant_id && activeTenantId) {
      insertData.tenant_id = activeTenantId;
    }

    // Salvaguarda: prevenção de inserção duplicada por duplo-clique rápido
    if (insertData.tenant_id) {
      const tenSecAgo = new Date(Date.now() - 10000).toISOString();
      const { data: recentDup } = await supabase
        .from('companies')
        .select(COMPANY_SELECT_COLUMNS)
        .eq('tenant_id', insertData.tenant_id)
        .ilike('name', name)
        .gte('created_at', tenSecAgo)
        .limit(1);

      if (recentDup && recentDup.length > 0) {
        console.warn("[API/Companies] Prevented rapid duplicate company creation:", recentDup[0].id);
        const dupItem = formatCompanyDbRow(recentDup[0]);
        return NextResponse.json({ success: true, id: recentDup[0].id, company: dupItem }, { headers: NO_CACHE_HEADERS });
      }
    }

    const { data: result, error } = await supabase
      .from('companies')
      .insert([insertData])
      .select(COMPANY_SELECT_COLUMNS);

    if (error) {
      console.error("[API/Companies] POST Insert Error:", error);
      throw error;
    }
    if (!result || result.length === 0) throw new Error("Falha ao cadastrar empresa no banco de dados.");

    invalidateServerCompaniesCache();

    const createdCompany = formatCompanyDbRow(result[0]);

    return NextResponse.json({ 
      success: true, 
      id: result[0].id, 
      company: createdCompany 
    }, { status: 201, headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Companies] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "ID válido é obrigatório para atualização" }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    const body = await req.json().catch(() => ({}));
    const updateData: any = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.industry !== undefined) updateData.industry = body.industry ? String(body.industry).trim() : null;
    if (body.website !== undefined) updateData.website = body.website ? String(body.website).trim() : null;

    let query = supabase
      .from('companies')
      .update(updateData)
      .eq('id', id);

    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    const { data: updated, error } = await query.select(COMPANY_SELECT_COLUMNS);

    if (error) {
      console.error("[API/Companies] PATCH Update Error:", error);
      throw error;
    }

    invalidateServerCompaniesCache();

    const updatedCompany = updated && updated.length > 0 ? formatCompanyDbRow(updated[0]) : null;

    return NextResponse.json({ 
      success: true, 
      company: updatedCompany 
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Companies] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "ID válido é obrigatório para exclusão" }, { status: 400, headers: NO_CACHE_HEADERS });
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

    if (error) {
      console.error("[API/Companies] DELETE Error:", error);
      throw error;
    }

    invalidateServerCompaniesCache();

    return NextResponse.json({ success: true, id }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Companies] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
