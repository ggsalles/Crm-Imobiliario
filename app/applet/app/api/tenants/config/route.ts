import { NextRequest, NextResponse } from 'next/server';
import { getSaaSConfig, saveSaaSConfig } from '@/lib/billing';
import { isPlatformAdmin } from '@/lib/constants';
import { getAuthenticatedUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

function verifyIsPlatformAdmin(req: NextRequest): boolean {
  const user = getAuthenticatedUser(req);
  if (!user || !user.email) return false;
  return isPlatformAdmin(user.email);
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
