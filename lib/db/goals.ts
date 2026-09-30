import { supabase } from '../supabase';
import { Goal } from './types';
import { 
  apiFetch, 
  dataCache, 
  createRealtimeChannel, 
  createVisibilityAwarePoll, 
  getSafeSession, 
  POLL_INTERVAL 
} from './core';

export async function getGoals(ownerId?: string): Promise<Goal[]> {
  try {
    let url = `/api/goals`;
    if (ownerId) url += `?ownerId=${ownerId}`;
    const data = await apiFetch(url);
    return data as Goal[];
  } catch (err) {
    console.error("[lib/db/goals] getGoals FATAL:", err);
    return [];
  }
}

export function subscribeToGoals(callback: (goals: Goal[]) => void, ownerId?: string) {
  const cacheKey = `goals:${ownerId || 'all'}`;
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) callback(dataCache[cacheKey]);

  const fetchGoals = async () => {
    try {
      const data = await getGoals(ownerId);
      if (data && Array.isArray(data)) {
        dataCache[cacheKey] = data;
        callback(data);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (err) {
      console.warn("[lib/db/goals] subscribeToGoals error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchGoals();
  const subscription = createRealtimeChannel('goals', fetchGoals);
  const poll = createVisibilityAwarePoll(fetchGoals, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function setGoal(
  arg1: string,
  arg2: any,
  arg3?: any,
  arg4?: any
) {
  const session = await getSafeSession();
  const user = session?.user;

  let month = "";
  let stageGoals: Record<string, number> = {};
  let revenue = 0;
  let ownerId = user?.id || "";

  // Check if arg1 is month (e.g. "2026-09" format) or ownerId
  if (typeof arg1 === 'string' && /^\d{4}-\d{2}/.test(arg1)) {
    month = arg1.substring(0, 7);
    stageGoals = typeof arg2 === 'object' && arg2 !== null ? arg2 : {};
    revenue = typeof arg3 === 'number' ? arg3 : (stageGoals["closed"] || 0);
    if (typeof arg4 === 'string' && arg4) ownerId = arg4;
  } else if (typeof arg2 === 'string' && /^\d{4}-\d{2}/.test(arg2)) {
    ownerId = arg1 || user?.id || "";
    month = arg2.substring(0, 7);
    revenue = typeof arg3 === 'number' ? arg3 : 0;
    stageGoals = typeof arg4 === 'object' && arg4 !== null ? arg4 : (typeof arg3 === 'object' ? arg3 : {});
    if (!revenue && stageGoals["closed"]) revenue = stageGoals["closed"];
  } else {
    month = String(arg1 || new Date().toISOString().substring(0, 7)).substring(0, 7);
    stageGoals = typeof arg2 === 'object' && arg2 !== null ? arg2 : {};
    revenue = typeof arg3 === 'number' ? arg3 : (stageGoals["closed"] || 0);
  }

  if (!ownerId) throw new Error("Not authenticated");

  const goalData: any = {
    month,
    revenue,
    stage_goals: stageGoals,
    owner_id: ownerId,
    updated_at: new Date().toISOString()
  };

  try {
    const res = await apiFetch('/api/goals', {
      method: "POST",
      body: JSON.stringify(goalData)
    });

    // Invalidate local cache
    for (const k of Object.keys(dataCache)) {
      if (k.startsWith('goals:')) {
        delete dataCache[k];
      }
    }

    return res;
  } catch (err) {
    console.error("[lib/db/goals] setGoal FATAL:", err);
    throw err;
  }
}
