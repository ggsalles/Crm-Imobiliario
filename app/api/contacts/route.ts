import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

interface CacheEntry {
  data: any[];
  timestamp: number;
}
const serverContactsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 120000; // 2 minutes in-memory cache to save 99% Supabase egress

export function invalidateServerContactsCache() {
  serverContactsCache.clear();
}

/**
 * Algoritmo de Temperatura Inteligente do Lead baseado no Funil de Vendas:
 * - 🔥 Quente: Negócio ativo em Negociação ou Proposta (ou lead recente com < 48h)
 * - ⚡ Morno: Negócio ativo em Lead (qualificação) ou cliente com vendas concluídas
 * - ❄️ Frio: Sem nenhum negócio ativo no funil (ou negócios marcados como perdidos)
 */
export function computeSmartTemperature(contact: any, contactDeals: any[]): 'quente' | 'morno' | 'frio' | undefined {
  if (contact.type !== 'cliente') return undefined;

  // Manual overrides explícitos escolhidos pelo corretor
  if (contact.role === 'manual_quente' || contact.role === 'quente_forcado') return 'quente';
  if (contact.role === 'manual_morno' || contact.role === 'morno_forcado') return 'morno';
  if (contact.role === 'manual_frio' || contact.role === 'frio_forcado') return 'frio';

  // 1. Contato SEM negócios no funil
  if (!contactDeals || contactDeals.length === 0) {
    const createdAt = new Date(contact.created_at || Date.now()).getTime();
    const now = Date.now();
    const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

    // Se foi capturado ou cadastrado nas últimas 48h, considera-se quente (em primeiro contato)
    if (hoursSinceCreation < 48) {
      return 'quente';
    }
    // Sem negócios no funil após 48h -> FRIO
    return 'frio';
  }

  // 2. Contato COM negócios no funil
  const stages = contactDeals.map((d: any) => d.stage);

  // Proposta ou Negociação ativa -> QUENTE
  if (stages.some((s: string) => s === 'negotiation' || s === 'proposal')) {
    return 'quente';
  }

  // Lead inicial em qualificação -> MORNO
  if (stages.some((s: string) => s === 'lead')) {
    return 'morno';
  }

  // Negócios concluídos (pós-venda e relacionamento ativo) -> MORNO
  if (stages.some((s: string) => s === 'closed') && !stages.some((s: string) => s === 'lost')) {
    return 'morno';
  }

  // Todos perdidos ou inativos -> FRIO
  return 'frio';
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');
    const id = searchParams.get('id');

    // Fetch active tenant from profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    if (id && id !== 'undefined' && id !== 'null') {
        let singleQuery = supabase.from('contacts').select('*').eq('id', id);
        if (activeTenantId) {
          singleQuery = singleQuery.eq('tenant_id', activeTenantId);
        }
        const { data, error } = await singleQuery.maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json(null);

        // Fetch deals for single contact to compute smart temperature
        let contactDeals: any[] = [];
        if (data.type === 'cliente') {
          const { data: dealsData } = await supabase
            .from('deals')
            .select('id, stage, created_at, updated_at')
            .eq('contact_id', data.id);
          contactDeals = dealsData || [];
        }

        const smartTemp = computeSmartTemperature(data, contactDeals);

        return NextResponse.json({
            id: data.id,
            name: data.name,
            role: data.type === 'equipe' ? data.role : "",
            temperature: smartTemp,
            rawRole: data.role,
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

    // Check server cache
    const cacheKey = `${activeTenantId || 'all'}:${ownerId || 'all'}`;
    const cached = serverContactsCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL_MS) && searchParams.get('nocache') !== 'true') {
      return NextResponse.json(cached.data);
    }

    // PostgREST limits single queries to 1,000 rows.
    // Batch fetch in ranges of 1,000 to retrieve full contact lists (e.g. 2,000 to 20,000+ items).
    const MAX_POSTGREST_PAGE = 1000;
    const targetMax = 20000;
    let allContacts: any[] = [];
    let offset = 0;

    while (allContacts.length < targetMax) {
      const currentBatchSize = Math.min(MAX_POSTGREST_PAGE, targetMax - allContacts.length);
      let batchQuery = supabase
        .from('contacts')
        .select('*')
        .order('name', { ascending: true });
      
      if (activeTenantId) {
        batchQuery = batchQuery.eq('tenant_id', activeTenantId);
      }

      if (ownerId && ownerId !== 'undefined' && ownerId !== 'all') {
        batchQuery = batchQuery.eq('owner_id', ownerId);
      }

      const { data: batch, error: batchError } = await batchQuery.range(offset, offset + currentBatchSize - 1);
      if (batchError) {
        console.error("[API/Contacts] Batch query error at offset", offset, batchError);
        throw batchError;
      }

      if (!batch || batch.length === 0) break;
      allContacts.push(...batch);

      // If fewer items than requested were returned, we have reached the end
      if (batch.length < currentBatchSize) break;
      offset += batch.length;
    }

    const contacts = allContacts;
    console.log(`[API/Contacts] GET: query returned ${contacts.length} contacts for tenant ${activeTenantId}`);

    if (contacts.length === 0) return NextResponse.json([]);

    // Fetch active deals in safe batches for calculating Smart Temperature
    let allDeals: any[] = [];
    let dealsOffset = 0;
    while (allDeals.length < 20000) {
      let dealsBatchQuery = supabase
        .from('deals')
        .select('id, contact_id, stage, created_at, updated_at');
      if (activeTenantId) {
        dealsBatchQuery = dealsBatchQuery.eq('tenant_id', activeTenantId);
      }
      const { data: dBatch, error: dError } = await dealsBatchQuery.range(dealsOffset, dealsOffset + 999);
      if (dError || !dBatch || dBatch.length === 0) break;
      allDeals.push(...dBatch);
      if (dBatch.length < 1000) break;
      dealsOffset += dBatch.length;
    }

    // Index deals by contact_id for O(1) lookup
    const dealsByContactId = new Map<string, any[]>();
    for (const d of allDeals) {
      if (d.contact_id) {
        const arr = dealsByContactId.get(d.contact_id) || [];
        arr.push(d);
        dealsByContactId.set(d.contact_id, arr);
      }
    }

    const items = contacts.map((item: any) => {
      const contactDeals = dealsByContactId.get(item.id) || [];
      const smartTemp = computeSmartTemperature(item, contactDeals);

      return {
        id: item.id,
        name: item.name,
        role: item.type === 'equipe' ? item.role : "",
        temperature: smartTemp,
        rawRole: item.role,
        email: item.email,
        phone: item.phone,
        type: item.type,
        department: item.department,
        companyId: item.company_id,
        source: item.source,
        ownerId: item.owner_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      };
    });

    serverContactsCache.set(cacheKey, { data: items, timestamp: Date.now() });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("[API/Contacts] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    invalidateServerContactsCache();
    const supabase = getSupabase(req);
    const data = await req.json().catch(() => ({}));
    
    // Map temperature to role for database storing
    if (data.type === 'cliente') {
      if (data.temperature === 'quente') data.role = 'manual_quente';
      else if (data.temperature === 'morno') data.role = 'manual_morno';
      else if (data.temperature === 'frio') data.role = 'manual_frio';
      else data.role = null; // 'auto' (Smart calculation)
      delete data.temperature;
    }
    
    // Fetch active tenant from profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);
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
    invalidateServerContactsCache();
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "Valid ID required for PATCH" }, { status: 400 });
    }

    const data = await req.json().catch(() => ({}));

    // Map temperature to role for database updates
    if (data.temperature !== undefined) {
      if (data.temperature === 'quente') data.role = 'manual_quente';
      else if (data.temperature === 'morno') data.role = 'manual_morno';
      else if (data.temperature === 'frio') data.role = 'manual_frio';
      else data.role = null; // 'auto' (Smart calculation)
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
    invalidateServerContactsCache();
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
