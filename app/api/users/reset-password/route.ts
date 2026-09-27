import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { isPlatformAdmin } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || '';

export async function POST(req: NextRequest) {
  try {
    const callerUser = getAuthenticatedUser(req);
    if (!callerUser) {
      return NextResponse.json({ error: "Sessão inválida ou não autenticada." }, { status: 401 });
    }

    const body = await req.json();
    const { targetUserId, targetEmail, newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "A nova senha deve ter no mínimo 6 caracteres." }, { status: 400 });
    }

    if (!targetUserId && !targetEmail) {
      return NextResponse.json({ error: "Identificador do usuário ou e-mail é obrigatório." }, { status: 400 });
    }

    const isMaster = callerUser.email ? isPlatformAdmin(callerUser.email) : false;

    // Verificar se o solicitante é Administrador no banco
    const adminSupabase = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
      : createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    if (!isMaster) {
      const { data: callerProfile } = await adminSupabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', callerUser.id)
        .maybeSingle();

      const isCallerAdmin = callerProfile?.role === 'Admin' || callerProfile?.is_admin === true;
      const isSelf = callerUser.id === targetUserId || (callerUser.email && targetEmail && callerUser.email.toLowerCase() === targetEmail.toLowerCase());

      if (!isCallerAdmin && !isSelf) {
        return NextResponse.json({ error: "Permissão negada. Apenas administradores podem redefinir a senha de outros usuários." }, { status: 403 });
      }
    }

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: "Chave de serviço administrativa não configurada no servidor." }, { status: 500 });
    }

    // 1. Localizar o Auth User correspondente
    let authUserId = targetUserId;
    let authUserEmail = targetEmail?.toLowerCase();

    if (!authUserEmail && targetUserId) {
      const { data: targetProfile } = await adminSupabase
        .from('profiles')
        .select('email')
        .eq('id', targetUserId)
        .maybeSingle();
      if (targetProfile?.email) {
        authUserEmail = targetProfile.email.toLowerCase();
      }
    }

    // Tentar atualizar pelo ID diretamente se for UUID do Auth
    let updateSuccess = false;
    let updateError: any = null;

    if (authUserId) {
      const { data: updateRes, error: err } = await adminSupabase.auth.admin.updateUserById(authUserId, {
        password: newPassword,
        email_confirm: true
      });

      if (!err && updateRes?.user) {
        updateSuccess = true;
      } else {
        updateError = err;
      }
    }

    // Se falhou pelo ID (por exemplo, profile id legado que não coincide com auth id), busca na lista de usuários do Auth pelo e-mail
    if (!updateSuccess && authUserEmail) {
      const { data: usersData, error: listErr } = await adminSupabase.auth.admin.listUsers();
      const match = usersData?.users?.find(u => u.email?.toLowerCase() === authUserEmail);

      if (match?.id) {
        const { error: matchErr } = await adminSupabase.auth.admin.updateUserById(match.id, {
          password: newPassword,
          email_confirm: true
        });
        if (!matchErr) {
          updateSuccess = true;
        } else {
          updateError = matchErr;
        }
      } else {
        // Usuário ainda não existia no GoTrue Auth (apenas como perfil pré-cadastrado no CRM). Vamos criar a conta de Auth agora!
        const { data: newAuthUser, error: createErr } = await adminSupabase.auth.admin.createUser({
          email: authUserEmail,
          password: newPassword,
          email_confirm: true
        });

        if (!createErr && newAuthUser?.user) {
          updateSuccess = true;
          // Se o id do novo auth user for diferente do profile id, atualizamos o profile id
          if (targetUserId && targetUserId !== newAuthUser.user.id) {
            try {
              await adminSupabase.from('profiles').update({ id: newAuthUser.user.id }).eq('id', targetUserId);
            } catch (e) {}
          }
        } else {
          updateError = createErr;
        }
      }
    }

    if (!updateSuccess) {
      console.error("[API/ResetPassword] Erro ao atualizar senha:", updateError);
      return NextResponse.json({ 
        error: updateError?.message || "Não foi possível atualizar a senha do usuário." 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Senha atualizada com sucesso!" 
    });
  } catch (error: any) {
    console.error("[API/ResetPassword] Erro fatal:", error);
    return NextResponse.json({ error: error.message || "Erro interno do servidor." }, { status: 500 });
  }
}
