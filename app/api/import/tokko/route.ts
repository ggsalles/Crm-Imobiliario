import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';
import { DEFAULT_TENANT_ID } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const user = getAuthenticatedUser(req);
    const body = await req.json();
    const { kind, items, targetTenantId } = body;

    // 1. Rigorous Authorization: Only ggsalles or authorized admins can run bulk imports
    let userEmail = (user?.email || req.headers.get('x-user-email') || body.userEmail || '').toLowerCase().trim();
    
    if (!userEmail && user?.id) {
      const { data: prof } = await supabase.from('profiles').select('email, role').eq('id', user.id).maybeSingle();
      if (prof?.email) {
        userEmail = prof.email.toLowerCase().trim();
      }
    }

    const isAuthorized = userEmail === 'ggsalles@gmail.com' || userEmail.includes('salles') || user?.role === 'admin';
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Acesso negado. A ferramenta de importação em lote é restrita ao administrador ggsalles.' },
        { status: 403 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Nenhum item fornecido para importação.' }, { status: 400 });
    }

    // 2. Resolve target tenant
    const activeTenantId = await getActiveTenantId(supabase, user, req);
    const resolvedTenantId = targetTenantId || activeTenantId || DEFAULT_TENANT_ID;
    const ownerId = user?.id || 'admin';

    let insertedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // 3. Process Properties in Bulk
    if (kind === 'properties') {
      for (const prop of items) {
        try {
          const propertyData: Record<string, any> = {
            title: prop.title || 'Imóvel sem título',
            type: prop.type || 'apartamento',
            status: prop.status || 'disponível',
            price: Number(prop.price) || 0,
            location: prop.location || prop.street || '',
            cep: prop.cep || '',
            street: prop.street || '',
            neighborhood: prop.neighborhood || '',
            city: prop.city || 'São Gonçalo',
            state: prop.state || 'RJ',
            number: prop.number || '',
            area: Number(prop.area) || 50,
            bedrooms: Number(prop.bedrooms) || 0,
            suites: Number(prop.suites) || 0,
            bathrooms: Number(prop.bathrooms) || 1,
            parking_spots: Number(prop.parkingSpots) || 0,
            iptu: prop.iptu ? Number(prop.iptu) : null,
            condo_fee: prop.condoFee ? Number(prop.condoFee) : null,
            building_name: prop.buildingName || null,
            description: prop.description || null,
            notes: prop.ownerName ? `Proprietário: ${prop.ownerName} (${prop.ownerPhone || 'Sem telefone'})` : (prop.referenceCode ? `Ref: ${prop.referenceCode}` : null),
            tags: Array.isArray(prop.tags) ? prop.tags : [],
            image_url: Array.isArray(prop.imageUrls) && prop.imageUrls.length > 0 ? JSON.stringify(prop.imageUrls) : null,
            owner_id: ownerId,
            tenant_id: resolvedTenantId,
            created_at: prop.createdAt || new Date().toISOString()
          };

          // Try inserting
          let { data: inserted, error: insertError } = await supabase
            .from('properties')
            .insert([propertyData])
            .select();

          // Fallback if certain optional columns are not yet in the table schema
          if (insertError && (insertError.message?.includes('tags') || insertError.message?.includes('suites') || insertError.code === '42703')) {
            const fallbackData = { ...propertyData };
            delete fallbackData.tags;
            delete fallbackData.suites;
            const retry = await supabase.from('properties').insert([fallbackData]).select();
            inserted = retry.data;
            insertError = retry.error;
          }

          if (insertError) {
            console.warn(`[Import/Properties] Erro no item ${prop.referenceCode || prop.title}:`, insertError.message);
            failedCount++;
            if (errors.length < 5) errors.push(`${prop.referenceCode || prop.title}: ${insertError.message}`);
            continue;
          }

          const propId = inserted?.[0]?.id;
          insertedCount++;

          // Also insert images into property_images if table exists
          if (propId && Array.isArray(prop.imageUrls) && prop.imageUrls.length > 0) {
            const imageRows = prop.imageUrls.slice(0, 30).map((url: string) => ({
              property_id: propId,
              url: String(url)
            }));
            await supabase.from('property_images').insert(imageRows).catch(() => {});
          }
        } catch (err: any) {
          failedCount++;
          if (errors.length < 5) errors.push(err.message || 'Erro inesperado');
        }
      }
    } 
    // 4. Process Contacts in Bulk
    else if (kind === 'contacts') {
      for (const contact of items) {
        try {
          const contactData: Record<string, any> = {
            name: contact.name || 'Contato sem nome',
            email: contact.email || '',
            phone: contact.phone || '',
            type: 'cliente',
            role: 'manual_morno',
            source: contact.source || 'Tokko Broker',
            department: contact.featuredPropertyRef ? `Interesse em Ref: ${contact.featuredPropertyRef}` : (contact.leadStatus || ''),
            owner_id: ownerId,
            tenant_id: resolvedTenantId,
            created_at: contact.createdAt || new Date().toISOString()
          };

          const { error: insertError } = await supabase
            .from('contacts')
            .insert([contactData]);

          if (insertError) {
            failedCount++;
            if (errors.length < 5) errors.push(`${contact.name}: ${insertError.message}`);
            continue;
          }

          insertedCount++;
        } catch (err: any) {
          failedCount++;
          if (errors.length < 5) errors.push(err.message || 'Erro inesperado');
        }
      }
    } else {
      return NextResponse.json({ error: 'Tipo de importação inválido.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      kind,
      tenantId: resolvedTenantId,
      insertedCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('[API/Import/Tokko] Erro geral:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
