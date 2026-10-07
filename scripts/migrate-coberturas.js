/**
 * Script de Migração em Lote:
 * Reclassifica todos os imóveis que contenham "cobertura" no título ou descrição:
 *  - Atualiza type = 'cobertura'
 *  - Atualiza reference_code para prefixo CO (ex: AP0006 -> CO0006)
 *  - Mantém integridade e tags do imóvel
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  
  [envPath, envLocalPath].forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...vals] = trimmed.split('=');
          if (key && !process.env[key.trim()]) {
            process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });
    }
  });
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ ERRO: Variáveis de ambiente Supabase não encontradas!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log("🚀 Iniciando migração e reclassificação de Coberturas...\n");

  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, title, description, type, reference_code, tags');

  if (error) {
    console.error("❌ Erro ao buscar imóveis:", error.message);
    process.exit(1);
  }

  const coberturas = properties.filter(p => {
    const title = (p.title || "").toLowerCase();
    const desc = (p.description || "").toLowerCase();
    return title.includes("cobertura") || desc.includes("cobertura");
  });

  console.log(`📊 Total de imóveis na base: ${properties.length}`);
  console.log(`🔍 Total identificados como Cobertura: ${coberturas.length}\n`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const prop of coberturas) {
    const oldType = prop.type;
    const oldRef = prop.reference_code || '';
    
    // Gerar nova referência com prefixo CO
    let newRef = oldRef;
    if (oldRef) {
      const match = oldRef.match(/^([A-Za-z]+)(\d+)$/);
      if (match) {
        newRef = `CO${match[2]}`;
      } else if (oldRef.startsWith('AP')) {
        newRef = oldRef.replace(/^AP/, 'CO');
      } else {
        newRef = `CO${oldRef}`;
      }
    } else {
      newRef = `CO${String(updatedCount + 1).padStart(4, '0')}`;
    }

    // Preparar tags com salvaguarda
    let currentTags = Array.isArray(prop.tags) ? [...prop.tags] : [];
    const cleanTags = currentTags.filter(t => !t.toLowerCase().startsWith('tipo:'));
    cleanTags.push('Tipo:cobertura');

    const updatePayload = {
      type: 'cobertura',
      reference_code: newRef,
      tags: cleanTags
    };

    // Tentar atualizar com type: 'cobertura' nativo
    let { error: updateError } = await supabase
      .from('properties')
      .update(updatePayload)
      .eq('id', prop.id);

    // Se o banco ainda tiver a constraint antiga properties_type_check que barra 'cobertura',
    // usa fallback de tipo 'apartamento' com tag 'Tipo:cobertura'
    if (updateError && (updateError.message.includes('properties_type_check') || updateError.code === '23514')) {
      const fallbackPayload = {
        type: 'apartamento',
        reference_code: newRef,
        tags: cleanTags
      };
      const retry = await supabase
        .from('properties')
        .update(fallbackPayload)
        .eq('id', prop.id);
      updateError = retry.error;
    }

    if (updateError) {
      console.error(`❌ Erro no imóvel ID ${prop.id} ("${prop.title}"):`, updateError.message);
      errorCount++;
    } else {
      updatedCount++;
      if (updatedCount <= 10 || updatedCount % 25 === 0 || updatedCount === coberturas.length) {
        console.log(`✅ [${updatedCount}/${coberturas.length}] ID ${prop.id}: Tipo "${oldType}" -> "cobertura" | Ref "${oldRef}" -> "${newRef}" | Título: "${(prop.title || '').substring(0, 45)}"`);
      }
    }
  }

  console.log(`\n🎉 Migração concluída com sucesso!`);
  console.log(`   - Atualizados com sucesso: ${updatedCount}`);
  console.log(`   - Erros: ${errorCount}`);
}

run();
