import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getBlockedTenantIds, setTenantBlocked, getSaaSConfig, getTenantBillingStatus } from '@/lib/billing';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || "";

function getSupabase(req: NextRequest) {
  // Se houver a chave de serviço administrativa do Supabase, priorizar o seu uso no backend
  // para evitar loops RLS lentos ou loops de planejamento de consultas nas tabelas de tenants.
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const hasCacheBuster = searchParams.has('t') || !!id;
    const config = await getSaaSConfig(hasCacheBuster);
    const blockedIds = config.blockedTenantIds || [];

    if (id) {
      if (id === '99999999-9999-9999-9999-999999999999') {
        return NextResponse.json(null); // Hide system config
      }
      
      const { data, error } = await supabase.from('tenants').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json(null);

      const billingResult = getTenantBillingStatus(config, data.id);
      const isBlocked = data.id !== '11111111-1111-1111-1111-111111111111' && 
                        (blockedIds.includes(data.id) || billingResult.status === 'bloqueado');

      return NextResponse.json({
        id: data.id,
        name: data.id === '11111111-1111-1111-1111-111111111111' ? 'SalesScore' : data.name,
        slug: data.slug,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        isBlocked,
        billingStatus: billingResult.status,
        billingSuspensionDate: billingResult.suspendedUntilStr,
        dueDay: billingResult.dueDay
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
    }

    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    
    // Garantir que o tenant padrão "SalesScore" está sempre presente na lista para multi-inquilinato correto
    // E filtrar o tenant de configuração interna para não vazar na listagem
    const rawTenants = tenants ? [...tenants] : [];
    const finalTenants = rawTenants.filter((t: any) => t.id !== '99999999-9999-9999-9999-999999999999');
    
    const hasDefault = finalTenants.some((t: any) => t.id === '11111111-1111-1111-1111-111111111111');
    if (!hasDefault) {
      finalTenants.unshift({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'SalesScore',
        slug: 'default',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const items = finalTenants.map((item: any) => {
      const billingResult = getTenantBillingStatus(config, item.id);
      const isBlocked = item.id !== '11111111-1111-1111-1111-111111111111' && 
                        (blockedIds.includes(item.id) || billingResult.status === 'bloqueado');

      return {
        id: item.id,
        name: item.id === '11111111-1111-1111-1111-111111111111' ? 'SalesScore' : item.name,
        slug: item.slug,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        isBlocked,
        billingStatus: billingResult.status,
        billingSuspensionDate: billingResult.suspendedUntilStr,
        dueDay: billingResult.dueDay
      };
    });

    return NextResponse.json(items, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: any) {
    console.error("[API/Tenants] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const data = await req.json();
    
    // Auto generate slug if not provided
    if (!data.slug && data.name) {
      data.slug = data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    }

    const { data: result, error } = await supabase
      .from('tenants')
      .insert([data])
      .select();

    if (error) throw error;
    if (!result || result.length === 0) throw new Error("Failed to create tenant");

    return NextResponse.json({ id: result[0].id, name: result[0].name, slug: result[0].slug });
  } catch (error: any) {
    console.error("[API/Tenants] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    // Catch and process isBlocked / is_blocked dynamic property
    const isBlockedParam = data.isBlocked !== undefined ? data.isBlocked : data.is_blocked;
    if (isBlockedParam !== undefined) {
      await setTenantBlocked(id, !!isBlockedParam);
      delete data.isBlocked;
      delete data.is_blocked;
    }

    // Only update Supabase if we have additional properties left to update
    if (Object.keys(data).length > 0) {
      data.updated_at = new Date().toISOString();
      const { error } = await supabase
        .from('tenants')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Tenants] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    // Protection to prevent deleting the default tenant
    if (id === '11111111-1111-1111-1111-111111111111') {
      return NextResponse.json({ error: "The default tenant cannot be deleted." }, { status: 400 });
    }

    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Tenants] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
