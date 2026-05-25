import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

      let tenantIds = [data.tenant_id || "11111111-1111-1111-1111-111111111111"];
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

      return NextResponse.json({
        id: data.id,
        displayName: data.display_name,
        email: data.email,
        photoURL: data.photo_url,
        role: data.role,
        userType: data.user_type,
        isAdmin: data.is_admin,
        tenantId: data.tenant_id,
        tenantIds
      });
    }

    if (email) {
      let { data, error } = await supabase.from('profiles').select('id, tenant_id').eq('email', email.toLowerCase()).maybeSingle();
      
      if ((error || !data) && supabaseServiceKey) {
        console.warn("[API/Profiles] GET Email: Erro ou vazio usando client padrão, tentando com Service Role...");
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
        const { data: adminData, error: adminError } = await adminSupabase.from('profiles').select('id, tenant_id').eq('email', email.toLowerCase()).maybeSingle();
        if (!adminError && adminData) {
          data = adminData;
          error = null;
        }
      }

      if (error) throw error;
      return NextResponse.json(data ? { id: data.id, tenantId: data.tenant_id } : null);
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

    if (error) throw error;
    
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

    const items = (profiles || []).map((item: any) => ({
      id: item.id,
      displayName: item.display_name,
      email: item.email,
      photoURL: item.photo_url,
      role: item.role,
      userType: item.user_type,
      isAdmin: item.is_admin,
      tenantId: item.tenant_id,
      tenantIds: associationsMap[item.id] || [item.tenant_id || "11111111-1111-1111-1111-111111111111"]
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("[API/Profiles] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const body = await req.json();
    
    const { tenantIds, ...profileData } = body;

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
      if ((existingUser.tenant_id === '11111111-1111-1111-1111-111111111111' || !existingUser.tenant_id) && profileData.tenant_id && profileData.tenant_id !== '11111111-1111-1111-1111-111111111111') {
        updatePayload.tenant_id = profileData.tenant_id;
      }

      if (Object.keys(updatePayload).length > 0) {
        await supabase.from('profiles').update(updatePayload).eq('id', profileId);
      }
    } else {
      const { data: result, error } = await supabase
        .from('profiles')
        .insert([profileData])
        .select();

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
            return NextResponse.json({ error: "Este e-mail já está sendo utilizado por outro usuário no CRM." }, { status: 400 });
          }
        } else {
          throw error;
        }
      } else {
        profileId = result[0].id;
        finalRole = result[0].role || 'Membro';
      }
    }

    const resolvedTenantIds = Array.isArray(tenantIds) && tenantIds.length > 0
      ? tenantIds
      : [profileData.tenant_id || "11111111-1111-1111-1111-111111111111"];

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

    return NextResponse.json({ id: profileId });
  } catch (error: any) {
    console.error("[API/Profiles] POST Error:", error);
    if (error.code === '23505' || (error.message && error.message.toLowerCase().includes('unique constraint'))) {
      return NextResponse.json({ error: "Este e-mail já está sendo utilizado por outro usuário no CRM." }, { status: 400 });
    }
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
    const { tenantIds, ...otherData } = data;

    if (Object.keys(otherData).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(otherData)
        .eq('id', id);

      if (error) throw error;

      // Se alterou a imobiliária ativa (tenant_id), cria ou garante associação dinâmica na tabela profile_tenants
      if (otherData.tenant_id) {
        try {
          const { data: profData } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', id)
            .maybeSingle();
          const userRole = otherData.role || (profData && profData.role) || 'Membro';

          await supabase
            .from('profile_tenants')
            .upsert({
              profile_id: id,
              tenant_id: otherData.tenant_id,
              role: userRole
            });
        } catch (assocErr) {
          console.warn("[API/Profiles] Erro ao registrar associação dinâmica em profile_tenants no PATCH:", assocErr);
        }


      }
    }

    if (Array.isArray(tenantIds)) {
      try {
        const { error: delError } = await supabase
          .from('profile_tenants')
          .delete()
          .eq('profile_id', id);
        
        if (delError) {
          console.warn("Erro ao deletar associacoes antigas:", delError);
        }

        if (tenantIds.length > 0) {
          const insertRows = tenantIds.map((tid: string) => ({
            profile_id: id,
            tenant_id: tid,
            role: otherData.role || 'Membro'
          }));

          const { error: insError } = await supabase
            .from('profile_tenants')
            .insert(insertRows);
          
          if (insError) throw insError;

          const { data: currProfile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', id)
            .maybeSingle();

          if (currProfile && !tenantIds.includes(currProfile.tenant_id)) {
            await supabase
              .from('profiles')
              .update({ tenant_id: tenantIds[0] })
              .eq('id', id);
          }
        }
      } catch (assocErr) {
        console.warn("Erro ao atualizar associacoes profile_tenants:", assocErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Profiles] PATCH Error:", error);
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

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API/Profiles] DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
