import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "").trim();

async function run() {
  let log = "";
  log += "SIMUTATING DIRECT DATABASE UPDATE FOR TENTANT CHANGE\n\n";

  if (!supabaseUrl) {
    fs.writeFileSync('./RECOVERY_TEST_REAL.txt', "Supabase URL is empty.");
    return;
  }

  try {
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { persistSession: false }
    });

    // 1. Get ggsalles profile initially
    const { data: initialProfiles } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('email', 'ggsalles@gmail.com');
      
    if (!initialProfiles || initialProfiles.length === 0) {
      log += "User profile not found.\n";
      fs.writeFileSync('./RECOVERY_TEST_REAL.txt', log);
      return;
    }
    const profile = initialProfiles[0];
    log += `Initial profile tenant_id: ${profile.tenant_id}\n`;

    // 2. Perform tenant_id update on profiles
    const targetTenantId = "c177f8cd-71b6-4bdc-a26d-4d26af076b4f"; // Nando Imobiliária
    log += `Attempting to update profiles tenant_id to ${targetTenantId}...\n`;
    const { data: updatedProfile, error: updateError } = await adminSupabase
      .from('profiles')
      .update({ tenant_id: targetTenantId })
      .eq('id', profile.id)
      .select();

    if (updateError) {
      log += `UPDATE FAILED with error: ${updateError.code} - ${updateError.message}\n`;
      if (updateError.details) log += `Details: ${updateError.details}\n`;
      if (updateError.hint) log += `Hint: ${updateError.hint}\n`;
    } else {
      log += `UPDATE SUCCESS. Returned count: ${updatedProfile?.length || 0}\n`;
      if (updatedProfile && updatedProfile.length > 0) {
        log += `Returned tenant_id in update response: ${updatedProfile[0].tenant_id}\n`;
      }
    }

    // 3. Query the DB again to verify actual state
    const { data: postProfiles } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', profile.id);
      
    if (postProfiles && postProfiles.length > 0) {
      log += `Post-update query tenant_id: ${postProfiles[0].tenant_id}\n`;
    }

    // 4. Reset to SalesScore so we don't break developer state
    log += "\nResetting profiles tenant_id back to default SalesScore...\n";
    const { error: resetError } = await adminSupabase
      .from('profiles')
      .update({ tenant_id: "11111111-1111-1111-1111-111111111111" })
      .eq('id', profile.id);
    if (resetError) {
      log += `Reset failed: ${resetError.message}\n`;
    } else {
      log += "Reset success!\n";
    }

  } catch (err: any) {
    log += `Fatal: ${err.message || err}\n`;
  }

  fs.writeFileSync('./RECOVERY_TEST_REAL.txt', log);
}

run();
