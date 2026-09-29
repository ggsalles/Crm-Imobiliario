import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || '';

function getSupabase() {
  const key = supabaseServiceKey || supabaseAnonKey;
  return createClient(supabaseUrl, key, { auth: { persistSession: false } });
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = getSupabase();

    // Busca imóveis disponíveis para compor a vitrine, priorizando destacados ou mais recentes
    const { data: properties, error } = await supabase
      .from('properties')
      .select('id, title, price, city, neighborhood, state, image_url, created_at')
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) {
      console.warn('[VitrineLayout Metadata] Erro ao buscar imóveis:', error.message);
    }

    const propList = properties || [];
    const totalCount = propList.length;

    // Identifica a melhor foto de capa de alta resolução (imóvel em destaque)
    let heroImageUrl = '';
    let featuredTitle = '';

    for (const p of propList) {
      if (p.image_url) {
        try {
          const parsed = typeof p.image_url === 'string' ? JSON.parse(p.image_url) : p.image_url;
          const url = Array.isArray(parsed) ? parsed[0] : String(p.image_url);
          if (url && typeof url === 'string' && url.startsWith('http')) {
            heroImageUrl = url;
            featuredTitle = p.title || '';
            break;
          }
        } catch {
          if (typeof p.image_url === 'string' && p.image_url.startsWith('http')) {
            heroImageUrl = p.image_url;
            featuredTitle = p.title || '';
            break;
          }
        }
      }
    }

    // Se não encontrou foto no array do imóvel, busca na tabela property_images
    if (!heroImageUrl && propList.length > 0) {
      const topIds = propList.map((p) => p.id);
      const { data: imgRecord } = await supabase
        .from('property_images')
        .select('url')
        .in('property_id', topIds)
        .limit(1)
        .maybeSingle();

      if (imgRecord?.url) {
        heroImageUrl = imgRecord.url;
      }
    }

    // Calcula preço mínimo de entrada
    const validPrices = propList.map((p) => Number(p.price)).filter((p) => !isNaN(p) && p > 0);
    const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
    const formattedMinPrice = minPrice
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(minPrice)
      : null;

    // Regiões e cidades atendidas
    const cities = Array.from(new Set(propList.map((p) => p.city).filter(Boolean))).slice(0, 3);
    const citiesStr = cities.length > 0 ? cities.join(', ') : 'regiões nobres';

    // Composição do título com estética de detalhamento dos imóveis
    const title = 'Vitrine Imobiliária • Imóveis Selecionados & Oportunidades';

    let description = 'Confira nosso catálogo de imóveis exclusivos, casas, apartamentos e coberturas.';
    if (totalCount > 0) {
      description = `Explore nosso portfólio com imóveis de alto padrão em ${citiesStr}.${formattedMinPrice ? ` Oportunidades a partir de ${formattedMinPrice}.` : ''} Agende sua visita online!`;
    }

    const images = heroImageUrl
      ? [{ url: heroImageUrl, width: 1200, height: 630, alt: featuredTitle || 'Vitrine de Imóveis Exclusivos' }]
      : [];

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images,
        siteName: 'SalesScore Vitrine Imobiliária',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: heroImageUrl ? [heroImageUrl] : [],
      },
    };
  } catch (err) {
    console.warn('[VitrineLayout Metadata] Fallback para metadados padrões:', err);
    return {
      title: 'Vitrine de Imóveis Exclusivos | SalesScore',
      description: 'Confira nosso catálogo completo de imóveis, casas e apartamentos exclusivos.',
      openGraph: {
        title: 'Vitrine de Imóveis Exclusivos | SalesScore',
        description: 'Confira nosso catálogo completo de imóveis, casas e apartamentos exclusivos.',
        type: 'website',
        siteName: 'SalesScore Vitrine Imobiliária',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Vitrine de Imóveis Exclusivos | SalesScore',
        description: 'Confira nosso catálogo completo de imóveis, casas e apartamentos exclusivos.',
      },
    };
  }
}

export default async function VitrineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let jsonLd = null;

  try {
    const supabase = getSupabase();
    const { data: properties } = await supabase
      .from('properties')
      .select('title, price, city, neighborhood')
      .limit(6);

    if (properties && properties.length > 0) {
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Vitrine Imobiliária de Imóveis Exclusivos',
        description: 'Catálogo online de imóveis, casas, apartamentos e empreendimentos.',
        about: {
          '@type': 'RealEstateAgent',
          name: 'SalesScore Imobiliária',
        },
        mainEntity: properties.map((prop) => ({
          '@type': 'RealEstateListing',
          name: prop.title,
          offers: {
            '@type': 'Offer',
            price: prop.price || undefined,
            priceCurrency: 'BRL',
          },
        })),
      };
    }
  } catch {
    // Fallback silencioso
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
