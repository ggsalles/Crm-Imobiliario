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

  // 1. Consulta inicial otimizada buscando os códigos mais recentes com ordenação decrescente
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

  // 2. Varredura paginada completa (ranges de 1000) para garantir precisão absoluta
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let pageQuery = supabase
      .from('properties')
      .select('reference_code')
      .ilike('reference_code', `${prefix}%`)
      .range(from, from + pageSize - 1);

    if (activeTenantId) {
      pageQuery = pageQuery.eq('tenant_id', activeTenantId);
    }

    const { data: pageRows, error: pageErr } = await pageQuery;
    if (pageErr || !pageRows || pageRows.length === 0) break;

    for (const p of pageRows) {
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

    if (pageRows.length < pageSize) break;
    from += pageSize;
  }

  // 3. Incrementa e garante que o código gerado não colida com nenhum existente
  let candidateNum = maxNum + 1;
  let nextCode = `${prefix}${String(candidateNum).padStart(4, '0')}`;

  while (true) {
    let checkQuery = supabase
      .from('properties')
      .select('id')
      .eq('reference_code', nextCode);

    if (activeTenantId) {
      checkQuery = checkQuery.eq('tenant_id', activeTenantId);
    }

    const { data: collision } = await checkQuery.maybeSingle();
    if (!collision) {
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
