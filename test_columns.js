const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from('contacts').insert([
      {
        name: 'Test Contact Temp',
        type: 'cliente',
        owner_id: '11111111-1111-1111-1111-111111111111', // Dummy profile or similar
        temperature: 'quente'
      }
    ]).select();
    if (error) {
      console.log('Error inserting with temperature:', error.message);
    } else {
      console.log('Success!', data);
    }
  } catch (err) {
    console.log('Catch error:', err);
  }
}

check();
