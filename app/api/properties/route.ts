import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');
    const id = searchParams.get('id');

    // If id is provided, fetch single property
    if (id && id !== 'undefined' && id !== 'null') {
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (propError) throw propError;
      if (!property) return NextResponse.json(null);

      // Fetch images for this property
      const { data: images, error: imagesError } = await supabase
        .from('property_images')
        .select('url')
        .eq('property_id', id);

      if (imagesError) {
        console.warn("[API/Properties] Erro ao carregar fotos:", imagesError);
      }

      let urls: string[] = (images || []).map((img: any) => String(img.url));
      
      if (urls.length === 0 && property.image_url) {
        try {
          const parsed = typeof property.image_url === 'string' ? JSON.parse(property.image_url) : property.image_url;
          urls = Array.isArray(parsed) ? parsed : [String(property.image_url)];
        } catch {
          urls = [String(property.image_url)];
        }
      }

      return NextResponse.json({
        id: property.id,
        title: String(property.title || "Sem título"),
        type: property.type,
        status: property.status,
        price: Number(property.price || 0),
        location: String(property.location || ""),
        cep: String(property.cep || ""),
        street: String(property.street || ""),
        neighborhood: String(property.neighborhood || ""),
        city: String(property.city || ""),
        state: String(property.state || ""),
        number: String(property.number || ""),
        complement: property.complement ? String(property.complement) : null,
        area: Number(property.area || 0),
        bedrooms: Number(property.bedrooms || 0),
        bathrooms: Number(property.bathrooms || 0),
        parkingSpots: Number(property.parking_spots || 0),
        acceptsFinancing: Boolean(property.accepts_financing),
        iptu: property.iptu !== null && property.iptu !== undefined ? Number(property.iptu) : null,
        condoFee: property.condo_fee !== null && property.condo_fee !== undefined ? Number(property.condo_fee) : null,
        buildingName: property.building_name ? String(property.building_name) : null,
        notes: property.notes ? String(property.notes) : null,
        description: property.description ? String(property.description) : null,
        imageUrls: urls,
        ownerId: property.owner_id,
        tenantId: property.tenant_id,
        createdAt: property.created_at,
        updatedAt: property.updated_at
      });
    }

    // Fetch active tenant from profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user);

    const isPublic = searchParams.get('public') === 'true';
    const tenantParam = searchParams.get('tenantId') || searchParams.get('tenant');
    const effectiveTenantId = activeTenantId || (isPublic ? tenantParam : null);

    let query = supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (effectiveTenantId && effectiveTenantId !== 'undefined' && effectiveTenantId !== 'all') {
      query = query.eq('tenant_id', effectiveTenantId);
    }

    if (isPublic) {
      // Vitrine pública: só exibe imóveis ativos e disponíveis ou reservados
      query = query.neq('status', 'inactive').neq('status', 'deleted');
    }

    if (ownerId && ownerId !== 'undefined' && ownerId !== 'all') {
      query = query.eq('owner_id', ownerId);
    }

    const limitParam = Number(searchParams.get('limit')) || (isPublic ? 150 : 60);
    const { data: properties, error } = await query.limit(limitParam);

    if (error) throw error;
    if (!properties || properties.length === 0) return NextResponse.json([]);

    // Fetch images
    const propertyIds = properties.map((p: any) => p.id);
    const { data: images, error: imagesError } = await supabase
      .from('property_images')
      .select('property_id, url')
      .in('property_id', propertyIds);

    if (imagesError) {
      console.warn("[API/Properties] Erro ao carregar fotos:", imagesError);
    }

    const items = properties.map((item: any) => {
      let urls: string[] = (images || [])
        .filter((img: any) => img.property_id === item.id)
        .map((img: any) => String(img.url));
      
      if (urls.length === 0 && item.image_url) {
        try {
          const parsed = typeof item.image_url === 'string' ? JSON.parse(item.image_url) : item.image_url;
          urls = Array.isArray(parsed) ? parsed : [String(item.image_url)];
        } catch {
          urls = [String(item.image_url)];
        }
      }

      return {
        id: item.id,
        title: String(item.title || "Sem título"),
        type: item.type,
        status: item.status,
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
        bathrooms: Number(item.bathrooms || 0),
        parkingSpots: Number(item.parking_spots || 0),
        acceptsFinancing: Boolean(item.accepts_financing),
        iptu: item.iptu !== null && item.iptu !== undefined ? Number(item.iptu) : null,
        condoFee: item.condo_fee !== null && item.condo_fee !== undefined ? Number(item.condo_fee) : null,
        buildingName: item.building_name ? String(item.building_name) : null,
        notes: item.notes ? String(item.notes) : null,
        description: item.description ? String(item.description) : null,
        tags: Array.isArray(item.tags)
          ? item.tags
          : (typeof item.tags === 'string'
              ? (item.tags.startsWith('[') ? (() => { try { return JSON.parse(item.tags); } catch { return []; } })() : item.tags.split(',').map((t: string) => t.trim()).filter(Boolean))
              : []),
        imageUrls: urls,
        ownerId: item.owner_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      };
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("[API/Properties] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json();
    console.log("[API/Properties] POST: Dados recebidos:", data);

    // Fetch active tenant from profile as a software isolation safeguard (zero HTTP auth roundtrip)
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user);
    if (activeTenantId) {
      data.tenant_id = activeTenantId;
    }
    
    const { imageUrls, ...sanitized } = data;
    if (data.tenant_id) {
      (sanitized as any).tenant_id = data.tenant_id;
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

    console.log("[API/Properties] POST: Inserindo na tabela 'properties'...");
    let { data: result, error } = await supabase
      .from('properties')
      .insert([sanitized])
      .select();

    // Fallback gracioso caso a coluna 'tags' ainda não tenha sido criada no Supabase pelo usuário
    if (error && (error.message?.includes('tags') || error.code === '42703' || (error.message?.includes('column') && error.message?.includes('does not exist')))) {
      console.warn("[API/Properties] POST: Coluna 'tags' ainda não criada no Supabase. Inserindo sem a coluna 'tags' temporariamente:", error.message);
      const fallbackSanitized = { ...sanitized };
      delete fallbackSanitized.tags;
      const retry = await supabase
        .from('properties')
        .insert([fallbackSanitized])
        .select();
      result = retry.data;
      error = retry.error;
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
        url: String(url)
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

    return NextResponse.json({ id: propertyId });
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

    const data = await req.json();
    console.log(`[API/Properties] PATCH ID ${id}: Dados recebidos:`, data);
    
    const { imageUrls, ...sanitized } = data;

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

    console.log(`[API/Properties] PATCH ID ${id}: Atualizando na tabela 'properties'...`);
    let { error } = await supabase
      .from('properties')
      .update(sanitized)
      .eq('id', id);

    // Fallback gracioso caso a coluna 'tags' ainda não tenha sido criada no Supabase pelo usuário
    if (error && (error.message?.includes('tags') || error.code === '42703' || (error.message?.includes('column') && error.message?.includes('does not exist')))) {
      console.warn(`[API/Properties] PATCH ID ${id}: Coluna 'tags' ainda não criada no Supabase. Atualizando sem a coluna 'tags':`, error.message);
      const fallbackSanitized = { ...sanitized };
      delete fallbackSanitized.tags;
      const retry = await supabase
        .from('properties')
        .update(fallbackSanitized)
        .eq('id', id);
      error = retry.error;
    }

    if (error) {
      console.error(`[API/Properties] PATCH ID ${id} error:`, error);
      throw error;
    }

    if (imageUrls && Array.isArray(imageUrls)) {
      console.log(`[API/Properties] PATCH ID ${id}: Sincronizando ${imageUrls.length} imagens...`);
      // Sync images
      const { error: delError } = await supabase.from('property_images').delete().eq('property_id', id);
      if (delError) console.warn(`[API/Properties] PATCH ID ${id}: Erro ao limpar imagens antigas:`, delError);
      
      if (imageUrls.length > 0) {
        const imageInserts = imageUrls.map(url => ({
          property_id: id,
          url: String(url)
        }));
        const { error: insError } = await supabase.from('property_images').insert(imageInserts);
        if (insError) console.warn(`[API/Properties] PATCH ID ${id}: Erro ao inserir novas imagens:`, insError);
      }
      console.log(`[API/Properties] PATCH ID ${id}: Imagens sincronizadas.`);
    }

    return NextResponse.json({ success: true });
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

    console.log(`[API/Properties] DELETE ID ${id}: Iniciando remoção...`);

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
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Properties] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
