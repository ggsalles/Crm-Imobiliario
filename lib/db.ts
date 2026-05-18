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

export interface UserProfile {
  id: string; // id in profiles table
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'Membro' | 'Admin';
  userType: 'funcionário' | 'cliente';
  isAdmin?: boolean;
}

// Helper para subscrições resilientes
function createRealtimeChannel(tableName: string, callback: () => void, filter?: string, channelPrefix = 'public') {
  const channelName = `${channelPrefix}:${tableName}:${Math.random().toString(36).substring(7)}`;
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
        // Only retry if not already trying to join
        if (channel.state !== 'joining' && channel.state !== 'joined') {
          setTimeout(() => {
            if (channel.state !== 'joining' && channel.state !== 'joined') {
              channel.subscribe();
            }
          }, 5000);
        }
      }
    });

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
  let lastValidData: Contact[] | null = null;
  const fetchContacts = async () => {
    try {
      const data = await getContacts(ownerId);
      if (data && Array.isArray(data) && (data.length > 0 || !lastValidData)) {
        lastValidData = data;
        callback(data);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToContacts error, maintaining stale data:", err);
      // Não limpa o estado em caso de erro temporário
    }
  };

  fetchContacts();
  const subscription = createRealtimeChannel('contacts', fetchContacts);

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function createContact(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
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
  let lastValidData: Company[] | null = null;
  const fetchCompanies = async () => {
    try {
      const data = await getCompanies(ownerId);
      if (data && Array.isArray(data) && (data.length > 0 || !lastValidData)) {
        lastValidData = data;
        callback(data);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToCompanies error, maintaining stale data:", err);
    }
  };

  fetchCompanies();
  const subscription = createRealtimeChannel('companies', fetchCompanies);

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function createCompany(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
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
  let lastValidData: Deal[] | null = null;
  const fetchDeals = async () => {
    try {
      const data = await getDeals(ownerId);
      if (data && Array.isArray(data) && (data.length > 0 || !lastValidData)) {
        lastValidData = data;
        callback(data);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToDeals error, maintaining stale data:", err);
    }
  };

  fetchDeals();
  const subscription = createRealtimeChannel('deals', fetchDeals);

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function createDeal(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const dealData = {
    title: data.title,
    value: data.value,
    stage: data.stage,
    company_id: data.companyId || null,
    contact_id: data.contactId || null,
    property_id: data.propertyId || null,
    owner_id: data.ownerId || user.id
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
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.value !== undefined) updateData.value = data.value;
  if (data.stage !== undefined) updateData.stage = data.stage;
  if (data.companyId !== undefined) updateData.company_id = data.companyId || null;
  if (data.contactId !== undefined) updateData.contact_id = data.contactId || null;
  if (data.propertyId !== undefined) updateData.property_id = data.propertyId || null;
  if (data.ownerId !== undefined) updateData.owner_id = data.ownerId || null;

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
  let lastValidData: Goal[] | null = null;
  const fetchGoals = async () => {
    try {
      const data = await getGoals(ownerId);
      if (data && Array.isArray(data) && (data.length > 0 || !lastValidData)) {
        lastValidData = data;
        callback(data);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToGoals error, maintaining stale data:", err);
    }
  };

  fetchGoals();
  const subscription = createRealtimeChannel('goals', fetchGoals);

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function setGoal(month: string, stageGoals: { [stageId: string]: number }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // First, check if a goal for this month and user already exists to get its ID
  const goals = await getGoals(user.id);
  const existingGoal = goals.find(g => g.month === month);

  const goalData: any = {
    month,
    stage_goals: stageGoals,
    owner_id: user.id,
    updated_at: new Date().toISOString()
  };

  if (existingGoal) {
    goalData.id = existingGoal.id;
  }

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
    return data as UserProfile;
  } catch (err) {
    console.error("[lib/db] getUserProfile FATAL:", err);
    return null;
  }
}

// User Profiles
export function subscribeToUsers(callback: (users: UserProfile[]) => void, ownerId?: string) {
  const fetchUsers = async () => {
    try {
      const data = await apiFetch('/api/profiles');
      let filtered = data as UserProfile[];
      if (ownerId) filtered = filtered.filter(u => u.id === ownerId);
      callback(filtered);
    } catch (err) {
      console.error("[lib/db] subscribeToUsers error:", err);
    }
  };

  fetchUsers();
  const subscription = createRealtimeChannel('profiles', fetchUsers);

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function updateUserProfile(id: string, data: any) {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.displayName !== undefined) updateData.display_name = data.displayName;
  if (data.photoURL !== undefined) updateData.photo_url = data.photoURL;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.userType !== undefined) updateData.user_type = data.userType;
  if (data.isAdmin !== undefined) updateData.is_admin = data.isAdmin;

  try {
    await apiFetch(`/api/profiles?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
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

export async function createUserProfile(data: { displayName: string; email: string; role: 'Membro' | 'Admin'; userType: 'funcionário' | 'cliente' }) {
  const tempId = crypto.randomUUID();
  
  const profileData = {
    id: tempId,
    display_name: data.displayName,
    email: data.email.toLowerCase(),
    role: data.role,
    user_type: data.userType,
    is_admin: data.role === 'Admin'
  };

  try {
    const result = await apiFetch('/api/profiles', {
      method: "POST",
      body: JSON.stringify(profileData)
    });
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
  let lastValidData: Activity[] | null = null;
  const fetchActivities = async () => {
    try {
      let url = `/api/activities`;
      if (ownerId) url += `?ownerId=${ownerId}`;
      const data = await apiFetch(url);
      if (data && Array.isArray(data) && (data.length > 0 || !lastValidData)) {
        lastValidData = data as Activity[];
        callback(lastValidData);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToActivities error, maintaining stale data:", err);
    }
  };

  fetchActivities();
  const subscription = createRealtimeChannel('activities', fetchActivities);

  return () => {
    supabase.removeChannel(subscription);
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
  const fetchEvents = async () => {
    try {
      let url = `/api/timeline?category=${category}&relatedId=${relatedId}`;
      if (ownerId) url += `&ownerId=${ownerId}`;
      const data = await apiFetch(url);
      callback(data as TimelineEvent[]);
    } catch (err) {
      console.error("[lib/db] subscribeToTimeline error:", err);
    }
  };

  fetchEvents();
  const subscription = createRealtimeChannel('timeline', fetchEvents);

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function createTimelineEvent(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
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

async function apiFetch(url: string, options: any = {}) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  
  let token: string | undefined;
  try {
    // Forward Supabase session token with a more generous timeout
    // and a retry for the session itself if it fails
    const getSessionWithRetry = async (retries = 2): Promise<any> => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout getting session")), 5000)
        );
        return await Promise.race([sessionPromise, timeoutPromise]);
      } catch (err) {
        if (retries > 0) return getSessionWithRetry(retries - 1);
        throw err;
      }
    };

    const { data: sessionData } = await getSessionWithRetry();
    token = sessionData?.session?.access_token;
  } catch (err) {
    console.warn("[apiFetch] Could not get session token, proceeding without it (check RLS):", err);
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  console.log(`[apiFetch] INICIANDO: ${options.method || 'GET'} ${url}`);
  
  let lastError: any;
  for (let i = 0; i < 3; i++) {
    try {
      // Renovação proativa da sessão no loop de tentativa
      let token: string | undefined;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        
        // Se estivermos em uma tentativa de erro, forçamos um refresh
        if (i > 0 || !sessionData?.session) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          token = refreshData?.session?.access_token;
        } else {
          token = sessionData?.session?.access_token;
        }
      } catch (sessionErr) {
        console.warn("[apiFetch] Erro ao obter sessão, tentando prosseguir:", sessionErr);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout as requested

      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      // Detecção de erro de autorização (401/403)
      if (response.status === 401 || response.status === 403) {
        console.warn(`[apiFetch] Erro de autorização (${response.status}) em ${url}. Forçando refresh e tentando novamente...`);
        await supabase.auth.refreshSession();
        throw new Error("AUTH_RETRY"); // Força a próxima iteração do loop i
      }

      if (!response.ok) {
        let errData: any;
        try {
          errData = await response.json();
        } catch {
          errData = { error: `HTTP ${response.status}` };
        }
        console.error(`[apiFetch] ERROR ${url}:`, errData);
        throw new Error(errData.error || `Erro na API: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (err: any) {
      lastError = err;
      const isTimeout = err.name === 'AbortError';
      const isAuthRetry = err.message === 'AUTH_RETRY';
      
      if (err.name === 'TypeError' || err.message.includes('fetch') || isTimeout || isAuthRetry) {
        console.warn(`[apiFetch] Tentativa ${i + 1} falhou para ${url}:`, err.message);
        await new Promise(r => setTimeout(r, Math.min(1000 * (i + 1), 3000)));
        continue;
      }
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
  let lastValidData: Property[] | null = null;
  const fetchProperties = async () => {
    try {
      const data = await getProperties(ownerId);
      if (data && Array.isArray(data) && (data.length > 0 || !lastValidData)) {
        lastValidData = data;
        callback(data);
      }
    } catch (e) {
      console.warn("[lib/db] subscribeToProperties error, maintaining stale data:", e);
    }
  };

  fetchProperties();
  const subscription = createRealtimeChannel('properties', fetchProperties);

  return () => {
    supabase.removeChannel(subscription);
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
    console.log("[lib/db] createProperty: SUCESSO. Novo ID:", result.id);
    return result.id;
  } catch (err) {
    console.error("[lib/db] createProperty FATAL:", err);
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
    console.log("[lib/db] updateProperty: Transação concluída com sucesso.");
    return id;
  } catch (err) {
    console.error(`[lib/db] updateProperty FATAL para o ID ${id}:`, err);
    throw err;
  }
}

export async function deleteProperty(id: string) {
  try {
    await apiFetch(`/api/properties?id=${id}`, {
      method: "DELETE"
    });
    return true;
  } catch (error) {
    console.error("[lib/db] Error in deleteProperty:", error);
    throw error;
  }
}


export async function getContact(id: string) {
  try {
    const data = await apiFetch(`/api/contacts?id=${id}`);
    return data as Contact;
  } catch (err) {
    console.error("[lib/db] getContact FATAL:", err);
    throw err;
  }
}

export async function getCompany(id: string) {
  try {
    const data = await apiFetch(`/api/companies?id=${id}`);
    return data as Company;
  } catch (err) {
    console.error("[lib/db] getCompany FATAL:", err);
    throw err;
  }
}

export async function getDeal(id: string) {
  try {
    const data = await apiFetch(`/api/deals?id=${id}`);
    return data as Deal;
  } catch (err) {
    console.error("[lib/db] getDeal FATAL:", err);
    throw err;
  }
}
export function subscribeToConversations(category: 'client' | 'team', callback: (conversations: Conversation[]) => void, ownerId?: string) {
  let lastValidData: Conversation[] | null = null;
  const fetchConversations = async () => {
    try {
      let url = `/api/conversations?category=${category}`;
      if (ownerId) url += `&ownerId=${ownerId}`;
      const data = await apiFetch(url);
      if (data && Array.isArray(data) && (data.length > 0 || !lastValidData)) {
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
        lastValidData = mapped;
        callback(mapped);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToConversations error, maintaining stale data:", err);
    }
  };

  fetchConversations();
  const subscription = createRealtimeChannel('conversations', fetchConversations);

  return () => {
    supabase.removeChannel(subscription);
  };
}

export function subscribeToMessages(conversationId: string, callback: (messages: ChatMessage[]) => void) {
  let lastValidData: ChatMessage[] | null = null;
  const fetchMessages = async () => {
    try {
      const data = await apiFetch(`/api/messages?conversationId=${conversationId}`);
      if (data && Array.isArray(data) && (data.length > 0 || !lastValidData)) {
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
        lastValidData = mapped;
        callback(mapped);
      }
    } catch (err) {
      console.warn("[lib/db] subscribeToMessages error, maintaining stale data:", err);
    }
  };

  fetchMessages();
  const subscription = createRealtimeChannel('messages', fetchMessages, `conversation_id=eq.${conversationId}`);

  return () => {
    supabase.removeChannel(subscription);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      callback(0);
      return;
    }

    try {
      const data = await apiFetch(`/api/conversations?ownerId=${user.id}`);
      if (data) {
        const total = (data as any[]).reduce((acc, conv) => {
          return acc + (conv.unread_count?.[user.id] || 0);
        }, 0);
        callback(total);
      }
    } catch (err) {
      console.error("[lib/db] subscribeToTotalUnreadMessages error:", err);
      callback(0);
    }
  };

  fetchTotalUnread();
  const subscription = createRealtimeChannel('conversations', fetchTotalUnread);

  return () => {
    supabase.removeChannel(subscription);
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

export async function uploadFile(file: File, bucketName: string = 'property-images') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${user.id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      upsert: true,
      cacheControl: '3600'
    });

  if (uploadError) {
    console.error(`[Storage] Error uploading to "${bucketName}":`, uploadError);
    // If bucket doesn't exist, try 'images' bucket as fallback
    if (uploadError.message.includes('bucket not found') && bucketName !== 'images') {
      return uploadFile(file, 'images');
    }
    throw uploadError;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return { name: file.name, url: publicUrl };
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
