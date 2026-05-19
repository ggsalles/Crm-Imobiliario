import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabase(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (id && id !== 'undefined' && id !== 'null') {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json(null);
      return NextResponse.json({
        id: data.id,
        displayName: data.display_name,
        email: data.email,
        photoURL: data.photo_url,
        role: data.role,
        userType: data.user_type,
        isAdmin: data.is_admin
      });
    }

    if (email) {
      const { data, error } = await supabase.from('profiles').select('id').eq('email', email.toLowerCase()).maybeSingle();
      if (error) throw error;
      return NextResponse.json(data);
    }

    const { data: profiles, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    
    const items = (profiles || []).map((item: any) => ({
      id: item.id,
      displayName: item.display_name,
      email: item.email,
      photoURL: item.photo_url,
      role: item.role,
      userType: item.user_type,
      isAdmin: item.is_admin
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
    const data = await req.json();
    
    // We use service role key for profile creation if it's during signup, 
    // but here we follow the standard pattern.
    const { data: result, error } = await supabase
      .from('profiles')
      .insert([data])
      .select();

    if (error) throw error;
    return NextResponse.json({ id: result[0].id });
  } catch (error: any) {
    console.error("[API/Profiles] POST Error:", error);
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

    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', id);

    if (error) throw error;

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
