import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';
import { normalizeReferenceCode, validateReferenceCodeStructure } from '@/lib/reference-codes';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const rawCode = searchParams.get('code');
    const excludeId = searchParams.get('excludeId');
    const selectedType = searchParams.get('type');

    if (!rawCode || !rawCode.trim()) {
      return NextResponse.json({ available: true, normalizedCode: '', isValid: true });
    }

    // 1. Validação estrutural de formato e sigla oficial
    const validation = validateReferenceCodeStructure(rawCode, selectedType);
    if (!validation.isValid) {
      return NextResponse.json({
        available: false,
        isValid: false,
        normalizedCode: validation.normalizedCode,
        error: validation.error,
        suggestion: validation.suggestion
      });
    }

    const normalizedCode = validation.normalizedCode;
    const user = getAuthenticatedUser(req);
    const activeTenantId = await getActiveTenantId(supabase, user, req);

    // 2. Consulta no banco se o código já está em uso
    let query = supabase
      .from('properties')
      .select('id, title, reference_code')
      .eq('reference_code', normalizedCode)
      .limit(1);

    if (activeTenantId) {
      query = query.eq('tenant_id', activeTenantId);
    }

    if (excludeId && excludeId !== 'undefined' && excludeId !== 'null') {
      query = query.neq('id', excludeId);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.warn('[check-reference] Erro ao consultar Supabase:', error);
      return NextResponse.json({
        available: true,
        isValid: true,
        normalizedCode,
        warning: validation.warning
      });
    }

    if (rows && rows.length > 0) {
      const conflict = rows[0];
      return NextResponse.json({
        available: false,
        isValid: true,
        isDuplicate: true,
        normalizedCode,
        error: `O código de referência "${normalizedCode}" já está em uso pelo imóvel "${conflict.title || 'Sem título'}".`,
        conflict: {
          id: conflict.id,
          title: conflict.title || 'Imóvel sem título',
          referenceCode: conflict.reference_code
        }
      });
    }

    return NextResponse.json({
      available: true,
      isValid: true,
      normalizedCode,
      warning: validation.warning
    });
  } catch (err: any) {
    console.error('[check-reference] Exceção:', err);
    return NextResponse.json({ available: true, isValid: true, normalizedCode: '' });
  }
}
