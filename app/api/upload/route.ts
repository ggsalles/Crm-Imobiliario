import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || "";

function getSupabase(req: NextRequest) {
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false
      }
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      },
      auth: {
        persistSession: false
      }
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabaseServer = getSupabase(req);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucketName = formData.get("bucketName") as string || "property-images";
    const userId = formData.get("userId") as string || "anonymous";

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // ArrayBuffer read on node side for safety and performance
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[API/Upload] Sincronização direta via proxy no bucket "${bucketName}" (${file.name}, ${file.size} bytes)`);

    const { error: uploadError } = await supabaseServer.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type || 'image/jpeg'
      });

    if (uploadError) {
      console.error(`[API/Upload] Erro no storage para o bucket ${bucketName}:`, uploadError);
      
      // Fallback para o bucket 'images' caso o bucket 'property-images' ou outro não seja encontrado
      if ((uploadError as any).status === 404 || uploadError.message?.includes('bucket not found')) {
        if (bucketName !== 'images') {
          console.log("[API/Upload] Tentando bucket de fallback 'images'...");
          const { error: fallbackError } = await supabaseServer.storage
            .from('images')
            .upload(filePath, buffer, {
              upsert: true,
              cacheControl: '3600',
              contentType: file.type || 'image/jpeg'
            });

          if (fallbackError) {
            return NextResponse.json({ error: fallbackError.message }, { status: 500 });
          }

          const { data: { publicUrl } } = supabaseServer.storage
            .from('images')
            .getPublicUrl(filePath);

          return NextResponse.json({ name: file.name, url: publicUrl });
        }
      }

      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabaseServer.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return NextResponse.json({ name: file.name, url: publicUrl });

  } catch (err: any) {
    console.error(`[API/Upload] Erro interno:`, err);
    return NextResponse.json({ error: err.message || "Erro desconhecido no servidor." }, { status: 500 });
  }
}
