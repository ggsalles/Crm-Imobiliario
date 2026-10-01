import { supabase } from '../supabase';
import { Property } from './types';
import { 
  apiFetch, 
  dataCache, 
  safePersistSnapshot, 
  safeRestoreSnapshot, 
  createRealtimeChannel, 
  createVisibilityAwarePoll, 
  forceDataResync, 
  invalidateApiCache, 
  POLL_INTERVAL 
} from './core';

export function getCachedProperties(ownerId?: string): Property[] | null {
  const specificKey = `properties:${ownerId || 'all'}`;
  if (dataCache[specificKey] && Array.isArray(dataCache[specificKey]) && dataCache[specificKey].length > 0) {
    return dataCache[specificKey];
  }
  const restored = safeRestoreSnapshot(specificKey) || safeRestoreSnapshot('properties:all');
  if (restored) {
    dataCache[specificKey] = restored;
    return restored;
  }
  const allKey = 'properties:all';
  if (dataCache[allKey] && Array.isArray(dataCache[allKey]) && dataCache[allKey].length > 0) {
    return dataCache[allKey];
  }
  for (const k of Object.keys(dataCache)) {
    if (k.startsWith('properties:') && Array.isArray(dataCache[k]) && dataCache[k].length > 0) {
      return dataCache[k];
    }
  }
  return null;
}

export async function getProperties(ownerId?: string, limit?: number): Promise<Property[]> {
  const startTime = Date.now();
  const cacheKey = `properties:${ownerId || 'all'}`;
  console.log("[lib/db/properties] getProperties: Buscando imóveis via API Proxy...");
  
  try {
    let url = `/api/properties?limit=${limit || 10000}`;
    if (ownerId) url += `&ownerId=${ownerId}`;
    
    const data = await apiFetch(url);
    if (Array.isArray(data)) {
      dataCache[cacheKey] = data;
      safePersistSnapshot(cacheKey, data);
    }
    console.log(`[lib/db/properties] getProperties concluído em ${Date.now() - startTime}ms (${data?.length || 0} imóveis carregados)`);
    return (data || []) as Property[];
  } catch (err: any) {
    console.warn("[lib/db/properties] getProperties aviso ao buscar imóveis:", err?.message || err);
    if (dataCache[cacheKey] && Array.isArray(dataCache[cacheKey]) && dataCache[cacheKey].length > 0) {
      console.log("[lib/db/properties] getProperties: Retornando dados em cache.");
      return dataCache[cacheKey] as Property[];
    }
    return [];
  }
}

export async function getProperty(id: string): Promise<Property | null> {
  if (!id) return null;
  try {
    const data = await apiFetch(`/api/properties?id=${encodeURIComponent(id)}`);
    return data || null;
  } catch (err) {
    console.error("[lib/db/properties] getProperty error:", err);
    return null;
  }
}

export function clearPropertiesCache() {
  invalidateApiCache('/api/properties');
  for (const k of Object.keys(dataCache)) {
    if (k.startsWith('properties:') || k.startsWith('showcase:')) {
      delete dataCache[k];
    }
  }
  if (typeof window !== 'undefined') {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('properties') || key.includes('showcase'))) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {}
    forceDataResync();
  }
}

