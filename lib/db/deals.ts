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

export async function createDeal(data: any): Promise<{ id: string; deal: Deal }> {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const sanitizeId = (val: any) => (val && val !== 'undefined' && val !== 'null') ? val : null;

  const dealData: any = {
    title: data.title,
    value: Number(data.value) || 0,
    stage: data.stage || 'lead',
    company_id: sanitizeId(data.companyId || data.company_id),
    contact_id: sanitizeId(data.contactId || data.contact_id),
    property_id: sanitizeId(data.propertyId || data.property_id),
    owner_id: sanitizeId(data.ownerId || data.owner_id) || user.id
  };

  if (data.priority !== undefined) dealData.priority = data.priority;
  if (data.status !== undefined) dealData.status = data.status;
  if (data.probability !== undefined && data.probability !== null) dealData.probability = Number(data.probability);
  if (data.expectedCloseDate !== undefined || data.expected_close_date !== undefined) {
    dealData.expected_close_date = data.expectedCloseDate || data.expected_close_date;
  }

  try {
    const result = await apiFetch('/api/deals', {
      method: "POST",
      body: JSON.stringify(dealData)
    });

    const createdId = result?.id || result?.deal?.id;
    const officialDeal: Deal = result?.deal || {
      id: createdId,
      title: dealData.title,
      value: dealData.value,
      stage: dealData.stage,
      companyId: dealData.company_id,
      contactId: dealData.contact_id,
      propertyId: dealData.property_id,
      ownerId: dealData.owner_id,
      priority: dealData.priority,
      status: dealData.status,
      probability: dealData.probability,
      expectedCloseDate: dealData.expected_close_date,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Sincroniza imediatamente o cache de memória local e snapshot persistente
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('deals:')) {
        if (Array.isArray(dataCache[k])) {
          const existingIdx = dataCache[k].findIndex((d: any) => d.id === createdId);
          if (existingIdx >= 0) {
            dataCache[k][existingIdx] = officialDeal;
          } else {
            dataCache[k] = [officialDeal, ...dataCache[k]];
          }
          safePersistSnapshot(k, dataCache[k]);
        }
      }
    }

    invalidateApiCache('/api/deals');
    forceDataResync();

    return { id: createdId, deal: officialDeal };
  } catch (err) {
    console.error("[lib/db/deals] createDeal FATAL:", err);
    throw err;
  }
}

export async function updateDeal(id: string, data: any): Promise<Deal> {
  if (!id || id === 'undefined' || id === 'null') {
    console.warn("[lib/db/deals] updateDeal: Invalid ID, ignoring update request.", id);
    throw new Error("ID de negócio inválido");
  }

  const updateData: any = { updated_at: new Date().toISOString() };
  const sanitizeId = (val: any) => (val && val !== 'undefined' && val !== 'null') ? val : null;

  if (data.title !== undefined) updateData.title = data.title;
  if (data.value !== undefined) updateData.value = Number(data.value) || 0;
  if (data.stage !== undefined) updateData.stage = data.stage;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.probability !== undefined && data.probability !== null) updateData.probability = Number(data.probability);
  if (data.expectedCloseDate !== undefined || data.expected_close_date !== undefined) {
    updateData.expected_close_date = data.expectedCloseDate || data.expected_close_date;
  }
  if (data.companyId !== undefined || data.company_id !== undefined) {
    updateData.company_id = sanitizeId(data.companyId || data.company_id);
  }
  if (data.contactId !== undefined || data.contact_id !== undefined) {
    updateData.contact_id = sanitizeId(data.contactId || data.contact_id);
  }
  if (data.propertyId !== undefined || data.property_id !== undefined) {
    updateData.property_id = sanitizeId(data.propertyId || data.property_id);
  }
  if (data.ownerId !== undefined || data.owner_id !== undefined) {
    updateData.owner_id = sanitizeId(data.ownerId || data.owner_id);
  }

  try {
    const result = await apiFetch(`/api/deals?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });

    const officialDeal: Deal = result?.deal || {
      id,
      title: updateData.title || data.title,
      value: updateData.value !== undefined ? updateData.value : data.value,
      stage: updateData.stage || data.stage,
      ...data,
      updatedAt: updateData.updated_at
    };

    // Atualização imediata no cache de memória local e snapshot persistente
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('deals:') && Array.isArray(dataCache[k])) {
        dataCache[k] = dataCache[k].map((d: any) => {
          if (d.id === id) {
            return { ...d, ...officialDeal };
          }
          return d;
        });
        safePersistSnapshot(k, dataCache[k]);
      }
    }

    invalidateApiCache('/api/deals');
    forceDataResync();
    return officialDeal;
  } catch (err) {
    console.error("[lib/db/deals] updateDeal FATAL:", err);
    throw err;
  }
}

export async function deleteDeal(id: string): Promise<boolean> {
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
          safePersistSnapshot(k, dataCache[k]);
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
