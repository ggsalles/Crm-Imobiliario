import { supabase, clearAuthSession } from '../supabase';
import { safeJsonParse } from '../safe-storage';

let cachedSession: any = null;
let cachedSessionTime = 0;
const SESSION_CACHE_TTL = 4000; // 4 seconds in-memory cache

export function invalidateSessionCache() {
  cachedSession = null;
  cachedSessionTime = 0;
}

export async function getSafeSession() {
  const now = Date.now();
  if (cachedSession && now - cachedSessionTime < SESSION_CACHE_TTL) {
    return cachedSession;
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      cachedSession = null;
      const errMsg = (error.message || '').toLowerCase();
      if (
        errMsg.includes('invalid refresh token') ||
        errMsg.includes('refresh token not found') ||
        errMsg.includes('refresh_token_not_found')
      ) {
        clearAuthSession();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app-session-expired'));
        }
      }
      return null;
    }
    cachedSession = data?.session || null;
    cachedSessionTime = now;
    return cachedSession;
  } catch (err: any) {
    cachedSession = null;
    const errMsg = (err?.message || (typeof err === 'string' ? err : '') || '').toLowerCase();
    if (
      errMsg.includes('invalid refresh token') ||
      errMsg.includes('refresh token not found') ||
      errMsg.includes('refresh_token_not_found')
    ) {
      clearAuthSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-session-expired'));
      }
    }
    return null;
  }
}

export const POLL_INTERVAL = 90000;
export const RESYNC_EVENT = 'db-force-resync';

export function createVisibilityAwarePoll(callback: () => void, intervalMs = POLL_INTERVAL) {
  return setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    callback();
  }, intervalMs);
}

export const dataCache: Record<string, any> = {};

export function safePersistSnapshot(key: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    if (Array.isArray(data) && data.length > 0) {
      try {
        sessionStorage.setItem(`db-cache:${key}`, JSON.stringify(data));
        return;
      } catch {
        // Fallback to compact representation if sessionStorage quota is tight
        const light = data.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          type: item.type,
          status: item.status,
          location: item.location,
          neighborhood: item.neighborhood,
          city: item.city,
          state: item.state,
          area: item.area,
          bedrooms: item.bedrooms,
          bathrooms: item.bathrooms,
          parkingSpots: item.parkingSpots,
          isFeatured: item.isFeatured,
          buildingName: item.buildingName,
          imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls.slice(0, 3) : [],
          tags: item.tags,
          tenantId: item.tenantId,
          ownerId: item.ownerId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }));
        sessionStorage.setItem(`db-cache:${key}`, JSON.stringify(light));
      }
    }
  } catch {}
}

export function safeRestoreSnapshot(key: string): any[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`db-cache:${key}`);
    if (raw) {
      const parsed = safeJsonParse(raw, null);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return null;
}

export function forceDataResync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RESYNC_EVENT));
  }
}

export function clearLocalCache() {
  console.log("[lib/db] Clearing global dataCache object...");
  for (const key in dataCache) {
    delete dataCache[key];
  }
}

if (typeof window !== 'undefined') {
  const onWakeUp = () => {
    if (document.visibilityState === 'visible') {
      console.log("[lib/db] Tab active, triggering global resync...");
      forceDataResync();
    }
  };
  window.addEventListener('visibilitychange', onWakeUp);
  window.addEventListener('online', forceDataResync);
}

