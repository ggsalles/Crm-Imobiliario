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

export function subscribeToTimeline(
  arg1: string,
  arg2: string | ((events: TimelineEvent[]) => void),
  arg3?: ((events: TimelineEvent[]) => void) | string,
  arg4?: string
) {
  let category: string | undefined;
  let relatedId: string;
  let callback: (events: TimelineEvent[]) => void;
  let ownerId: string | undefined;

  if (typeof arg2 === 'function') {
    // Called as (relatedId, callback, ownerId?)
    relatedId = arg1;
    callback = arg2;
    if (typeof arg3 === 'string') ownerId = arg3;
  } else {
    // Called as (category, relatedId, callback, ownerId?)
    category = arg1;
    relatedId = arg2;
    callback = typeof arg3 === 'function' ? arg3 : () => {};
    ownerId = arg4;
  }

  const cacheKey = `timeline:${category || 'all'}:${relatedId}`;
  if (dataCache[cacheKey]) {
    try {
      callback(dataCache[cacheKey]);
    } catch (e) {
      console.warn('[lib/db/timeline] Cache callback error:', e);
    }
  }

  const fetchEvents = async () => {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'undefined') params.set('category', category);
      if (relatedId && relatedId !== 'undefined') params.set('relatedId', relatedId);
      if (ownerId && ownerId !== 'undefined') params.set('ownerId', ownerId);

      const queryString = params.toString();
      const url = `/api/timeline${queryString ? `?${queryString}` : ''}`;
      
      const data = await apiFetch(url);
      if (data && Array.isArray(data)) {
        dataCache[cacheKey] = data;
        callback(data);
      } else {
        callback(dataCache[cacheKey] || []);
      }
    } catch (err) {
      console.warn("[lib/db/timeline] subscribeToTimeline fetch error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchEvents();
  const subscription = createRealtimeChannel('timeline', fetchEvents, `related_id=eq.${relatedId}`);
  const poll = createVisibilityAwarePoll(fetchEvents, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)?._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createTimelineEvent(data: {
  type: 'system' | 'note';
  category?: 'contact' | 'deal' | 'company' | string;
  relatedId: string;
  content: string;
  title?: string;
  authorName?: string;
  author_name?: string;
  ownerId?: string;
  metadata?: any;
}) {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const author = data.authorName || data.author_name || user.email || 'Sistema';

  const eventData = {
    type: data.type || 'note',
    category: data.category || 'deal',
    related_id: data.relatedId,
    content: data.content,
    title: data.title || (data.type === 'system' ? 'Evento do Sistema' : 'Nota'),
    author_name: author,
    owner_id: data.ownerId || user.id,
    created_by: user.id,
    metadata: data.metadata || {}
  };

  try {
    const result = await apiFetch('/api/timeline', {
      method: "POST",
      body: JSON.stringify(eventData)
    });
    
    // Invalidate local cache so next poll or listener gets latest
    const cat = data.category || 'deal';
    const cacheKey = `timeline:${cat}:${data.relatedId}`;
    if (dataCache[cacheKey] && Array.isArray(dataCache[cacheKey])) {
      const optimisticItem: TimelineEvent = {
        id: result?.id || `temp-${Date.now()}`,
        type: eventData.type as any,
        category: eventData.category as any,
        relatedId: eventData.related_id,
        content: eventData.content,
        title: eventData.title,
        authorName: eventData.author_name,
        ownerId: eventData.owner_id,
        createdBy: eventData.created_by,
        createdAt: new Date().toISOString(),
        metadata: eventData.metadata
      };
      dataCache[cacheKey] = [optimisticItem, ...dataCache[cacheKey]];
    }

    return result?.id;
  } catch (err) {
    console.error("[lib/db/timeline] createTimelineEvent FATAL:", err);
    throw err;
  }
}
