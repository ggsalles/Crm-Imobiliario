import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getBlockedTenantIds, setTenantBlocked, setTenantUnlocked, getSaaSConfig, getTenantBillingStatus, setTenantUserLimit } from '@/lib/billing';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME, DEFAULT_USER_LIMIT_PER_TENANT } from '@/lib/constants';

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

      const billingResult = getTenantBillingStatus(config, data.id, new Date(), data.created_at);
      const isManuallyUnlocked = Boolean(
        billingResult.isManuallyUnlocked || 
        (config.unlockedTenantIds && config.unlockedTenantIds.includes(data.id))
      );
      const isBlocked = !isManuallyUnlocked && (
        (data.is_blocked === true) || 
        blockedIds.includes(data.id) || 
        billingResult.status === 'bloqueado'
      );
      const userLimit = data.user_limit ?? config.userLimits?.[data.id] ?? DEFAULT_USER_LIMIT_PER_TENANT;
      const dueDay = data.due_day ?? billingResult.dueDay;

      return NextResponse.json({
        id: data.id,
        name: data.id === DEFAULT_TENANT_ID ? DEFAULT_TENANT_NAME : data.name,
        slug: data.slug,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        isBlocked,
        isManuallyUnlocked,
        userLimit,
        billingStatus: billingResult.status,
        billingSuspensionDate: billingResult.suspendedUntilStr,
        dueDay: data.due_day ?? billingResult.dueDay,
        diffDays: billingResult.diffDays,
        overdueCount: billingResult.overdueCount || 0,
        oldestOverdueMonthKey: billingResult.oldestOverdueMonthKey || '',
        cnpj: data.cnpj || '',
        city: data.city || '',
        state: data.state || '',
        phone: data.phone || '',
        contactEmail: data.contact_email || '',
        basePrice: data.base_price !== undefined && data.base_price !== null ? Number(data.base_price) : 499.00,
        brokerLimit: data.broker_limit !== undefined && data.broker_limit !== null ? Number(data.broker_limit) : (userLimit || 2),
        adminLimit: data.admin_limit !== undefined && data.admin_limit !== null ? Number(data.admin_limit) : 1,
        extraBrokerPrice: data.extra_broker_price !== undefined && data.extra_broker_price !== null ? Number(data.extra_broker_price) : 29.90,
        extraAdminPrice: data.extra_admin_price !== undefined && data.extra_admin_price !== null ? Number(data.extra_admin_price) : 49.90,
        plan: data.plan || 'ativo'
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
    
    // Garantir que o tenant padrão está sempre presente na lista para multi-inquilinato correto
    // E filtrar o tenant de configuração interna para não vazar na listagem
    const rawTenants = tenants ? [...tenants] : [];
    const finalTenants = rawTenants.filter((t: any) => t.id !== '99999999-9999-9999-9999-999999999999');
    
    const hasDefault = finalTenants.some((t: any) => t.id === DEFAULT_TENANT_ID);
    if (!hasDefault) {
      finalTenants.unshift({
        id: DEFAULT_TENANT_ID,
        name: DEFAULT_TENANT_NAME,
        slug: 'default',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const items = finalTenants.map((item: any) => {
      const billingResult = getTenantBillingStatus(config, item.id, new Date(), item.created_at);
      const isManuallyUnlocked = Boolean(
        billingResult.isManuallyUnlocked || 
        (config.unlockedTenantIds && config.unlockedTenantIds.includes(item.id))
      );
      const isBlocked = !isManuallyUnlocked && (
        (item.is_blocked === true) || 
        blockedIds.includes(item.id) || 
        billingResult.status === 'bloqueado'
      );
      const userLimit = item.user_limit ?? config.userLimits?.[item.id] ?? DEFAULT_USER_LIMIT_PER_TENANT;
      const dueDay = item.due_day ?? billingResult.dueDay;

      return {
        id: item.id,
        name: item.id === DEFAULT_TENANT_ID ? DEFAULT_TENANT_NAME : item.name,
        slug: item.slug,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        isBlocked,
        isManuallyUnlocked,
        userLimit,
        billingStatus: billingResult.status,
        billingSuspensionDate: billingResult.suspendedUntilStr,
        dueDay: item.due_day ?? billingResult.dueDay,
        diffDays: billingResult.diffDays,
        overdueCount: billingResult.overdueCount || 0,
        oldestOverdueMonthKey: billingResult.oldestOverdueMonthKey || '',
        cnpj: item.cnpj || '',
        city: item.city || '',
        state: item.state || '',
        phone: item.phone || '',
        contactEmail: item.contact_email || '',
        basePrice: item.base_price !== undefined && item.base_price !== null ? Number(item.base_price) : 499.00,
        brokerLimit: item.broker_limit !== undefined && item.broker_limit !== null ? Number(item.broker_limit) : (userLimit || 2),
        adminLimit: item.admin_limit !== undefined && item.admin_limit !== null ? Number(item.admin_limit) : 1,
        extraBrokerPrice: item.extra_broker_price !== undefined && item.extra_broker_price !== null ? Number(item.extra_broker_price) : 29.90,
        extraAdminPrice: item.extra_admin_price !== undefined && item.extra_admin_price !== null ? Number(item.extra_admin_price) : 49.90,
        plan: item.plan || 'ativo'
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
    
    // Extract and handle userLimit if present
    const userLimitParam = data.userLimit !== undefined ? Number(data.userLimit) : undefined;
    delete data.userLimit;
    if (userLimitParam !== undefined) {
      data.user_limit = userLimitParam;
    }

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

    if (userLimitParam !== undefined) {
      await setTenantUserLimit(result[0].id, userLimitParam);
    }

    return NextResponse.json({ 
      id: result[0].id, 
      name: result[0].name, 
      slug: result[0].slug,
      userLimit: userLimitParam ?? DEFAULT_USER_LIMIT_PER_TENANT
    });
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
    const updatePayload: Record<string, any> = { ...data };

    // Catch and process userLimit
    if (data.userLimit !== undefined) {
      const numLimit = Number(data.userLimit);
      await setTenantUserLimit(id, numLimit);
      updatePayload.user_limit = numLimit;
      delete updatePayload.userLimit;
    }

    // Catch and process isBlocked / is_blocked dynamic property
    const isBlockedParam = data.isBlocked !== undefined ? data.isBlocked : data.is_blocked;
    const isManuallyUnlockedParam = data.isManuallyUnlocked;

    if (isBlockedParam !== undefined) {
      if (isBlockedParam) {
        await setTenantBlocked(id, true);
        await setTenantUnlocked(id, false);
        updatePayload.is_blocked = true;
      } else {
        await setTenantBlocked(id, false);
        if (isManuallyUnlockedParam) {
          await setTenantUnlocked(id, true);
        }
        updatePayload.is_blocked = false;
      }
      delete updatePayload.isBlocked;
    }

    if (isManuallyUnlockedParam !== undefined) {
      await setTenantUnlocked(id, !!isManuallyUnlockedParam);
      delete updatePayload.isManuallyUnlocked;
    }

    if (data.dueDay !== undefined || data.due_day !== undefined) {
      updatePayload.due_day = Number(data.dueDay ?? data.due_day);
      delete updatePayload.dueDay;
    }

    if (data.contactEmail !== undefined) {
      updatePayload.contact_email = data.contactEmail;
      delete updatePayload.contactEmail;
    }

    if (data.basePrice !== undefined || data.base_price !== undefined) {
      updatePayload.base_price = Number(data.basePrice ?? data.base_price);
      delete updatePayload.basePrice;
    }

    if (data.brokerLimit !== undefined || data.broker_limit !== undefined) {
      const bLimit = Number(data.brokerLimit ?? data.broker_limit);
      updatePayload.broker_limit = bLimit;
      updatePayload.user_limit = bLimit; // Keep general limit aligned
      delete updatePayload.brokerLimit;
    }

    if (data.adminLimit !== undefined || data.admin_limit !== undefined) {
      updatePayload.admin_limit = Number(data.adminLimit ?? data.admin_limit);
      delete updatePayload.adminLimit;
    }

    if (data.extraBrokerPrice !== undefined || data.extra_broker_price !== undefined) {
      updatePayload.extra_broker_price = Number(data.extraBrokerPrice ?? data.extra_broker_price);
      delete updatePayload.extraBrokerPrice;
    }

    if (data.extraAdminPrice !== undefined || data.extra_admin_price !== undefined) {
      updatePayload.extra_admin_price = Number(data.extraAdminPrice ?? data.extra_admin_price);
      delete updatePayload.extraAdminPrice;
    }

    // Update Supabase native record
    if (Object.keys(updatePayload).length > 0) {
      updatePayload.updated_at = new Date().toISOString();
      const { error } = await supabase
        .from('tenants')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
        console.warn("[API/Tenants] Notice on update:", error.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Tenants] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const PUT = PATCH;

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "Valid ID required for DELETE" }, { status: 400 });
    }

    // Protection to prevent deleting the default tenant
    if (id === DEFAULT_TENANT_ID) {
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
