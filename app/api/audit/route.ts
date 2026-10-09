import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser } from '@/lib/server-auth';
import { isPlatformAdmin } from '@/lib/constants';
import { safeJsonParse } from '@/lib/safe-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || '';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    let authUser = getAuthenticatedUser(req);

    if (!authUser || !authUser.id) {
      const rawHeader = req.headers.get('Authorization');
      const token = (rawHeader?.startsWith('Bearer ') ? rawHeader.substring(7) : '').trim();
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
            const payload = safeJsonParse<any>(payloadJson);
            if (payload?.sub) {
              authUser = {
                id: payload.sub,
                email: payload.email,
                role: payload.role
              };
            }
          }
        } catch {}
      }
    }

    if (!authUser || !authUser.id) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { data: userProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, is_admin, tenant_id, email')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('[API/Audit] Erro ao carregar perfil:', profileErr);
    }

    const isMaster = isPlatformAdmin(authUser.email) || isPlatformAdmin(userProfile?.email);
    const isTenantAdmin = userProfile?.role === 'Admin' || userProfile?.is_admin === true;

    if (!isMaster && !isTenantAdmin) {
      return NextResponse.json({ 
        error: 'Acesso restrito. Apenas administradores e o usuário master têm permissão para acessar a auditoria.' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const requestedTenantId = searchParams.get('tenantId');
    const actionFilter = searchParams.get('action');
    const severityFilter = searchParams.get('severity');
    const userIdFilter = searchParams.get('userId');
    const limitParam = parseInt(searchParams.get('limit') || '150', 10);
    const limit = Math.min(Math.max(limitParam, 1), 500);

    let query = supabase
      .from('timeline')
      .select('*')
      .eq('category', 'audit')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Tenant scoping
    if (isMaster) {
      if (requestedTenantId && requestedTenantId !== 'all') {
        query = query.eq('tenant_id', requestedTenantId);
      }
    } else {
      // Tenant Admin is strictly scoped to their tenant
      const activeTenantId = userProfile?.tenant_id;
      if (activeTenantId) {
        query = query.eq('tenant_id', activeTenantId);
      }
    }

    if (userIdFilter && userIdFilter !== 'all') {
      query = query.eq('created_by', userIdFilter);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      console.error('[API/Audit] Erro ao buscar logs:', logsError);
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    // Optional post-filter for JSON metadata fields like action or severity
    let filteredLogs = logs || [];

    // Shielding: Non-master administrators should never see platform master actions
    if (!isMaster) {
      filteredLogs = filteredLogs.filter((log: any) => {
        const email = (log.metadata?.userEmail || log.author_name || '').toLowerCase();
        return !isPlatformAdmin(email);
      });
    }

    if (actionFilter && actionFilter !== 'all') {
      filteredLogs = filteredLogs.filter((log: any) => log.metadata?.action === actionFilter);
    }
    if (severityFilter && severityFilter !== 'all') {
      filteredLogs = filteredLogs.filter((log: any) => log.metadata?.severity === severityFilter);
    }

    // Dynamic enrichment: Ensure any log where author_name is an email displays the user's real display name
    try {
      const { data: profilesList } = await supabase
        .from('profiles')
        .select('id, email, display_name');
      if (profilesList && Array.isArray(profilesList)) {
        const nameById = new Map<string, string>();
        const nameByEmail = new Map<string, string>();
        for (const p of profilesList) {
          if (p.display_name) {
            if (p.id) nameById.set(p.id, p.display_name);
            if (p.email) nameByEmail.set(p.email.toLowerCase().trim(), p.display_name);
          }
        }
        filteredLogs = filteredLogs.map((log: any) => {
          let author = log.author_name;
          const userEmail = (log.metadata?.userEmail || (author?.includes('@') ? author : '')).toLowerCase().trim();
          if (author?.includes('@') || !author || author === 'Usuário') {
            if (log.created_by && nameById.has(log.created_by)) {
              author = nameById.get(log.created_by)!;
            } else if (userEmail && nameByEmail.has(userEmail)) {
              author = nameByEmail.get(userEmail)!;
            }
          }
          return {
            ...log,
            author_name: author || 'Sistema'
          };
        });
      }
    } catch (enrichErr) {
      console.warn('[API/Audit] Erro ao enriquecer nomes de perfil nos logs:', enrichErr);
    }

    return NextResponse.json({
      logs: filteredLogs,
      isMaster,
      isTenantAdmin,
      total: filteredLogs.length
    });
  } catch (error: any) {
    console.error('[API/Audit] Erro geral:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 
                     '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || body.metadata?.userAgent || 'Desconhecido';

    // 1. Resolve token from header or body
    const rawHeader = req.headers.get('Authorization');
    const token = (rawHeader?.startsWith('Bearer ') ? rawHeader.substring(7) : (body.token || '')).trim();
    const effectiveAuthHeader = token ? `Bearer ${token}` : rawHeader;

    // 2. Build authenticated Supabase client
    let supabase: any;
    if (supabaseServiceKey) {
      supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    } else if (effectiveAuthHeader) {
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: effectiveAuthHeader } },
        auth: { persistSession: false }
      });
    } else {
      supabase = getSupabase(req);
    }

    // 3. Resolve authenticated user from JWT token
    let authUser = getAuthenticatedUser(req);
    if (!authUser && token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
          const payload = safeJsonParse<any>(payloadJson);
          if (payload?.sub) {
            authUser = {
              id: payload.sub,
              email: payload.email,
              role: payload.role
            };
          }
        }
      } catch {}
    }

    // Ghost Mode for Master / Platform Admin:
    // Discard any logs originating from the Platform Admin (Master) so tenant audit logs remain clean and private
    const resolvedEmail = (authUser?.email || body.userEmail || '').trim().toLowerCase();
    if (isPlatformAdmin(resolvedEmail)) {
      return NextResponse.json({ success: true, ghostMode: true, message: 'Ghost mode ativo para o usuário Master.' });
    }

    let userId = authUser?.id || body.userId;
    let tenantId = body.tenantId;
    let userDisplayName: string | null = null;

    if (userId) {
      const { data: p } = await supabase
        .from('profiles')
        .select('tenant_id, display_name, email')
        .eq('id', userId)
        .maybeSingle();
      if (p?.email && isPlatformAdmin(p.email)) {
        return NextResponse.json({ success: true, ghostMode: true, message: 'Ghost mode ativo para o usuário Master.' });
      }
      if (!tenantId) tenantId = p?.tenant_id;
      if (p?.display_name) userDisplayName = p.display_name;
    }

    // Resilient fallback by email if tenantId, userId or userDisplayName is still undefined
    const emailToLookup = (authUser?.email || body.userEmail || '').trim().toLowerCase();
    if ((!tenantId || !userId || !userDisplayName) && emailToLookup) {
      const { data: pByEmail } = await supabase
        .from('profiles')
        .select('id, tenant_id, display_name')
        .eq('email', emailToLookup)
        .maybeSingle();
      if (pByEmail) {
        if (!userId) userId = pByEmail.id;
        if (!tenantId) tenantId = pByEmail.tenant_id;
        if (!userDisplayName && pByEmail.display_name) userDisplayName = pByEmail.display_name;
      }
    }

    // Safety fallback for foreign key constraints on timeline table (owner_id, created_by)
    if (!userId) {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('email', 'ggsalles@gmail.com')
        .maybeSingle();
      if (adminProfile?.id) {
        userId = adminProfile.id;
        if (!userDisplayName && adminProfile.display_name) userDisplayName = adminProfile.display_name;
      }
    }

    // Prioritize friendly Display Name: Never fallback to email if display_name exists in the system
    const rawUserName = body.userName && !body.userName.includes('@') ? body.userName : null;
    const authorName = rawUserName || userDisplayName || authUser?.email || body.userEmail || 'Sistema';

    const insertPayload = {
      type: 'system',
      category: 'audit',
      title: body.title || 'Registro de Auditoria',
      content: body.content || '',
      related_id: body.relatedId || '00000000-0000-0000-0000-000000000000',
      owner_id: userId || null,
      created_by: userId || null,
      author_name: authorName,
      tenant_id: tenantId || null,
      metadata: {
        ...(body.metadata || {}),
        action: body.action || 'GENERAL_AUDIT',
        severity: body.severity || 'info',
        entityType: body.entityType || 'system',
        ip: clientIp,
        userAgent,
        userEmail: authUser?.email || body.userEmail,
        recordedAt: new Date().toISOString()
      }
    };

    const { data, error } = await supabase
      .from('timeline')
      .insert(insertPayload)
      .select('id');

    if (error) {
      console.warn('[API/Audit] Falha ao gravar log na timeline:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const logId = Array.isArray(data) && data[0]?.id ? data[0].id : null;
    return NextResponse.json({ success: true, logId });
  } catch (error: any) {
    console.error('[API/Audit] POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const authUser = getAuthenticatedUser(req);

    if (!authUser || !authUser.id) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { data: userProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, is_admin, tenant_id, email')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('[API/Audit] Erro ao carregar perfil:', profileErr);
    }

    const isMaster = isPlatformAdmin(authUser.email) || isPlatformAdmin(userProfile?.email);

    if (!isMaster) {
      return NextResponse.json({ 
        error: 'Acesso restrito. Apenas o usuário master da plataforma (ggsalles) tem permissão para limpar a auditoria.' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const requestedTenantId = searchParams.get('tenantId');

    let deleteQuery = supabase
      .from('timeline')
      .delete()
      .eq('category', 'audit');

    if (isMaster) {
      if (requestedTenantId && requestedTenantId !== 'all') {
        deleteQuery = deleteQuery.or(`tenant_id.eq.${requestedTenantId},tenant_id.eq.11111111-1111-1111-1111-111111111111`);
      }
    } else {
      const activeTenantId = userProfile?.tenant_id;
      if (activeTenantId) {
        deleteQuery = deleteQuery.or(`tenant_id.eq.${activeTenantId},tenant_id.eq.11111111-1111-1111-1111-111111111111`);
      }
    }

    const { error: deleteErr, count } = await deleteQuery;

    if (deleteErr) {
      console.error('[API/Audit] Erro ao limpar logs:', deleteErr);
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Logs de auditoria excluídos com sucesso.',
      count
    });
  } catch (error: any) {
    console.error('[API/Audit] DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