export function createRealtimeChannel(tableName: string, callback: () => void, filter?: string, channelPrefix = 'public') {
  const channelName = `${channelPrefix}:${tableName}:${Math.random().toString(36).substring(7)}`;
  
  if (typeof window !== 'undefined') {
    window.addEventListener(RESYNC_EVENT, callback);
  }

  let retryCount = 0;
  const maxRetries = 2;
  let retryTimeout: NodeJS.Timeout | null = null;

  let channel: any;
  try {
    channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName, filter }, () => {
        console.log(`[Realtime] Mudança detectada em ${tableName}${filter ? ` (${filter})` : ''}, atualizando...`);
        callback();
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          retryCount = 0;
          console.log(`[Realtime] Inscrito com sucesso em ${tableName} (${channelName})`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] Erro/Timeout em ${tableName} (${status}):`, err?.message || err);
          if (typeof window !== 'undefined' && retryCount < maxRetries) {
            retryCount++;
            retryTimeout = setTimeout(() => {
              try {
                channel?.subscribe();
              } catch (retryErr) {
                console.warn(`[Realtime] Falha ao reconectar ${tableName}:`, retryErr);
              }
            }, 6000 * retryCount);
          }
        }
      });
  } catch (initErr) {
    console.warn(`[Realtime] Não foi possível inicializar canal para ${tableName}:`, initErr);
    channel = { state: 'closed' };
  }

  channel._customCleanup = () => {
    if (retryTimeout) clearTimeout(retryTimeout);
    if (typeof window !== 'undefined') {
      window.removeEventListener(RESYNC_EVENT, callback);
    }
  };

  return channel;
}

let isPageUnloading = false;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    isPageUnloading = true;
    setTimeout(() => {
      isPageUnloading = false;
    }, 2000);
  });
}

const inFlightRequests = new Map<string, Promise<any>>();
const apiGetCache = new Map<string, { data: any; timestamp: number }>();
const API_GET_CACHE_TTL = 4000;

export function invalidateApiCache(pattern?: string) {
  if (!pattern) {
    apiGetCache.clear();
    return;
  }
  for (const key of apiGetCache.keys()) {
    if (key.includes(pattern)) {
      apiGetCache.delete(key);
    }
  }
}

let activeRefreshPromise: Promise<any> | null = null;

async function getRefreshedSession() {
  if (activeRefreshPromise) {
    console.log("[apiFetch] Waiting for concurrent refreshSession to complete...");
    return activeRefreshPromise;
  }
  
  activeRefreshPromise = (async () => {
    try {
      console.log("[apiFetch] Performing single-coalesced refreshSession...");
      let session = null;
      try {
        session = await getSafeSession();
      } catch (sessErr: any) {
        console.warn("[apiFetch] Fail to get session in getRefreshedSession:", sessErr?.message || sessErr);
      }
      
      if (!session || !session.refresh_token) {
        console.info("[apiFetch] No active session or refresh token found. Skipping refreshSession.");
        clearAuthSession();
        return null;
      }
      
      const { data, error } = await supabase.auth.refreshSession().catch((err: any) => ({
        data: { session: null },
        error: err
      }));
      if (error) {
        clearAuthSession();
        throw error;
      }
      return data?.session || null;
    } catch (e: any) {
      const errMsg = (e?.message || e?.error_description || (typeof e === 'string' ? e : '') || "").toString();
      if (
        errMsg.toLowerCase().includes("refresh") || 
        errMsg.toLowerCase().includes("token") || 
        errMsg.toLowerCase().includes("grant") || 
        errMsg.toLowerCase().includes("session")
      ) {
        clearAuthSession();
        console.warn("[apiFetch] refreshSession bypassed (normal/expired session state):", errMsg);
      } else {
        console.error("[apiFetch] refreshSession failed:", errMsg);
      }
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();
  
  return activeRefreshPromise;
}

export async function apiFetch(url: string, options: any = {}): Promise<any> {
  const isServer = typeof window === 'undefined';
  const method = (options.method || 'GET').toUpperCase();
  
  if (!isServer && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const basePath = url.split('?')[0];
    invalidateApiCache(basePath);
  }

  if (method === 'GET' && !isServer) {
    const cacheKey = url;
    
    if (!options.bypassCache && !options.noCache) {
      const cached = apiGetCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < API_GET_CACHE_TTL) {
        return cached.data;
      }
    }
    
    if (inFlightRequests.has(cacheKey)) {
      console.log(`[apiFetch] Concurrent GET merged for url: ${url}`);
      return inFlightRequests.get(cacheKey)!;
    }
    
    const promise = apiFetchImpl(url, options)
      .then((data) => {
        if (data !== undefined && data !== null) {
          apiGetCache.set(cacheKey, { data, timestamp: Date.now() });
        }
        return data;
      })
      .finally(() => {
        inFlightRequests.delete(cacheKey);
      });
    
    inFlightRequests.set(cacheKey, promise);
    return promise;
  }
  
  return apiFetchImpl(url, options);
}

async function apiFetchImpl(url: string, options: any = {}) {
  const isServer = typeof window === 'undefined';
  const timestamp = new Date().toISOString();
  const method = (options.method || 'GET').toUpperCase();
  
  const fullUrl = url;
  console.log(`[apiFetch] [${timestamp}] ${method} ${url}`);
  
  let lastError: any;
  const maxRetries = 2;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      let token = null;
      try {
        const session = await getSafeSession();
        token = session?.access_token;
      } catch (e) {
        console.warn("[apiFetch] Erro ao recuperar sessão:", e);
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
 
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      if (!isServer && typeof window !== 'undefined' && !headers['x-tenant-id']) {
        try {
          const session = await getSafeSession();
          const userId = session?.user?.id;
          let activeTenant = userId ? sessionStorage.getItem(`active-tenant-id:${userId}`) : null;
          if (!activeTenant) {
            activeTenant = sessionStorage.getItem('login-chosen-tenant-id');
          }
          if (!activeTenant && userId) {
            const cachedProfileStr = sessionStorage.getItem(`local-profile:${userId}`);
            if (cachedProfileStr) {
              const cachedProf = safeJsonParse(cachedProfileStr, null);
              activeTenant = cachedProf?.tenantId || null;
            }
          }
          if (activeTenant && activeTenant !== 'undefined' && activeTenant !== 'null') {
            headers['x-tenant-id'] = activeTenant;
          }
        } catch (e) {}
      }
 
      const controller = new AbortController();
      const timeoutValue = options.timeout || 35000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutValue);
 
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
 
      if (response.status === 401 || response.status === 403) {
        if (!isServer) {
          console.warn("[apiFetch] Sessão possivelmente expirada (401/403), tentando refresh...");
          const refreshed = await getRefreshedSession();
          if (!refreshed) {
            window.dispatchEvent(new CustomEvent('app-session-expired'));
            throw new Error("Sessão expirada.");
          }
          continue;
        }
      }

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        let errMessage = `Erro ${response.status}: ${response.statusText}`;
        if (isJson) {
          try {
            const errData = await response.json();
            errMessage = errData.error || errMessage;
          } catch (e) {}
        } else {
          try {
            const textHeader = await response.text();
            if (textHeader.length < 200) {
              errMessage = `${errMessage} - ${textHeader}`;
            }
          } catch (e) {}
        }

        if (typeof window !== 'undefined') {
          const isPaused = response.status === 503 || /paused|inactive|database error or timeout/i.test(errMessage);
          if (isPaused) {
            window.dispatchEvent(new CustomEvent('supabase-status-change', {
              detail: { isPaused: true, message: errMessage }
            }));
          }
        }

        const httpErr = new Error(errMessage) as any;
        httpErr.status = response.status;
        throw httpErr;
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supabase-status-change', {
          detail: { isPaused: false }
        }));
      }

      const rawText = await response.text();
      const isHtmlResponse = rawText.trim().startsWith('<!doctype') || 
                             rawText.trim().startsWith('<html') || 
                             rawText.trim().startsWith('<!DOCTYPE') ||
                             rawText.trim().startsWith('<div') ||
                             rawText.trim().startsWith('{"error"');

      if (!isJson && isHtmlResponse && !rawText.trim().startsWith('{"error"')) {
        throw new Error(`Resposta do servidor inválida (HTML recebido em vez de JSON) para ${url}`);
      }

      if (!rawText || rawText.trim() === '') {
        return null;
      }

      const parsed = safeJsonParse(rawText, null);
      if (parsed === null && rawText.trim().length > 0 && !rawText.trim().startsWith('null')) {
        console.warn(`[apiFetch] Falha ao analisar JSON de ${url}`);
        return null;
      }
      return parsed;
    } catch (err: any) {
      if (typeof window !== 'undefined' && (isPageUnloading || window.closed)) {
        console.log(`[apiFetch] Page is unloading or tab is closing. Silencing fetch error for ${url}.`);
        return new Promise(() => {});
      }
      lastError = err;
      
      const isNetworkError = err.message === 'Failed to fetch' || err.name === 'TypeError';
      const isTimeout = err.name === 'AbortError';
      const isRateLimit = err.status === 429 || /429|rate exceeded|too many requests/i.test(err.message || '');

      if ((isNetworkError || isTimeout || isRateLimit) && i < maxRetries) {
        const backoffMs = isRateLimit 
          ? (800 * (i + 1)) + Math.floor(Math.random() * 400)
          : 1000;
        console.warn(`[apiFetch] Falha na tentativa ${i+1} para ${url}: ${err.message}. Retentando em ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      
      if (!isServer && method === 'GET' && apiGetCache.has(url)) {
        console.warn(`[apiFetch] Retornando cache anterior para ${url} após falha: ${err.message}`);
        return apiGetCache.get(url)!.data;
      }

      console.error(`[apiFetch] Erro fatal em ${url}:`, err);
      throw err;
    }
  }
  throw lastError;
}
