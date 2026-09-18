import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();

function getSupabaseAdmin() {
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
}

export * from './billing-types';
import { SaaSAdminConfig } from './billing-types';

const RESERVED_CONFIG_TENANT_ID = '99999999-9999-9999-9999-999999999999';
const CACHE_FILE_PATH = path.join(process.cwd(), 'blocked_tenants.json');

// Default initial config
const DEFAULT_CONFIG: SaaSAdminConfig = {
  blockedTenantIds: [],
  unlockedTenantIds: [],
  payments: {},
  dueDays: {},
  userLimits: {},
  suttleStart: 1,
  criticalStart: 5,
  blockStart: 7
};

// Safe filesystem read
function readConfigFromFile(): SaaSAdminConfig {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const txt = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const data = JSON.parse(txt);
      if (data && Array.isArray(data.blockedTenantIds)) {
        if (!Array.isArray(data.unlockedTenantIds)) {
          data.unlockedTenantIds = [];
        }
        return data as SaaSAdminConfig;
      }
      // Migrate from old simple array style if detected
      if (Array.isArray(data)) {
        return {
          blockedTenantIds: data,
          unlockedTenantIds: [],
          payments: {}
        };
      }
    }
  } catch (err) {
    console.error('[Billing UI] Error reading file config:', err);
  }
  return { ...DEFAULT_CONFIG };
}

// Safe filesystem write
function writeConfigToFile(config: SaaSAdminConfig) {
  try {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Billing UI] Error writing file config:', err);
  }
}

// Global cached in-memory config for instant responses
let cachedAdminConfig: SaaSAdminConfig | null = null;
let lastCacheTime = 0;

export async function getSaaSConfig(bypassCache = false): Promise<SaaSAdminConfig> {
  const now = Date.now();
  if (!bypassCache && cachedAdminConfig !== null && now - lastCacheTime < 1000) {
    return cachedAdminConfig;
  }

  let config: SaaSAdminConfig = { ...DEFAULT_CONFIG };
  try {
    const adminSupabase = getSupabaseAdmin();
    const { data, error } = await adminSupabase
      .from('tenants')
      .select('slug')
      .eq('id', RESERVED_CONFIG_TENANT_ID)
      .maybeSingle();

    if (!error && data && data.slug && data.slug.startsWith('saas_cfg:')) {
      const jsonStr = data.slug.replace('saas_cfg:', '');
      const parsed = JSON.parse(jsonStr);
      if (parsed && Array.isArray(parsed.blockedTenantIds)) {
        config = parsed as SaaSAdminConfig;
        writeConfigToFile(config);
      } else {
        config = readConfigFromFile();
      }
    } else {
      // fallback to file
      config = readConfigFromFile();
    }
  } catch (err) {
    console.error('[Billing System] Error getting SaaS config, using file fallback:', err);
    config = readConfigFromFile();
  }

  cachedAdminConfig = config;
  lastCacheTime = now;
  return config;
}

export async function saveSaaSConfig(config: SaaSAdminConfig): Promise<boolean> {
  cachedAdminConfig = config;
  lastCacheTime = Date.now();

  // 1. Write file
  writeConfigToFile(config);

  // 2. Write Database
  try {
    const adminSupabase = getSupabaseAdmin();
    const payloadString = `saas_cfg:${JSON.stringify(config)}`;

    const { error } = await adminSupabase
      .from('tenants')
      .upsert({
        id: RESERVED_CONFIG_TENANT_ID,
        name: 'System Config - Do Not Delete',
        slug: payloadString
      });

    if (error) {
      console.error('[Billing System] Failed to upsert SaaS config to DB:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Billing System] Exception during DB sync of SaaS Config:', err);
    return false;
  }
}

// Backward-compatible helpers
export async function getBlockedTenantIds(bypassCache = false): Promise<string[]> {
  const config = await getSaaSConfig(bypassCache);
  return config.blockedTenantIds || [];
}

export async function setTenantBlocked(tenantId: string, blocked: boolean): Promise<boolean> {
  const config = await getSaaSConfig();
  if (!config.blockedTenantIds) config.blockedTenantIds = [];
  if (!config.unlockedTenantIds) config.unlockedTenantIds = [];

  const bIndex = config.blockedTenantIds.indexOf(tenantId);
  const uIndex = config.unlockedTenantIds.indexOf(tenantId);

  if (blocked) {
    if (bIndex === -1) {
      config.blockedTenantIds.push(tenantId);
    }
    if (uIndex !== -1) {
      config.unlockedTenantIds.splice(uIndex, 1);
    }
  } else {
    if (bIndex !== -1) {
      config.blockedTenantIds.splice(bIndex, 1);
    }
  }

  return saveSaaSConfig(config);
}

export async function setTenantUnlocked(tenantId: string, unlocked: boolean): Promise<boolean> {
  const config = await getSaaSConfig();
  if (!config.blockedTenantIds) config.blockedTenantIds = [];
  if (!config.unlockedTenantIds) config.unlockedTenantIds = [];

  const bIndex = config.blockedTenantIds.indexOf(tenantId);
  const uIndex = config.unlockedTenantIds.indexOf(tenantId);

  if (unlocked) {
    if (uIndex === -1) {
      config.unlockedTenantIds.push(tenantId);
    }
    if (bIndex !== -1) {
      config.blockedTenantIds.splice(bIndex, 1);
    }
  } else {
    if (uIndex !== -1) {
      config.unlockedTenantIds.splice(uIndex, 1);
    }
  }

  return saveSaaSConfig(config);
}

// Ledger operations
export async function updateTenantPayment(tenantId: string, month: string, status: 'pago' | 'pendente' | 'atrasado'): Promise<boolean> {
  const config = await getSaaSConfig();
  if (!config.payments[tenantId]) {
    config.payments[tenantId] = {};
  }
  config.payments[tenantId][month] = status;
  return saveSaaSConfig(config);
}

// User limit operations
export async function setTenantUserLimit(tenantId: string, limit: number): Promise<boolean> {
  const config = await getSaaSConfig();
  if (!config.userLimits) {
    config.userLimits = {};
  }
  config.userLimits[tenantId] = Math.max(1, limit);
  return saveSaaSConfig(config);
}

export async function getTenantUserLimit(tenantId: string): Promise<number> {
  const config = await getSaaSConfig();
  return config.userLimits?.[tenantId] ?? 5;
}

