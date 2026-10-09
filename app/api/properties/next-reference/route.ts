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

function getPrefix(type?: string | null): string {
  if (!type) return 'IM';
  const clean = String(type).trim().toLowerCase();
  return TYPE_PREFIXES[clean] || 'IM';
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'apartamento';
    const prefix = getPrefix(type);

    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    let query = supabase
      .from('properties')
      .select('reference_code')
      .ilike('reference_code', `${prefix}%`);

    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    const { data: properties } = await query;

    let maxNum = 0;
    if (properties && Array.isArray(properties)) {
      for (const p of properties) {
        if (p.reference_code) {
          const numPart = p.reference_code.replace(/^[A-Za-z]+/, '');
          const parsed = parseInt(numPart, 10);
          if (!isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        }
      }
    }

    const nextNum = maxNum + 1;
    const nextCode = `${prefix}${String(nextNum).padStart(4, '0')}`;

    return NextResponse.json({ nextCode });
  } catch (error: any) {
    console.warn('[API/Properties/NextReference] Error:', error);
    return NextResponse.json({ nextCode: 'IM0001' });
  }
}
