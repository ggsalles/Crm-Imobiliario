import { supabase } from '../supabase';
import { Deal } from './types';
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

export function getCachedDeals(ownerId?: string): Deal[] | null {
  const specificKey = `deals:${ownerId || 'all'}`;
  if (dataCache[specificKey] && Array.isArray(dataCache[specificKey]) && dataCache[specificKey].length > 0) {
    return dataCache[specificKey];
  }
  const restored = safeRestoreSnapshot(specificKey) || safeRestoreSnapshot('deals:all');
  if (restored) {
    dataCache[specificKey] = restored;
    return restored;
  }
  const allKey = 'deals:all';
  if (dataCache[allKey] && Array.isArray(dataCache[allKey]) && dataCache[allKey].length > 0) {
    return dataCache[allKey];
  }
  for (const k of Object.keys(dataCache)) {
    if (k.startsWith('deals:') && Array.isArray(dataCache[k]) && dataCache[k].length > 0) {
      return dataCache[k];
    }
  }
  return null;
}

export async function getDeals(ownerId?: string): Promise<Deal[]> {
  const startTime = Date.now();
  const cacheKey = `deals:${ownerId || 'all'}`;
  console.log("[lib/db/deals] getDeals: Buscando negócios via API Proxy...");

  try {
    let url = `/api/deals`;
    if (ownerId) url += `?ownerId=${ownerId}`;
    
    const data = await apiFetch(url);
    if (Array.isArray(data)) {
      dataCache[cacheKey] = data;
      safePersistSnapshot(cacheKey, data);
    }
    console.log(`[lib/db/deals] getDeals concluído em ${Date.now() - startTime}ms`);
    return (data || []) as Deal[];
  } catch (err: any) {
    console.warn("[lib/db/deals] getDeals aviso ao buscar negócios:", err?.message || err);
    if (dataCache[cacheKey] && Array.isArray(dataCache[cacheKey]) && dataCache[cacheKey].length > 0) {
      console.log("[lib/db/deals] getDeals: Retornando dados em cache.");
      return dataCache[cacheKey] as Deal[];
    }
    return [];
  }
}

export async function getDealsByContact(contactId: string): Promise<Deal[]> {
  try {
    const data = await apiFetch(`/api/deals?contactId=${contactId}`);
    return (data || []) as Deal[];
  } catch (err) {
    console.error("[lib/db/deals] getDealsByContact FATAL:", err);
    return [];
  }
}

export async function getDeal(id: string): Promise<Deal | null> {
  if (!id) return null;
  try {
    const data = await apiFetch(`/api/deals?id=${encodeURIComponent(id)}`);
    return data || null;
  } catch (err) {
    console.error("[lib/db/deals] getDeal error:", err);
    return null;
  }
}

export function subscribeToDeals(callback: (deals: Deal[]) => void, ownerId?: string) {
  const cacheKey = `deals:${ownerId || 'all'}`;
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) callback(dataCache[cacheKey]);

  const fetchDeals = async () => {
    try {
      const data = await getDeals(ownerId);
      if (data && Array.isArray(data)) {
        dataCache[cacheKey] = data;
        safePersistSnapshot(cacheKey, data);
        callback(data);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (err) {
      console.warn("[lib/db/deals] subscribeToDeals error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchDeals();
  const subscription = createRealtimeChannel('deals', fetchDeals);
  const poll = createVisibilityAwarePoll(fetchDeals, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createDeal(data: any) {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const sanitizeId = (val: any) => (val && val !== 'undefined' && val !== 'null') ? val : null;

  const dealData = {
    title: data.title,
    value: Number(data.value) || 0,
    stage: data.stage || 'lead',
    company_id: sanitizeId(data.companyId),
    contact_id: sanitizeId(data.contactId),
    property_id: sanitizeId(data.propertyId),
    owner_id: sanitizeId(data.ownerId) || user.id
  };

  try {
    const result = await apiFetch('/api/deals', {
      method: "POST",
      body: JSON.stringify(dealData)
    });
    return result.id;
  } catch (err) {
    console.error("[lib/db/deals] createDeal FATAL:", err);
    throw err;
  }
}

export async function updateDeal(id: string, data: any) {
  if (!id || id === 'undefined' || id === 'null') {
    console.warn("[lib/db/deals] updateDeal: Invalid ID, ignoring update request.", id);
    return;
  }

  const updateData: any = { updated_at: new Date().toISOString() };
  const sanitizeId = (val: any) => (val && val !== 'undefined' && val !== 'null') ? val : null;

  if (data.title !== undefined) updateData.title = data.title;
  if (data.value !== undefined) updateData.value = Number(data.value) || 0;
  if (data.stage !== undefined) updateData.stage = data.stage;
  if (data.companyId !== undefined) updateData.company_id = sanitizeId(data.companyId);
  if (data.contactId !== undefined) updateData.contact_id = sanitizeId(data.contactId);
  if (data.propertyId !== undefined) updateData.property_id = sanitizeId(data.propertyId);
  if (data.ownerId !== undefined) updateData.owner_id = sanitizeId(data.ownerId);

  try {
    await apiFetch(`/api/deals?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
  } catch (err) {
    console.error("[lib/db/deals] updateDeal FATAL:", err);
    throw err;
  }
}

export async function deleteDeal(id: string) {
  if (!id || id === 'undefined' || id === 'null') {
    console.warn("[lib/db/deals] deleteDeal: Invalid ID, ignoring delete request.", id);
    return false;
  }
  try {
    await apiFetch(`/api/deals?id=${id}`, {
      method: "DELETE"
    });
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('deals:')) {
        if (Array.isArray(dataCache[k])) {
          dataCache[k] = dataCache[k].filter((d: any) => d.id !== id);
        }
      }
    }
    invalidateApiCache('/api/deals');
    forceDataResync();
    return true;
  } catch (err) {
    console.error("[lib/db/deals] deleteDeal FATAL:", err);
    throw err;
  }
}
