import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAuthenticatedUser } from '@/lib/server-auth';
import { isPlatformAdmin } from '@/lib/constants';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase(req);
    const user = getAuthenticatedUser(req);
    const userEmail = (user?.email || req.headers.get('x-user-email') || '').toLowerCase().trim();

    // Rigorous security: restricted to platform admin
    if (!isPlatformAdmin(userEmail) && userEmail !== 'ggsalles@gmail.com') {
      return NextResponse.json({ error: 'Acesso negado ao backup de imóveis.' }, { status: 403 });
    }

    const backupsDir = path.join(process.cwd(), 'backups');
    // Check if there is an existing local backup file
    if (fs.existsSync(backupsDir)) {
      const files = fs.readdirSync(backupsDir).filter(f => f.startsWith('properties_backup_') && f.endsWith('.json'));
      if (files.length > 0) {
        // Sort descending to get the most recent backup
        files.sort().reverse();
        const latestFile = path.join(backupsDir, files[0]);
        const content = fs.readFileSync(latestFile, 'utf-8');
        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${files[0]}"`
          }
        });
      }
    }

    // Otherwise, generate backup on the fly from Supabase
    let allProps: any[] = [];
    let from = 0;
    const step = 500;

    while (true) {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .range(from, from + step - 1)
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data || data.length === 0) break;
      allProps = allProps.concat(data);
      if (data.length < step) break;
      from += step;
    }

    const filename = `properties_backup_${Date.now()}.json`;
    return new Response(JSON.stringify(allProps, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error: any) {
    console.error('[API/Properties/Backup] Erro ao gerar backup:', error);
    return NextResponse.json({ error: error.message || 'Erro ao gerar backup' }, { status: 500 });
  }
}
