import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';
import { DEFAULT_TENANT_ID, isPlatformAdmin } from '@/lib/constants';

export const dynamic = 'force-dynamic';

function getPropertyTypePrefix(propType: string): string {
  const t = (propType || '').toLowerCase().trim();
  switch (t) {
    case 'apartamento': return 'AP';
    case 'casa': return 'CA';
    case 'condomínio':
    case 'condominio': return 'CD';
    case 'sobrado': return 'SO';
    case 'cobertura': return 'CO';
    case 'studio': return 'ST';
    case 'sala': return 'SL';
    case 'comercial': return 'CM';
    case 'galpão':
    case 'galpao': return 'GP';
    case 'prédio':
    case 'predio': return 'PR';
    case 'terreno': return 'TR';
    case 'sítio':
    case 'sitio': return 'SI';
    case 'chácara':
    case 'chacara': return 'CH';
    case 'fazenda': return 'FZ';
    default: return 'IM';
  }
}

// In-memory cache for fast matching during batch stream
interface TenantPropertyIndex {
  loadedAt: number;
  tokkoMap: Map<string, { id: string; reference_code: string; type: string; status: string }>;
  refMap: Map<string, { id: string; reference_code: string; type: string; status: string }>;
  maxSeqByType: Map<string, number>;
}

const tenantIndexes = new Map<string, TenantPropertyIndex>();

