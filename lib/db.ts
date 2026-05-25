import { supabase } from './supabase';

export interface Company {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Property {
  id: string;
  title: string;
  type: 'casa' | 'apartamento' | 'terreno' | 'comercial' | 'sítio' | 'chácara' | 'fazenda' | 'sobrado' | 'cobertura' | 'outros';
  status: 'disponível' | 'reservado' | 'vendido' | 'alugado';
  price: number;
  location: string;
  cep?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  number?: string;
  complement?: string;
  area: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpots?: number;
  acceptsFinancing?: boolean;
  notes?: string;
  description?: string;
  imageUrls?: string[];
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  companyId?: string;
  contactId?: string;
  propertyId?: string;
  probability?: number;
  status?: string;
  expectedCloseDate?: string;
  priority?: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  type: 'cliente' | 'equipe';
  department?: string;
  companyId?: string;
  source?: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Goal {
  id: string;
  month: string;
  revenue?: number;
  stageGoals: { [stageId: string]: number };
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Activity {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: 'call' | 'meeting' | 'email' | 'task' | 'other';
  status: 'pending' | 'completed';
  contactId?: string;
  dealId?: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TimelineEvent {
  id: string;
  type: 'system' | 'note';
  category: 'contact' | 'deal' | 'company';
  relatedId: string;
  content: string;
  title?: string;
  authorName?: string;
  ownerId: string;
  createdBy: string;
  createdAt?: string;
  metadata?: any;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantDetails: Record<string, {
    name: string;
    photoURL?: string;
    email: string;
  }>;
  lastMessage?: string;
  lastMessageAt?: string;
  type: 'direct' | 'group';
  category: 'client' | 'team';
  ownerId: string;
  unreadCount?: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file';
  fileName?: string;
  fileUrl?: string;
  createdAt?: string;
  ownerId: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string; // id in profiles table
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'Membro' | 'Admin';
  userType: 'funcionário' | 'cliente';
  isAdmin?: boolean;
  tenantId?: string;
  tenantIds?: string[];
}

// Constants
const POLL_INTERVAL = 45000; // 45 seconds for better responsiveness
const RESYNC_EVENT = 'db-force-resync';

// Cache global para evitar que dados sumam durante re-subscriptions ou hibernação
const dataCache: Record<string, any> = {};

// Helper to wake up the app and force data refresh
export function forceDataResync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RESYNC_EVENT));
  }
}

// Clear the global in-memory client cache
export function clearLocalCache() {
  console.log("[lib/db] Clearing global dataCache object...");
  for (const key in dataCache) {
    delete dataCache[key];
  }
}

// Auto-resync listeners
if (typeof window !== 'undefined') {
  const onWakeUp = () => {
    if (document.visibilityState === 'visible') {
      console.log("[lib/db] Tab active, triggering global resync...");
      forceDataResync();
    }
  };
  window.addEventListener('visibilitychange', onWakeUp);
  window.addEventListener('online', forceDataResync);
}

// Helper para subscrições resilientes
function createRealtimeChannel(tableName: string, callback: () => void, filter?: string, channelPrefix = 'public') {
  const channelName = `${channelPrefix}:${tableName}:${Math.random().toString(36).substring(7)}`;
  
  // Resync on event
  if (typeof window !== 'undefined') {
    window.addEventListener(RESYNC_EVENT, callback);
  }

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: tableName, filter }, () => {
      console.log(`[Realtime] Mudança detectada em ${tableName}${filter ? ` (${filter})` : ''}, atualizando...`);
      callback();
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Inscrito com sucesso em ${tableName} (${channelName})`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[Realtime] Erro/Timeout em ${tableName} (${status}), tentando reconectar...`);
        if (typeof window !== 'undefined') {
          setTimeout(() => channel.subscribe(), 3000);
        }
      }
    });

  // Attach a cleanup method if needed (not standard for Supabase channel but useful for us)
  (channel as any)._customCleanup = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(RESYNC_EVENT, callback);
    }
  };

  return channel;
}

