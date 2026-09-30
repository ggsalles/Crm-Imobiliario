import { supabase } from '../supabase';
import { Company } from './types';
import { 
  apiFetch, 
  dataCache, 
  createRealtimeChannel, 
  createVisibilityAwarePoll, 
  forceDataResync, 
  invalidateApiCache, 
  getSafeSession,
  POLL_INTERVAL 
} from './core';

export async function getCompanies(ownerId?: string, tenantId?: string): Promise<Company[]> {
  try {
    let url = `/api/companies`;
    const params = new URLSearchParams();
    if (ownerId) params.append('ownerId', ownerId);
    if (tenantId) params.append('tenantId', tenantId);
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const data = await apiFetch(url);
    return data as Company[];
  } catch (err) {
    console.error("[lib/db/companies] getCompanies FATAL:", err);
    return [];
  }
}

export async function getCompany(id: string): Promise<Company | null> {
  try {
    const data = await apiFetch(`/api/companies?id=${id}`);
    if (Array.isArray(data)) return data[0] as Company;
    return data as Company;
  } catch (err) {
    console.error("[lib/db/companies] getCompany FATAL:", err);
    return null;
  }
}

export function subscribeToCompanies(callback: (companies: Company[]) => void, ownerId?: string, tenantId?: string) {
  const cacheKey = `companies:${tenantId || 'all'}:${ownerId || 'all'}`;
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) {
    callback(dataCache[cacheKey]);
  }

  const fetchCompanies = async () => {
    try {
      const data = await getCompanies(ownerId, tenantId);
      if (data && Array.isArray(data)) {
        dataCache[cacheKey] = data;
        callback(data);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (err) {
      console.warn("[lib/db/companies] subscribeToCompanies error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchCompanies();
  const subscription = createRealtimeChannel('companies', fetchCompanies);
  const poll = createVisibilityAwarePoll(fetchCompanies, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createCompany(data: any) {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const companyData: any = {
    name: data.name,
    industry: data.industry,
    website: data.website,
    owner_id: user.id
  };
  if (data.tenantId || data.tenant_id) {
    companyData.tenant_id = data.tenantId || data.tenant_id;
  }

  try {
    const result = await apiFetch('/api/companies', {
      method: "POST",
      body: JSON.stringify(companyData)
    });
    return result.id;
  } catch (err) {
    console.error("[lib/db/companies] createCompany FATAL:", err);
    throw err;
  }
}

export async function updateCompany(id: string, data: any) {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.industry !== undefined) updateData.industry = data.industry;
  if (data.website !== undefined) updateData.website = data.website;

  try {
    await apiFetch(`/api/companies?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
  } catch (err) {
    console.error("[lib/db/companies] updateCompany FATAL:", err);
    throw err;
  }
}

export async function deleteCompany(id: string) {
  try {
    await apiFetch(`/api/companies?id=${id}`, {
      method: "DELETE"
    });
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('companies:')) {
        if (Array.isArray(dataCache[k])) {
          dataCache[k] = dataCache[k].filter((c: any) => c.id !== id);
        }
      }
    }
    invalidateApiCache('/api/companies');
    forceDataResync();
    return true;
  } catch (err) {
    console.error("[lib/db/companies] deleteCompany FATAL:", err);
    throw err;
  }
}
