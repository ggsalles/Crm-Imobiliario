import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';
import { DEFAULT_TENANT_ID } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

const DEAL_SELECT_COLUMNS = 'id, tenant_id, title, value, stage, probability, status, priority, expected_close_date, company_id, contact_id, property_id, owner_id, created_at, updated_at';

interface DealsCacheEntry {
  data: any[];
  timestamp: number;
}
const serverDealsCache = new Map<string, DealsCacheEntry>();
const CACHE_TTL_MS = 60000; // 60s server-side memory cache for Supabase Free tier optimization

export function invalidateServerDealsCache() {
  serverDealsCache.clear();
}

function sanitizeId(val: any): string | null {
  return (val && val !== 'undefined' && val !== 'null') ? String(val) : null;
}

function formatDeal(item: any) {
  return {
    id: item.id,
    tenantId: item.tenant_id,
    title: item.title === 'EM CONSTRUÇÃO' ? 'Em Construção' : (item.title || 'Oportunidade'),
    value: Number(item.value || 0),
    stage: item.stage || 'lead',
    probability: item.probability !== null && item.probability !== undefined ? Number(item.probability) : undefined,
    status: item.status || 'aberto',
    priority: item.priority || 'media',
    expectedCloseDate: item.expected_close_date || undefined,
    companyId: item.company_id || undefined,
    contactId: item.contact_id || undefined,
    propertyId: item.property_id || undefined,
    ownerId: item.owner_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const ownerId = searchParams.get('ownerId');
    const contactId = searchParams.get('contactId');

    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json([]);
    }
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    // Single Deal Retrieval
    if (id && id !== 'undefined' && id !== 'null') {
      let singleQuery = supabase
        .from('deals')
        .select(DEAL_SELECT_COLUMNS)
        .eq('id', id);

      if (activeTenantId) {
        singleQuery = singleQuery.eq('tenant_id', activeTenantId);
      }
      const { data: item, error } = await singleQuery.maybeSingle();
      if (error) throw error;
      if (!item) return NextResponse.json(null);
      return NextResponse.json(formatDeal(item), { headers: NO_CACHE_HEADERS });
    }

    // List Deals with Server-side caching
    const cacheKey = `${activeTenantId || 'default'}:${ownerId || 'all'}:${contactId || 'all'}`;
    const cached = serverDealsCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, { headers: NO_CACHE_HEADERS });
    }

    let query = supabase
      .from('deals')
      .select(DEAL_SELECT_COLUMNS)
      .order('created_at', { ascending: false });
    
    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }
    
    if (ownerId && ownerId !== 'undefined') {
      query = query.eq('owner_id', ownerId);
    }
    
    if (contactId && contactId !== 'undefined') {
      query = query.eq('contact_id', contactId);
    }

    const { data: deals, error } = await query;
    if (error) {
      console.error("[API/Deals] GET query error:", error);
      throw error;
    }
    if (!deals) return NextResponse.json([]);

    const items = deals.map(formatDeal);
    serverDealsCache.set(cacheKey, { data: items, timestamp: now });

    return NextResponse.json(items, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Deals] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const body = await req.json().catch(() => ({}));
    
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeTenantId = await getActiveTenantId(supabase, user, req);

    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: "O título do negócio é obrigatório" }, { status: 400 });
    }

    const newDealPayload: any = {
      title: body.title.trim(),
      value: Number(body.value) || 0,
      stage: body.stage || 'lead',
      owner_id: sanitizeId(body.owner_id || body.ownerId) || user.id,
      company_id: sanitizeId(body.company_id || body.companyId),
      contact_id: sanitizeId(body.contact_id || body.contactId),
      property_id: sanitizeId(body.property_id || body.propertyId),
      tenant_id: activeTenantId || DEFAULT_TENANT_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (body.priority) newDealPayload.priority = body.priority;
    if (body.status) newDealPayload.status = body.status;
    if (body.probability !== undefined && body.probability !== null) newDealPayload.probability = Number(body.probability);
    if (body.expected_close_date || body.expectedCloseDate) {
      newDealPayload.expected_close_date = body.expected_close_date || body.expectedCloseDate;
    }

    const { data: result, error } = await supabase
      .from('deals')
      .insert([newDealPayload])
      .select(DEAL_SELECT_COLUMNS);

    if (error) {
      console.error("[API/Deals] POST Insert Error:", error);
      throw error;
    }
    if (!result || result.length === 0) throw new Error("Falha ao criar oportunidade no funil");

    // Invalida cache após inserção bem sucedida
    invalidateServerDealsCache();

    const createdDeal = formatDeal(result[0]);
    return NextResponse.json({ 
      success: true, 
      id: result[0].id, 
      deal: createdDeal 
    }, { status: 201, headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Deals] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "ID de negócio inválido" }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: NO_CACHE_HEADERS });
    }
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    // Validação de isolamento: verificar se o negócio existe e pertence ao tenant ativo
    let checkQuery = supabase.from('deals').select('id, tenant_id').eq('id', id);
    if (activeTenantId) {
      checkQuery = checkQuery.eq('tenant_id', activeTenantId);
    }
    const { data: existingDeal, error: checkError } = await checkQuery.maybeSingle();
    if (checkError || !existingDeal) {
      return NextResponse.json({ error: "Negócio não encontrado ou sem permissão de acesso" }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    const body = await req.json().catch(() => ({}));
    const updatePayload: any = { updated_at: new Date().toISOString() };

    // Atualização cirúrgica de campos permitidos
    if (body.title !== undefined) updatePayload.title = String(body.title).trim();
    if (body.value !== undefined) updatePayload.value = Number(body.value) || 0;
    if (body.stage !== undefined) updatePayload.stage = body.stage;
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.priority !== undefined) updatePayload.priority = body.priority;
    if (body.probability !== undefined) updatePayload.probability = Number(body.probability);
    if (body.expected_close_date !== undefined || body.expectedCloseDate !== undefined) {
      updatePayload.expected_close_date = body.expected_close_date || body.expectedCloseDate;
    }
    if (body.company_id !== undefined || body.companyId !== undefined) {
      updatePayload.company_id = sanitizeId(body.company_id || body.companyId);
    }
    if (body.contact_id !== undefined || body.contactId !== undefined) {
      updatePayload.contact_id = sanitizeId(body.contact_id || body.contactId);
    }
    if (body.property_id !== undefined || body.propertyId !== undefined) {
      updatePayload.property_id = sanitizeId(body.property_id || body.propertyId);
    }
    if (body.owner_id !== undefined || body.ownerId !== undefined) {
      updatePayload.owner_id = sanitizeId(body.owner_id || body.ownerId);
    }

    let updateQuery = supabase
      .from('deals')
      .update(updatePayload)
      .eq('id', id);

    if (activeTenantId) {
      updateQuery = updateQuery.eq('tenant_id', activeTenantId);
    }

    const { data: updatedDeals, error: updateError } = await updateQuery.select(DEAL_SELECT_COLUMNS);
    if (updateError) {
      console.error("[API/Deals] PATCH update error:", updateError);
      throw updateError;
    }

    // Invalida cache após mutação
    invalidateServerDealsCache();

    const updatedDeal = updatedDeals && updatedDeals.length > 0 ? formatDeal(updatedDeals[0]) : null;

    return NextResponse.json({ 
      success: true, 
      deal: updatedDeal 
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Deals] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "ID de negócio inválido" }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: NO_CACHE_HEADERS });
    }
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    // Validação de isolamento antes do delete
    let checkQuery = supabase.from('deals').select('id, tenant_id').eq('id', id);
    if (activeTenantId) {
      checkQuery = checkQuery.eq('tenant_id', activeTenantId);
    }
    const { data: existingDeal, error: checkError } = await checkQuery.maybeSingle();
    if (checkError || !existingDeal) {
      return NextResponse.json({ error: "Negócio não encontrado ou sem permissão para exclusão" }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    let deleteQuery = supabase
      .from('deals')
      .delete()
      .eq('id', id);

    if (activeTenantId) {
      deleteQuery = deleteQuery.eq('tenant_id', activeTenantId);
    }

    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      console.error("[API/Deals] DELETE error:", deleteError);
      throw deleteError;
    }

    // Invalida cache após remoção
    invalidateServerDealsCache();

    return NextResponse.json({ success: true, id }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Deals] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