async function getOrBuildTenantIndex(supabase: any, tenantId: string): Promise<TenantPropertyIndex> {
  const existing = tenantIndexes.get(tenantId);
  const now = Date.now();
  if (existing && (now - existing.loadedAt) < 180000) { // 3 minutes cache
    return existing;
  }

  const tokkoMap = new Map<string, { id: string; reference_code: string; type: string; status: string }>();
  const refMap = new Map<string, { id: string; reference_code: string; type: string; status: string }>();
  const maxSeqByType = new Map<string, number>();

  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('properties')
      .select('id, reference_code, type, status, image_url, notes')
      .eq('tenant_id', tenantId)
      .range(from, from + step - 1);

    if (error || !data || data.length === 0) break;

    for (const p of data) {
      let tokkoId: string | null = null;
      if (p.image_url) {
        const m = p.image_url.match(/static\.tokkobroker\.com\/(?:w_pics|thumbs|original_pictures)\/(\d+)_/);
        if (m) tokkoId = m[1];
      }
      if (!tokkoId && p.notes) {
        const m = p.notes.match(/Tokko ID:?\s*(\d+)/i);
        if (m) tokkoId = m[1];
      }

      const itemMeta = {
        id: p.id,
        reference_code: p.reference_code || '',
        type: p.type || 'apartamento',
        status: p.status || 'disponível'
      };

      if (tokkoId) {
        tokkoMap.set(tokkoId, itemMeta);
      }

      if (p.reference_code) {
        const cleanRef = p.reference_code.trim().toUpperCase();
        refMap.set(cleanRef, itemMeta);
        const matchSeq = cleanRef.match(/^([A-Za-z]+)(\d+)$/);
        if (matchSeq) {
          const prefix = matchSeq[1].toUpperCase();
          const num = parseInt(matchSeq[2], 10);
          const currentMax = maxSeqByType.get(prefix) || 0;
          if (num > currentMax) maxSeqByType.set(prefix, num);
        }
      }
    }

    if (data.length < step) break;
    from += step;
  }

  const index: TenantPropertyIndex = {
    loadedAt: now,
    tokkoMap,
    refMap,
    maxSeqByType
  };

  tenantIndexes.set(tenantId, index);
  return index;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const user = getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const { kind, items, targetTenantId, mode = 'sync' } = body;

    // 1. Authorization: Only ggsalles or authorized admins can run bulk imports/sync
    let userEmail = (user?.email || req.headers.get('x-user-email') || body.userEmail || '').toLowerCase().trim();
    
    if (!userEmail && user?.id) {
      const { data: prof } = await supabase.from('profiles').select('email, role').eq('id', user.id).maybeSingle();
      if (prof?.email) {
        userEmail = prof.email.toLowerCase().trim();
      }
    }

    const isAuthorized = userEmail === 'ggsalles@gmail.com' || userEmail.includes('salles') || isPlatformAdmin(userEmail) || user?.role === 'admin';
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Acesso negado. A sincronização de dados é restrita ao administrador.' },
        { status: 403 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Nenhum item fornecido para sincronização.' }, { status: 400 });
    }

    // 2. Resolve target tenant
    const activeTenantId = await getActiveTenantId(supabase, user, req);
    const resolvedTenantId = targetTenantId || activeTenantId || 'c177f8cd-71b6-4bdc-a26d-4d26af076b4f';
    const ownerId = user?.id || 'admin';

    let insertedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // 3. Process Properties in Smart Sync / Update Mode
    if (kind === 'properties') {
      const index = await getOrBuildTenantIndex(supabase, resolvedTenantId);

      for (const prop of items) {
        try {
          const tokkoExternalId = String(prop.externalId || '').trim();
          const incomingRefCode = prop.referenceCode ? String(prop.referenceCode).trim().toUpperCase() : '';

          // Look for existing property by Tokko ID or matching reference code
          let matchedProperty = tokkoExternalId ? index.tokkoMap.get(tokkoExternalId) : undefined;
          if (!matchedProperty && incomingRefCode) {
            matchedProperty = index.refMap.get(incomingRefCode);
          }

          if (mode === 'sync' && matchedProperty) {
            // === SCENARIO A: PROPERTY ALREADY EXISTS IN DATABASE ===
            // PRESERVE the existing reference_code (e.g. AP2016 remains AP2016!)
            // UPDATE: image_url (with refreshed CDN tokens), status, and updated_at
            const updatePayload: Record<string, any> = {
              status: prop.status || 'disponível',
              updated_at: new Date().toISOString()
            };

            if (Array.isArray(prop.imageUrls) && prop.imageUrls.length > 0) {
              updatePayload.image_url = JSON.stringify(prop.imageUrls);
            }

            if (prop.price && Number(prop.price) > 0) {
              updatePayload.price = Number(prop.price);
            }
            if (prop.condoFee) updatePayload.condo_fee = Number(prop.condoFee);
            if (prop.iptu) updatePayload.iptu = Number(prop.iptu);

            const { error: updateError } = await supabase
              .from('properties')
              .update(updatePayload)
              .eq('id', matchedProperty.id);

            if (updateError) {
              console.warn(`[Sync/Properties] Erro ao atualizar ${matchedProperty.reference_code || matchedProperty.id}:`, updateError.message);
              failedCount++;
              if (errors.length < 5) errors.push(`${matchedProperty.reference_code}: ${updateError.message}`);
              continue;
            }

            // Sync property_images table if exists
            if (Array.isArray(prop.imageUrls) && prop.imageUrls.length > 0) {
              await supabase.from('property_images').delete().eq('property_id', matchedProperty.id).catch(() => {});
              const imageRows = prop.imageUrls.slice(0, 30).map((url: string) => ({
                property_id: matchedProperty.id,
                url: String(url)
              }));
              await supabase.from('property_images').insert(imageRows).catch(() => {});
            }

            updatedCount++;
          } else {
            // === SCENARIO B: NEW PROPERTY NOT YET IN DATABASE ===
            // Generate next sequential reference_code for this type
            const propType = prop.type || 'apartamento';
            const prefix = getPropertyTypePrefix(propType);
            const currentMax = index.maxSeqByType.get(prefix) || 0;
            const nextSeq = currentMax + 1;
            index.maxSeqByType.set(prefix, nextSeq);

            const generatedRef = `${prefix}${String(nextSeq).padStart(4, '0')}`;

            const propertyData: Record<string, any> = {
              title: prop.title || 'Imóvel sem título',
              type: propType,
              status: prop.status || 'disponível',
              price: Number(prop.price) || 0,
              location: prop.location || prop.street || '',
              cep: prop.cep || '',
              street: prop.street || '',
              neighborhood: prop.neighborhood || '',
              city: prop.city || 'Niterói',
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
              reference_code: generatedRef,
              notes: prop.ownerName ? `Proprietário: ${prop.ownerName} (${prop.ownerPhone || 'Sem telefone'})` : (tokkoExternalId ? `Tokko ID: ${tokkoExternalId}` : null),
              tags: Array.isArray(prop.tags) ? prop.tags : [],
              image_url: Array.isArray(prop.imageUrls) && prop.imageUrls.length > 0 ? JSON.stringify(prop.imageUrls) : null,
              owner_id: ownerId,
              tenant_id: resolvedTenantId,
              created_at: prop.createdAt || new Date().toISOString()
            };

            let { data: inserted, error: insertError } = await supabase
              .from('properties')
              .insert([propertyData])
              .select();

            if (insertError && (insertError.message?.includes('tags') || insertError.message?.includes('suites') || insertError.message?.includes('reference_code') || insertError.code === '42703')) {
              const fallbackData = { ...propertyData };
              delete fallbackData.tags;
              delete fallbackData.suites;
              delete fallbackData.reference_code;
              const retry = await supabase.from('properties').insert([fallbackData]).select();
              inserted = retry.data;
              insertError = retry.error;
            }

            if (insertError) {
              console.warn(`[Import/Properties] Erro no item ${generatedRef}:`, insertError.message);
              failedCount++;
              if (errors.length < 5) errors.push(`${generatedRef}: ${insertError.message}`);
              continue;
            }

            const propId = inserted?.[0]?.id;
            insertedCount++;

            // Register in in-memory index for subsequent items in same stream
            if (tokkoExternalId && propId) {
              index.tokkoMap.set(tokkoExternalId, { id: propId, reference_code: generatedRef, type: propType, status: prop.status || 'disponível' });
            }
            if (propId) {
              index.refMap.set(generatedRef, { id: propId, reference_code: generatedRef, type: propType, status: prop.status || 'disponível' });
            }

            if (propId && Array.isArray(prop.imageUrls) && prop.imageUrls.length > 0) {
              const imageRows = prop.imageUrls.slice(0, 30).map((url: string) => ({
                property_id: propId,
                url: String(url)
              }));
              await supabase.from('property_images').insert(imageRows).catch(() => {});
            }
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
      return NextResponse.json({ error: 'Tipo de operação inválido.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      kind,
      tenantId: resolvedTenantId,
      updatedCount,
      insertedCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('[API/Import/Tokko] Erro geral:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
