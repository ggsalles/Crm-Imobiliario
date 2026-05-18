import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

    let query = supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (ownerId && ownerId !== 'undefined') {
      query = query.eq('owner_id', ownerId);
    }

    const { data: properties, error } = await query.limit(60);

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
        notes: item.notes ? String(item.notes) : null,
        description: item.description ? String(item.description) : null,
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
    
    const { imageUrls, ...sanitized } = data;

    console.log("[API/Properties] POST: Inserindo na tabela 'properties'...");
    const { data: result, error } = await supabase
      .from('properties')
      .insert([sanitized])
      .select();

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
    if (!id) throw new Error("ID required for PATCH");

    const data = await req.json();
    console.log(`[API/Properties] PATCH ID ${id}: Dados recebidos:`, data);
    
    const { imageUrls, ...sanitized } = data;

    console.log(`[API/Properties] PATCH ID ${id}: Atualizando na tabela 'properties'...`);
    const { error } = await supabase
      .from('properties')
      .update(sanitized)
      .eq('id', id);

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
    if (!id) throw new Error("ID required");

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
