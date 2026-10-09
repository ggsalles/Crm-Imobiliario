import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from '@/lib/supabase-config';

export const dynamic = 'force-dynamic';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;
const supabaseServiceKey = SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  const key = supabaseServiceKey || supabaseAnonKey;
  return createClient(supabaseUrl, key, { auth: { persistSession: false } });
}

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!id) {
    return {
      title: 'Imóvel Exclusivo | SalesScore',
      description: 'Confira as características deste imóvel exclusivo.',
    };
  }

  try {
    const supabase = getSupabase();
    const { data: prop } = await supabase
      .from('properties')
      .select('title, description, price, city, neighborhood, state, bedrooms, suites, bathrooms, area, image_url')
      .eq('id', id)
      .maybeSingle();

    if (!prop) {
      return {
        title: 'Imóvel | SalesScore Vitrine',
        description: 'Detalhes do imóvel selecionado.',
      };
    }

    // Format price
    const formattedPrice = prop.price
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(prop.price)
      : '';

    // Title construction
    const titleParts = [prop.title || 'Imóvel'];
    if (formattedPrice) titleParts.push(formattedPrice);
    const title = titleParts.join(' • ');

    // Location & specs construction
    const locParts = [prop.neighborhood, prop.city, prop.state].filter(Boolean).join(', ');
    const specs = [
      prop.bedrooms 
        ? `${prop.bedrooms} quartos${prop.suites && prop.suites > 0 ? ` (${prop.suites} suíte${prop.suites > 1 ? 's' : ''})` : ''}` 
        : null,
      prop.bathrooms ? `${prop.bathrooms} banheiros` : null,
      prop.area ? `${prop.area}m²` : null,
    ].filter(Boolean).join(' • ');

    const description = prop.description?.slice(0, 160) || 
      `Excelente oportunidade em ${locParts || 'ótima localização'}.${specs ? ` Com ${specs}.` : ''} Confira fotos e agende sua visita!`;

    // Extract image
    let imageUrl = '';
    if (prop.image_url) {
      try {
        const parsed = typeof prop.image_url === 'string' ? JSON.parse(prop.image_url) : prop.image_url;
        imageUrl = Array.isArray(parsed) ? parsed[0] : String(prop.image_url);
      } catch {
        imageUrl = String(prop.image_url);
      }
    }

    if (!imageUrl) {
      const { data: imgRecord } = await supabase
        .from('property_images')
        .select('url')
        .eq('property_id', id)
        .limit(1)
        .maybeSingle();
      if (imgRecord?.url) {
        imageUrl = imgRecord.url;
      }
    }

    const images = imageUrl ? [{ url: imageUrl, alt: prop.title || 'Foto do imóvel' }] : [];

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
        images: imageUrl ? [imageUrl] : [],
      },
    };
  } catch (err) {
    console.warn('[PropertyLayout Metadata] Erro ao gerar metadados dinâmicos:', err);
    return {
      title: 'Imóvel Exclusivo | SalesScore Vitrine',
      description: 'Confira as melhores ofertas e imóveis disponíveis.',
    };
  }
}

export default async function PropertyLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  let jsonLd = null;

  try {
    const supabase = getSupabase();
    const { data: prop } = await supabase
      .from('properties')
      .select('title, description, price, city, neighborhood, state, image_url')
      .eq('id', id)
      .maybeSingle();

    if (prop) {
      let imageUrl = '';
      if (prop.image_url) {
        try {
          const parsed = typeof prop.image_url === 'string' ? JSON.parse(prop.image_url) : prop.image_url;
          imageUrl = Array.isArray(parsed) ? parsed[0] : String(prop.image_url);
        } catch {
          imageUrl = String(prop.image_url);
        }
      }

      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: prop.title,
        description: prop.description || `${prop.title} em ${prop.city || 'localização privilegiada'}`,
        image: imageUrl || undefined,
        offers: {
          '@type': 'Offer',
          price: prop.price || undefined,
          priceCurrency: 'BRL',
          availability: 'https://schema.org/InStock',
        },
        address: {
          '@type': 'PostalAddress',
          addressLocality: prop.city || undefined,
          addressRegion: prop.state || undefined,
          streetAddress: prop.neighborhood || undefined,
        },
      };
    }
  } catch {
    // Non-blocking fallback
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
