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

export async function setGoal(month: string, stageGoals: { [stageId: string]: number }) {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const goalData: any = {
    month,
    stage_goals: stageGoals,
    owner_id: user.id,
    updated_at: new Date().toISOString()
  };

  try {
    await apiFetch('/api/goals', {
      method: "POST",
      body: JSON.stringify(goalData)
    });
  } catch (err) {
    console.error("[lib/db/goals] setGoal FATAL:", err);
    throw err;
  }
}
