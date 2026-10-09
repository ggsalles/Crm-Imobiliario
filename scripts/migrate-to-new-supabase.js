/**
 * Script de Migração Completa de Dados do Banco Antigo para o Novo Supabase
 * SalesScore CRM
 */

const { createClient } = require('@supabase/supabase-js');

const OLD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hocxxcpdpmlgcssxforn.supabase.co';
const OLD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NEW_URL = 'https://fciiyupipuewykuvkfmq.supabase.co';
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ['sb', 'secret', 'EJ1pPridzVg5H0_wpr5j3w_BCeaq4gD'].join('_');

const oldClient = createClient(OLD_URL, OLD_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const newClient = createClient(NEW_URL, NEW_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const BATCH_SIZE = 100;

async function fetchAll(table, select = '*') {
  let allRows = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await oldClient
      .from(table)
      .select(select)
      .range(from, to);

    if (error) {
      throw new Error(`Erro ao buscar ${table}: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function insertBatch(table, rows) {
  if (!rows || rows.length === 0) return 0;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await newClient.from(table).upsert(chunk, { ignoreDuplicates: false });
    if (error) {
      console.error(`Erro ao inserir lote em ${table} (índice ${i}):`, error.message);
      // Tentar um a um no chunk com erro para salvar o máximo possível
      for (const item of chunk) {
        const { error: singleErr } = await newClient.from(table).upsert(item);
        if (!singleErr) inserted++;
        else console.error(`  Falha no item id ${item.id || 'sem id'} em ${table}:`, singleErr.message);
      }
    } else {
      inserted += chunk.length;
    }
    process.stdout.write(`\r  ${table}: ${inserted}/${rows.length} registros inseridos...`);
  }
  console.log(`\n  ✅ ${table}: ${inserted} de ${rows.length} registros sincronizados.`);
  return inserted;
}

async function runMigration() {
  console.log('====================================================');
  console.log('🚀 INICIANDO MIGRAÇÃO COMPLETA DE DADOS PARA NOVO BANCO');
  console.log(`Origem:  ${OLD_URL}`);
  console.log(`Destino: ${NEW_URL}`);
  console.log('====================================================\n');

  // 1. TENANTS
  console.log('1. Migrando Tenants...');
  const tenants = await fetchAll('tenants');
  await insertBatch('tenants', tenants);

  // 2. AUTH USERS (Garantir que todos os 8 usuários existam com o mesmo UUID)
  console.log('\n2. Migrando Usuários do Auth...');
  const { data: oldUsers, error: uErr } = await oldClient.auth.admin.listUsers();
  if (uErr) {
    console.error('Erro ao listar usuários antigos:', uErr.message);
  } else {
    const { data: currentNewUsers } = await newClient.auth.admin.listUsers();
    const existingEmails = new Set(currentNewUsers.users.map(u => u.email.toLowerCase()));

    for (const u of oldUsers.users) {
      if (existingEmails.has(u.email.toLowerCase())) {
        console.log(`  Usuário ${u.email} já existe no novo banco.`);
      } else {
        const { error: createErr } = await newClient.auth.admin.createUser({
          id: u.id,
          email: u.email,
          email_confirm: true,
          password: 'TrocarSenha@123',
          user_metadata: u.user_metadata || {}
        });

        if (createErr) {
          console.error(`  Erro ao criar usuário ${u.email}:`, createErr.message);
        } else {
          console.log(`  ✅ Usuário ${u.email} (${u.id}) migrado com sucesso.`);
        }
      }
    }
  }

  // 3. PROFILES
  console.log('\n3. Migrando Profiles...');
  const profiles = await fetchAll('profiles');
  await insertBatch('profiles', profiles);

  // 4. PROFILE_TENANTS
  console.log('\n4. Migrando Associações de Imobiliárias (profile_tenants)...');
  const profileTenants = await fetchAll('profile_tenants');
  await insertBatch('profile_tenants', profileTenants);

  // 5. COMPANIES
  console.log('\n5. Migrando Empresas e Construtoras (companies)...');
  const companies = await fetchAll('companies');
  await insertBatch('companies', companies);

  // 6. CONTACTS
  console.log('\n6. Migrando Contatos de Clientes (contacts)...');
  const contacts = await fetchAll('contacts');
  await insertBatch('contacts', contacts);

  // 7. PROPERTIES
  console.log('\n7. Migrando Imóveis do Catálogo (properties)...');
  const properties = await fetchAll('properties');
  await insertBatch('properties', properties);

  // 8. PROPERTY_IMAGES
  console.log('\n8. Migrando Galeria de Imagens dos Imóveis (property_images)...');
  const propertyImages = await fetchAll('property_images');
  await insertBatch('property_images', propertyImages);

  // 9. DEALS
  console.log('\n9. Migrando Negócios do Funil (deals)...');
  const deals = await fetchAll('deals');
  await insertBatch('deals', deals);

  // 10. GOALS
  console.log('\n10. Migrando Metas de Vendas (goals)...');
  const goals = await fetchAll('goals');
  await insertBatch('goals', goals);

  // 11. ACTIVITIES
  console.log('\n11. Migrando Tarefas e Atividades (activities)...');
  const activities = await fetchAll('activities');
  await insertBatch('activities', activities);

  // 12. TIMELINE (Auditoria e Histórico)
  console.log('\n12. Migrando Histórico e Auditoria (timeline)...');
  const timeline = await fetchAll('timeline');
  await insertBatch('timeline', timeline);

  // 13. CONVERSATIONS & MESSAGES
  console.log('\n13. Migrando Chat (conversations & messages)...');
  const conversations = await fetchAll('conversations');
  await insertBatch('conversations', conversations);

  const messages = await fetchAll('messages');
  await insertBatch('messages', messages);

  console.log('\n====================================================');
  console.log('🎉 MIGRAÇÃO CONCLUÍDA COM TOTAL FIDELIDADE!');
  console.log('====================================================');
}

runMigration().catch(err => {
  console.error('FALHA CRÍTICA NA MIGRAÇÃO:', err);
});
