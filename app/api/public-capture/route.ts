import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || "";

function getSupabase() {
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { propertyId, name, email, phone, message } = await req.json();

    if (!propertyId || !name || !email || !phone) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
    }

    // 1. Fetch property details to grab the owner and tenant
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .maybeSingle();

    if (propError) {
      console.error("[API/Public-Capture] property find error:", propError);
      throw propError;
    }

    if (!property) {
      return NextResponse.json({ error: "Imóvel não encontrado ou inválido" }, { status: 404 });
    }

    const tenantId = property.tenant_id;
    const ownerId = property.owner_id;

    // 2. Check if contact exists by email in this tenant
    let contactId = null;
    let existingContact = null;

    if (tenantId) {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('email', email)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      existingContact = data;
    } else {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      existingContact = data;
    }

    if (existingContact) {
      contactId = existingContact.id;
      console.log(`[API/Public-Capture] Contact existing with ID: ${contactId}`);
    } else {
      // Create new contact
      const contactPayload: any = {
        name,
        email,
        phone,
        type: 'cliente',
        role: 'quente', // Leads from Instagram represent real active intent!
        source: 'Instagram - Captura Pública',
        owner_id: ownerId,
      };

      if (tenantId) {
        contactPayload.tenant_id = tenantId;
      }

      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert([contactPayload])
        .select();

      if (contactError) {
        console.error("[API/Public-Capture] contact insert error:", contactError);
        throw contactError;
      }

      if (!newContact || newContact.length === 0) {
        throw new Error("Falha ao salvar novo contato no banco.");
      }

      contactId = newContact[0].id;
      console.log(`[API/Public-Capture] New contact created with ID: ${contactId}`);
    }

    // 3. Create Deal linked to property and contact
    const dealPayload: any = {
      title: `Lead Instagram - ${name} (${property.title || 'Imóvel'})`,
      value: property.price || 0,
      stage: 'lead', // first stage Novo Lead
      contact_id: contactId,
      property_id: propertyId,
      owner_id: ownerId,
    };

    if (tenantId) {
      dealPayload.tenant_id = tenantId;
    }

    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert([dealPayload])
      .select();

    if (dealError) {
      console.error("[API/Public-Capture] deal insert error:", dealError);
      throw dealError;
    }

    if (!newDeal || newDeal.length === 0) {
      throw new Error("Falha ao salvar negócio no banco.");
    }

    const dealId = newDeal[0].id;
    console.log(`[API/Public-Capture] New deal created with ID: ${dealId}`);

    // 4. Create timeline event for the contact
    const timelineContactPayload: any = {
      type: 'system',
      category: 'contact',
      related_id: contactId,
      title: 'Interesse via Instagram',
      content: `O lead demonstrou interesse no imóvel "${property.title}" de valor ${property.price ? 'R$ ' + property.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'sob consulta'}. Mensagem opcional: ${message || "Não enviada."}`,
      author_name: 'Captura Integrada',
      owner_id: ownerId,
      created_by: ownerId,
    };

    if (tenantId) {
      timelineContactPayload.tenant_id = tenantId;
    }

    await supabase
      .from('timeline')
      .insert([timelineContactPayload]);

    // Create timeline event for the deal
    const timelineDealPayload: any = {
      type: 'system',
      category: 'deal',
      related_id: dealId,
      title: 'Negócio Gerado Automaticamente',
      content: `Este negócio foi aberto automaticamente através do formulário público de captura ligado ao Instagram. Imóvel de interesse: ${property.title}.`,
      author_name: 'Captura Integrada',
      owner_id: ownerId,
      created_by: ownerId,
    };

    if (tenantId) {
      timelineDealPayload.tenant_id = tenantId;
    }

    await supabase
      .from('timeline')
      .insert([timelineDealPayload]);

    return NextResponse.json({ success: true, contactId, dealId });
  } catch (error: any) {
    console.error("[API/Public-Capture] POST error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
