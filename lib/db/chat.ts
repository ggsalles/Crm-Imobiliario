import { supabase } from '../supabase';
import { Conversation, ChatMessage } from './types';
import { getUserProfile } from './profiles';
import { 
  apiFetch, 
  dataCache, 
  createRealtimeChannel, 
  createVisibilityAwarePoll, 
  forceDataResync, 
  invalidateApiCache, 
  getSafeSession, 
  POLL_INTERVAL 
} from './core';

export function subscribeToConversations(category: 'client' | 'team', callback: (conversations: Conversation[]) => void, ownerId?: string) {
  const cacheKey = `conversations:${category}:${ownerId || 'all'}`;
  if (dataCache[cacheKey]) callback(dataCache[cacheKey]);

  const fetchConversations = async () => {
    try {
      let url = `/api/conversations?category=${category}`;
      if (ownerId) url += `&ownerId=${ownerId}`;
      const data = await apiFetch(url, { bypassCache: true });
      if (data && Array.isArray(data)) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          participants: Array.isArray(item.participants) 
            ? item.participants 
            : (item.contactId ? [item.ownerId, item.contactId].filter(Boolean) : []),
          participantDetails: item.participantDetails || item.participant_details || {},
          lastMessage: item.lastMessage || item.last_message || "",
          lastMessageAt: item.lastMessageAt || item.last_message_at || "",
          type: item.type || 'direct',
          category: item.category || 'client',
          ownerId: item.ownerId || item.owner_id || "",
          unreadCount: item.unreadCount || item.unread_count || {}
        })) as Conversation[];
        dataCache[cacheKey] = mapped;
        callback(mapped);
      }
    } catch (err) {
      console.warn("[lib/db/chat] subscribeToConversations error, maintaining stale data:", err);
      if (dataCache[cacheKey]) callback(dataCache[cacheKey]);
    }
  };

  fetchConversations();
  const subscription = createRealtimeChannel('conversations', fetchConversations);
  // Polling de segurança de 30 segundos (o canal Realtime WebSocket já notifica em tempo real)
  const poll = createVisibilityAwarePoll(fetchConversations, 30000);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export function subscribeToMessages(conversationId: string, callback: (messages: ChatMessage[]) => void) {
  const cacheKey = `messages:${conversationId}`;
  if (dataCache[cacheKey]) callback(dataCache[cacheKey]);

  const fetchMessages = async () => {
    try {
      const data = await apiFetch(`/api/messages?conversationId=${conversationId}`, { bypassCache: true });
      if (data && Array.isArray(data)) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          conversationId: item.conversation_id,
          senderId: item.sender_id,
          content: item.content,
          type: item.type,
          fileName: item.file_name,
          fileUrl: item.file_url,
          createdAt: item.created_at,
          ownerId: item.owner_id
        })) as ChatMessage[];
        dataCache[cacheKey] = mapped;
        callback(mapped);
      }
    } catch (err) {
      console.warn("[lib/db/chat] subscribeToMessages error, maintaining stale data:", err);
      if (dataCache[cacheKey]) callback(dataCache[cacheKey]);
    }
  };

  fetchMessages();
  const subscription = createRealtimeChannel('messages', fetchMessages, `conversation_id=eq.${conversationId}`);
  // Polling de segurança de 15 segundos (Realtime já entrega novas mensagens instantaneamente)
  const poll = createVisibilityAwarePoll(fetchMessages, 15000);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function sendChatMessage(conversationId: string, content: string, type: 'text' | 'image' | 'file' = 'text', fileData?: { name?: string, url?: string }) {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const messageData = {
    conversation_id: conversationId,
    sender_id: user.id,
    content,
    type,
    file_name: fileData?.name,
    file_url: fileData?.url,
    owner_id: user.id
  };

  try {
    const result = await apiFetch('/api/messages', {
      method: "POST",
      body: JSON.stringify(messageData)
    });

    const conv = await apiFetch(`/api/conversations?id=${conversationId}`);
    
    const updateData: any = {
      last_message: content,
      last_message_at: new Date().toISOString()
    };

    if (conv) {
      const unreadCount = conv.unread_count || conv.unreadCount || {};
      const participants = Array.isArray(conv.participants) ? conv.participants : [];
      participants.forEach((pId: string) => {
        if (pId !== user.id) {
          unreadCount[pId] = (unreadCount[pId] || 0) + 1;
        }
      });
      updateData.unread_count = unreadCount;
    }

    await apiFetch(`/api/conversations?id=${conversationId}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });

    invalidateApiCache('/api/messages');
    invalidateApiCache('/api/conversations');
    delete dataCache[`messages:${conversationId}`];
    forceDataResync();

    return result.id;
  } catch (err) {
    console.error("[lib/db/chat] sendChatMessage FATAL:", err);
    throw err;
  }
}

export async function markAsRead(conversationId: string) {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) return;

  try {
    const conv = await apiFetch(`/api/conversations?id=${conversationId}`);
    const unreadObj = conv?.unread_count || conv?.unreadCount;
    
    if (conv && unreadObj && (unreadObj[user.id] || 0) > 0) {
      const newUnreadCount = { ...unreadObj };
      newUnreadCount[user.id] = 0;

      await apiFetch(`/api/conversations?id=${conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ unread_count: newUnreadCount })
      });

      invalidateApiCache('/api/conversations');
      forceDataResync();
    }
  } catch (err) {
    console.error("[lib/db/chat] markAsRead error:", err);
  }
}

