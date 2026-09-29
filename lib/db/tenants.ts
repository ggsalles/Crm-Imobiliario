import { Tenant } from './types';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME } from '../constants';
import { apiFetch, forceDataResync } from './core';

let cachedTenants: Tenant[] | null = null;
let cachedTenantsTime = 0;
const TENANTS_CACHE_TTL = 30000;

export function invalidateTenantsCache() {
  cachedTenants = null;
  cachedTenantsTime = 0;
}

export async function getTenants(forceRefresh = false): Promise<Tenant[]> {
  const now = Date.now();
  if (!forceRefresh && cachedTenants && (now - cachedTenantsTime < TENANTS_CACHE_TTL)) {
    return cachedTenants;
  }
  try {
    const data = await apiFetch('/api/tenants');
    const tenantsList = (data || []) as Tenant[];
    const result = tenantsList.map((t: any) => {
      if (t && t.id === DEFAULT_TENANT_ID) {
        return { ...t, name: DEFAULT_TENANT_NAME };
      }
      return t;
    });
    cachedTenants = result;
    cachedTenantsTime = now;
    return result;
  } catch (err) {
    console.error("[lib/db/tenants] getTenants FATAL:", err);
    return cachedTenants || [];
  }
}

export async function createTenant(data: { name: string; slug?: string }): Promise<Tenant> {
  try {
    const result = await apiFetch('/api/tenants', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    invalidateTenantsCache();
    forceDataResync();
    return result as Tenant;
  } catch (err) {
    console.error("[lib/db/tenants] createTenant FATAL:", err);
    throw err;
  }
}

export async function updateTenant(id: string, data: Partial<Tenant>): Promise<boolean> {
  try {
    await apiFetch(`/api/tenants?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    invalidateTenantsCache();
    forceDataResync();
    return true;
  } catch (err) {
    console.error("[lib/db/tenants] updateTenant FATAL:", err);
    throw err;
  }
}

export async function deleteTenant(id: string): Promise<boolean> {
  try {
    await apiFetch(`/api/tenants?id=${id}`, {
      method: 'DELETE'
    });
    invalidateTenantsCache();
    forceDataResync();
    return true;
  } catch (err) {
    console.error("[lib/db/tenants] deleteTenant FATAL:", err);
    throw err;
  }
}
