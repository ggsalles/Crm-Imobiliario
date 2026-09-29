import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSecurityKeywordFromStore } from '@/lib/security-keywords';
import { keywordResetSchema, validateData } from '@/lib/validations';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || '';

// Rate limiting in-memory map to prevent brute-force keyword guessing
const attemptTracker = new Map<string, { count: number; blockedUntil: number }>();

function checkRateLimit(ipOrEmail: string): { allowed: boolean; remainingSeconds?: number } {
  const now = Date.now();
  const record = attemptTracker.get(ipOrEmail);

  if (record) {
    if (record.blockedUntil > now) {
      return { allowed: false, remainingSeconds: Math.ceil((record.blockedUntil - now) / 1000) };
    }
    if (record.blockedUntil !== 0 && record.blockedUntil <= now) {
      attemptTracker.delete(ipOrEmail);
    }
  }
  return { allowed: true };
}

function registerFailedAttempt(ipOrEmail: string) {
  const now = Date.now();
  const record = attemptTracker.get(ipOrEmail) || { count: 0, blockedUntil: 0 };
  record.count += 1;

  if (record.count >= 5) {
    // Block for 5 minutes after 5 consecutive failures
    record.blockedUntil = now + 5 * 60 * 1000;
  }
  attemptTracker.set(ipOrEmail, record);
}

function registerSuccess(ipOrEmail: string) {
  attemptTracker.delete(ipOrEmail);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const validation = validateData(keywordResetSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { email: normalizedEmail, securityKeyword: cleanKeyword, newPassword: cleanPassword } = validation.data;

    // Anti-Brute-Force check
    const rateCheck = checkRateLimit(normalizedEmail);
    if (!rateCheck.allowed) {
      return NextResponse.json({ 
        error: `Muitas tentativas incorretas. Por segurança, tente novamente em ${rateCheck.remainingSeconds} segundos ou solicite a um administrador.` 
      }, { status: 429 });
    }

    // Conectar ao Supabase
    const adminSupabase = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
      : createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    // 1. Buscar o perfil pelo e-mail
    const { data: profile, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('id, display_name, email, role, security_keyword, is_active')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (profileErr) {
      console.error("[API/Keyword-Reset] Erro ao buscar perfil:", profileErr);
    }

    if (!profile) {
      registerFailedAttempt(normalizedEmail);
      return NextResponse.json({ 
        error: "Não encontramos uma conta cadastrada com este e-mail. Verifique a digitação ou contate o administrador." 
      }, { status: 404 });
    }

    if (profile.is_active === false) {
      return NextResponse.json({ 
        error: "Esta conta está atualmente inativada. Entre em contato com a administração da sua imobiliária." 
      }, { status: 403 });
    }

    // 2. Validar a Palavra-Chave (Tenta no Supabase ou no armazenamento local resiliente)
    let storedKeyword = (profile.security_keyword || '').trim().toLowerCase();

    if (!storedKeyword) {
      const localKeyword = getSecurityKeywordFromStore(profile.id, normalizedEmail);
      if (localKeyword) {
        storedKeyword = localKeyword.trim().toLowerCase();
      }
    }

    if (!storedKeyword) {
      return NextResponse.json({ 
        error: "Nenhuma palavra-chave foi cadastrada para esta conta ainda. Solicite a redefinição de senha ao administrador da sua imobiliária ou utilize a opção de e-mail." 
      }, { status: 400 });
    }

    if (storedKeyword !== cleanKeyword) {
      registerFailedAttempt(normalizedEmail);
      return NextResponse.json({ 
        error: "Palavra-chave incorreta. Verifique os caracteres e tente novamente." 
      }, { status: 401 });
    }

    // Palavra-chave correta -> Resetar contador de tentativas
    registerSuccess(normalizedEmail);

    if (!supabaseServiceKey) {
      return NextResponse.json({ 
        error: "Chave de serviço do banco não configurada no servidor para atualizar credenciais." 
      }, { status: 500 });
    }

    // 3. Atualizar a senha no Supabase Auth
    let authUpdateSuccess = false;
    const authUserId = profile.id;

    // Tentar atualizar pelo ID direto
    const { data: updateRes, error: errById } = await adminSupabase.auth.admin.updateUserById(authUserId, {
      password: cleanPassword,
      email_confirm: true
    });

    if (!errById && updateRes?.user) {
      authUpdateSuccess = true;
    } else {
      // Se o ID do profile não bate com o do Auth (legado), busca na lista do Auth pelo email
      const { data: usersList, error: listErr } = await adminSupabase.auth.admin.listUsers();
      if (!listErr && usersList?.users) {
        const authMatch = usersList.users.find(u => u.email?.toLowerCase() === normalizedEmail);
        if (authMatch?.id) {
          const { error: matchErr } = await adminSupabase.auth.admin.updateUserById(authMatch.id, {
            password: cleanPassword,
            email_confirm: true
          });
          if (!matchErr) {
            authUpdateSuccess = true;
          }
        }
      }
    }

    if (!authUpdateSuccess) {
      return NextResponse.json({ 
        error: "Não foi possível atualizar a senha no serviço de autenticação. Contate o suporte." 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Senha redefinida com sucesso! Você já pode fazer login com sua nova senha." 
    });
  } catch (error: any) {
    console.error("[API/Keyword-Reset] Erro fatal:", error);
    return NextResponse.json({ error: error.message || "Erro interno ao redefinir senha." }, { status: 500 });
  }
}
