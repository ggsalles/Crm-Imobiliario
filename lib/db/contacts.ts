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

export async function createContact(data: any): Promise<{ id: string; contact: Contact }> {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const contactData: any = {
    name: String(data.name || '').trim(),
    email: String(data.email || '').trim(),
    phone: String(data.phone || '').trim(),
    type: data.type === 'equipe' ? 'equipe' : 'cliente',
    department: data.department || null,
    company_id: data.companyId || null,
    source: data.source || null,
    owner_id: user.id
  };

  if (data.type === 'equipe') {
    contactData.role = data.role || null;
  } else {
    contactData.temperature = data.temperature;
  }

  try {
    const result = await apiFetch('/api/contacts', {
      method: "POST",
      body: JSON.stringify(contactData)
    });

    if (!result || (!result.id && !result.contact?.id)) {
      throw new Error("Falha ao registrar contato no banco de dados.");
    }

    const created: Contact = result.contact || {
      id: result.id,
      name: contactData.name,
      role: contactData.role || '',
      temperature: data.temperature || 'morno',
      email: contactData.email,
      phone: contactData.phone,
      type: contactData.type,
      department: contactData.department,
      companyId: contactData.company_id,
      source: contactData.source,
      ownerId: contactData.owner_id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Atualização imediata em memória do React e Snapshots para evitar refetch desnecessário
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('contacts:') && Array.isArray(dataCache[k])) {
        dataCache[k] = [created, ...dataCache[k].filter((c: any) => c.id !== created.id)];
        safePersistSnapshot(k, dataCache[k]);
      }
    }
    invalidateApiCache('/api/contacts');

    return { id: created.id, contact: created };
  } catch (err) {
    console.error("[lib/db/contacts] createContact FATAL:", err);
    throw err;
  }
}

export async function updateContact(id: string, data: any): Promise<Contact> {
  if (!id) throw new Error("ID de contato inválido para atualização.");

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = String(data.name).trim();
  if (data.role !== undefined) updateData.role = data.role;
  if (data.email !== undefined) updateData.email = String(data.email).trim();
  if (data.phone !== undefined) updateData.phone = String(data.phone).trim();
  if (data.type !== undefined) updateData.type = data.type;
  if (data.department !== undefined) updateData.department = data.department;
  if (data.companyId !== undefined) updateData.company_id = data.companyId || null;
  if (data.source !== undefined) updateData.source = data.source || null;
  if (data.temperature !== undefined) updateData.temperature = data.temperature;

  try {
    const result = await apiFetch(`/api/contacts?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });

    const updatedContact: Contact = result?.contact || {
      id,
      name: updateData.name ?? '',
      role: updateData.role ?? '',
      temperature: updateData.temperature ?? 'morno',
      email: updateData.email ?? '',
      phone: updateData.phone ?? '',
      type: updateData.type ?? 'cliente',
      department: updateData.department,
      companyId: updateData.company_id ?? data.companyId,
      source: updateData.source ?? data.source,
      ownerId: '',
      updatedAt: new Date().toISOString()
    };

    // Sincronização atômica imediata em todas as chaves de cache de contatos
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('contacts:') && Array.isArray(dataCache[k])) {
        dataCache[k] = dataCache[k].map((c: any) => c.id === id ? { ...c, ...updatedContact } : c);
        safePersistSnapshot(k, dataCache[k]);
      }
    }
    invalidateApiCache('/api/contacts');

    return updatedContact;
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

export async function deleteContact(id: string): Promise<boolean> {
  if (!id) throw new Error("ID de contato inválido para exclusão.");

  try {
    const result = await apiFetch(`/api/contacts?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('contacts:')) {
        if (Array.isArray(dataCache[k])) {
          dataCache[k] = dataCache[k].filter((c: any) => c.id !== id);
          safePersistSnapshot(k, dataCache[k]);
        }
      }
    }
    invalidateApiCache('/api/contacts');
    forceDataResync();
    return result?.deleted ? true : true;
  } catch (err) {
    console.error("[lib/db/contacts] deleteContact FATAL:", err);
    throw err;
  }
}
