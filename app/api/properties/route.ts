import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';
import { DEFAULT_TENANT_ID, isPlatformAdmin } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

interface CacheEntry {
  data: any[];
  timestamp: number;
  lastModifiedAt: string | null;
  etag: string;
}
const serverPropertiesCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 300000; // 5 minutes server-side cache

export function invalidateServerPropertiesCache() {
  serverPropertiesCache.clear();
}

function resolvePropertyTypeAndStatus(type: string | undefined | null, status: string | undefined | null, tagsList: string[]) {
  // 1. Status Inativo
  const isInactive = status === 'inativo' || tagsList.includes('Inativo') || tagsList.includes('Status:Inativo');
  const resolvedStatus = isInactive ? 'inativo' : status;

  // 2. Type fallback extraction (se foi salvo com base segura devido à restrição do banco antigo)
  let resolvedType = type || 'apartamento';
  const typeTag = tagsList.find(t => t.toLowerCase().startsWith('tipo:'));
  if (typeTag) {
    const rawTypeFromTag = typeTag.slice(5).trim();
    if (rawTypeFromTag) {
      resolvedType = rawTypeFromTag;
    }
  }

  return { resolvedStatus, resolvedType };
}

function getSafeFallbackType(desiredType: string | undefined | null): string {
  const norm = (desiredType || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (norm.includes('condominio') || norm.includes('sobrado') || norm.includes('casa')) return 'casa';
  if (norm.includes('cobertura') || norm.includes('studio') || norm.includes('loft') || norm.includes('flat') || norm.includes('kitnet') || norm.includes('apartamento')) return 'apartamento';
  if (norm.includes('sala') || norm.includes('galpao') || norm.includes('predio') || norm.includes('comercial')) return 'comercial';
  if (norm.includes('terreno') || norm.includes('lote') || norm.includes('chacara') || norm.includes('sitio') || norm.includes('fazenda')) return 'terreno';
  return 'apartamento';
}

export function formatPropertyDbRow(item: any, explicitUrls?: string[], isPublic = false) {
  let propUrls: string[] = [];
  if (explicitUrls && Array.isArray(explicitUrls) && explicitUrls.length > 0) {
    propUrls = explicitUrls;
  } else if (item.image_url) {
    try {
      const parsed = typeof item.image_url === 'string' ? JSON.parse(item.image_url) : item.image_url;
      propUrls = Array.isArray(parsed) ? parsed.map(String) : [String(item.image_url)];
    } catch {
      propUrls = [String(item.image_url)];
    }
  }
  const allUrls = Array.from(new Set(propUrls.filter((u: string) => typeof u === 'string' && u.trim().length > 0)));
  const previewUrls = explicitUrls && explicitUrls.length > 0 ? explicitUrls : allUrls.slice(0, 10);

  const tagsList: string[] = Array.isArray(item.tags)
    ? item.tags
    : (typeof item.tags === 'string'
        ? (item.tags.startsWith('[') ? (() => { try { return JSON.parse(item.tags); } catch { return []; } })() : item.tags.split(',').map((t: string) => t.trim()).filter(Boolean))
        : []);

  const { resolvedStatus: resolvedItemStatus, resolvedType: resolvedItemType } = resolvePropertyTypeAndStatus(item.type, item.status, tagsList);

  return {
    id: item.id,
    referenceCode: item.reference_code || item.referenceCode || null,
    reference_code: item.reference_code || null,
    title: String(item.title || "Sem título"),
    type: resolvedItemType,
    status: resolvedItemStatus,
    price: Number(item.price || 0),
    location: String(item.location || ""),
    cep: String(item.cep || ""),
    street: String(item.street || ""),
    neighborhood: String(item.neighborhood || ""),
    city: String(item.city || ""),
    state: String(item.state || ""),
    number: String(item.number || ""),
    complement: item.complement ? String(item.complement) : null,
    area: Number(item.area || 0),
    bedrooms: Number(item.bedrooms || 0),
    suites: Number(item.suites || 0),
    bathrooms: Number(item.bathrooms || 0),
    parkingSpots: Number(item.parking_spots !== undefined && item.parking_spots !== null ? item.parking_spots : (item.parkingSpots || 0)),
    acceptsFinancing: Boolean(item.accepts_financing !== undefined ? item.accepts_financing : item.acceptsFinancing),
    isFeatured: Boolean(item.is_featured !== undefined ? item.is_featured : item.isFeatured),
    iptu: item.iptu !== null && item.iptu !== undefined ? Number(item.iptu) : null,
    condoFee: (item.condo_fee !== null && item.condo_fee !== undefined) ? Number(item.condo_fee) : ((item.condoFee !== null && item.condoFee !== undefined) ? Number(item.condoFee) : null),
    buildingName: item.building_name || item.buildingName || null,
    companyId: item.company_id || item.companyId || null,
    notes: isPublic ? null : (item.notes ? String(item.notes) : null),
    internalNotes: isPublic ? null : (item.notes ? String(item.notes) : null),
    description: item.description ? String(item.description) : null,
    tags: tagsList,
    imageUrls: previewUrls,
    photoCount: allUrls.length,
    ownerId: item.owner_id || item.ownerId || null,
    tenantId: item.tenant_id || item.tenantId || null,
    createdAt: item.created_at || item.createdAt || new Date().toISOString(),
    updatedAt: item.updated_at || item.updatedAt || new Date().toISOString()
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');
    const id = searchParams.get('id');

    // If id is provided, fetch single property
    if (id && id !== 'undefined' && id !== 'null') {
      const isPublic = searchParams.get('public') === 'true';
      const user = getAuthenticatedUser(req);
      const isMaster = user?.email ? isPlatformAdmin(user.email) : false;
      const activeTenantId = await getActiveTenantId(supabase, user, req);

      let singleQuery = supabase
        .from('properties')
        .select('*')
        .eq('id', id);

      const { data: property, error: propError } = await singleQuery.maybeSingle();

      if (propError) throw propError;
      if (!property) return NextResponse.json(null);

      // Access control for authenticated CRM view
      if (!isPublic && !isMaster && user?.id && property.tenant_id) {
        if (activeTenantId && activeTenantId !== property.tenant_id && activeTenantId !== DEFAULT_TENANT_ID) {
          const { data: assoc } = await supabase
            .from('profile_tenants')
            .select('tenant_id')
            .eq('profile_id', user.id)
            .eq('tenant_id', property.tenant_id)
            .maybeSingle();
          if (!assoc && property.owner_id !== user.id) {
            return NextResponse.json(null, { status: 403 });
          }
        }
      }

      // Fetch images for this property
      const { data: images, error: imagesError } = await supabase
        .from('property_images')
        .select('url')
        .eq('property_id', id);

      if (imagesError) {
        console.warn("[API/Properties] Erro ao carregar fotos da tabela property_images:", imagesError);
      }

      let dbUrls: string[] = (images || []).map((img: any) => String(img.url));
      let propUrls: string[] = [];
      if (property.image_url) {
        try {
          const parsed = typeof property.image_url === 'string' ? JSON.parse(property.image_url) : property.image_url;
          propUrls = Array.isArray(parsed) ? parsed.map(String) : [String(property.image_url)];
        } catch {
          propUrls = [String(property.image_url)];
        }
      }
      const urls: string[] = Array.from(new Set([...dbUrls, ...propUrls].filter((u: string) => typeof u === 'string' && u.trim().length > 0)));

      return NextResponse.json(formatPropertyDbRow(property, urls, isPublic), { headers: NO_CACHE_HEADERS });
    }

    // Fetch active tenant from profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    const isPublic = searchParams.get('public') === 'true';
    const tenantParam = searchParams.get('tenantId') || searchParams.get('tenant');
    const brokerParam = searchParams.get('brokerId') || searchParams.get('broker');
    
    // Strict tenant isolation: force active company tenant for CRM / authenticated requests.
    // For public showcase queries, allow target showcase tenantParam or activeTenantId.
    let effectiveTenantId = isPublic
      ? (tenantParam || activeTenantId)
      : (activeTenantId || tenantParam);

    // If tenantParam was omitted in a public link, but a broker or owner is specified:
    // Automatically resolve the broker's company tenant_id so the agency's catalog is loaded!
    if (isPublic && !effectiveTenantId && (brokerParam || ownerId)) {
      const targetUser = brokerParam || ownerId;
      if (targetUser && targetUser !== 'undefined' && targetUser !== 'all') {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', targetUser)
            .single();
          if (prof?.tenant_id) {
            effectiveTenantId = prof.tenant_id;
          }
        } catch {}
      }
    }

    const isMaster = user?.email ? isPlatformAdmin(user.email) : false;

    if (isMaster && tenantParam === 'all') {
      effectiveTenantId = null;
    } else if (!effectiveTenantId || effectiveTenantId === DEFAULT_TENANT_ID) {
      if (activeTenantId && activeTenantId !== DEFAULT_TENANT_ID) {
        effectiveTenantId = activeTenantId;
      } else {
        effectiveTenantId = 'c177f8cd-71b6-4bdc-a26d-4d26af076b4f';
      }
    }

    // Vitrine pública compartilhada por corretor (ex: link de Vivi da Nando Imobiliária):
    // A vitrine exibe todo o portfólio da imobiliária com o atendimento e atribuição desse corretor.
    // Só filtra estritamente por owner_id se 'exclusiveOnly=true' for explicitamente passado.
    const shouldFilterByOwner = isPublic
      ? (searchParams.get('exclusiveOnly') === 'true' && ownerId && ownerId !== 'undefined' && ownerId !== 'all')
      : (ownerId && ownerId !== 'undefined' && ownerId !== 'all');

    const cacheKey = `${effectiveTenantId || 'all'}:${shouldFilterByOwner ? ownerId : 'all'}:${isPublic}:${searchParams.get('featured') || 'all'}:${searchParams.get('limit') || 'all'}`;
    const cached = serverPropertiesCache.get(cacheKey);
    const now = Date.now();
    const isBypass = searchParams.get('nocache') === 'true' || searchParams.get('force') === 'true';
    const effectiveTtl = isPublic ? 600000 : 300000; // 10 min vitrine pública, 5 min CRM autenticado
    const clientIfNoneMatch = req.headers.get('if-none-match');

    // 1. Verificação ultrarrápida de modificação (Checksum Guard):
    // Em vez de puxar milhares de imóveis (10MB+ de egress), consulta apenas 1 registro com updated_at (~40 bytes).
    let lastModifiedAt: string | null = null;
    try {
      let checkQuery = supabase
        .from('properties')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (effectiveTenantId && effectiveTenantId !== 'undefined' && effectiveTenantId !== 'all') {
        checkQuery = checkQuery.eq('tenant_id', effectiveTenantId);
      }
      const { data: latestRows } = await checkQuery;
      if (latestRows && latestRows.length > 0 && latestRows[0]?.updated_at) {
        lastModifiedAt = latestRows[0].updated_at;
      }
    } catch (checkErr) {
      console.warn("[API/Properties] Checksum guard warning:", checkErr);
    }

    // Se temos cache e o banco não sofreu nenhuma alteração recente:
    if (cached && !isBypass && lastModifiedAt && cached.lastModifiedAt === lastModifiedAt) {
      if (clientIfNoneMatch && clientIfNoneMatch === cached.etag) {
        return new NextResponse(null, { 
          status: 304, 
          headers: { 
            'ETag': cached.etag, 
            'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' 
          } 
        });
      }
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          'ETag': cached.etag,
        }
      });
    }

    if (cached && (now - cached.timestamp < effectiveTtl) && !isBypass) {
      return NextResponse.json(cached.data, { 
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          'ETag': cached.etag || `"${cached.timestamp}"`,
        }
      });
    }

    const rawLimit = searchParams.get('limit');
    let limitParam: number | null = null;
    if (rawLimit === 'all' || rawLimit === '0' || rawLimit === '-1') {
      limitParam = null;
    } else if (rawLimit && rawLimit !== '500' && rawLimit !== '150') {
      limitParam = Math.max(1, Number(rawLimit) || 10000);
    } else {
      limitParam = 10000;
    }

    // PostgREST limits single queries to 1,000 rows.
    const MAX_POSTGREST_PAGE = 1000;
    const targetMax = limitParam !== null ? limitParam : 20000;
    let allProperties: any[] = [];
    let offset = 0;

    while (allProperties.length < targetMax) {
      const currentBatchSize = Math.min(MAX_POSTGREST_PAGE, targetMax - allProperties.length);
      // Otimização Crítica: remove 'description' e 'notes' (campos de texto massivo) da listagem geral.
      // Esses campos são carregados sob demanda na abertura da ficha individual (?id=...).
      let batchQuery = supabase
        .from('properties')
        .select('id, reference_code, title, type, status, price, area, bedrooms, suites, bathrooms, parking_spots, location, neighborhood, city, state, street, number, complement, cep, image_url, tags, is_featured, accepts_financing, building_name, condo_fee, iptu, company_id, owner_id, tenant_id, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (effectiveTenantId && effectiveTenantId !== 'undefined' && effectiveTenantId !== 'all') {
        batchQuery = batchQuery.eq('tenant_id', effectiveTenantId);
      }

      if (isPublic) {
        batchQuery = batchQuery.in('status', ['disponível', 'disponivel', 'available']);
      }

      if (shouldFilterByOwner) {
        batchQuery = batchQuery.eq('owner_id', ownerId);
      }

      if (searchParams.get('featured') === 'true') {
        batchQuery = batchQuery.eq('is_featured', true);
      }

      const { data: batch, error: batchError } = await batchQuery.range(offset, offset + currentBatchSize - 1);
      if (batchError) {
        console.error("[API/Properties] Batch query error at offset", offset, batchError);
        throw batchError;
      }

      if (!batch || batch.length === 0) break;
      allProperties.push(...batch);

      if (batch.length < currentBatchSize) break;
      offset += batch.length;
    }

    const properties = allProperties;

    if (!properties || properties.length === 0) {
      return NextResponse.json([], { 
        headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' } 
      });
    }

    let items = properties.map((item: any) => formatPropertyDbRow(item, undefined, isPublic));

    if (isPublic) {
      items = items.filter(item => {
        const s = (item.status || 'disponível').toLowerCase().trim();
        return s === 'disponível' || s === 'disponivel' || s === 'available';
      });
    }

    const generatedEtag = `W/"p-${lastModifiedAt || Date.now()}"`;
    serverPropertiesCache.set(cacheKey, { 
      data: items, 
      timestamp: Date.now(), 
      lastModifiedAt, 
      etag: generatedEtag 
    });

    return NextResponse.json(items, { 
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        'ETag': generatedEtag,
      } 
    });
  } catch (error: any) {
    console.error("[API/Properties] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json().catch(() => ({}));
    console.log("[API/Properties] POST: Dados recebidos:", data);

    // Fetch active tenant from profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);
    const resolvedTenantId = activeTenantId || data.tenant_id || DEFAULT_TENANT_ID;
    data.tenant_id = resolvedTenantId;
    
    const { imageUrls, ...sanitized } = data;
    (sanitized as any).tenant_id = resolvedTenantId;

    if (!sanitized.title || String(sanitized.title).trim() === '') {
      return NextResponse.json({ error: "O título do imóvel é obrigatório para gravação." }, { status: 400 });
    }
    if (!sanitized.price || Number(sanitized.price) <= 0) {
      return NextResponse.json({ error: "O valor de venda do imóvel é obrigatório e deve ser maior que zero." }, { status: 400 });
    }

    if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
      sanitized.image_url = imageUrls.length > 1 ? JSON.stringify(imageUrls) : String(imageUrls[0]);
    }

    if (sanitized.tags && Array.isArray(sanitized.tags)) {
      sanitized.tags = sanitized.tags.filter((t: string) => !t.toLowerCase().startsWith('tipo:'));
    }

    // Normalize camelCase to snake_case for Supabase columns
    if ('condoFee' in sanitized) {
      sanitized.condo_fee = sanitized.condoFee;
      delete sanitized.condoFee;
    }
    if ('buildingName' in sanitized) {
      sanitized.building_name = sanitized.buildingName;
      delete sanitized.buildingName;
    }
    if ('parkingSpots' in sanitized) {
      sanitized.parking_spots = sanitized.parkingSpots;
      delete sanitized.parkingSpots;
    }
    if ('acceptsFinancing' in sanitized) {
      sanitized.accepts_financing = sanitized.acceptsFinancing;
      delete sanitized.acceptsFinancing;
    }
    if ('isFeatured' in sanitized) {
      sanitized.is_featured = Boolean(sanitized.isFeatured);
      delete sanitized.isFeatured;
    }

    if ('companyId' in sanitized) {
      sanitized.company_id = sanitized.companyId || null;
      delete sanitized.companyId;
    }
    if ('referenceCode' in sanitized) {
      sanitized.reference_code = sanitized.referenceCode;
      delete sanitized.referenceCode;
    }
    if ('ownerId' in sanitized) {
      sanitized.owner_id = sanitized.ownerId || null;
      delete sanitized.ownerId;
    }

    console.log("[API/Properties] POST: Inserindo na tabela 'properties'...");
    let { data: result, error } = await supabase
      .from('properties')
      .insert([sanitized])
      .select();

    // Fallback gracioso caso a coluna 'tags', 'is_featured', 'suites' ou 'company_id' ainda não tenha sido criada no Supabase pelo usuário
    if (error && (error.message?.includes('tags') || error.message?.includes('is_featured') || error.message?.includes('suites') || error.message?.includes('company_id') || error.code === '42703' || (error.message?.includes('column') && error.message?.includes('does not exist')))) {
      console.warn("[API/Properties] POST: Coluna ainda não criada no Supabase. Inserindo com campos de fallback:", error.message);
      const fallbackSanitized = { ...sanitized };
      if (error.message?.includes('tags')) delete fallbackSanitized.tags;
      if (error.message?.includes('is_featured')) delete fallbackSanitized.is_featured;
      if (error.message?.includes('suites')) delete fallbackSanitized.suites;
      if (error.message?.includes('company_id')) delete fallbackSanitized.company_id;
      // Se genérico 42703, remove preventivamente
      if (error.code === '42703') {
        delete fallbackSanitized.tags;
        delete fallbackSanitized.is_featured;
        delete fallbackSanitized.suites;
        delete fallbackSanitized.company_id;
      }
      const retry = await supabase
        .from('properties')
        .insert([fallbackSanitized])
        .select();
      result = retry.data;
      error = retry.error;
    }

    // Fallback gracioso para a restrição properties_type_check caso novos tipos ainda não estejam no check constraint do Supabase
    if (error && (error.message?.includes('properties_type_check') || (error.code === '23514' && error.message?.includes('type')))) {
      console.warn(`[API/Properties] POST: 'properties_type_check' rejeitou tipo '${sanitized.type}'. Usando fallback de tipo seguro:`, error.message);
      const fallbackTypeObj = { ...sanitized };
      const originalType = sanitized.type;
      fallbackTypeObj.type = getSafeFallbackType(originalType);
      const currentTags = Array.isArray(fallbackTypeObj.tags) ? [...fallbackTypeObj.tags] : [];
      const cleanTags = currentTags.filter(t => !t.toLowerCase().startsWith('tipo:'));
      if (originalType) cleanTags.push(`Tipo:${originalType}`);
      fallbackTypeObj.tags = cleanTags;

      const retryType = await supabase
        .from('properties')
        .insert([fallbackTypeObj])
        .select();
      result = retryType.data;
      error = retryType.error;
    }

    // Fallback gracioso para a restrição properties_status_check caso o status 'inativo' ainda não esteja no check constraint do Supabase
    if (error && (error.message?.includes('properties_status_check') || error.code === '23514')) {
      console.warn("[API/Properties] POST: 'properties_status_check' ainda não aceita 'inativo' nativamente no DB. Salvando como 'reservado' com tag 'Inativo':", error.message);
      const fallbackStatus = { ...sanitized };
      if (fallbackStatus.status === 'inativo') {
        fallbackStatus.status = 'reservado';
        const currentTags = Array.isArray(fallbackStatus.tags) ? [...fallbackStatus.tags] : [];
        if (!currentTags.includes('Inativo')) currentTags.push('Inativo');
        fallbackStatus.tags = currentTags;
      }
      const retryStatus = await supabase
        .from('properties')
        .insert([fallbackStatus])
        .select();
      result = retryStatus.data;
      error = retryStatus.error;
    }

    if (error) {
      console.error("[API/Properties] POST error ao inserir imóvel:", error);
      throw error;
    }
    
    if (!result || result.length === 0) {
      console.error("[API/Properties] POST: Nenhum resultado retornado após inserção");
      throw new Error("Failed to create property in database");
    }

    const propertyId = result[0].id;
    console.log(`[API/Properties] POST: Imóvel criado com ID: ${propertyId}. Sincronizando imagens...`);

    if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
      const imageInserts = imageUrls.map(url => ({
        property_id: propertyId,
        url: String(url),
        tenant_id: resolvedTenantId
      }));

      const { error: imgError } = await supabase
        .from('property_images')
        .insert(imageInserts);

      if (imgError) {
        console.warn("[API/Properties] POST: Erro ao inserir imagens na tabela secundária:", imgError);
      } else {
        console.log(`[API/Properties] POST: ${imageInserts.length} imagens sincronizadas com sucesso.`);
      }
    }

    serverPropertiesCache.clear();

    const formattedCreated = formatPropertyDbRow(result[0], imageUrls);
    return NextResponse.json({ success: true, id: propertyId, property: formattedCreated }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Properties] POST FATAL ERROR:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error during POST" }, { status: 500 });
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

    const data = await req.json().catch(() => ({}));
    console.log(`[API/Properties] PATCH ID ${id}: Dados recebidos:`, data);
    
    const user = getAuthenticatedUser(req);
    const isMaster = user?.email ? isPlatformAdmin(user.email) : false;
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    // 1. Fetch existing property to verify existence and preserve tenant
    const { data: existingProp, error: findError } = await supabase
      .from('properties')
      .select('id, tenant_id, owner_id')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      console.error(`[API/Properties] PATCH ID ${id} find error:`, findError);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!existingProp) {
      console.warn(`[API/Properties] PATCH ID ${id}: Imóvel não encontrado no banco.`);
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 });
    }

    // 2. Permission check:
    if (!isMaster && user?.id) {
      const propTenant = existingProp.tenant_id;
      const isOwner = existingProp.owner_id === user.id;
      const isTenantMatch = activeTenantId && activeTenantId === propTenant;
      
      let hasTenantAssoc = false;
      if (!isOwner && !isTenantMatch && propTenant) {
        const { data: assoc } = await supabase
          .from('profile_tenants')
          .select('tenant_id')
          .eq('profile_id', user.id)
          .eq('tenant_id', propTenant)
          .maybeSingle();
        hasTenantAssoc = !!assoc;
      }

      if (!isOwner && !isTenantMatch && !hasTenantAssoc && propTenant && activeTenantId && activeTenantId !== DEFAULT_TENANT_ID) {
        console.warn(`[API/Properties] PATCH ID ${id}: Acesso negado para o tenant ${propTenant}`);
        return NextResponse.json({ error: "Permissão insuficiente para alterar imóvel desta imobiliária." }, { status: 403 });
      }
    }

    const { imageUrls, ...sanitized } = data;

    // Never mutate primary key or tenant_id during regular edits
    delete sanitized.id;
    delete sanitized.tenant_id;

    if (imageUrls && Array.isArray(imageUrls)) {
      sanitized.image_url = imageUrls.length > 1 ? JSON.stringify(imageUrls) : (imageUrls.length === 1 ? String(imageUrls[0]) : null);
    }

    if (sanitized.tags && Array.isArray(sanitized.tags)) {
      sanitized.tags = sanitized.tags.filter((t: string) => !t.toLowerCase().startsWith('tipo:'));
    }

    // Normalize camelCase to snake_case for Supabase columns
    if ('condoFee' in sanitized) {
      sanitized.condo_fee = sanitized.condoFee;
      delete sanitized.condoFee;
    }
    if ('buildingName' in sanitized) {
      sanitized.building_name = sanitized.buildingName;
      delete sanitized.buildingName;
    }
    if ('parkingSpots' in sanitized) {
      sanitized.parking_spots = sanitized.parkingSpots;
      delete sanitized.parkingSpots;
    }
    if ('acceptsFinancing' in sanitized) {
      sanitized.accepts_financing = sanitized.acceptsFinancing;
      delete sanitized.acceptsFinancing;
    }
    if ('isFeatured' in sanitized) {
      sanitized.is_featured = Boolean(sanitized.isFeatured);
      delete sanitized.isFeatured;
    }
    if ('companyId' in sanitized) {
      sanitized.company_id = sanitized.companyId || null;
      delete sanitized.companyId;
    }
    if ('referenceCode' in sanitized) {
      sanitized.reference_code = sanitized.referenceCode;
      delete sanitized.referenceCode;
    }
    if ('ownerId' in sanitized) {
      sanitized.owner_id = sanitized.ownerId || null;
      delete sanitized.ownerId;
    }

    console.log(`[API/Properties] PATCH ID ${id}: Atualizando na tabela 'properties'...`);
    let { data: updatedRows, error } = await supabase
      .from('properties')
      .update(sanitized)
      .eq('id', id)
      .select();

    // Fallback gracioso caso alguma coluna opcional ainda não exista no Supabase
    if (error && (error.message?.includes('tags') || error.message?.includes('is_featured') || error.message?.includes('suites') || error.message?.includes('company_id') || error.code === '42703' || (error.message?.includes('column') && error.message?.includes('does not exist')))) {
      console.warn(`[API/Properties] PATCH ID ${id}: Coluna não existente no Supabase. Atualizando com fallback:`, error.message);
      const fallbackSanitized = { ...sanitized };
      if (error.message?.includes('tags')) delete fallbackSanitized.tags;
      if (error.message?.includes('is_featured')) delete fallbackSanitized.is_featured;
      if (error.message?.includes('suites')) delete fallbackSanitized.suites;
      if (error.message?.includes('company_id')) delete fallbackSanitized.company_id;
      if (error.code === '42703') {
        delete fallbackSanitized.tags;
        delete fallbackSanitized.is_featured;
        delete fallbackSanitized.suites;
        delete fallbackSanitized.company_id;
      }
      const retry = await supabase
        .from('properties')
        .update(fallbackSanitized)
        .eq('id', id)
        .select();

      updatedRows = retry.data;
      error = retry.error;
    }

    // Fallback gracioso para a restrição properties_type_check no PATCH
    if (error && (error.message?.includes('properties_type_check') || (error.code === '23514' && error.message?.includes('type')))) {
      console.warn(`[API/Properties] PATCH ID ${id}: 'properties_type_check' rejeitou '${sanitized.type}'. Usando fallback de tipo seguro:`, error.message);
      const fallbackTypeObj = { ...sanitized };
      const originalType = sanitized.type;
      fallbackTypeObj.type = getSafeFallbackType(originalType);
      let currentTags = Array.isArray(fallbackTypeObj.tags) ? [...fallbackTypeObj.tags] : [];
      if (!fallbackTypeObj.tags) {
        const { data: existingRow } = await supabase.from('properties').select('tags').eq('id', id).maybeSingle();
        if (existingRow && Array.isArray(existingRow.tags)) {
          currentTags = [...existingRow.tags];
        }
      }
      const cleanTags = currentTags.filter(t => !t.toLowerCase().startsWith('tipo:'));
      if (originalType) cleanTags.push(`Tipo:${originalType}`);
      fallbackTypeObj.tags = cleanTags;

      const retryType = await supabase
        .from('properties')
        .update(fallbackTypeObj)
        .eq('id', id)
        .select();

      updatedRows = retryType.data;
      error = retryType.error;
    }

    // Fallback gracioso para a restrição properties_status_check no PATCH
    if (error && (error.message?.includes('properties_status_check') || error.code === '23514')) {
      console.warn(`[API/Properties] PATCH ID ${id}: 'properties_status_check' ainda não aceita 'inativo'. Usando 'reservado' com tag 'Inativo':`, error.message);
      const fallbackStatus = { ...sanitized };
      if (fallbackStatus.status === 'inativo') {
        fallbackStatus.status = 'reservado';
        const currentTags = Array.isArray(fallbackStatus.tags) ? [...fallbackStatus.tags] : [];
        if (!currentTags.includes('Inativo')) currentTags.push('Inativo');
        fallbackStatus.tags = currentTags;
      }
      const retryStatus = await supabase
        .from('properties')
        .update(fallbackStatus)
        .eq('id', id)
        .select();

      updatedRows = retryStatus.data;
      error = retryStatus.error;
    }

    if (error) {
      console.error(`[API/Properties] PATCH ID ${id} error:`, error);
      throw error;
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.error(`[API/Properties] PATCH ID ${id}: Nenhuma linha foi atualizada no banco.`);
      return NextResponse.json({ error: "Falha ao persistir alterações. O registro não foi modificado no banco de dados." }, { status: 400 });
    }

    // Sincroniza fotos com a imobiliária correta do imóvel
    if (imageUrls && Array.isArray(imageUrls)) {
      console.log(`[API/Properties] PATCH ID ${id}: Sincronizando ${imageUrls.length} imagens...`);
      const { error: delError } = await supabase.from('property_images').delete().eq('property_id', id);
      if (delError) console.warn(`[API/Properties] PATCH ID ${id}: Erro ao limpar imagens antigas:`, delError);
      
      if (imageUrls.length > 0) {
        const imageInserts = imageUrls.map(url => ({
          property_id: id,
          url: String(url),
          tenant_id: existingProp.tenant_id || activeTenantId || DEFAULT_TENANT_ID
        }));
        const { error: insError } = await supabase.from('property_images').insert(imageInserts);
        if (insError) console.warn(`[API/Properties] PATCH ID ${id}: Erro ao inserir novas imagens:`, insError);
      }
      console.log(`[API/Properties] PATCH ID ${id}: Imagens sincronizadas.`);
    }

    serverPropertiesCache.clear();

    const formattedUpdated = formatPropertyDbRow(updatedRows[0], imageUrls);
    return NextResponse.json({ success: true, id, updated: formattedUpdated }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error(`[API/Properties] PATCH FATAL ERROR:`, error);
    return NextResponse.json({ error: error.message || "Internal Server Error during PATCH" }, { status: 500 });
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
    const isMaster = user?.email ? isPlatformAdmin(user.email) : false;
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    console.log(`[API/Properties] DELETE ID ${id}: Iniciando remoção...`);

    const { data: existingProp } = await supabase
      .from('properties')
      .select('id, tenant_id, owner_id')
      .eq('id', id)
      .maybeSingle();

    if (!existingProp) {
      return NextResponse.json({ success: true, message: "Imóvel já removido." });
    }

    if (!isMaster && user?.id) {
      const isOwner = existingProp.owner_id === user.id;
      const isTenantMatch = activeTenantId && activeTenantId === existingProp.tenant_id;
      if (!isOwner && !isTenantMatch && existingProp.tenant_id && activeTenantId && activeTenantId !== DEFAULT_TENANT_ID) {
        const { data: assoc } = await supabase
          .from('profile_tenants')
          .select('tenant_id')
          .eq('profile_id', user.id)
          .eq('tenant_id', existingProp.tenant_id)
          .maybeSingle();
        if (!assoc) {
          return NextResponse.json({ error: "Permissão insuficiente para excluir este imóvel." }, { status: 403 });
        }
      }
    }

    // First delete associated images due to possible foreign key constraints
    const { error: imgError } = await supabase
      .from('property_images')
      .delete()
      .eq('property_id', id);

    if (imgError) {
      console.warn(`[API/Properties] DELETE ID ${id}: Erro ao remover imagens associadas (continuando...):`, imgError);
    }

    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[API/Properties] DELETE ID ${id} error:`, error);
      throw error;
    }

    console.log(`[API/Properties] DELETE ID ${id}: Sucesso.`);
    serverPropertiesCache.clear();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Properties] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
