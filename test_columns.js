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
    const { data, error } = await supabase.from('tenants').select('*').limit(1);
    if (error) {
      console.log('Error fetching from tenants:', error.message);
    } else {
      console.log('Tenants keys:', data && data.length > 0 ? Object.keys(data[0]) : 'No rows');
    }
  } catch (err) {
    console.log('Catch error:', err);
  }
}

check();
