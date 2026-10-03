/**
 * Script de Reindexação e Geração de Códigos de Referência Sequenciais
 * 
 * Uso:
 *   node scripts/generate-reference-codes.js
 * 
 * Este script busca todos os imóveis que não possuem `reference_code` preenchido
 * e atribui um código sequencial padronizado por imobiliária (tenant) e tipo:
 *   - Apartamento: AP0001, AP0002...
 *   - Casa: CA0001, CA0002...
 *   - Condomínio: CD0001, CD0002...
 *   - etc.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis do .env ou ambiente
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
  console.error("❌ ERRO: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY/ANON_KEY não encontradas!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const TYPE_PREFIXES = {
  apartamento: 'AP',
  casa: 'CA',
  'condomínio': 'CD',
  condominio: 'CD',
  sobrado: 'SO',
  cobertura: 'CO',
  studio: 'ST',
  sala: 'SL',
  comercial: 'CM',
  'galpão': 'GP',
  galpao: 'GP',
  'prédio': 'PR',
  predio: 'PR',
  terreno: 'TR',
  'sítio': 'SI',
  sitio: 'SI',
  'chácara': 'CH',
  chacara: 'CH',
  fazenda: 'FZ'
};

function getPrefix(type) {
  if (!type) return 'IM';
  const clean = String(type).trim().toLowerCase();
  return TYPE_PREFIXES[clean] || 'IM';
}

async function run() {
  console.log("🚀 Iniciando verificação e geração de códigos de referência de imóveis...\n");

  // 1. Carrega todos os imóveis da base
  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, title, type, tenant_id, reference_code, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("❌ Erro ao buscar imóveis:", error.message);
    if (error.message.includes('reference_code')) {
      console.log("\n💡 DICA: Execute primeiro o script SQL 'supabase_add_reference_code.sql' no SQL Editor do Supabase!");
    }
    process.exit(1);
  }

  if (!properties || properties.length === 0) {
    console.log("ℹ️ Nenhum imóvel encontrado no banco de dados.");
    return;
  }

  console.log(`📦 Total de imóveis encontrados: ${properties.length}`);

  // 2. Mapeia os maiores contadores existentes por tenant e prefixo
  const counters = {};

  properties.forEach(p => {
    const tenant = p.tenant_id || 'default';
    const prefix = getPrefix(p.type);
    const key = `${tenant}:${prefix}`;
    if (!counters[key]) counters[key] = 0;

    if (p.reference_code) {
      const match = p.reference_code.match(/^([A-Za-z]+)(\d+)$/);
      if (match) {
        const num = parseInt(match[2], 10);
        if (num > counters[key]) {
          counters[key] = num;
        }
      }
    }
  });

  // 3. Itera sobre os imóveis sem reference_code e atribui novo número
  const toUpdate = properties.filter(p => !p.reference_code || p.reference_code.trim() === '');
  console.log(`🔍 Imóveis sem código de referência: ${toUpdate.length}\n`);

  if (toUpdate.length === 0) {
    console.log("✨ Todos os imóveis já possuem código de referência! Nada a fazer.");
    return;
  }

  let updatedCount = 0;

  for (const prop of toUpdate) {
    const tenant = prop.tenant_id || 'default';
    const prefix = getPrefix(prop.type);
    const key = `${tenant}:${prefix}`;

    counters[key] = (counters[key] || 0) + 1;
    const seq = String(counters[key]).padStart(4, '0');
    const newCode = `${prefix}${seq}`;

    const { error: updateError } = await supabase
      .from('properties')
      .update({ reference_code: newCode })
      .eq('id', prop.id);

    if (updateError) {
      console.error(`❌ Erro ao atualizar imóvel ${prop.id} (${prop.title}):`, updateError.message);
    } else {
      updatedCount++;
      console.log(`✅ [${newCode}] Imóvel "${prop.title?.slice(0, 30)}" atualizado com sucesso.`);
    }
  }

  console.log(`\n🎉 Processo concluído! ${updatedCount} de ${toUpdate.length} imóveis foram atualizados com novos códigos.`);
}

run().catch(err => {
  console.error("Erro inesperado:", err);
  process.exit(1);
});
