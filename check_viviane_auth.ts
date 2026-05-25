import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "").trim();

async function run() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  const email = "viviane.b.correa@gmail.com";

  try {
    // Look at auth.users
    const { data: users, error: e1 } = await supabase.auth.admin.listUsers();
    if (e1) {
      console.error("List users error:", e1);
    } else {
      const targetUser = users.users.find((u: any) => u.email?.toLowerCase() === email);
      console.log("Auth User in Auth database:", JSON.stringify(targetUser, null, 2));

      // Check current profile again
      const { data: profile1, error: e2 } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      console.log("Database profiles for this email:", JSON.stringify(profile1, null, 2));
    }
  } catch (err) {
    console.error("Fatal:", err);
  }
}

run();
