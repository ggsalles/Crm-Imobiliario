import { supabase } from '../supabase';
import { Company } from './types';
import { 
  apiFetch, 
  dataCache, 
  safePersistSnapshot,
  safeRestoreSnapshot,
  createRealtimeChannel, 
  createVisibilityAwarePoll, 
  forceDataResync, 
  invalidateApiCache, 
  getSafeSession,
  POLL_INTERVAL 
} from './core';

export function getCachedCompanies(ownerId?: string, tenantId?: string): Company[] | null {
  const specificKey = `companies:${tenantId || 'all'}:${ownerId || 'all'}`;
  if (dataCache[specificKey] && Array.isArray(dataCache[specificKey]) && dataCache[specificKey].length > 0) {
    return dataCache[specificKey];
  }
  const restored = safeRestoreSnapshot(specificKey) || safeRestoreSnapshot('companies:all:all');
  if (restored) {
    dataCache[specificKey] = restored;
    return restored;
  }
  for (const k of Object.keys(dataCache)) {
    if (k.startsWith('companies:') && Array.isArray(dataCache[k]) && dataCache[k].length > 0) {
      return dataCache[k];
    }
  }
  return null;
}

export async function getCompanies(ownerId?: string, tenantId?: string): Promise<Company[]> {
  try {
    let url = `/api/companies`;
    const params = new URLSearchParams();
    if (ownerId) params.append('ownerId', ownerId);
    if (tenantId) params.append('tenantId', tenantId);
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const data = await apiFetch(url);
    return (data || []) as Company[];
  } catch (err) {
    console.error("[lib/db/companies] getCompanies FATAL:", err);
    return getCachedCompanies(ownerId, tenantId) || [];
  }
}

export async function getCompany(id: string): Promise<Company | null> {
  if (!id) return null;

  // Verificação 1: Cache em memória ativa do navegador (0 egress)
  for (const k of Object.keys(dataCache)) {
    if (k.startsWith('companies:')) {
      if (Array.isArray(dataCache[k])) {
        const found = dataCache[k].find((c: any) => c.id === id);
        if (found) return found;
      }
    }
  }

  // Verificação 2: Snapshot persistente local (0 egress)
  const restored = safeRestoreSnapshot('companies:all:all');
  if (Array.isArray(restored)) {
    const found = restored.find((c: any) => c.id === id);
    if (found) return found;
  }

  // Verificação 3: API Server Cache
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
  const initial = getCachedCompanies(ownerId, tenantId);
  if (initial && initial.length > 0) {
    callback(initial);
  }

  const fetchCompanies = async () => {
    try {
      const data = await getCompanies(ownerId, tenantId);
      if (data && Array.isArray(data)) {
        dataCache[cacheKey] = data;
        safePersistSnapshot(cacheKey, data);
        callback(data);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (err) {
      console.warn("[lib/db/companies] subscribeToCompanies error:", err);
      const fallback = getCachedCompanies(ownerId, tenantId);
      if (fallback) {
        callback(fallback);
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

export async function createCompany(data: any): Promise<{ id: string; company: Company }> {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const companyData: any = {
    name: (data.name || '').trim(),
    industry: data.industry ? data.industry.trim() : undefined,
    website: data.website ? data.website.trim() : undefined,
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

    const createdId = result?.id || result?.company?.id;
    const officialCompany: Company = result?.company || {
      id: createdId,
      name: companyData.name,
      industry: companyData.industry,
      website: companyData.website,
      ownerId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Sincronização imediata no cache de memória local e snapshot persistente
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('companies:')) {
        if (Array.isArray(dataCache[k])) {
          const existingIdx = dataCache[k].findIndex((c: any) => c.id === createdId);
          if (existingIdx >= 0) {
            dataCache[k][existingIdx] = officialCompany;
          } else {
            dataCache[k] = [officialCompany, ...dataCache[k]];
          }
          safePersistSnapshot(k, dataCache[k]);
        }
      }
    }

    invalidateApiCache('/api/companies');
    forceDataResync();
    return { id: createdId, company: officialCompany };
  } catch (err) {
    console.error("[lib/db/companies] createCompany FATAL:", err);
    throw err;
  }
}

export async function updateCompany(id: string, data: any): Promise<Company> {
  if (!id) throw new Error("ID de empresa inválido");

  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = (data.name || '').trim();
  if (data.industry !== undefined) updateData.industry = data.industry ? data.industry.trim() : undefined;
  if (data.website !== undefined) updateData.website = data.website ? data.website.trim() : undefined;

  try {
    const result = await apiFetch(`/api/companies?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });

    const officialCompany: Company = result?.company || {
      id,
      ...data,
      updatedAt: updateData.updated_at
    };

    // Atualização imediata no cache de memória local e snapshot persistente
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('companies:')) {
        if (Array.isArray(dataCache[k])) {
          dataCache[k] = dataCache[k].map((c: any) => {
            if (c.id === id) {
              return { ...c, ...officialCompany };
            }
            return c;
          });
          safePersistSnapshot(k, dataCache[k]);
        }
      }
    }

    invalidateApiCache('/api/companies');
    forceDataResync();
    return officialCompany;
  } catch (err) {
    console.error("[lib/db/companies] updateCompany FATAL:", err);
    throw err;
  }
}

export async function deleteCompany(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    await apiFetch(`/api/companies?id=${id}`, {
      method: "DELETE"
    });
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('companies:')) {
        if (Array.isArray(dataCache[k])) {
          dataCache[k] = dataCache[k].filter((c: any) => c.id !== id);
          safePersistSnapshot(k, dataCache[k]);
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
