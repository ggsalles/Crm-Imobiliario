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

function getClientActiveTenant(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    const raw = sessionStorage.getItem('active-tenant-id');
    if (raw && raw !== 'undefined' && raw !== 'null') return raw;
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('active-tenant-id:')) {
        const val = sessionStorage.getItem(k);
        if (val && val !== 'undefined' && val !== 'null') return val;
      }
    }
  } catch {}
  return 'default';
}

export function getCachedProperties(ownerId?: string): Property[] | null {
  const tenant = getClientActiveTenant();
  const specificKey = `properties:${tenant}:${ownerId || 'all'}`;
  if (dataCache[specificKey] && Array.isArray(dataCache[specificKey]) && dataCache[specificKey].length > 0) {
    return dataCache[specificKey];
  }
  const restored = safeRestoreSnapshot(specificKey);
  if (restored) {
    dataCache[specificKey] = restored;
    return restored;
  }
  return null;
}

const inFlightPropertyFetches = new Map<string, Promise<Property[]>>();

export async function getProperties(ownerId?: string, limit?: number, forceRefresh = false): Promise<Property[]> {
  const tenant = getClientActiveTenant();
  const cacheKey = `properties:${tenant}:${ownerId || 'all'}`;
  
  if (!forceRefresh && inFlightPropertyFetches.has(cacheKey)) {
    return inFlightPropertyFetches.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    const startTime = Date.now();
    try {
      let url = `/api/properties?limit=${limit || 10000}`;
      if (ownerId) url += `&ownerId=${ownerId}`;
      if (forceRefresh) url += `&nocache=true&_t=${Date.now()}`;
      
      const data = await apiFetch(url, { bypassCache: forceRefresh, noCache: forceRefresh });
      if (Array.isArray(data)) {
        dataCache[cacheKey] = data;
        safePersistSnapshot(cacheKey, data);
      }
      return (data || []) as Property[];
    } catch (err: any) {
      console.warn("[lib/db/properties] getProperties aviso ao buscar imóveis:", err?.message || err);
      if (dataCache[cacheKey] && Array.isArray(dataCache[cacheKey]) && dataCache[cacheKey].length > 0) {
        return dataCache[cacheKey] as Property[];
      }
      return [];
    } finally {
      inFlightPropertyFetches.delete(cacheKey);
    }
  })();

  inFlightPropertyFetches.set(cacheKey, fetchPromise);
  return fetchPromise;
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

  const fetchShowcase = async (force = false) => {
    try {
      let url = `/api/properties?public=true&limit=10000`;
      if (tenantId) url += `&tenantId=${encodeURIComponent(tenantId)}`;
      if (ownerId) url += `&brokerId=${encodeURIComponent(ownerId)}`;
      if (force) url += `&nocache=true&_t=${Date.now()}`;

      const data = await apiFetch(url, { bypassCache: force, noCache: force });
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
  const subscription = createRealtimeChannel('properties', () => fetchShowcase(true));
  // Polling de segurança a cada 5 minutos (o Supabase Realtime já notifica instantaneamente)
  const poll = createVisibilityAwarePoll(() => fetchShowcase(false), 300000);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

// Reactive In-Memory Subscribers Store (padrão iFood / Optimistic UI instantâneo)
const propertySubscribers = new Set<(properties: Property[]) => void>();

export function notifyPropertiesUpdated(updatedList: Property[]) {
  if (!Array.isArray(updatedList)) return;
  propertySubscribers.forEach((cb) => {
    try {
      cb([...updatedList]);
    } catch (err) {
      console.warn("[lib/db/properties] Falha ao notificar subscriber:", err);
    }
  });
}

export function subscribeToProperties(callback: (properties: Property[]) => void, ownerId?: string) {
  const tenant = getClientActiveTenant();
  const cacheKey = `properties:${tenant}:${ownerId || 'all'}`;
  propertySubscribers.add(callback);

  const initialData = getCachedProperties(ownerId);
  if (initialData && initialData.length > 0) {
    callback(initialData);
  }

  const fetchProperties = async (silent = false) => {
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
  const subscription = createRealtimeChannel('properties', () => fetchProperties(true));
  const poll = createVisibilityAwarePoll(() => fetchProperties(false), POLL_INTERVAL);

  return () => {
    propertySubscribers.delete(callback);
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
    reference_code: (data.referenceCode || data.reference_code) ? String(data.referenceCode || data.reference_code).trim().toUpperCase().substring(0, 50) : null,
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

  const primaryImageUrl = cleanImageUrls.length > 1
    ? JSON.stringify(cleanImageUrls)
    : (cleanImageUrls.length === 1 ? cleanImageUrls[0] : "");

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

    if (!result || !result.id) {
      throw new Error(result?.error || "Servidor não confirmou a criação do imóvel.");
    }

    console.log("[lib/db/properties] createProperty Proxy: SUCESSO. Novo ID:", result.id);
    const confirmedRecord: Property = result.property || ({
      id: result.id,
      ...sanitized,
      imageUrls: cleanImageUrls,
      tags: sanitized.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);

    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('properties:') && Array.isArray(dataCache[k])) {
        dataCache[k] = [confirmedRecord, ...dataCache[k]];
        safePersistSnapshot(k, dataCache[k]);
        notifyPropertiesUpdated(dataCache[k]);
      }
    }

    invalidateApiCache('/api/properties');
    return confirmedRecord;
  } catch (err) {
    console.error("[lib/db/properties] createProperty Proxy FATAL:", err);
    throw err;
  }
}

export async function updateProperty(id: string, data: any, bypassUserId?: string): Promise<Property> {
  if (!id) throw new Error("ID do imóvel é obrigatório.");
  const userId = bypassUserId;
  if (!userId) throw new Error("Usuário não identificado.");

  console.log(`[lib/db/properties] updateProperty: Iniciando atualização para o ID: ${id}`);
  const { sanitized } = sanitizePropertyData(data, userId);

  // In updates, preserve existing owner_id unless explicitly changing owner
  if (!data.ownerId && !data.owner_id) {
    delete (sanitized as any).owner_id;
  }
  delete (sanitized as any).tenant_id;

  let cleanImageUrls: string[] = [];
  if (Array.isArray(data.imageUrls)) {
    cleanImageUrls = data.imageUrls.map((u: any) => String(u || '').trim()).filter((u: string) => u.length > 0);
  }

  const primaryImageUrl = cleanImageUrls.length > 1
    ? JSON.stringify(cleanImageUrls)
    : (cleanImageUrls.length === 1 ? cleanImageUrls[0] : "");

  const updateData = {
    ...sanitized,
    image_url: primaryImageUrl,
    updated_at: new Date().toISOString(),
    imageUrls: cleanImageUrls
  };

  try {
    console.log(`[lib/db/properties] updateProperty: Enviando atualização via API Proxy...`, updateData);
    const result = await apiFetch(`/api/properties?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });

    if (!result || !result.success) {
      throw new Error(result?.error || "Servidor não confirmou a gravação do imóvel.");
    }

    console.log("[lib/db/properties] updateProperty Proxy: Transação concluída com sucesso.");
    
    const confirmedRecord: Property = result.updated || ({
      id,
      ...sanitized,
      ...updateData,
      imageUrls: cleanImageUrls
    } as any);

    // Atualiza a memória local com o registro carimbado pelo banco de dados
    let updatedSnapshot: Property[] | null = null;
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('properties:') && Array.isArray(dataCache[k])) {
        dataCache[k] = dataCache[k].map((p: any) => p.id === id ? { ...p, ...confirmedRecord } : p);
        safePersistSnapshot(k, dataCache[k]);
        if (!updatedSnapshot) updatedSnapshot = dataCache[k];
      }
    }
    
    // Notifica instantaneamente todos os componentes React montados na tela
    if (updatedSnapshot) {
      notifyPropertiesUpdated(updatedSnapshot);
    }
    
    invalidateApiCache('/api/properties');
    return confirmedRecord;
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
    
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('properties:') && Array.isArray(dataCache[k])) {
        dataCache[k] = dataCache[k].filter((p: any) => p.id !== id);
        safePersistSnapshot(k, dataCache[k]);
        notifyPropertiesUpdated(dataCache[k]);
      }
    }
    invalidateApiCache('/api/properties');
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
