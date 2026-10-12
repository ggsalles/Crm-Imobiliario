import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const TYPE_PREFIXES: Record<string, string> = {
  apartamento: 'AP',
  casa: 'CA',
  'condomínio': 'CD',
  condominio: 'CD',
  sobrado: 'SO',
  cobertura: 'CO',
  studio: 'ST',
  sala: 'SL',
  comercial: 'CM',
  'galpão': 'GP',
  galpao: 'GP',
  'prédio': 'PR',
  predio: 'PR',
  terreno: 'TR',
  'sítio': 'SI',
  sitio: 'SI',
  'chácara': 'CH',
  chacara: 'CH',
  fazenda: 'FZ'
};

export function getPropertyPrefix(type?: string | null): string {
  if (!type) return 'IM';
  const clean = String(type).trim().toLowerCase();
  return TYPE_PREFIXES[clean] || 'IM';
}

export async function calculateNextReferenceCode(supabase: any, type: string, activeTenantId?: string | null): Promise<string> {
  const prefix = getPropertyPrefix(type);

  // 1. Consulta inicial dos códigos mais recentes ordenados decrescente
  let orderQuery = supabase
    .from('properties')
    .select('reference_code')
    .ilike('reference_code', `${prefix}%`)
    .order('reference_code', { ascending: false })
    .limit(200);

  if (activeTenantId) {
    orderQuery = orderQuery.eq('tenant_id', activeTenantId);
  }

  const { data: topProperties } = await orderQuery;

  let maxNum = 0;
  if (topProperties && Array.isArray(topProperties)) {
    for (const p of topProperties) {
      if (p.reference_code) {
        const match = p.reference_code.match(/^[A-Za-z]+(\d+)$/);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        }
      }
    }
  }

  // 2. Verifica a contagem total de imóveis para este prefixo
  let countQuery = supabase
    .from('properties')
    .select('*', { count: 'exact', head: true })
    .ilike('reference_code', `${prefix}%`);

  if (activeTenantId) {
    countQuery = countQuery.eq('tenant_id', activeTenantId);
  }

  const { count: totalCount } = await countQuery;

  // Se houver mais de 200 registros, executa varredura em paralelo (blocos de 1000)
  // para garantir que nenhuma numeração escape (ex: ordenação alfabética com dígitos diferentes)
  if (totalCount && totalCount > 200) {
    const pageSize = 1000;
    const pageCount = Math.ceil(totalCount / pageSize);
    const pageQueries = [];

    for (let i = 0; i < pageCount; i++) {
      let pq = supabase
        .from('properties')
        .select('reference_code')
        .ilike('reference_code', `${prefix}%`)
        .range(i * pageSize, (i + 1) * pageSize - 1);

      if (activeTenantId) {
        pq = pq.eq('tenant_id', activeTenantId);
      }
      pageQueries.push(pq);
    }

    const pageResults = await Promise.all(pageQueries);
    for (const res of pageResults) {
      if (res.data && Array.isArray(res.data)) {
        for (const p of res.data) {
          if (p.reference_code) {
            const match = p.reference_code.match(/^[A-Za-z]+(\d+)$/);
            if (match) {
              const parsed = parseInt(match[1], 10);
              if (!isNaN(parsed) && parsed > maxNum) {
                maxNum = parsed;
              }
            }
          }
        }
      }
    }
  }

  // 3. Incrementa e garante que o código gerado não colida com nenhum registro existente
  // CRÍTICO: Usa .limit(1) ao invés de .maybeSingle() para evitar erro PGRST116 se houver duplicidade
  let candidateNum = maxNum + 1;
  let nextCode = `${prefix}${String(candidateNum).padStart(4, '0')}`;

  while (true) {
    let checkQuery = supabase
      .from('properties')
      .select('id')
      .eq('reference_code', nextCode)
      .limit(1);

    if (activeTenantId) {
      checkQuery = checkQuery.eq('tenant_id', activeTenantId);
    }

    const { data: collisions } = await checkQuery;
    if (!collisions || collisions.length === 0) {
      break;
    }
    candidateNum++;
    nextCode = `${prefix}${String(candidateNum).padStart(4, '0')}`;
  }

  return nextCode;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'apartamento';

    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    const nextCode = await calculateNextReferenceCode(supabase, type, activeTenantId);

    return NextResponse.json({ nextCode });
  } catch (error: any) {
    console.warn('[API/Properties/NextReference] Error:', error);
    return NextResponse.json({ nextCode: 'IM0001' });
  }
}