export function subscribeToShowcaseProperties(
  callback: (properties: Property[]) => void,
  tenantId?: string,
  ownerId?: string
) {
  const cacheKey = `showcase:${tenantId || 'all'}:${ownerId || 'all'}`;
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) {
    callback(dataCache[cacheKey]);
  }

  const fetchShowcase = async () => {
    try {
      let url = `/api/properties?public=true&limit=500&_t=${Date.now()}`;
      if (tenantId) url += `&tenantId=${encodeURIComponent(tenantId)}`;
      if (ownerId) url += `&ownerId=${encodeURIComponent(ownerId)}`;

      const data = await apiFetch(url, { bypassCache: true, noCache: true });
      if (Array.isArray(data)) {
        dataCache[cacheKey] = data as Property[];
        callback(data as Property[]);
      }
    } catch (err) {
      console.warn("[lib/db/properties] subscribeToShowcaseProperties error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      }
    }
  };

  fetchShowcase();
  const subscription = createRealtimeChannel('properties', fetchShowcase);
  const poll = createVisibilityAwarePoll(fetchShowcase, 15000);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export function subscribeToProperties(callback: (properties: Property[]) => void, ownerId?: string) {
  const cacheKey = `properties:${ownerId || 'all'}`;
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) callback(dataCache[cacheKey]);

  const fetchProperties = async () => {
    try {
      const data = await getProperties(ownerId, 10000);
      if (data && Array.isArray(data)) {
        dataCache[cacheKey] = data;
        safePersistSnapshot(cacheKey, data);
        callback(data);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (e) {
      console.warn("[lib/db/properties] subscribeToProperties error:", e);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchProperties();
  const subscription = createRealtimeChannel('properties', fetchProperties);
  const poll = createVisibilityAwarePoll(fetchProperties, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export function sanitizePropertyData(data: any, userId: string) {
  const sanitized = {
    title: String(data.title || "").substring(0, 500),
    type: String(data.type || "apartamento"),
    status: String(data.status || "disponível"),
    price: Number(data.price || 0),
    location: String(data.location || "").substring(0, 1000),
    cep: String(data.cep || "").substring(0, 20),
    street: String(data.street || "").substring(0, 500),
    neighborhood: String(data.neighborhood || "").substring(0, 500),
    city: String(data.city || "").substring(0, 500),
    state: String(data.state || "").substring(0, 10),
    number: String(data.number || "").substring(0, 50),
    complement: data.complement ? String(data.complement).substring(0, 1000) : null,
    area: Number(data.area || 0),
    bedrooms: Number(data.bedrooms || 0),
    suites: Number(data.suites || 0),
    bathrooms: Number(data.bathrooms || 0),
    parking_spots: Number(data.parkingSpots || data.parking_spots || 0),
    accepts_financing: Boolean(data.acceptsFinancing),
    iptu: data.iptu !== undefined && data.iptu !== null ? Number(data.iptu) : null,
    condo_fee: data.condoFee !== undefined && data.condoFee !== null ? Number(data.condoFee) : null,
    building_name: data.buildingName ? String(data.buildingName).substring(0, 500) : null,
    notes: data.notes ? String(data.notes).substring(0, 5000) : null,
    description: data.description ? String(data.description).substring(0, 5000) : null,
    tags: Array.isArray(data.tags) ? data.tags.map((t: any) => String(t).trim()).filter(Boolean) : [],
    is_featured: Boolean(data.isFeatured ?? data.is_featured ?? false),
    owner_id: userId
  };

  return { sanitized };
}

export async function createProperty(data: any, bypassUserId?: string) {
  const userId = bypassUserId;
  if (!userId) throw new Error("Usuário não identificado.");
  
  console.log("[lib/db/properties] createProperty: Iniciando processo de higienização...");
  const { sanitized } = sanitizePropertyData(data, userId);
  
  let cleanImageUrls: string[] = [];
  if (Array.isArray(data.imageUrls)) {
    cleanImageUrls = data.imageUrls.map((u: any) => String(u || '').trim()).filter((u: string) => u.length > 0);
  }

  const primaryImageUrl = cleanImageUrls.length > 0 ? cleanImageUrls[0] : "";

  const insertData = { 
    ...sanitized, 
    image_url: primaryImageUrl, 
    imageUrls: cleanImageUrls
  };

  try {
    console.log("[lib/db/properties] createProperty: Enviando payload ao servidor via API Proxy...", insertData);
    const result = await apiFetch('/api/properties', {
      method: "POST",
      body: JSON.stringify(insertData)
    });
    console.log("[lib/db/properties] createProperty Proxy: SUCESSO. Novo ID:", result.id);
    clearPropertiesCache();
    forceDataResync();
    return result.id;
  } catch (err) {
    console.error("[lib/db/properties] createProperty Proxy FATAL:", err);
    throw err;
  }
}

export async function updateProperty(id: string, data: any, bypassUserId?: string) {
  if (!id) throw new Error("ID do imóvel é obrigatório.");
  const userId = bypassUserId;
  if (!userId) throw new Error("Usuário não identificado.");

  console.log(`[lib/db/properties] updateProperty: Iniciando atualização para o ID: ${id}`);
  const { sanitized } = sanitizePropertyData(data, userId);

  let cleanImageUrls: string[] = [];
  if (Array.isArray(data.imageUrls)) {
    cleanImageUrls = data.imageUrls.map((u: any) => String(u || '').trim()).filter((u: string) => u.length > 0);
  }

  const primaryImageUrl = cleanImageUrls.length > 0 ? cleanImageUrls[0] : "";

  const updateData = {
    ...sanitized,
    image_url: primaryImageUrl,
    updated_at: new Date().toISOString(),
    imageUrls: cleanImageUrls
  };

  try {
    console.log(`[lib/db/properties] updateProperty: Enviando atualização via API Proxy...`, updateData);
    await apiFetch(`/api/properties?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
    console.log("[lib/db/properties] updateProperty Proxy: Transação concluída com sucesso.");
    clearPropertiesCache();
    forceDataResync();
    return id;
  } catch (err) {
    console.error(`[lib/db/properties] updateProperty Proxy FATAL para o ID ${id}:`, err);
    throw err;
  }
}

export async function deleteProperty(id: string) {
  console.log(`[lib/db/properties] deleteProperty: Removendo ID: ${id}`);
  
  try {
    await apiFetch(`/api/properties?id=${id}`, {
      method: "DELETE"
    });
    clearPropertiesCache();
    forceDataResync();
    return true;
  } catch (error) {
    console.error("[lib/db/properties] Error in deleteProperty Proxy:", error);
    throw error;
  }
}

export async function togglePropertyFeatured(id: string, isFeatured: boolean) {
  console.log(`[lib/db/properties] togglePropertyFeatured: ID ${id} -> ${isFeatured}`);
  try {
    const res = await apiFetch(`/api/properties?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_featured: isFeatured, isFeatured })
    });
    clearPropertiesCache();
    forceDataResync();
    return res;
  } catch (error) {
    console.error("[lib/db/properties] Error in togglePropertyFeatured:", error);
    throw error;
  }
}