let cachedTotalUnread: number | null = null;

export function subscribeToTotalUnreadMessages(callback: (count: number) => void) {
  if (cachedTotalUnread !== null) {
    callback(cachedTotalUnread);
  }

  const fetchTotalUnread = async () => {
    try {
      const session = await getSafeSession();
      const user = session?.user;
      if (!user) {
        cachedTotalUnread = 0;
        callback(0);
        return;
      }

      const data = await apiFetch(`/api/conversations?ownerId=${user.id}`);
      if (data && Array.isArray(data)) {
        const total = data.reduce((acc, conv) => {
          const unreadObj = conv?.unread_count || conv?.unreadCount || {};
          return acc + (unreadObj[user.id] || 0);
        }, 0);
        cachedTotalUnread = total;
        callback(total);
      }
    } catch (err) {
      console.error("[lib/db/chat] subscribeToTotalUnreadMessages error:", err);
    }
  };

  fetchTotalUnread();
  const subscription = createRealtimeChannel('conversations', fetchTotalUnread);
  const poll = createVisibilityAwarePoll(fetchTotalUnread, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createConversation(participants: string[], category: 'client' | 'team', details: Record<string, any>) {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const conversationData = {
    participants,
    participant_details: details,
    type: participants.length > 2 ? 'group' : 'direct',
    category,
    owner_id: user.id,
    last_message_at: new Date().toISOString(),
    unread_count: {}
  };

  try {
    const result = await apiFetch('/api/conversations', {
      method: "POST",
      body: JSON.stringify(conversationData)
    });
    return result.id;
  } catch (err) {
    console.error("[lib/db/chat] createConversation FATAL:", err);
    throw err;
  }
}

export async function deleteChatMessage(id: string) {
  try {
    await apiFetch(`/api/messages?id=${id}`, {
      method: "DELETE"
    });
    return true;
  } catch (err) {
    console.error("[lib/db/chat] deleteChatMessage FATAL:", err);
    throw err;
  }
}

export async function deleteConversation(id: string) {
  try {
    await apiFetch(`/api/conversations?id=${id}`, {
      method: "DELETE"
    });
    return true;
  } catch (err) {
    console.error("[lib/db/chat] deleteConversation FATAL:", err);
    throw err;
  }
}

export async function findOrCreateConversation(participantId: string, category: 'client' | 'team', partnerDetails: any) {
  const session = await getSafeSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  try {
    const existing = await apiFetch(`/api/conversations?category=${category}&ownerId=${user.id}`);

    if (existing && Array.isArray(existing) && existing.length > 0) {
      const exactMatch = existing.find(c => {
        const parts = Array.isArray(c?.participants) ? c.participants : [];
        return parts.length === 2 && 
               parts.includes(participantId) && 
               parts.includes(user.id);
      });
      if (exactMatch) return exactMatch.id;
    }

    const profile = await getUserProfile(user.id);

    const details = {
      [user.id]: {
        name: profile?.displayName || user.email || "Usuário",
        email: user.email || "",
        photoURL: profile?.photoURL || null
      },
      [participantId]: {
        name: partnerDetails.name || partnerDetails.displayName,
        email: partnerDetails.email,
        photoURL: partnerDetails.photoURL || null
      }
    };

    return createConversation([user.id, participantId], category, details);
  } catch (err) {
    console.error("[lib/db/chat] findOrCreateConversation FATAL:", err);
    throw err;
  }
}
