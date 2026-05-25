import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSaaSConfig, saveSaaSConfig } from '@/lib/billing';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function verifyIsPlatformAdmin(req: NextRequest): Promise<boolean> {
  // Extract user from token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return false;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;

  return user.email?.toLowerCase() === 'ggsalles@gmail.com';
}

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await verifyIsPlatformAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Access Denied. Platform administrator only." }, { status: 403 });
    }

    const config = await getSaaSConfig();
    return NextResponse.json(config);
  } catch (error: any) {
    console.error("[API/Tenants/Config] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyIsPlatformAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Access Denied. Platform administrator only." }, { status: 403 });
    }

    const newConfig = await req.json();
    if (!newConfig || !Array.isArray(newConfig.blockedTenantIds)) {
      return NextResponse.json({ error: "Invalid SaaS configuration body." }, { status: 400 });
    }

    const success = await saveSaaSConfig(newConfig);
    if (!success) {
      return NextResponse.json({ error: "Failed to save configuration." }, { status: 500 });
    }

    return NextResponse.json({ success: true, config: newConfig });
  } catch (error: any) {
    console.error("[API/Tenants/Config] POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
