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

const RESERVED_CONFIG_TENANT_ID = '99999999-9999-9999-9999-999999999999';
const CACHE_FILE_PATH = path.join(process.cwd(), 'blocked_tenants.json');

export interface PaymentLedger {
  [tenantId: string]: {
    [month: string]: 'pago' | 'pendente' | 'atrasado';
  };
}

export interface SaaSAdminConfig {
  blockedTenantIds: string[];
  payments: PaymentLedger;
  dueDays?: { [tenantId: string]: number };
  suttleStart?: number;
  criticalStart?: number;
  blockStart?: number;
}

// Default initial config
const DEFAULT_CONFIG: SaaSAdminConfig = {
  blockedTenantIds: [],
  payments: {},
  dueDays: {},
  suttleStart: 1,
  criticalStart: 5,
  blockStart: 7
};

export interface BillingStatusResult {
  status: 'regular' | 'aviso_sutil' | 'aviso_critico' | 'bloqueado';
  diffDays: number;
  dueDay: number;
  currentMonthKey: string;
  dueDate: Date;
  suspendedUntilStr: string;
}

export function getTenantBillingStatus(
  config: SaaSAdminConfig,
  tenantId: string,
  currentDate = new Date()
): BillingStatusResult {
  const years = currentDate.getFullYear();
  const months = currentDate.getMonth() + 1;
  const currentMonthKey = `${years}-${String(months).padStart(2, '0')}`;

  const suttleStart = config.suttleStart !== undefined ? config.suttleStart : 1;
  const criticalStart = config.criticalStart !== undefined ? config.criticalStart : 5;
  const blockStart = config.blockStart !== undefined ? config.blockStart : 7;

  // 1. Prioritize manual blocked check (immediate)
  if (config.blockedTenantIds && config.blockedTenantIds.includes(tenantId)) {
    return {
      status: 'bloqueado',
      diffDays: 99,
      dueDay: 10,
      currentMonthKey,
      dueDate: new Date(),
      suspendedUntilStr: 'Imediatamente'
    };
  }

  const record = config.payments?.[tenantId] || {};
  const status = record[currentMonthKey] || 'pendente';
  const dueDay = config.dueDays?.[tenantId] ?? 10;

  if (status === 'pago') {
    return {
      status: 'regular',
      diffDays: 0,
      dueDay,
      currentMonthKey,
      dueDate: new Date(years, months - 1, dueDay),
      suspendedUntilStr: ''
    };
  }

  // 2. Automated rules relative to due date of current month
  const todayMidnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const dueMidnight = new Date(years, months - 1, dueDay);

  const diffTime = todayMidnight.getTime() - dueMidnight.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // Base suspension date is D+blockStart
  const suspenseDate = new Date(years, months - 1, dueDay + blockStart, 0, 0, 0);
  const suspendedUntilStr = suspenseDate.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Format nice Date-Time string
  const formattedSuspendedStr = suspenseDate.toLocaleDateString('pt-BR') + ' às ' + 
    String(suspenseDate.getHours()).padStart(2, '0') + ':' + 
    String(suspenseDate.getMinutes()).padStart(2, '0');

  if (diffDays < suttleStart) {
    // Vencimento (Dia D): Active, tolerance period starts
    return {
      status: 'regular',
      diffDays,
      dueDay,
      currentMonthKey,
      dueDate: dueMidnight,
      suspendedUntilStr: formattedSuspendedStr
    };
  }

  if (diffDays >= suttleStart && diffDays < criticalStart) {
    // Aviso Sutil (D+suttleStart até D+criticalStart): show customer dynamic banner
    return {
      status: 'aviso_sutil',
      diffDays,
      dueDay,
      currentMonthKey,
      dueDate: dueMidnight,
      suspendedUntilStr: formattedSuspendedStr
    };
  }

  if (diffDays >= criticalStart && diffDays < blockStart) {
    // Aviso Crítico (D+criticalStart até D+blockStart)
    return {
      status: 'aviso_critico',
      diffDays,
      dueDay,
      currentMonthKey,
      dueDate: dueMidnight,
      suspendedUntilStr: formattedSuspendedStr
    };
  }

  // Bloqueio Total (D+blockStart)
  return {
    status: 'bloqueado',
    diffDays,
    dueDay,
    currentMonthKey,
    dueDate: dueMidnight,
    suspendedUntilStr: formattedSuspendedStr
  };
}

// Safe filesystem read
function readConfigFromFile(): SaaSAdminConfig {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const txt = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const data = JSON.parse(txt);
      if (data && Array.isArray(data.blockedTenantIds)) {
        return data as SaaSAdminConfig;
      }
      // Migrate from old simple array style if detected
      if (Array.isArray(data)) {
        return {
          blockedTenantIds: data,
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
  const index = config.blockedTenantIds.indexOf(tenantId);

  if (blocked && index === -1) {
    config.blockedTenantIds.push(tenantId);
  } else if (!blocked && index !== -1) {
    config.blockedTenantIds.splice(index, 1);
  } else {
    return true;
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
