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
  POLL_INTERVAL 
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

const inFlightActivityCreations = new Map<string, Promise<string>>();
const recentActivityCreations = new Map<string, { id: string; expiresAt: number }>();

export async function createActivity(data: any) {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const dedupKey = `${user.id}:${data.title?.trim()}:${data.date}`;
  const now = Date.now();

  const cached = recentActivityCreations.get(dedupKey);
  if (cached && cached.expiresAt > now) {
    return cached.id;
  }

  if (inFlightActivityCreations.has(dedupKey)) {
    return inFlightActivityCreations.get(dedupKey)!;
  }

  const activityData = {
    title: data.title,
    description: data.description,
    date: data.date,
    type: data.type,
    status: data.status,
    contact_id: data.contactId || null,
    deal_id: data.dealId || null,
    owner_id: user.id
  };

  const creationPromise = (async () => {
    try {
      const result = await apiFetch('/api/activities', {
        method: "POST",
        body: JSON.stringify(activityData)
      });
      recentActivityCreations.set(dedupKey, { id: result.id, expiresAt: Date.now() + 5000 });
      return result.id;
    } catch (err) {
      console.error("[lib/db/activities] createActivity FATAL:", err);
      throw err;
    } finally {
      inFlightActivityCreations.delete(dedupKey);
    }
  })();

  inFlightActivityCreations.set(dedupKey, creationPromise);
  return creationPromise;
}

export async function updateActivity(id: string, data: any) {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.date !== undefined) updateData.date = data.date;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status;

  try {
    await apiFetch(`/api/activities?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
  } catch (err) {
    console.error("[lib/db/activities] updateActivity FATAL:", err);
    throw err;
  }
}

export async function deleteActivity(id: string) {
  try {
    await apiFetch(`/api/activities?id=${id}`, {
      method: "DELETE"
    });
  } catch (err) {
    console.error("[lib/db/activities] deleteActivity FATAL:", err);
    throw err;
  }
}
