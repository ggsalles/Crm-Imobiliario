import { supabase } from '../supabase';
import { TimelineEvent } from './types';
import { 
  apiFetch, 
  dataCache, 
  createRealtimeChannel, 
  createVisibilityAwarePoll, 
  getSafeSession, 
  POLL_INTERVAL 
} from './core';

export function subscribeToTimeline(relatedId: string, callback: (events: TimelineEvent[]) => void) {
  const cacheKey = `timeline:${relatedId}`;
  if (dataCache[cacheKey]) callback(dataCache[cacheKey]);

  const fetchEvents = async () => {
    try {
      const data = await apiFetch(`/api/timeline?relatedId=${relatedId}`);
      if (data && Array.isArray(data)) {
        dataCache[cacheKey] = data;
        callback(data);
      }
    } catch (err) {
      console.warn("[lib/db/timeline] subscribeToTimeline error:", err);
      if (dataCache[cacheKey]) callback(dataCache[cacheKey]);
    }
  };

  fetchEvents();
  const subscription = createRealtimeChannel('timeline', fetchEvents, `related_id=eq.${relatedId}`);
  const poll = createVisibilityAwarePoll(fetchEvents, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createTimelineEvent(data: any) {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const eventData = {
    type: data.type,
    category: data.category,
    related_id: data.relatedId,
    content: data.content,
    title: data.title,
    author_name: data.authorName || user.email,
    owner_id: user.id,
    created_by: user.id,
    metadata: data.metadata
  };

  try {
    const result = await apiFetch('/api/timeline', {
      method: "POST",
      body: JSON.stringify(eventData)
    });
    return result.id;
  } catch (err) {
    console.error("[lib/db/timeline] createTimelineEvent FATAL:", err);
    throw err;
  }
}
