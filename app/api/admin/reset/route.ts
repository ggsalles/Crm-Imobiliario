import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, getSupabase } from '@/lib/server-auth';
import { PLATFORM_ADMIN_EMAIL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || '';

function getAdminClient() {
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
}

function verifyMasterAdmin(req: NextRequest): { authorized: boolean; email?: string } {
  const authUser = getAuthenticatedUser(req);
  const email = authUser?.email?.trim().toLowerCase();
  
  if (!email || email !== PLATFORM_ADMIN_EMAIL.toLowerCase()) {
    return { authorized: false, email };
  }
  return { authorized: true, email };
}

// GET: Conta os registros atuais para cada área selecionada
export async function GET(req: NextRequest) {
  try {
    const auth = verifyMasterAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'Acesso restrito. Esta área é exclusiva do desenvolvedor master (ggsalles@gmail.com).' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'current';
    const tenantId = searchParams.get('tenantId');

    const supabase = getAdminClient();
    const isSingleTenant = scope === 'current' && !!tenantId;

    const counts: Record<string, number> = {
      activities: 0,
      deals: 0,
      contacts: 0,
      companies: 0,
      properties: 0,
      images: 0,
      messages: 0,
      conversations: 0,
      goals: 0,
      timeline: 0,
      members: 0
    };

    // 1. Activities
    let actQ = supabase.from('activities').select('*', { count: 'exact', head: true });
    if (isSingleTenant) actQ = actQ.eq('tenant_id', tenantId);
    const { count: actCount } = await actQ;
    counts.activities = actCount || 0;

    // 2. Deals
    let dealsQ = supabase.from('deals').select('*', { count: 'exact', head: true });
    if (isSingleTenant) dealsQ = dealsQ.eq('tenant_id', tenantId);
    const { count: dealsCount } = await dealsQ;
    counts.deals = dealsCount || 0;

    // 3. Contacts
    let contactsQ = supabase.from('contacts').select('*', { count: 'exact', head: true });
    if (isSingleTenant) contactsQ = contactsQ.eq('tenant_id', tenantId);
    const { count: contactsCount } = await contactsQ;
    counts.contacts = contactsCount || 0;

    // 4. Companies
    try {
      let compQ = supabase.from('companies').select('*', { count: 'exact', head: true });
      if (isSingleTenant) compQ = compQ.eq('tenant_id', tenantId);
      const { count: compCount } = await compQ;
      counts.companies = compCount || 0;
    } catch {
      counts.companies = 0;
    }

    // 5. Properties & Images
    let propQ = supabase.from('properties').select('id', { count: 'exact' });
    if (isSingleTenant) propQ = propQ.eq('tenant_id', tenantId);
    const { data: propRows, count: propCount } = await propQ;
    counts.properties = propCount || 0;

    if (propRows && propRows.length > 0) {
      const propIds = propRows.map(p => p.id);
      const { count: imgCount } = await supabase
        .from('images')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propIds);
      counts.images = imgCount || 0;
    }

    // 6. Messages & Conversations
    let msgQ = supabase.from('messages').select('*', { count: 'exact', head: true });
    if (isSingleTenant) msgQ = msgQ.eq('tenant_id', tenantId);
    const { count: msgCount } = await msgQ;
    counts.messages = msgCount || 0;

    let convQ = supabase.from('conversations').select('*', { count: 'exact', head: true });
    if (isSingleTenant) convQ = convQ.eq('tenant_id', tenantId);
    const { count: convCount } = await convQ;
    counts.conversations = convCount || 0;

    // 7. Goals
    let goalsQ = supabase.from('goals').select('*', { count: 'exact', head: true });
    if (isSingleTenant) goalsQ = goalsQ.eq('tenant_id', tenantId);
    const { count: goalsCount } = await goalsQ;
    counts.goals = goalsCount || 0;

    // 8. Timeline (Audit)
    let timeQ = supabase.from('timeline').select('*', { count: 'exact', head: true });
    if (isSingleTenant) timeQ = timeQ.eq('tenant_id', tenantId);
    const { count: timeCount } = await timeQ;
    counts.timeline = timeCount || 0;

    // 9. Members (Non-admin profiles, excluding ggsalles)
    let memberQ = supabase
      .from('profiles')
      .select('id, email, role', { count: 'exact' })
      .neq('email', PLATFORM_ADMIN_EMAIL.toLowerCase())
      .in('role', ['Membro', 'membro', 'corretor', 'user']);
    
    if (isSingleTenant) {
      memberQ = memberQ.eq('tenant_id', tenantId);
    }
    const { count: memberCount } = await memberQ;
    counts.members = memberCount || 0;

    return NextResponse.json({
      success: true,
      scope,
      tenantId: tenantId || null,
      counts
    });
  } catch (error: any) {
    console.error('[API/Admin/Reset] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Executa a limpeza selecionada
export async function POST(req: NextRequest) {
  try {
    const auth = verifyMasterAdmin(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'Acesso restrito. Esta área é exclusiva do desenvolvedor master (ggsalles@gmail.com).' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { confirmationText, scope = 'current', tenantId, entities = [] } = body;

    if (confirmationText !== 'ZERAR TUDO') {
      return NextResponse.json(
        { error: 'Texto de confirmação incorreto. Digite exatamente "ZERAR TUDO".' },
        { status: 400 }
      );
    }

    const isSingleTenant = scope === 'current';
    if (isSingleTenant && !tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID não informado para o escopo selecionado.' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const results: Record<string, { success: boolean; deleted: number; error?: string }> = {};

    // 1. ATIVIDADES & CALENDÁRIO (activities)
    if (entities.includes('activities')) {
      try {
        let q = supabase.from('activities').delete();
        if (isSingleTenant) {
          q = q.eq('tenant_id', tenantId);
        } else {
          q = q.gte('created_at', '1970-01-01');
        }
        const { error, count } = await q.select('id');
        if (error) throw error;
        results.activities = { success: true, deleted: count || 0 };
      } catch (err: any) {
        console.error('[Reset] Erro ao deletar activities:', err);
        results.activities = { success: false, deleted: 0, error: err.message };
      }
    }

    // 2. MENSAGENS & CONVERSAS (messages, conversations)
    if (entities.includes('messages')) {
      try {
        let qMsg = supabase.from('messages').delete();
        if (isSingleTenant) {
          qMsg = qMsg.eq('tenant_id', tenantId);
        } else {
          qMsg = qMsg.gte('created_at', '1970-01-01');
        }
        const { count: msgCount, error: msgErr } = await qMsg.select('id');
        if (msgErr) console.warn('[Reset] Aviso ao deletar messages:', msgErr);

        let qConv = supabase.from('conversations').delete();
        if (isSingleTenant) {
          qConv = qConv.eq('tenant_id', tenantId);
        } else {
          qConv = qConv.gte('created_at', '1970-01-01');
        }
        const { count: convCount, error: convErr } = await qConv.select('id');
        if (convErr) console.warn('[Reset] Aviso ao deletar conversations:', convErr);

        results.messages = { 
          success: true, 
          deleted: (msgCount || 0) + (convCount || 0) 
        };
      } catch (err: any) {
        results.messages = { success: false, deleted: 0, error: err.message };
      }
    }

    // 3. PIPELINE / NEGÓCIOS (deals)
    if (entities.includes('deals')) {
      try {
        let q = supabase.from('deals').delete();
        if (isSingleTenant) {
          q = q.eq('tenant_id', tenantId);
        } else {
          q = q.gte('created_at', '1970-01-01');
        }
        const { error, count } = await q.select('id');
        if (error) throw error;
        results.deals = { success: true, deleted: count || 0 };
      } catch (err: any) {
        console.error('[Reset] Erro ao deletar deals:', err);
        results.deals = { success: false, deleted: 0, error: err.message };
      }
    }

    // 4. CLIENTES / LEADS (contacts)
    if (entities.includes('contacts')) {
      try {
        let q = supabase.from('contacts').delete();
        if (isSingleTenant) {
          q = q.eq('tenant_id', tenantId);
        } else {
          q = q.gte('created_at', '1970-01-01');
        }
        const { error, count } = await q.select('id');
        if (error) throw error;
        results.contacts = { success: true, deleted: count || 0 };
      } catch (err: any) {
        console.error('[Reset] Erro ao deletar contacts:', err);
        results.contacts = { success: false, deleted: 0, error: err.message };
      }
    }

    // 5. EMPRESAS (companies)
    if (entities.includes('companies')) {
      try {
        let q = supabase.from('companies').delete();
        if (isSingleTenant) {
          // Checa se a coluna tenant_id existe
          const { error: testErr } = await supabase.from('companies').select('tenant_id').limit(1);
          if (!testErr) {
            q = q.eq('tenant_id', tenantId);
          } else {
            q = q.gte('created_at', '1970-01-01');
          }
        } else {
          q = q.gte('created_at', '1970-01-01');
        }
        const { error, count } = await q.select('id');
        if (error) throw error;
        results.companies = { success: true, deleted: count || 0 };
      } catch (err: any) {
        console.error('[Reset] Erro ao deletar companies:', err);
        results.companies = { success: false, deleted: 0, error: err.message };
      }
    }

    // 6. IMÓVEIS & FOTOS (properties, images)
    if (entities.includes('properties')) {
      try {
        let propQ = supabase.from('properties').select('id');
        if (isSingleTenant) propQ = propQ.eq('tenant_id', tenantId);
        const { data: propRows } = await propQ;
        const propIds = (propRows || []).map(p => p.id);

        let imgDeleted = 0;
        if (propIds.length > 0) {
          const { count: iCount } = await supabase
            .from('images')
            .delete()
            .in('property_id', propIds)
            .select('id');
          imgDeleted = iCount || 0;
        }

        let q = supabase.from('properties').delete();
        if (isSingleTenant) {
          q = q.eq('tenant_id', tenantId);
        } else {
          q = q.gte('created_at', '1970-01-01');
        }
        const { error, count } = await q.select('id');
        if (error) throw error;

        results.properties = { 
          success: true, 
          deleted: (count || 0) + imgDeleted 
        };
      } catch (err: any) {
        console.error('[Reset] Erro ao deletar properties/images:', err);
        results.properties = { success: false, deleted: 0, error: err.message };
      }
    }

    // 7. METAS (goals)
    if (entities.includes('goals')) {
      try {
        let q = supabase.from('goals').delete();
        if (isSingleTenant) {
          q = q.eq('tenant_id', tenantId);
        } else {
          q = q.gte('created_at', '1970-01-01');
        }
        const { error, count } = await q.select('id');
        if (error) throw error;
        results.goals = { success: true, deleted: count || 0 };
      } catch (err: any) {
        console.error('[Reset] Erro ao deletar goals:', err);
        results.goals = { success: false, deleted: 0, error: err.message };
      }
    }

    // 8. AUDITORIA / TIMELINE (timeline)
    if (entities.includes('timeline')) {
      try {
        let q = supabase.from('timeline').delete();
        if (isSingleTenant) {
          q = q.eq('tenant_id', tenantId);
        } else {
          q = q.gte('created_at', '1970-01-01');
        }
        const { error, count } = await q.select('id');
        if (error) throw error;
        results.timeline = { success: true, deleted: count || 0 };
      } catch (err: any) {
        console.error('[Reset] Erro ao deletar timeline:', err);
        results.timeline = { success: false, deleted: 0, error: err.message };
      }
    }

    // 9. USUÁRIOS (MEMBROS / CORRETORES - Exceto ggsalles@gmail.com e Admins)
    if (entities.includes('members')) {
      try {
        let memberQ = supabase
          .from('profiles')
          .select('id, email, role')
          .neq('email', PLATFORM_ADMIN_EMAIL.toLowerCase())
          .in('role', ['Membro', 'membro', 'corretor', 'user']);

        if (isSingleTenant) {
          memberQ = memberQ.eq('tenant_id', tenantId);
        }

        const { data: targetMembers, error: fetchErr } = await memberQ;
        if (fetchErr) throw fetchErr;

        let membersDeleted = 0;
        if (targetMembers && targetMembers.length > 0) {
          const memberIds = targetMembers.map(m => m.id);

          // Remove associações profile_tenants
          if (isSingleTenant) {
            await supabase.from('profile_tenants').delete().eq('tenant_id', tenantId).in('profile_id', memberIds);
          } else {
            await supabase.from('profile_tenants').delete().in('profile_id', memberIds);
          }

          // Remove de profiles
          const { count: pCount, error: pErr } = await supabase
            .from('profiles')
            .delete()
            .in('id', memberIds)
            .select('id');
          if (pErr) throw pErr;
          membersDeleted = pCount || 0;

          // Se a chave de serviço existir, remove também do Auth (liberando o e-mail)
          if (supabaseServiceKey) {
            for (const mId of memberIds) {
              try {
                await supabase.auth.admin.deleteUser(mId);
              } catch (authErr) {
                console.warn(`[Reset] Não foi possível remover usuário ${mId} do Auth:`, authErr);
              }
            }
          }
        }
        results.members = { success: true, deleted: membersDeleted };
      } catch (err: any) {
        console.error('[Reset] Erro ao deletar members:', err);
        results.members = { success: false, deleted: 0, error: err.message };
      }
    }

    // Registra log final da operação no timeline para histórico transparente
    try {
      await supabase.from('timeline').insert({
        tenant_id: isSingleTenant ? tenantId : null,
        owner_id: auth.email,
        title: 'Reset Geral do Sistema Executado',
        content: `O administrador mestre (${auth.email}) executou a rotina de limpeza do sistema. Escopo: ${scope}. Áreas limpas: ${entities.join(', ')}.`,
        category: 'audit',
        type: 'system_reset',
        severity: 'critical'
      });
    } catch (logErr) {
      console.warn('[Reset] Aviso ao registrar log de auditoria do reset:', logErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Limpeza do sistema executada com sucesso!',
      executedAt: new Date().toISOString(),
      scope,
      results
    });
  } catch (error: any) {
    console.error('[API/Admin/Reset] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
