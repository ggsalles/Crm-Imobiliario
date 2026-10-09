import { supabase } from '../supabase';
import { Activity } from './types';
import { 
  apiFetch, 
  dataCache, 
  safePersistSnapshot, 
  safeRestoreSnapshot, 
  createRealtimeChannel, 
  createVisibilityAwarePoll, 
  getSafeSession, 
  POLL_INTERVAL,
  invalidateApiCache 
} from './core';

export function getCachedActivities(ownerId?: string): Activity[] | null {
  const specificKey = `activities:${ownerId || 'all'}`;
  if (dataCache[specificKey] && Array.isArray(dataCache[specificKey]) && dataCache[specificKey].length > 0) {
    return dataCache[specificKey];
  }
  const restored = safeRestoreSnapshot(specificKey) || safeRestoreSnapshot('activities:all');
  if (restored) {
    dataCache[specificKey] = restored;
    return restored;
  }
  const allKey = 'activities:all';
  if (dataCache[allKey] && Array.isArray(dataCache[allKey]) && dataCache[allKey].length > 0) {
    return dataCache[allKey];
  }
  for (const k of Object.keys(dataCache)) {
    if (k.startsWith('activities:') && Array.isArray(dataCache[k]) && dataCache[k].length > 0) {
      return dataCache[k];
    }
  }
  return null;
}

export async function getActivitiesByContact(contactId: string): Promise<Activity[]> {
  try {
    const data = await apiFetch(`/api/activities?contactId=${contactId}`);
    return data as Activity[];
  } catch (err) {
    console.error("[lib/db/activities] getActivitiesByContact FATAL:", err);
    return [];
  }
}

export function subscribeToActivities(callback: (activities: Activity[]) => void, ownerId?: string) {
  const cacheKey = `activities:${ownerId || 'all'}`;
  if (dataCache[cacheKey]) callback(dataCache[cacheKey]);

  const fetchActivities = async () => {
    try {
      let url = `/api/activities`;
      if (ownerId) url += `?ownerId=${ownerId}`;
      const data = await apiFetch(url);
      if (data && Array.isArray(data)) {
        const result = data as Activity[];
        dataCache[cacheKey] = result;
        safePersistSnapshot(cacheKey, result);
        callback(result);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (err) {
      console.warn("[lib/db/activities] subscribeToActivities error, maintaining stale data:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchActivities();
  const subscription = createRealtimeChannel('activities', fetchActivities);
  const poll = createVisibilityAwarePoll(fetchActivities, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createActivity(data: any): Promise<{ id: string; activity: Activity }> {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const activityData = {
    title: data.title,
    description: data.description,
    date: data.date,
    type: data.type || 'task',
    status: data.status || 'pending',
    contact_id: data.contactId || data.contact_id || null,
    deal_id: data.dealId || data.deal_id || null,
    owner_id: user.id
  };

  try {
    const result = await apiFetch('/api/activities', {
      method: "POST",
      body: JSON.stringify(activityData)
    });

    const createdId = result?.id || result?.activity?.id;
    const officialActivity: Activity = result?.activity || {
      id: createdId,
      title: activityData.title,
      description: activityData.description,
      date: activityData.date,
      type: activityData.type,
      status: activityData.status,
      contactId: activityData.contact_id || undefined,
      dealId: activityData.deal_id || undefined,
      ownerId: activityData.owner_id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Sincronização imediata no cache de memória local e snapshot persistente
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('activities:')) {
        if (Array.isArray(dataCache[k])) {
          const existingIdx = dataCache[k].findIndex((a: any) => a.id === createdId);
          if (existingIdx >= 0) {
            dataCache[k][existingIdx] = officialActivity;
          } else {
            dataCache[k] = [...dataCache[k], officialActivity];
          }
          safePersistSnapshot(k, dataCache[k]);
        }
      }
    }

    invalidateApiCache('/api/activities');
    return { id: createdId, activity: officialActivity };
  } catch (err) {
    console.error("[lib/db/activities] createActivity FATAL:", err);
    throw err;
  }
}

export async function updateActivity(id: string, data: any): Promise<Activity> {
  if (!id) throw new Error("ID de atividade inválido");

  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.date !== undefined) updateData.date = data.date;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.contactId !== undefined) updateData.contact_id = data.contactId;
  if (data.dealId !== undefined) updateData.deal_id = data.dealId;

  try {
    const result = await apiFetch(`/api/activities?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });

    const officialActivity: Activity = result?.activity || {
      id,
      ...data,
      updatedAt: updateData.updated_at
    };

    // Atualização imediata no cache de memória local e snapshot persistente
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('activities:')) {
        if (Array.isArray(dataCache[k])) {
          dataCache[k] = dataCache[k].map((a: any) => {
            if (a.id === id) {
              return { ...a, ...officialActivity };
            }
            return a;
          });
          safePersistSnapshot(k, dataCache[k]);
        }
      }
    }

    invalidateApiCache('/api/activities');
    return officialActivity;
  } catch (err) {
    console.error("[lib/db/activities] updateActivity FATAL:", err);
    throw err;
  }
}

export async function deleteActivity(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    await apiFetch(`/api/activities?id=${id}`, {
      method: "DELETE"
    });
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('activities:')) {
        if (Array.isArray(dataCache[k])) {
          dataCache[k] = dataCache[k].filter((a: any) => a.id !== id);
          safePersistSnapshot(k, dataCache[k]);
        }
      }
    }
    invalidateApiCache('/api/activities');
    return true;
  } catch (err) {
    console.error("[lib/db/activities] deleteActivity FATAL:", err);
    throw err;
  }
}
