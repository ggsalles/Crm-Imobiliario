import { supabase } from '../supabase';
import { Contact } from './types';
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

export function getCachedContacts(ownerId?: string): Contact[] | null {
  const specificKey = `contacts:${ownerId || 'all'}`;
  if (dataCache[specificKey] && Array.isArray(dataCache[specificKey]) && dataCache[specificKey].length > 0) {
    return dataCache[specificKey];
  }
  const restored = safeRestoreSnapshot(specificKey) || safeRestoreSnapshot('contacts:all');
  if (restored) {
    dataCache[specificKey] = restored;
    return restored;
  }
  const allKey = 'contacts:all';
  if (dataCache[allKey] && Array.isArray(dataCache[allKey]) && dataCache[allKey].length > 0) {
    return dataCache[allKey];
  }
  for (const k of Object.keys(dataCache)) {
    if (k.startsWith('contacts:') && Array.isArray(dataCache[k]) && dataCache[k].length > 0) {
      return dataCache[k];
    }
  }
  return null;
}

export async function getContacts(ownerId?: string): Promise<Contact[]> {
  try {
    let url = `/api/contacts`;
    if (ownerId) url += `?ownerId=${ownerId}`;
    const data = await apiFetch(url);
    return (data || []) as Contact[];
  } catch (err) {
    console.error("[lib/db/contacts] getContacts FATAL:", err);
    return [];
  }
}

export async function getContact(id: string): Promise<Contact | null> {
  if (!id) return null;
  try {
    const data = await apiFetch(`/api/contacts?id=${encodeURIComponent(id)}`);
    return data || null;
  } catch (err) {
    console.error("[lib/db/contacts] getContact error:", err);
    return null;
  }
}

export function subscribeToContacts(callback: (contacts: Contact[]) => void, ownerId?: string) {
  const cacheKey = `contacts:${ownerId || 'all'}`;
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) callback(dataCache[cacheKey]);

  const fetchContacts = async () => {
    try {
      const data = await getContacts(ownerId);
      if (data && Array.isArray(data)) {
        dataCache[cacheKey] = data;
        safePersistSnapshot(cacheKey, data);
        callback(data);
      } else if (!dataCache[cacheKey]) {
        callback([]); 
      }
    } catch (err) {
      console.warn("[lib/db/contacts] subscribeToContacts error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]); 
      }
    }
  };

  fetchContacts();
  const subscription = createRealtimeChannel('contacts', fetchContacts);
  const poll = createVisibilityAwarePoll(fetchContacts, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createContact(data: any) {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const contactData = {
    name: data.name,
    role: data.role,
    temperature: data.temperature,
    email: data.email,
    phone: data.phone,
    type: data.type,
    department: data.department,
    company_id: data.companyId || null,
    source: data.source || null,
    owner_id: user.id
  };

  try {
    const result = await apiFetch('/api/contacts', {
      method: "POST",
      body: JSON.stringify(contactData)
    });
    return result.id;
  } catch (err) {
    console.error("[lib/db/contacts] createContact FATAL:", err);
    throw err;
  }
}

export async function updateContact(id: string, data: any) {
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.department !== undefined) updateData.department = data.department;
  if (data.companyId !== undefined) updateData.company_id = data.companyId || null;
  if (data.source !== undefined) updateData.source = data.source || null;
  if (data.temperature !== undefined) updateData.temperature = data.temperature;

  try {
    await apiFetch(`/api/contacts?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
  } catch (err) {
    console.error("[lib/db/contacts] updateContact FATAL:", err);
    throw err;
  }
}

export function clearContactsCache() {
  invalidateApiCache('/api/contacts');
  for (const k of Object.keys(dataCache)) {
    if (k.startsWith('contacts:')) {
      delete dataCache[k];
    }
  }
}

export async function deleteContact(id: string) {
  try {
    const result = await apiFetch(`/api/contacts?id=${id}`, {
      method: "DELETE"
    });
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('contacts:')) {
        if (Array.isArray(dataCache[k])) {
          dataCache[k] = dataCache[k].filter((c: any) => c.id !== id);
        }
      }
    }
    invalidateApiCache('/api/contacts');
    forceDataResync();
    return result?.deleted ?? true;
  } catch (err) {
    console.error("[lib/db/contacts] deleteContact FATAL:", err);
    throw err;
  }
}