// Contacts
export async function getContacts(ownerId?: string) {
  try {
    let url = `/api/contacts`;
    if (ownerId) url += `?ownerId=${ownerId}`;
    const data = await apiFetch(url);
    return data as Contact[];
  } catch (err) {
    console.error("[lib/db] getContacts FATAL:", err);
    return [];
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
        callback(data);
      } else if (!dataCache[cacheKey]) {
        callback([]); 
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToContacts error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]); 
      }
    }
  };

  fetchContacts();
  const subscription = createRealtimeChannel('contacts', fetchContacts);
  const poll = setInterval(fetchContacts, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createContact(data: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const contactData = {
    name: data.name,
    role: data.role,
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
    console.error("[lib/db] createContact FATAL:", err);
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

  try {
    await apiFetch(`/api/contacts?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
  } catch (err) {
    console.error("[lib/db] updateContact FATAL:", err);
    throw err;
  }
}

export async function deleteContact(id: string) {
  try {
    const result = await apiFetch(`/api/contacts?id=${id}`, {
      method: "DELETE"
    });
    return result.deleted;
  } catch (err) {
    console.error("[lib/db] deleteContact FATAL:", err);
    throw err;
  }
}

// Companies
export async function getCompanies(ownerId?: string) {
  try {
    let url = `/api/companies`;
    if (ownerId) url += `?ownerId=${ownerId}`;
    const data = await apiFetch(url);
    return data as Company[];
  } catch (err) {
    console.error("[lib/db] getCompanies FATAL:", err);
    return [];
  }
}

export function subscribeToCompanies(callback: (companies: Company[]) => void, ownerId?: string) {
  const cacheKey = `companies:${ownerId || 'all'}`;
  // Only use cache if it actually has data
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) {
    callback(dataCache[cacheKey]);
  }

  const fetchCompanies = async () => {
    try {
      const data = await getCompanies(ownerId);
      if (data && Array.isArray(data)) {
        dataCache[cacheKey] = data;
        callback(data);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToCompanies error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchCompanies();
  const subscription = createRealtimeChannel('companies', fetchCompanies);
  const poll = setInterval(fetchCompanies, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createCompany(data: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const companyData = {
    name: data.name,
    industry: data.industry,
    website: data.website,
    owner_id: user.id
  };

  try {
    const result = await apiFetch('/api/companies', {
      method: "POST",
      body: JSON.stringify(companyData)
    });
    return result.id;
  } catch (err) {
    console.error("[lib/db] createCompany FATAL:", err);
    throw err;
  }
}

export async function updateCompany(id: string, data: any) {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.industry !== undefined) updateData.industry = data.industry;
  if (data.website !== undefined) updateData.website = data.website;

  try {
    await apiFetch(`/api/companies?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
  } catch (err) {
    console.error("[lib/db] updateCompany FATAL:", err);
    throw err;
  }
}

export async function deleteCompany(id: string) {
  try {
    await apiFetch(`/api/companies?id=${id}`, {
      method: "DELETE"
    });
  } catch (err) {
    console.error("[lib/db] deleteCompany FATAL:", err);
    throw err;
  }
}

// Deals
export async function getDeals(ownerId?: string) {
  try {
    let url = `/api/deals`;
    if (ownerId) url += `?ownerId=${ownerId}`;
    const data = await apiFetch(url);
    return data as Deal[];
  } catch (err) {
    console.error("[lib/db] getDeals FATAL:", err);
    return [];
  }
}

export async function getDealsByContact(contactId: string) {
  try {
    const data = await apiFetch(`/api/deals?contactId=${contactId}`);
    return data as Deal[];
  } catch (err) {
    console.error("[lib/db] getDealsByContact FATAL:", err);
    return [];
  }
}

export function subscribeToDeals(callback: (deals: Deal[]) => void, ownerId?: string) {
  const cacheKey = `deals:${ownerId || 'all'}`;
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) callback(dataCache[cacheKey]);

  const fetchDeals = async () => {
    try {
      const data = await getDeals(ownerId);
      if (data && Array.isArray(data)) {
        dataCache[cacheKey] = data;
        callback(data);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToDeals error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchDeals();
  const subscription = createRealtimeChannel('deals', fetchDeals);
  const poll = setInterval(fetchDeals, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createDeal(data: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const sanitizeId = (id: any) => (id && id !== 'undefined' && id !== 'null') ? id : null;

  const dealData = {
    title: data.title,
    value: Number(data.value) || 0,
    stage: data.stage,
    company_id: sanitizeId(data.companyId),
    contact_id: sanitizeId(data.contactId),
    property_id: sanitizeId(data.propertyId),
    owner_id: sanitizeId(data.ownerId) || user.id
  };

  try {
    const result = await apiFetch('/api/deals', {
      method: "POST",
      body: JSON.stringify(dealData)
    });
    return result.id;
  } catch (err) {
    console.error("[lib/db] createDeal FATAL:", err);
    throw err;
  }
}

export async function updateDeal(id: string, data: any) {
  if (!id || id === 'undefined' || id === 'null') {
    console.warn("[lib/db] updateDeal: Invalid ID, ignoring update request.", id);
    return;
  }

  const updateData: any = { updated_at: new Date().toISOString() };
  const sanitizeId = (val: any) => (val && val !== 'undefined' && val !== 'null') ? val : null;

  if (data.title !== undefined) updateData.title = data.title;
  if (data.value !== undefined) updateData.value = Number(data.value) || 0;
  if (data.stage !== undefined) updateData.stage = data.stage;
  if (data.companyId !== undefined) updateData.company_id = sanitizeId(data.companyId);
  if (data.contactId !== undefined) updateData.contact_id = sanitizeId(data.contactId);
  if (data.propertyId !== undefined) updateData.property_id = sanitizeId(data.propertyId);
  if (data.ownerId !== undefined) updateData.owner_id = sanitizeId(data.ownerId);

  try {
    await apiFetch(`/api/deals?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
  } catch (err) {
    console.error("[lib/db] updateDeal FATAL:", err);
    throw err;
  }
}

export async function deleteDeal(id: string) {
  if (!id || id === 'undefined' || id === 'null') {
    console.warn("[lib/db] deleteDeal: Invalid ID, ignoring delete request.", id);
    return;
  }
  try {
    await apiFetch(`/api/deals?id=${id}`, {
      method: "DELETE"
    });
  } catch (err) {
    console.error("[lib/db] deleteDeal FATAL:", err);
    throw err;
  }
}

// Goals
export async function getGoals(ownerId?: string) {
  try {
    let url = `/api/goals`;
    if (ownerId) url += `?ownerId=${ownerId}`;
    const data = await apiFetch(url);
    return data as Goal[];
  } catch (err) {
    console.error("[lib/db] getGoals FATAL:", err);
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
      console.warn("[lib/db] subscribeToGoals error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchGoals();
  const subscription = createRealtimeChannel('goals', fetchGoals);
  const poll = setInterval(fetchGoals, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function setGoal(month: string, stageGoals: { [stageId: string]: number }) {
  const { data: { session } } = await supabase.auth.getSession();
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
    console.error("[lib/db] setGoal FATAL:", err);
    throw err;
  }
}

export async function getUserProfile(id: string) {
  try {
    const data = await apiFetch(`/api/profiles?id=${id}`);
    if (Array.isArray(data)) return data[0] as UserProfile;
    return data as UserProfile;
  } catch (err) {
    console.error("[lib/db] getUserProfile FATAL:", err);
    return null;
  }
}

// User Profiles
export function subscribeToUsers(callback: (users: UserProfile[]) => void, ownerId?: string) {
  const cacheKey = `users:${ownerId || 'all'}`;
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) callback(dataCache[cacheKey]);

  const fetchUsers = async () => {
    try {
      const data = await apiFetch('/api/profiles');
      if (data && Array.isArray(data)) {
        let filtered = data as UserProfile[];
        if (ownerId) filtered = filtered.filter(u => u.id === ownerId);
        dataCache[cacheKey] = filtered;
        callback(filtered);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToUsers error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchUsers();
  const subscription = createRealtimeChannel('profiles', fetchUsers);
  const poll = setInterval(fetchUsers, POLL_INTERVAL);

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

  try {
    if (typeof window !== "undefined") {
      const cacheKey = `local-profile:${id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id === id) {
            if (data.displayName !== undefined) parsed.displayName = data.displayName;
            if (data.photoURL !== undefined) parsed.photoURL = data.photoURL;
            if (data.role !== undefined) parsed.role = data.role;
            if (data.userType !== undefined) parsed.userType = data.userType;
            if (data.isAdmin !== undefined) parsed.isAdmin = data.isAdmin;
            if (data.tenantId !== undefined) parsed.tenantId = data.tenantId;
            if (data.tenantIds !== undefined) parsed.tenantIds = data.tenantIds;
            localStorage.setItem(cacheKey, JSON.stringify(parsed));
          }
        } catch (e) {
          console.warn("[lib/db] Error updating local profile cache synchronously:", e);
        }
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
    console.error("[lib/db] updateUserProfile FATAL:", err);
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
    console.error("[lib/db] deleteUserProfile FATAL:", err);
    throw err;
  }
}

export async function isEmailRegistered(email: string) {
  try {
    const data = await apiFetch(`/api/profiles?email=${email}`);
    return !!data;
  } catch (err) {
    console.error("[lib/db] isEmailRegistered error:", err);
    return false;
  }
}

export async function createUserProfile(data: { displayName: string; email: string; role: 'Membro' | 'Admin'; userType: 'funcionário' | 'cliente'; tenantId?: string; tenantIds?: string[] }) {
  const tempId = crypto.randomUUID();
  
  const profileData = {
    id: tempId,
    display_name: data.displayName,
    email: data.email.toLowerCase(),
    role: data.role,
    user_type: data.userType,
    is_admin: data.role === 'Admin',
    tenant_id: data.tenantId || null,
    tenantIds: data.tenantIds || (data.tenantId ? [data.tenantId] : ["11111111-1111-1111-1111-111111111111"])
  };

  try {
    const result = await apiFetch('/api/profiles', {
      method: "POST",
      body: JSON.stringify(profileData)
    });
    forceDataResync();
    return result.id;
  } catch (err) {
    console.error("[lib/db] createUserProfile FATAL:", err);
    throw err;
  }
}

// Activities
export async function getActivitiesByContact(contactId: string) {
  try {
    const data = await apiFetch(`/api/activities?contactId=${contactId}`);
    return data as Activity[];
  } catch (err) {
    console.error("[lib/db] getActivitiesByContact FATAL:", err);
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
        callback(result);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToActivities error, maintaining stale data:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchActivities();
  const subscription = createRealtimeChannel('activities', fetchActivities);
  const poll = setInterval(fetchActivities, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createActivity(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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

  try {
    const result = await apiFetch('/api/activities', {
      method: "POST",
      body: JSON.stringify(activityData)
    });
    return result.id;
  } catch (err) {
    console.error("[lib/db] createActivity FATAL:", err);
    throw err;
  }
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
    console.error("[lib/db] updateActivity FATAL:", err);
    throw err;
  }
}

export async function deleteActivity(id: string) {
  try {
    await apiFetch(`/api/activities?id=${id}`, {
      method: "DELETE"
    });
  } catch (err) {
    console.error("[lib/db] deleteActivity FATAL:", err);
    throw err;
  }
}

// Timeline
export function subscribeToTimeline(category: string, relatedId: string, callback: (events: TimelineEvent[]) => void, ownerId?: string) {
  const cacheKey = `timeline:${category}:${relatedId}:${ownerId || 'all'}`;
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) callback(dataCache[cacheKey]);

  const fetchEvents = async () => {
    try {
      let url = `/api/timeline?category=${category}&relatedId=${relatedId}`;
      if (ownerId) url += `&ownerId=${ownerId}`;
      const data = await apiFetch(url);
      if (data && Array.isArray(data)) {
        const events = data as TimelineEvent[];
        dataCache[cacheKey] = events;
        callback(events);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToTimeline error:", err);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchEvents();
  const subscription = createRealtimeChannel('timeline', fetchEvents, `related_id=eq.${relatedId}`);
  const poll = setInterval(fetchEvents, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createTimelineEvent(data: any) {
  const { data: { session } } = await supabase.auth.getSession();
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
    console.error("[lib/db] createTimelineEvent FATAL:", err);
    throw err;
  }
}

// Properties

/**
 * Utilitário de timeout para operações do Supabase
 */
async function winTimeout<T>(promise: Promise<T>, ms: number = 60000, label: string = "Operação"): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`TIMEOUT_DB: A operação no banco (${label}) excedeu ${ms}ms.`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

let isPageUnloading = false;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    isPageUnloading = true;
    // Se o unload for abortado ou interceptado por soft-routing, recuperamos o estado em 2s
    setTimeout(() => {
      isPageUnloading = false;
    }, 2000);
  });
}

const inFlightRequests = new Map<string, Promise<any>>();
let activeRefreshPromise: Promise<any> | null = null;

async function getRefreshedSession() {
  if (activeRefreshPromise) {
    console.log("[apiFetch] Waiting for concurrent refreshSession to complete...");
    return activeRefreshPromise;
  }
  
  activeRefreshPromise = (async () => {
    try {
      console.log("[apiFetch] Performing single-coalesced refreshSession...");
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      return data.session;
    } catch (e: any) {
      console.error("[apiFetch] refreshSession failed:", e.message || e);
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();
  
  return activeRefreshPromise;
}

export async function apiFetch(url: string, options: any = {}): Promise<any> {
  const isServer = typeof window === 'undefined';
  const method = (options.method || 'GET').toUpperCase();
  
  // Deduplicate client-side concurrent GET requests to avoid HTTP 429 and timeouts
  if (method === 'GET' && !isServer) {
    const cacheKey = url;
    if (inFlightRequests.has(cacheKey)) {
      console.log(`[apiFetch] Concurrent GET merged for url: ${url}`);
      return inFlightRequests.get(cacheKey)!;
    }
    
    const promise = apiFetchImpl(url, options).finally(() => {
      inFlightRequests.delete(cacheKey);
    });
    
    inFlightRequests.set(cacheKey, promise);
    return promise;
  }
  
  return apiFetchImpl(url, options);
}

async function apiFetchImpl(url: string, options: any = {}) {
  const isServer = typeof window === 'undefined';
  const timestamp = new Date().toISOString();
  
  const fullUrl = url;
  
  console.log(`[apiFetch] [${timestamp}] ${options.method || 'GET'} ${url}`);
  
  let lastError: any;
  const maxRetries = 1; // Only 1 retry to fail fast and prevent browser freeze appearance
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      // Sessão rápida
      let token = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      } catch (e) {
        console.warn("[apiFetch] Erro ao recuperar sessão:", e);
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
 
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
 
      const controller = new AbortController();
      const timeoutValue = options.timeout || 10000; // 10s timeout instead of 30s
      const timeoutId = setTimeout(() => controller.abort(), timeoutValue);
 
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
 
      if (response.status === 401 || response.status === 403) {
        if (!isServer) {
          console.warn("[apiFetch] Sessão possivelmente expirada (401/403), tentando refresh...");
          const refreshed = await getRefreshedSession();
          if (!refreshed) {
            window.dispatchEvent(new CustomEvent('app-session-expired'));
            throw new Error("Sessão expirada.");
          }
          continue; // Tenta novamente com o novo token
        }
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
      if (typeof window !== 'undefined' && (isPageUnloading || window.closed)) {
        console.log(`[apiFetch] Page is unloading or tab is closing. Silencing fetch error for ${url}.`);
        return new Promise(() => {}); // never resolving promise to keep React lifecycle quiet during unload
      }
      lastError = err;
      
      const isNetworkError = err.message === 'Failed to fetch' || err.name === 'TypeError';
      const isTimeout = err.name === 'AbortError';

      if ((isNetworkError || isTimeout) && i < maxRetries) {
        console.warn(`[apiFetch] Falha na tentativa ${i+1} para ${url}: ${err.message}. Retentando em 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      console.error(`[apiFetch] Erro fatal em ${url}:`, err);
      throw err;
    }
  }
  throw lastError;
}

export async function getProperties(ownerId?: string) {
  const startTime = Date.now();
  console.log("[lib/db] getProperties: Buscando imóveis via API Proxy...");
  
  try {
    let url = `/api/properties`;
    if (ownerId) url += `?ownerId=${ownerId}`;
    
    const data = await apiFetch(url);
    console.log(`[lib/db] getProperties concluído em ${Date.now() - startTime}ms`);
    return data as Property[];
  } catch (err: any) {
    console.error("[lib/db] getProperties FATAL:", err);
    throw err;
  }
}

export function subscribeToProperties(callback: (properties: Property[]) => void, ownerId?: string) {
  const cacheKey = `properties:${ownerId || 'all'}`;
  if (dataCache[cacheKey] && dataCache[cacheKey].length > 0) callback(dataCache[cacheKey]);

  const fetchProperties = async () => {
    try {
      const data = await getProperties(ownerId);
      if (data && Array.isArray(data)) {
        dataCache[cacheKey] = data;
        callback(data);
      } else if (!dataCache[cacheKey]) {
        callback([]);
      }
    } catch (e) {
      console.warn("[lib/db] subscribeToProperties error:", e);
      if (dataCache[cacheKey]) {
        callback(dataCache[cacheKey]);
      } else {
        callback([]);
      }
    }
  };

  fetchProperties();
  const subscription = createRealtimeChannel('properties', fetchProperties);
  const poll = setInterval(fetchProperties, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

/**
 * Higieniza dados para evitar problemas com Proxies do React ou tipos complexos
 */
function sanitizePropertyData(data: any, userId: string) {
  const sanitized = {
    title: String(data.title || "").substring(0, 500),
    type: String(data.type || "apartamento"),
    status: String(data.status || "disponível"),
    price: Number(data.price || 0),
    location: String(data.location || "").substring(0, 1000),
    cep: String(data.cep || "").substring(0, 20),
    street: String(data.street || "").substring(0, 500),
    neighborhood: String(data.neighborhood || "").substring(0, 500),
    city: String(data.city || "").substring(0, 500),
    state: String(data.state || "").substring(0, 10),
    number: String(data.number || "").substring(0, 50),
    complement: data.complement ? String(data.complement).substring(0, 1000) : null,
    area: Number(data.area || 0),
    bedrooms: Number(data.bedrooms || 0),
    bathrooms: Number(data.bathrooms || 0),
    parking_spots: Number(data.parkingSpots || 0),
    accepts_financing: Boolean(data.acceptsFinancing),
    notes: data.notes ? String(data.notes).substring(0, 5000) : null,
    description: data.description ? String(data.description).substring(0, 5000) : null,
    owner_id: userId
  };

  return { sanitized };
}

export async function createProperty(data: any, bypassUserId?: string) {
  const userId = bypassUserId;
  if (!userId) throw new Error("Usuário não identificado.");
  
  console.log("[lib/db] createProperty: Iniciando processo de higienização...");
  const { sanitized } = sanitizePropertyData(data, userId);
  
  let cleanImageUrls: string[] = [];
  if (Array.isArray(data.imageUrls)) {
    cleanImageUrls = data.imageUrls.map((u: any) => String(u || '').trim()).filter((u: string) => u.length > 0);
  }

  // Refatoração image_url: Enviamos a primeira URL como string simples para compatibilidade
  const primaryImageUrl = cleanImageUrls.length > 0 ? cleanImageUrls[0] : "";

  const insertData = { 
    ...sanitized, 
    image_url: primaryImageUrl, 
    imageUrls: cleanImageUrls
  };

  try {
    console.log("[lib/db] createProperty: Enviando payload ao servidor via API Proxy...", insertData);
    const result = await apiFetch('/api/properties', {
      method: "POST",
      body: JSON.stringify(insertData)
    });
    console.log("[lib/db] createProperty Proxy: SUCESSO. Novo ID:", result.id);
    return result.id;
  } catch (err) {
    console.error("[lib/db] createProperty Proxy FATAL:", err);
    throw err;
  }
}

export async function updateProperty(id: string, data: any, bypassUserId?: string) {
  if (!id) throw new Error("ID do imóvel é obrigatório.");
  const userId = bypassUserId;
  if (!userId) throw new Error("Usuário não identificado.");

  console.log(`[lib/db] updateProperty: Iniciando atualização para o ID: ${id}`);
  const { sanitized } = sanitizePropertyData(data, userId);

  let cleanImageUrls: string[] = [];
  if (Array.isArray(data.imageUrls)) {
    cleanImageUrls = data.imageUrls.map((u: any) => String(u || '').trim()).filter((u: string) => u.length > 0);
  }

  // Refatoração image_url: Enviamos a primeira URL como string simples para compatibilidade
  const primaryImageUrl = cleanImageUrls.length > 0 ? cleanImageUrls[0] : "";

  const updateData = {
    ...sanitized,
    image_url: primaryImageUrl,
    updated_at: new Date().toISOString(),
    imageUrls: cleanImageUrls
  };

  try {
    console.log(`[lib/db] updateProperty: Enviando atualização via API Proxy...`, updateData);
    await apiFetch(`/api/properties?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
    console.log("[lib/db] updateProperty Proxy: Transação concluída com sucesso.");
    return id;
  } catch (err) {
    console.error(`[lib/db] updateProperty Proxy FATAL para o ID ${id}:`, err);
    throw err;
  }
}

export async function deleteProperty(id: string) {
  console.log(`[lib/db] deleteProperty: Removendo ID: ${id}`);
  
  try {
    await apiFetch(`/api/properties?id=${id}`, {
      method: "DELETE"
    });
    return true;
  } catch (error) {
    console.error("[lib/db] Error in deleteProperty Proxy:", error);
    throw error;
  }
}


export async function getContact(id: string) {
  try {
    const data = await apiFetch(`/api/contacts?id=${id}`);
    if (Array.isArray(data)) return data[0] as Contact;
    return data as Contact;
  } catch (err) {
    console.error("[lib/db] getContact FATAL:", err);
    throw err;
  }
}

export async function getCompany(id: string) {
  try {
    const data = await apiFetch(`/api/companies?id=${id}`);
    if (Array.isArray(data)) return data[0] as Company;
    return data as Company;
  } catch (err) {
    console.error("[lib/db] getCompany FATAL:", err);
    throw err;
  }
}

export async function getDeal(id: string) {
  if (!id || id === 'undefined' || id === 'null') return null;
  try {
    const data = await apiFetch(`/api/deals?id=${id}`);
    if (Array.isArray(data)) return data[0] as Deal;
    return data as Deal;
  } catch (err) {
    console.error("[lib/db] getDeal FATAL:", err);
    throw err;
  }
}
export function subscribeToConversations(category: 'client' | 'team', callback: (conversations: Conversation[]) => void, ownerId?: string) {
  const cacheKey = `conversations:${category}:${ownerId || 'all'}`;
  if (dataCache[cacheKey]) callback(dataCache[cacheKey]);

  const fetchConversations = async () => {
    try {
      let url = `/api/conversations?category=${category}`;
      if (ownerId) url += `&ownerId=${ownerId}`;
      const data = await apiFetch(url);
      if (data && Array.isArray(data)) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          participants: item.participants,
          participantDetails: item.participant_details,
          lastMessage: item.last_message,
          lastMessageAt: item.last_message_at,
          type: item.type,
          category: item.category,
          ownerId: item.owner_id,
          unreadCount: item.unread_count
        })) as Conversation[];
        dataCache[cacheKey] = mapped;
        callback(mapped);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToConversations error, maintaining stale data:", err);
      if (dataCache[cacheKey]) callback(dataCache[cacheKey]);
    }
  };

  fetchConversations();
  const subscription = createRealtimeChannel('conversations', fetchConversations);
  const poll = setInterval(fetchConversations, POLL_INTERVAL);

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
      const data = await apiFetch(`/api/messages?conversationId=${conversationId}`);
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
      console.warn("[lib/db] subscribeToMessages error, maintaining stale data:", err);
      if (dataCache[cacheKey]) callback(dataCache[cacheKey]);
    }
  };

  fetchMessages();
  const subscription = createRealtimeChannel('messages', fetchMessages, `conversation_id=eq.${conversationId}`);
  const poll = setInterval(fetchMessages, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function sendChatMessage(conversationId: string, content: string, type: 'text' | 'image' | 'file' = 'text', fileData?: { name?: string, url?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
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

    // Handle conversation update
    const conv = await apiFetch(`/api/conversations?id=${conversationId}`);
    
    const updateData: any = {
      last_message: content,
      last_message_at: new Date().toISOString()
    };

    if (conv) {
      const unreadCount = conv.unread_count || {};
      conv.participants.forEach((pId: string) => {
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

    return result.id;
  } catch (err) {
    console.error("[lib/db] sendChatMessage FATAL:", err);
    throw err;
  }
}

export async function markAsRead(conversationId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const conv = await apiFetch(`/api/conversations?id=${conversationId}`);
    
    if (conv && conv.unread_count && (conv.unread_count[user.id] || 0) > 0) {
      const newUnreadCount = { ...conv.unread_count };
      newUnreadCount[user.id] = 0;

      await apiFetch(`/api/conversations?id=${conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ unread_count: newUnreadCount })
      });
    }
  } catch (err) {
    console.error("[lib/db] markAsRead error:", err);
  }
}

export function subscribeToTotalUnreadMessages(callback: (count: number) => void) {
  const fetchTotalUnread = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        callback(0);
        return;
      }

      const data = await apiFetch(`/api/conversations?ownerId=${user.id}`);
      if (data && Array.isArray(data)) {
        const total = data.reduce((acc, conv) => {
          return acc + (conv.unread_count?.[user.id] || 0);
        }, 0);
        callback(total);
      }
    } catch (err) {
      console.error("[lib/db] subscribeToTotalUnreadMessages error:", err);
      // No re-throwing here to avoid breaking UI
    }
  };

  fetchTotalUnread();
  const subscription = createRealtimeChannel('conversations', fetchTotalUnread);
  const poll = setInterval(fetchTotalUnread, POLL_INTERVAL);

  return () => {
    supabase.removeChannel(subscription);
    if ((subscription as any)._customCleanup) (subscription as any)._customCleanup();
    clearInterval(poll);
  };
}

export async function createConversation(participants: string[], category: 'client' | 'team', details: Record<string, any>) {
  const { data: { user } } = await supabase.auth.getUser();
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
    console.error("[lib/db] createConversation FATAL:", err);
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
    console.error("[lib/db] deleteChatMessage FATAL:", err);
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
    console.error("[lib/db] deleteConversation FATAL:", err);
    throw err;
  }
}


export async function uploadFile(file: File, bucketName: string = 'property-images', bypassUserId?: string) {
  try {
    let userId = bypassUserId;

    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
      
      if (!userId) {
        console.warn("[Storage] No session found, trying getUser() as fallback...");
        const { data: { user: verifiedUser } } = await supabase.auth.getUser();
        userId = verifiedUser?.id;
      }
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucketName", bucketName);
    formData.append("userId", userId || "anonymous");

    console.log(`[Storage Client] Redirecionando upload de "${file.name}" para proxy de API local...`);
    
    let token: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || null;
    } catch (e) {
      console.warn("[Storage Client] Erro ao obter session token para upload:", e);
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch("/api/upload", {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorMsg = `Erro ${response.status}: ${response.statusText}`;
      try {
        const errData = await response.json();
        errorMsg = errData.error || errorMsg;
      } catch (e) {
        // Ignora erro se não for JSON
      }
      throw new Error(errorMsg);
    }

    const result = await response.json();
    return { name: result.name, url: result.url };
  } catch (err: any) {
    console.error("[Storage] Falha crítica no uploadFile através do Proxy:", err);
    throw err;
  }
}

export async function uploadChatFile(file: File) {
  return uploadFile(file, 'chat-attachments');
}

export async function downloadFile(url: string, fileName: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Error downloading file:", error);
    // Fallback to opening in new tab if fetch fails
    window.open(url, '_blank');
  }
}

export async function findOrCreateConversation(participantId: string, category: 'client' | 'team', partnerDetails: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check if conversation already exists
  try {
    const existing = await apiFetch(`/api/conversations?category=${category}&ownerId=${user.id}`);

    if (existing && Array.isArray(existing) && existing.length > 0) {
      // Verify it's exactly these two for direct chat
      const exactMatch = existing.find(c => 
        c.participants.length === 2 && 
        c.participants.includes(participantId) && 
        c.participants.includes(user.id)
      );
      if (exactMatch) return exactMatch.id;
    }

    // Get current profile for details
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
    console.error("[lib/db] findOrCreateConversation FATAL:", err);
    throw err;
  }
}

// ==========================================
// TENANT MANAGEMENT DB HELPERS
// ==========================================

export async function getTenants() {
  try {
    const data = await apiFetch('/api/tenants');
    const tenantsList = (data || []) as Tenant[];
    return tenantsList.map((t: any) => {
      if (t && t.id === "11111111-1111-1111-1111-111111111111") {
        return { ...t, name: "SalesScore" };
      }
      return t;
    });
  } catch (err) {
    console.error("[lib/db] getTenants FATAL:", err);
    return [];
  }
}

export async function createTenant(data: { name: string; slug?: string }) {
  try {
    const result = await apiFetch('/api/tenants', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    forceDataResync();
    return result as Tenant;
  } catch (err) {
    console.error("[lib/db] createTenant FATAL:", err);
    throw err;
  }
}

export async function updateTenant(id: string, data: Partial<Tenant>) {
  try {
    await apiFetch(`/api/tenants?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    forceDataResync();
    return true;
  } catch (err) {
    console.error("[lib/db] updateTenant FATAL:", err);
    throw err;
  }
}

export async function deleteTenant(id: string) {
  try {
    await apiFetch(`/api/tenants?id=${id}`, {
      method: 'DELETE'
    });
    forceDataResync();
    return true;
  } catch (err) {
    console.error("[lib/db] deleteTenant FATAL:", err);
    throw err;
  }
}
