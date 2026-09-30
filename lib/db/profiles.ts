import { supabase } from '../supabase';
import { UserProfile } from './types';
import { DEFAULT_TENANT_ID } from '../constants';
import { safeJsonParse } from '../safe-storage';
import { 
  apiFetch, 
  dataCache, 
  createRealtimeChannel, 
  createVisibilityAwarePoll, 
  forceDataResync, 
  invalidateApiCache, 
  POLL_INTERVAL 
} from './core';

export async function getUserProfile(id: string): Promise<UserProfile | null> {
  try {
    const data = await apiFetch(`/api/profiles?id=${id}`);
    if (Array.isArray(data)) return data[0] as UserProfile;
    return data as UserProfile;
  } catch (err) {
    console.error("[lib/db/profiles] getUserProfile FATAL:", err);
    return null;
  }
}

export function subscribeToUsers(callback: (users: UserProfile[]) => void, ownerId?: string, tenantId?: string) {
  const cacheKey = `users:${tenantId || 'all'}:${ownerId || 'all'}`;
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) callback(dataCache[cacheKey]);

  const fetchUsers = async () => {
    try {
      let url = '/api/profiles';
      if (tenantId) url += `?tenantId=${tenantId}`;
      const data = await apiFetch(url, { bypassCache: true });
      if (data && Array.isArray(data)) {
        let filtered = data as UserProfile[];
        if (ownerId) filtered = filtered.filter(u => u.id === ownerId);
        dataCache[cacheKey] = filtered;
        callback(filtered);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (err) {
      console.warn("[lib/db/profiles] subscribeToUsers error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchUsers();
  const subscription = createRealtimeChannel('profiles', fetchUsers);
  const poll = createVisibilityAwarePoll(fetchUsers, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function updateUserProfile(id: string, data: any, skipResync = false) {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.displayName !== undefined) updateData.display_name = data.displayName;
  if (data.photoURL !== undefined) updateData.photo_url = data.photoURL;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.userType !== undefined) updateData.user_type = data.userType;
  if (data.isAdmin !== undefined) updateData.is_admin = data.isAdmin;
  if (data.tenantId !== undefined) updateData.tenant_id = data.tenantId;
  if (data.tenantIds !== undefined) updateData.tenantIds = data.tenantIds;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.inactiveReason !== undefined) updateData.inactiveReason = data.inactiveReason;
  if (data.securityKeyword !== undefined) updateData.security_keyword = data.securityKeyword;
  if (data.security_keyword !== undefined) updateData.security_keyword = data.security_keyword;

  try {
    if (typeof window !== "undefined") {
      const cacheKey = `local-profile:${id}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = safeJsonParse(cached, null);
          if (parsed && parsed.id === id) {
            if (data.displayName !== undefined) parsed.displayName = data.displayName;
            if (data.photoURL !== undefined) parsed.photoURL = data.photoURL;
            if (data.role !== undefined) parsed.role = data.role;
            if (data.userType !== undefined) parsed.userType = data.userType;
            if (data.isAdmin !== undefined) parsed.isAdmin = data.isAdmin;
            if (data.tenantId !== undefined) parsed.tenantId = data.tenantId;
            if (data.tenantIds !== undefined) parsed.tenantIds = data.tenantIds;
            if (data.isActive !== undefined) parsed.isActive = data.isActive;
            if (data.inactiveReason !== undefined) parsed.inactiveReason = data.inactiveReason;
            if (data.securityKeyword !== undefined) parsed.securityKeyword = data.securityKeyword;
            if (data.security_keyword !== undefined) parsed.securityKeyword = data.security_keyword;
            sessionStorage.setItem(cacheKey, JSON.stringify(parsed));
          }
        } catch (e) {
          console.warn("[lib/db/profiles] Error updating local profile cache synchronously:", e);
        }
      }
    }

    invalidateApiCache('/api/profiles');

    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('users:')) {
        dataCache[k] = (dataCache[k] || []).map((u: any) => {
          if (u.id === id) {
            return {
              ...u,
              displayName: data.displayName !== undefined ? data.displayName : u.displayName,
              role: data.role !== undefined ? data.role : u.role,
              userType: data.userType !== undefined ? data.userType : u.userType,
              tenantId: data.tenantId !== undefined ? data.tenantId : u.tenantId,
              tenantIds: data.tenantIds !== undefined ? data.tenantIds : u.tenantIds,
              isActive: data.isActive !== undefined ? data.isActive : u.isActive,
              inactiveReason: data.inactiveReason !== undefined ? data.inactiveReason : u.inactiveReason,
              securityKeyword: data.securityKeyword !== undefined ? data.securityKeyword : (data.security_keyword !== undefined ? data.security_keyword : u.securityKeyword)
            };
          }
          return u;
        });
      }
    }

    await apiFetch(`/api/profiles?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
    
    if (!skipResync) {
      forceDataResync();
    }
  } catch (err) {
    console.error("[lib/db/profiles] updateUserProfile FATAL:", err);
    throw err;
  }
}

export async function deleteUserProfile(id: string) {
  try {
    await apiFetch(`/api/profiles?id=${id}`, {
      method: "DELETE"
    });
    forceDataResync();
  } catch (err) {
    console.error("[lib/db/profiles] deleteUserProfile FATAL:", err);
    throw err;
  }
}

export async function isEmailRegistered(email: string): Promise<boolean> {
  try {
    const data = await apiFetch(`/api/profiles?email=${encodeURIComponent(email)}`);
    return !!data;
  } catch (err) {
    console.error("[lib/db/profiles] isEmailRegistered error:", err);
    return false;
  }
}

export async function createUserProfile(data: { 
  displayName: string; 
  email: string; 
  role: 'Membro' | 'Admin'; 
  userType: 'funcionário' | 'cliente'; 
  tenantId?: string; 
  tenantIds?: string[];
  isActive?: boolean;
  inactiveReason?: string;
  securityKeyword?: string;
  password?: string;
}) {
  const tempId = crypto.randomUUID();
  
  const profileData = {
    id: tempId,
    display_name: data.displayName,
    email: data.email.toLowerCase(),
    role: data.role,
    user_type: data.userType,
    is_admin: data.role === 'Admin',
    tenant_id: data.tenantId || null,
    tenantIds: data.tenantIds || (data.tenantId ? [data.tenantId] : [DEFAULT_TENANT_ID]),
    isActive: data.isActive !== undefined ? data.isActive : true,
    inactiveReason: data.inactiveReason || null,
    security_keyword: data.securityKeyword || null,
    password: data.password || undefined
  };

  try {
    const result = await apiFetch('/api/profiles', {
      method: "POST",
      body: JSON.stringify(profileData)
    });
    forceDataResync();
    return result.id;
  } catch (err) {
    console.error("[lib/db/profiles] createUserProfile FATAL:", err);
    throw err;
  }
}
