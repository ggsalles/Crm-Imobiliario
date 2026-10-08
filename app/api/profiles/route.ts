import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_TENANT_ID, isPlatformAdmin } from '@/lib/constants';
import { getAuthenticatedUser, getActiveTenantId } from '@/lib/server-auth';
import { 
  isUserInactiveInStore, 
  getUserInactiveDetail, 
  setUserInactiveInStore 
} from '@/lib/user-status';
import {
  getSecurityKeywordFromStore,
  setSecurityKeywordInStore
} from '@/lib/security-keywords';
import {
  getCustomUsersStore,
  upsertCustomUser,
  deleteCustomUser
} from '@/lib/custom-users';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

interface ProfilesCacheEntry {
  data: any[];
  timestamp: number;
}
const serverProfilesCache = new Map<string, ProfilesCacheEntry>();
const CACHE_TTL_MS = 60000; // 60s memory cache to optimize Supabase Free tier egress

export function invalidateServerProfilesCache() {
  serverProfilesCache.clear();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || "";

if (typeof process !== 'undefined' && process.env) {
  const envKeys = Object.keys(process.env).filter(key => key.includes("SUPABASE") || key.includes("SERVICE"));
  console.log("[DB Env Diagnostics] Keys in process.env:", envKeys);
  console.log("[DB Env Diagnostics] Service Key exists and length:", !!supabaseServiceKey, supabaseServiceKey?.length || 0);
}

function getSupabase(req: NextRequest) {
  // Se houver a chave de serviço administrativa do Supabase, priorizar o seu uso no backend
  // para evitar loops RLS lentos ou loops de planejamento cíclicos do Postgres nas tabelas de perfil/associação.
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

// Helper de timeout para evitar que requisições ao Supabase fiquem presas devido a problemas em políticas RLS
async function queryWithTimeout<T>(promise: Promise<T>, ms: number = 8000): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error("Timeout")), ms)
  );
  return Promise.race([promise, timeoutPromise]);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (id && id !== 'undefined' && id !== 'null') {
      let data = null;
      let error = null;
      
      try {
        const queryRes = await queryWithTimeout(
          supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
          8000
        );
        data = queryRes.data;
        error = queryRes.error;
      } catch (e: any) {
        console.warn("[API/Profiles] Falha de leitura ou Timeout na query de Profiles (RLS ativo):", e.message || e);
        error = e;
      }
      
      // Resilient fallback to Service Role client if we have the service key and the standard query fails/returns empty due to RLS policies
      if ((error || !data) && supabaseServiceKey) {
        console.warn("[API/Profiles] GET Single: Erro ou vazio no cliente padrão, tentando com Service Role...");
        try {
          const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
          const adminRes = await queryWithTimeout(
            adminSupabase.from('profiles').select('*').eq('id', id).maybeSingle(),
            5000
          );
          if (!adminRes.error && adminRes.data) {
            data = adminRes.data;
            error = null;
          }
        } catch (adminErr) {
          console.error("[API/Profiles] Falha letal ao tentar consultar via Service Role:", adminErr);
        }
      }

      if (error && !data) {
        // Fallback to custom users store
        const customUsers = getCustomUsersStore();
        const found = customUsers.find(u => u.id === id);
        if (found) {
          return NextResponse.json({
            id: found.id,
            displayName: found.display_name,
            email: found.email,
            photoURL: found.photo_url || null,
            role: found.role,
            userType: found.user_type,
            isAdmin: found.is_admin,
            tenantId: found.tenant_id,
            tenantIds: found.tenantIds || [found.tenant_id],
            isActive: found.is_active !== false,
            inactiveReason: found.inactive_reason || null,
            securityKeyword: found.security_keyword || null
          });
        }
        console.error("[API/Profiles] Ambos os métodos de leitura do Profile falharam.");
        return NextResponse.json({ error: "Database error or timeout" }, { status: 500 });
      }

      // Se não encontrou o perfil e temos a Service Role Key, tentamos localizar o e-mail no Auth para realizar o "claim" (fusão) de perfil preexistente
      if (!data && supabaseServiceKey) {
        try {
          console.log(`[API/Profiles] GET: Perfil não encontrado para id=${id}. Buscando usuário auth para claim...`);
          const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
          const { data: authUserRes } = await adminSupabase.auth.admin.getUserById(id);
          const userEmail = authUserRes?.user?.email;

          if (userEmail) {
            console.log(`[API/Profiles] GET: Usuário auth possui email ${userEmail}. Buscando perfil preexistente...`);
            const { data: existingProfile } = await adminSupabase
              .from('profiles')
              .select('*')
              .eq('email', userEmail.toLowerCase())
              .maybeSingle();

            if (existingProfile && existingProfile.id !== id) {
              const oldId = existingProfile.id;
              const newId = id;
              console.log(`[API/Profiles] GET Claim: Migrando perfil ${oldId} para o novo ID ${newId}`);

              // A. Renomear e-mail temporariamente no perfil antigo para evitar conflito de chave única "profiles_email_key"
              const tempEmail = `${existingProfile.email}_migrating_${Date.now()}`;
              await adminSupabase.from('profiles').update({ email: tempEmail }).eq('id', oldId);

              // B. Copiar para o novo ID com e-mail correto original
              const { data: copyProfile, error: copyErr } = await adminSupabase
                .from('profiles')
                .insert({
                  id: newId,
                  display_name: existingProfile.display_name,
                  email: existingProfile.email,
                  photo_url: existingProfile.photo_url,
                  role: existingProfile.role,
                  user_type: existingProfile.user_type,
                  is_admin: existingProfile.is_admin,
                  tenant_id: existingProfile.tenant_id,
                  created_at: existingProfile.created_at,
                  updated_at: new Date().toISOString()
                })
                .select()
                .maybeSingle();

              if (!copyErr && copyProfile) {
                console.log("[API/Profiles] GET Claim: Perfil principal copiado no novo ID!");

                // C. Copiar as associações de inquilinos
                const { data: oldAssocs } = await adminSupabase
                  .from('profile_tenants')
                  .select('*')
                  .eq('profile_id', oldId);

                if (oldAssocs && oldAssocs.length > 0) {
                  const newAssocs = oldAssocs.map((a: any) => ({
                    profile_id: newId,
                    tenant_id: a.tenant_id,
                    role: a.role
                  }));
                  await adminSupabase.from('profile_tenants').insert(newAssocs);
                }

                // D. Reassociar entidades de negócios do proprietário antigo para o novo ID
                await Promise.all([
                  adminSupabase.from('deals').update({ owner_id: newId }).eq('owner_id', oldId),
                  adminSupabase.from('contacts').update({ owner_id: newId }).eq('owner_id', oldId),
                  adminSupabase.from('companies').update({ owner_id: newId }).eq('owner_id', oldId),
                  adminSupabase.from('properties').update({ owner_id: newId }).eq('owner_id', oldId),
                  adminSupabase.from('activities').update({ owner_id: newId }).eq('owner_id', oldId),
                  adminSupabase.from('goals').update({ owner_id: newId }).eq('owner_id', oldId),
                ]).catch(err => {
                  console.error("[API/Profiles] GET Claim: Erro nas atualizações de entidades:", err);
                });

                // E. Reassociar conversas e participantes
                try {
                  const { data: convs } = await adminSupabase
                    .from('conversations')
                    .select('*')
                    .contains('participants', [oldId]);

                  if (convs && convs.length > 0) {
                    for (const conv of convs) {
                      const updatedParticipants = conv.participants.map((pid: string) => pid === oldId ? newId : pid);
                      await adminSupabase
                        .from('conversations')
                        .update({ 
                          participants: updatedParticipants,
                          owner_id: conv.owner_id === oldId ? newId : conv.owner_id
                        })
                        .eq('id', conv.id);
                    }
                  }

                  await adminSupabase.from('conversations').update({ owner_id: newId }).eq('owner_id', oldId);
                  await adminSupabase.from('messages').update({ sender_id: newId }).eq('sender_id', oldId);
                  await adminSupabase.from('messages').update({ owner_id: newId }).eq('owner_id', oldId);
                } catch (convErr) {
                  console.error("[API/Profiles] GET Claim: Erro nas atualizações de chats:", convErr);
                }

                // F. Deletar registros antigos
                await adminSupabase.from('profile_tenants').delete().eq('profile_id', oldId);
                await adminSupabase.from('profiles').delete().eq('id', oldId);

                console.log("[API/Profiles] GET Claim: Sucesso no claim!");
                data = copyProfile;
              } else {
                console.error("[API/Profiles] GET Claim: Erro de insert no perfil clonado:", copyErr);
                // Restaurar e-mail original se deu erro
                await adminSupabase.from('profiles').update({ email: existingProfile.email }).eq('id', oldId);
              }
            }
          }
        } catch (err) {
          console.error("[API/Profiles] Falha letal na execução do claim workflow:", err);
        }
      }

      if (!data) return NextResponse.json(null);

      let tenantIds = [data.tenant_id || DEFAULT_TENANT_ID];
      try {
        let assoc = null;
        let assocError = null;
        
        try {
          const assocRes = await queryWithTimeout(
            supabase.from('profile_tenants').select('tenant_id').eq('profile_id', data.id),
            6000
          );
          assoc = assocRes.data;
          assocError = assocRes.error;
        } catch (assocTimeoutErr: any) {
          console.warn("[API/Profiles] Timeout/Erro ao ler associacoes via cliente normal:", assocTimeoutErr.message || assocTimeoutErr);
          assocError = assocTimeoutErr;
        }
        
        if ((assocError || !assoc) && supabaseServiceKey) {
          try {
            const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
            const adminAssocRes = await queryWithTimeout(
              adminSupabase.from('profile_tenants').select('tenant_id').eq('profile_id', data.id),
              4000
            );
            if (!adminAssocRes.error && adminAssocRes.data) {
              assoc = adminAssocRes.data;
              assocError = null;
            }
          } catch (adminAssocErr) {
            console.error("[API/Profiles] Falha ao ler associacoes via Service Role:", adminAssocErr);
          }
        }

        if (!assocError && assoc && assoc.length > 0) {
          tenantIds = assoc.map((a: any) => a.tenant_id);
        }
      } catch (e) {
        console.warn("Tabela profile_tenants pode nao ter sido criada ainda:", e);
      }

      // Se o usuário foi associado a imobiliárias específicas, garanta que seu tenantId ativo seja válido
      let activeTenantId = data.tenant_id;
      if (tenantIds.length > 0) {
        if (!activeTenantId || !tenantIds.includes(activeTenantId)) {
          // Prioriza o primeiro tenant explicitamente associado
          activeTenantId = tenantIds[0];
          
          // Corrige no banco se for service key para persistência imediata
          if (supabaseServiceKey && data.id) {
            try {
              const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
              await adminSupabase.from('profiles').update({ tenant_id: activeTenantId }).eq('id', data.id);
            } catch {}
          }
        }
      } else if (!activeTenantId) {
        activeTenantId = DEFAULT_TENANT_ID;
      }

      const inactiveDetail = getUserInactiveDetail(data.id);
      const isLocallyInactive = isUserInactiveInStore(data.id);
      const isActive = !isLocallyInactive && (data.is_active !== false);
      const inactiveReason = inactiveDetail?.reason || data.inactive_reason || null;
      const securityKeyword = data.security_keyword || getSecurityKeywordFromStore(data.id, data.email) || null;

      return NextResponse.json({
        id: data.id,
        displayName: data.display_name,
        email: data.email,
        photoURL: data.photo_url,
        role: data.role,
        userType: data.user_type,
        isAdmin: data.is_admin,
        tenantId: activeTenantId,
        tenantIds: tenantIds.length > 0 ? tenantIds : [activeTenantId],
        isActive,
        inactiveReason,
        securityKeyword
      }, { headers: NO_CACHE_HEADERS });
    }

    if (email) {
      let { data, error } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).maybeSingle();
      
      if ((error || !data) && supabaseServiceKey) {
        console.warn("[API/Profiles] GET Email: Erro ou vazio usando client padrão, tentando com Service Role...");
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
        const { data: adminData, error: adminError } = await adminSupabase.from('profiles').select('*').eq('email', email.toLowerCase()).maybeSingle();
        if (!adminError && adminData) {
          data = adminData;
          error = null;
        }
      }

      if (!data) {
        // Fallback to custom users store
        const customUsers = getCustomUsersStore();
        const found = customUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (found) {
          return NextResponse.json({
            id: found.id,
            displayName: found.display_name,
            email: found.email,
            role: found.role,
            userType: found.user_type,
            isAdmin: found.is_admin,
            tenantId: found.tenant_id,
            tenantIds: found.tenantIds || [found.tenant_id],
            isActive: found.is_active !== false,
            inactiveReason: found.inactive_reason || null,
            securityKeyword: found.security_keyword || null
          }, { headers: NO_CACHE_HEADERS });
        }
        return NextResponse.json(null, { headers: NO_CACHE_HEADERS });
      }

      const inactiveDetail = getUserInactiveDetail(data.id);
      const isLocallyInactive = isUserInactiveInStore(data.id);
      const isActive = !isLocallyInactive && (data.is_active !== false);
      const inactiveReason = inactiveDetail?.reason || data.inactive_reason || null;
      const securityKeyword = data.security_keyword || getSecurityKeywordFromStore(data.id, data.email) || null;

      let emailTenantIds = [data.tenant_id || DEFAULT_TENANT_ID];
      try {
        const adminSupabase = supabaseServiceKey 
          ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
          : supabase;
        const { data: assoc } = await adminSupabase.from('profile_tenants').select('tenant_id').eq('profile_id', data.id);
        if (assoc && assoc.length > 0) {
          emailTenantIds = assoc.map((a: any) => a.tenant_id);
        }
      } catch (e) {}

      let resolvedEmailTenantId = data.tenant_id;
      if (emailTenantIds.length > 0 && (!resolvedEmailTenantId || !emailTenantIds.includes(resolvedEmailTenantId))) {
        resolvedEmailTenantId = emailTenantIds[0];
      } else if (!resolvedEmailTenantId) {
        resolvedEmailTenantId = DEFAULT_TENANT_ID;
      }

      return NextResponse.json({ 
        id: data.id, 
        tenantId: resolvedEmailTenantId,
        tenantIds: emailTenantIds,
        displayName: data.display_name,
        email: data.email,
        role: data.role,
        isActive,
        inactiveReason,
        securityKeyword
      }, { headers: NO_CACHE_HEADERS });
    }

    const callerUser = getAuthenticatedUser(req);
    const callerIsMaster = callerUser?.email ? isPlatformAdmin(callerUser.email) : false;
    const requestedTenantId = searchParams.get('tenantId');
    const activeTenantId = requestedTenantId || (callerUser ? await getActiveTenantId(supabase, callerUser, req) : null);

    const cacheKey = `${activeTenantId || 'all'}:${requestedTenantId || 'default'}:${callerIsMaster ? 'master' : (callerUser?.id || 'anon')}`;
    const cached = serverProfilesCache.get(cacheKey);
    const now = Date.now();
    const isBypass = searchParams.get('nocache') === 'true';

    if (cached && (now - cached.timestamp < CACHE_TTL_MS) && !isBypass) {
      return NextResponse.json(cached.data, { headers: NO_CACHE_HEADERS });
    }

    let { data: profiles, error } = await supabase.from('profiles').select('*');
    
    if ((error || !profiles) && supabaseServiceKey) {
      console.warn("[API/Profiles] GET Todos: Erro ou vazio usando client padrão, tentando com Service Role...");
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
      const { data: adminData, error: adminError } = await adminSupabase.from('profiles').select('*');
      if (!adminError && adminData) {
        profiles = adminData;
        error = null;
      }
    }

    let associationsMap: Record<string, string[]> = {};
    try {
      let { data: assoc, error: assocError } = await supabase
        .from('profile_tenants')
        .select('profile_id, tenant_id');
      
      if ((assocError || !assoc) && supabaseServiceKey) {
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
        const { data: adminData, error: adminAssocError } = await adminSupabase
          .from('profile_tenants')
          .select('profile_id, tenant_id');
        if (!adminAssocError && adminData) {
          assoc = adminData;
          assocError = null;
        }
      }

      if (!assocError && assoc) {
        assoc.forEach((a: any) => {
          if (!associationsMap[a.profile_id]) associationsMap[a.profile_id] = [];
          associationsMap[a.profile_id].push(a.tenant_id);
        });
      }
    } catch (e) {
      console.warn("Tabela profile_tenants pode nao ter sido criada ainda:", e);
    }

    // Merge with custom users store
    const customUsers = getCustomUsersStore();
    const existingIds = new Set((profiles || []).map((p: any) => p.id));
    const existingEmails = new Set((profiles || []).map((p: any) => p.email?.toLowerCase()));

    const mergedProfiles = [...(profiles || [])];
    for (const cu of customUsers) {
      if (!existingIds.has(cu.id) && !existingEmails.has(cu.email.toLowerCase())) {
        mergedProfiles.push({
          id: cu.id,
          display_name: cu.display_name,
          email: cu.email,
          photo_url: cu.photo_url,
          role: cu.role,
          user_type: cu.user_type,
          is_admin: cu.is_admin,
          tenant_id: cu.tenant_id,
          is_active: cu.is_active,
          inactive_reason: cu.inactive_reason,
          security_keyword: cu.security_keyword
        });
        if (cu.tenantIds) {
          associationsMap[cu.id] = cu.tenantIds;
        }
      }
    }

    let items = mergedProfiles.map((item: any) => {
      const inactiveDetail = getUserInactiveDetail(item.id);
      const isLocallyInactive = isUserInactiveInStore(item.id);
      const isActive = !isLocallyInactive && (item.is_active !== false);
      const inactiveReason = inactiveDetail?.reason || item.inactive_reason || null;
      const securityKeyword = item.security_keyword || getSecurityKeywordFromStore(item.id, item.email) || null;

      return {
        id: item.id,
        displayName: item.display_name,
        email: item.email,
        photoURL: item.photo_url,
        role: item.role,
        userType: item.user_type,
        isAdmin: item.is_admin,
        tenantId: item.tenant_id,
        tenantIds: associationsMap[item.id] || [item.tenant_id || DEFAULT_TENANT_ID],
        isActive,
        inactiveReason,
        securityKeyword
      };
    });

    // Se o solicitante NÃO for o Master (ggsalles), ocultar o login do Master de empresas clientes:
    if (!callerIsMaster) {
      items = items.filter(item => !isPlatformAdmin(item.email));
      
      // E isolar por empresa para que vejam apenas usuários pertencentes à sua organização
      if (activeTenantId) {
        items = items.filter(item => 
          item.tenantId === activeTenantId || (item.tenantIds && item.tenantIds.includes(activeTenantId))
        );
      }
    } else if ((requestedTenantId && requestedTenantId !== 'all') || (activeTenantId && activeTenantId !== 'all')) {
      // Se for o master e houver inquilino ativo ou filtrado:
      const targetTenant = requestedTenantId || activeTenantId;
      items = items.filter(item =>
        item.tenantId === targetTenant || (item.tenantIds && item.tenantIds.includes(targetTenant))
      );
    }

    serverProfilesCache.set(cacheKey, { data: items, timestamp: now });
    return NextResponse.json(items, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Profiles] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const body = await req.json().catch(() => ({}));
    
    const { tenantIds, password, initialPassword, ...profileData } = body;
    const userPassword = password || initialPassword || null;

    let initialIsActive: boolean = true;
    let initialReason: string | undefined = undefined;
    if (profileData.isActive !== undefined || profileData.is_active !== undefined) {
      initialIsActive = profileData.isActive !== undefined ? Boolean(profileData.isActive) : Boolean(profileData.is_active);
      initialReason = profileData.inactiveReason !== undefined ? profileData.inactiveReason : profileData.inactive_reason;
      profileData.is_active = initialIsActive;
      profileData.inactive_reason = initialReason || null;
      delete profileData.isActive;
      delete profileData.inactiveReason;
    }

    // Provisionar ou sincronizar credenciais no Supabase Auth se uma senha foi fornecida
    let createdAuthUserId: string | null = null;
    if (userPassword && supabaseServiceKey) {
      try {
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
        const { data: authCreated, error: authCreateErr } = await adminSupabase.auth.admin.createUser({
          email: profileData.email.toLowerCase(),
          password: userPassword,
          email_confirm: true,
          user_metadata: {
            display_name: profileData.display_name,
            tenant_id: profileData.tenant_id,
            role: profileData.role
          }
        });

        if (authCreated?.user?.id) {
          createdAuthUserId = authCreated.user.id;
        } else if (authCreateErr && authCreateErr.message?.toLowerCase().includes('already')) {
          // Usuário já existe no Auth, busca pelo e-mail e atualiza a senha
          const { data: usersList } = await adminSupabase.auth.admin.listUsers();
          const matchAuth = usersList?.users?.find(u => u.email?.toLowerCase() === profileData.email.toLowerCase());
          if (matchAuth?.id) {
            createdAuthUserId = matchAuth.id;
            await adminSupabase.auth.admin.updateUserById(matchAuth.id, {
              password: userPassword,
              email_confirm: true,
              user_metadata: {
                display_name: profileData.display_name,
                tenant_id: profileData.tenant_id,
                role: profileData.role
              }
            });
          }
        }
      } catch (authErr) {
        console.warn("[API/Profiles] Aviso ao provisionar senha no Supabase Auth:", authErr);
      }
    }

    // Serves as real-time multi-tenant association. We first check if a profile with this email already exists inside CRM.
    const { data: existingUser, error: findError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', profileData.email)
      .maybeSingle();

    let profileId: string;
    let finalRole: string;

    if (existingUser) {
      profileId = existingUser.id;
      finalRole = existingUser.role || 'Membro';

      // Update name or other details if they were blank and are provided now
      const updatePayload: any = {};
      if (!existingUser.display_name && profileData.display_name) {
        updatePayload.display_name = profileData.display_name;
      }
      if ((existingUser.tenant_id === DEFAULT_TENANT_ID || !existingUser.tenant_id) && profileData.tenant_id && profileData.tenant_id !== DEFAULT_TENANT_ID) {
        updatePayload.tenant_id = profileData.tenant_id;
      }

      if (Object.keys(updatePayload).length > 0) {
        await supabase.from('profiles').update(updatePayload).eq('id', profileId);
      }
    } else {
      const newProfileToInsert = { ...profileData };
      if (createdAuthUserId) {
        newProfileToInsert.id = createdAuthUserId;
      }

      let { data: result, error } = await supabase
        .from('profiles')
        .insert([newProfileToInsert])
        .select();

      if (error && (error.message?.includes('is_active') || error.message?.includes('inactive_reason') || error.message?.includes('security_keyword') || error.code === '42703')) {
        console.warn("[API/Profiles] POST: Coluna opcional ainda não no Supabase. Fallback inserindo sem essas colunas...");
        const fallbackInsert = { ...newProfileToInsert };
        delete fallbackInsert.is_active;
        delete fallbackInsert.inactive_reason;
        delete fallbackInsert.security_keyword;
        const res = await supabase.from('profiles').insert([fallbackInsert]).select();
        result = res.data;
        error = res.error;
      }

      if (error) {
        if (error.code === '23505' || (error.message && error.message.toLowerCase().includes('unique constraint'))) {
          const { data: reCheckUser } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', profileData.email)
            .maybeSingle();
          if (reCheckUser) {
            profileId = reCheckUser.id;
            finalRole = reCheckUser.role || 'Membro';
          } else {
            // Check custom store
            const customUsers = getCustomUsersStore();
            const existing = customUsers.find(u => u.email.toLowerCase() === profileData.email.toLowerCase());
            if (existing) {
              profileId = existing.id;
              finalRole = existing.role || 'Membro';
            } else {
              profileId = newProfileToInsert.id || crypto.randomUUID();
              finalRole = newProfileToInsert.role || 'Membro';
            }
          }
        } else {
          console.warn("[API/Profiles] Aviso ao inserir no Supabase profiles (RLS/Restrição):", error.message);
          profileId = newProfileToInsert.id || crypto.randomUUID();
          finalRole = newProfileToInsert.role || 'Membro';
        }
      } else {
        profileId = result[0].id;
        finalRole = result[0].role || 'Membro';
      }
    }

    if (!initialIsActive) {
      setUserInactiveInStore(profileId, true, initialReason);
    }

    const resolvedTenantIds = Array.isArray(tenantIds) && tenantIds.length > 0
      ? tenantIds
      : [profileData.tenant_id || DEFAULT_TENANT_ID];

    // Always persist to custom user store for instant resilience
    upsertCustomUser({
      id: profileId,
      display_name: profileData.display_name || profileData.displayName || profileData.email.split('@')[0],
      email: profileData.email,
      role: finalRole as any || profileData.role || 'Membro',
      user_type: profileData.user_type || profileData.userType || 'funcionário',
      is_admin: finalRole === 'Admin' || profileData.role === 'Admin',
      tenant_id: profileData.tenant_id || resolvedTenantIds[0] || DEFAULT_TENANT_ID,
      tenantIds: resolvedTenantIds,
      is_active: initialIsActive,
      inactive_reason: initialReason,
      security_keyword: profileData.security_keyword || profileData.securityKeyword,
      password: userPassword || undefined
    });

    try {
      const associationRows = resolvedTenantIds.map((tid: string) => ({
        profile_id: profileId,
        tenant_id: tid,
        role: finalRole
      }));

      await supabase.from('profile_tenants').upsert(associationRows);
    } catch (assocErr) {
      console.warn("Erro ao inserir na tabela profile_tenants via upsert:", assocErr);
      for (const tid of resolvedTenantIds) {
        try {
          await supabase.from('profile_tenants').insert({
            profile_id: profileId,
            tenant_id: tid,
            role: finalRole
          });
        } catch (e) {
          // ignore already linked
        }
      }
    }

    invalidateServerProfilesCache();

    const createdProfile = {
      id: profileId,
      displayName: profileData.display_name || profileData.displayName || profileData.email.split('@')[0],
      email: profileData.email.toLowerCase(),
      photoURL: profileData.photo_url || profileData.photoURL || null,
      role: finalRole || profileData.role || 'Membro',
      userType: profileData.user_type || profileData.userType || 'funcionário',
      isAdmin: (finalRole === 'Admin' || profileData.role === 'Admin'),
      tenantId: profileData.tenant_id || resolvedTenantIds[0] || DEFAULT_TENANT_ID,
      tenantIds: resolvedTenantIds,
      isActive: initialIsActive,
      inactiveReason: initialReason || null,
      securityKeyword: profileData.security_keyword || profileData.securityKeyword || null
    };

    return NextResponse.json({ 
      success: true, 
      id: profileId, 
      profile: createdProfile 
    }, { status: 201, headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Profiles] POST Error:", error);
    if (error.code === '23505' || (error.message && error.message.toLowerCase().includes('unique constraint'))) {
      return NextResponse.json({ error: "Este e-mail já está sendo utilizado por outro usuário no CRM." }, { status: 400, headers: NO_CACHE_HEADERS });
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
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

    const data = await req.json().catch(() => ({}));
    const { tenantIds, ...otherData } = data;

    // Trata palavra-chave secreta
    const kw = otherData.securityKeyword !== undefined ? otherData.securityKeyword : otherData.security_keyword;
    if (kw !== undefined) {
      setSecurityKeywordInStore(id, otherData.email || null, kw);
      otherData.security_keyword = kw ? String(kw).trim() : null;
      delete otherData.securityKeyword;
    }

    // Trata atualização de status ativo/inativo
    if (otherData.isActive !== undefined || otherData.is_active !== undefined) {
      const isActive = otherData.isActive !== undefined ? Boolean(otherData.isActive) : Boolean(otherData.is_active);
      const reason = (otherData.inactiveReason !== undefined ? otherData.inactiveReason : otherData.inactive_reason) || null;
      setUserInactiveInStore(id, !isActive, reason || undefined);
      otherData.is_active = isActive;
      otherData.inactive_reason = reason;
      delete otherData.isActive;
      delete otherData.inactiveReason;
    }

    // Normaliza tenantIds caso tenham sido informados
    const validTenantIds: string[] = Array.isArray(tenantIds) 
      ? tenantIds.filter(Boolean)
      : (otherData.tenant_id ? [otherData.tenant_id] : (otherData.tenantId ? [otherData.tenantId] : []));

    // Normaliza camelCase para snake_case para as colunas do PostgreSQL
    if ('displayName' in otherData) {
      otherData.display_name = otherData.displayName;
      delete otherData.displayName;
    }
    if ('userType' in otherData) {
      otherData.user_type = otherData.userType;
      delete otherData.userType;
    }
    if ('tenantId' in otherData) {
      otherData.tenant_id = otherData.tenantId;
      delete otherData.tenantId;
    }
    if ('photoURL' in otherData) {
      otherData.photo_url = otherData.photoURL;
      delete otherData.photoURL;
    }
    if (otherData.role) {
      otherData.is_admin = otherData.role === 'Admin';
    }

    // Se temos tenantIds definidos, garante que o tenant_id primário seja consistente e válido
    if (validTenantIds.length > 0) {
      if (!otherData.tenant_id || !validTenantIds.includes(otherData.tenant_id)) {
        otherData.tenant_id = validTenantIds[0];
      }
    }

    // Update in custom user store
    upsertCustomUser({
      id,
      email: otherData.email || id,
      ...otherData,
      display_name: otherData.display_name || undefined,
      user_type: otherData.user_type || undefined,
      tenant_id: otherData.tenant_id || undefined,
      tenantIds: validTenantIds.length > 0 ? validTenantIds : undefined
    });

    // Se o e-mail foi alterado, atualiza também no Supabase Auth
    if (otherData.email && supabaseServiceKey) {
      try {
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
        await adminSupabase.auth.admin.updateUserById(id, {
          email: String(otherData.email).trim().toLowerCase(),
          email_confirm: true,
          user_metadata: {
            display_name: otherData.display_name || undefined,
            role: otherData.role || undefined
          }
        });
      } catch (authEmailErr) {
        console.warn("[API/Profiles] Aviso ao atualizar email no Supabase Auth:", authEmailErr);
      }
    }

    // 1. Atualiza dados do perfil na tabela profiles em uma única operação direta
    if (Object.keys(otherData).length > 0) {
      try {
        let { error } = await supabase
          .from('profiles')
          .update(otherData)
          .eq('id', id);

        if (error && (
          error.message?.includes('is_active') || 
          error.message?.includes('inactive_reason') || 
          error.message?.includes('security_keyword') || 
          error.code === '42703'
        )) {
          console.warn("[API/Profiles] Colunas novas ainda não no Supabase. Fallback aplicado com persistência local.");
          const fallbackData = { ...otherData };
          delete fallbackData.is_active;
          delete fallbackData.inactive_reason;
          delete fallbackData.security_keyword;
          if (Object.keys(fallbackData).length > 0) {
            await supabase.from('profiles').update(fallbackData).eq('id', id);
          }
        }
      } catch (dbErr) {
        console.warn("[API/Profiles] Aviso ao atualizar profiles no Supabase:", dbErr);
      }
    }

    // 2. Sincroniza a tabela de relacionamento muitos-para-muitos profile_tenants de forma atômica e resiliente
    if (Array.isArray(tenantIds)) {
      try {
        const userRole = otherData.role || 'Membro';

        // 2a. Remove apenas associações que foram desmarcadas (evita apagar e recriar tudo)
        if (validTenantIds.length > 0) {
          await supabase
            .from('profile_tenants')
            .delete()
            .eq('profile_id', id)
            .not('tenant_id', 'in', `(${validTenantIds.join(',')})`);
        } else {
          await supabase.from('profile_tenants').delete().eq('profile_id', id);
        }

        // 2b. Upsert seguro com tratamento de conflito na chave primária (profile_id, tenant_id)
        if (validTenantIds.length > 0) {
          const insertRows = validTenantIds.map((tid: string) => ({
            profile_id: id,
            tenant_id: tid,
            role: userRole
          }));

          const { error: upsertError } = await supabase
            .from('profile_tenants')
            .upsert(insertRows, { onConflict: 'profile_id,tenant_id' });
          
          if (upsertError) {
            for (const row of insertRows) {
              await supabase.from('profile_tenants').upsert(row, { onConflict: 'profile_id,tenant_id' }).catch(() => {});
            }
          }
        }
      } catch (assocErr) {
        console.error("[API/Profiles] Erro ao sincronizar associações profile_tenants:", assocErr);
      }
    }

    invalidateServerProfilesCache();

    const updatedProfile = {
      id,
      displayName: otherData.display_name || otherData.displayName || undefined,
      email: otherData.email || undefined,
      photoURL: otherData.photo_url || otherData.photoURL || null,
      role: otherData.role || undefined,
      userType: otherData.user_type || otherData.userType || undefined,
      isAdmin: otherData.is_admin !== undefined ? otherData.is_admin : (otherData.role === 'Admin'),
      tenantId: otherData.tenant_id || (validTenantIds.length > 0 ? validTenantIds[0] : undefined),
      tenantIds: validTenantIds.length > 0 ? validTenantIds : undefined,
      isActive: otherData.is_active !== undefined ? otherData.is_active : true,
      inactiveReason: otherData.inactive_reason || null,
      securityKeyword: otherData.security_keyword || null
    };

    return NextResponse.json({ success: true, profile: updatedProfile }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Profiles] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: "Valid ID required for DELETE" }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    deleteCustomUser(id);

    try {
      await supabase.from('profile_tenants').delete().eq('profile_id', id);
      await supabase.from('profiles').delete().eq('id', id);
    } catch (e) {
      console.warn("[API/Profiles] Aviso ao excluir perfil no Supabase:", e);
    }

    invalidateServerProfilesCache();

    return NextResponse.json({ success: true, id }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("[API/Profiles] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
