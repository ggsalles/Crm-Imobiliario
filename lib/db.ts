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
  type: 'casa' | 'apartamento' | 'terreno' | 'comercial';
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

// Contacts
export async function getContacts(ownerId?: string) {
  try {
    let query = supabase.from('contacts').select('*').order('name', { ascending: true });
    if (ownerId) query = query.eq('owner_id', ownerId);
    const { data, error } = (await winTimeout(query as any, 30000, "fetch contacts")) as any;
    if (error) {
      console.error("[lib/db] Error in getContacts:", error);
      throw error;
    }
    if (!data) return [];
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      email: item.email,
      phone: item.phone,
      type: item.type,
      department: item.department,
      companyId: item.company_id,
      source: item.source,
      ownerId: item.owner_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    })) as Contact[];
  } catch (err) {
    console.error("[lib/db] getContacts FATAL:", err);
    return [];
  }
}

export function subscribeToContacts(callback: (contacts: Contact[]) => void, ownerId?: string) {
  const fetchContacts = async () => {
    const data = await getContacts(ownerId);
    callback(data);
  };

  fetchContacts();

  const subscription = supabase
    .channel(`public:contacts:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
      fetchContacts();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function createContact(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: result, error } = await supabase.from('contacts').insert([{
    name: data.name,
    role: data.role,
    email: data.email,
    phone: data.phone,
    type: data.type,
    department: data.department,
    company_id: data.companyId || null,
    source: data.source || null,
    owner_id: user.id
  }]).select();

  if (error) throw error;
  if (!result || result.length === 0) throw new Error("Failed to create contact");
  return result[0].id;
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

  const { error } = await supabase.from('contacts').update(updateData).eq('id', id);
  if (error) {
    console.error("Supabase error updating contact:", error);
    throw error;
  }
}

export async function deleteContact(id: string) {
  console.log("Attempting to delete contact with id:", id);
  // Using .select() ensures we get the deleted data back if it was successful
  const { data, error } = await supabase.from('contacts').delete().eq('id', id).select();
  
  if (error) {
    console.error("Supabase Error deleting contact:", error);
    throw error;
  }
  
  if (!data || data.length === 0) {
    console.warn("No contact was deleted. This might be due to permissions or the contact not existing.");
    throw new Error("Não foi possível excluir o contato. Verifique se você tem permissão ou se o contato ainda existe.");
  }
  
  console.log("Successfully deleted contact:", data[0]);
  return data[0];
}

// Companies
export async function getCompanies(ownerId?: string) {
  try {
    let query = supabase.from('companies').select('*').order('name', { ascending: true });
    if (ownerId) query = query.eq('owner_id', ownerId);
    const { data, error } = (await winTimeout(query as any, 30000, "fetch companies")) as any;
    if (error) throw error;
    if (!data) return [];
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      industry: item.industry,
      website: item.website,
      ownerId: item.owner_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    })) as Company[];
  } catch (err) {
    console.error("[lib/db] getCompanies FATAL:", err);
    return [];
  }
}

export function subscribeToCompanies(callback: (companies: Company[]) => void, ownerId?: string) {
  const fetchCompanies = async () => {
    const data = await getCompanies(ownerId);
    callback(data);
  };

  fetchCompanies();

  const subscription = supabase
    .channel(`public:companies:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
      fetchCompanies();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function createCompany(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: result, error } = await supabase.from('companies').insert([{
    name: data.name,
    industry: data.industry,
    website: data.website,
    owner_id: user.id
  }]).select();

  if (error) throw error;
  return result[0].id;
}

export async function updateCompany(id: string, data: any) {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.industry !== undefined) updateData.industry = data.industry;
  if (data.website !== undefined) updateData.website = data.website;

  const { error } = await supabase.from('companies').update(updateData).eq('id', id);
  if (error) throw error;
}

export async function deleteCompany(id: string) {
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) throw error;
}

// Deals
export async function getDeals(ownerId?: string) {
  try {
    let query = supabase.from('deals').select('*').order('created_at', { ascending: false });
    if (ownerId) query = query.eq('owner_id', ownerId);
    const { data, error } = (await winTimeout(query as any, 30000, "fetch deals")) as any;
    if (error) throw error;
    if (!data) return [];
    return data.map((item: any) => ({
      id: item.id,
      title: item.title === 'EM CONSTRUÇÃO' ? 'Em Construção' : item.title,
      value: item.value,
      stage: item.stage,
      companyId: item.company_id,
      contactId: item.contact_id,
      propertyId: item.property_id,
      ownerId: item.owner_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    })) as Deal[];
  } catch (err) {
    console.error("[lib/db] getDeals FATAL:", err);
    return [];
  }
}

export async function getDealsByContact(contactId: string) {
  const { data } = await supabase.from('deals').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });
  if (!data) return [];
  return data.map(item => ({
    id: item.id,
    title: item.title === 'EM CONSTRUÇÃO' ? 'Em Construção' : item.title,
    value: item.value,
    stage: item.stage,
    companyId: item.company_id,
    contactId: item.contact_id,
    propertyId: item.property_id,
    ownerId: item.owner_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  })) as Deal[];
}

export function subscribeToDeals(callback: (deals: Deal[]) => void, ownerId?: string) {
  const fetchDeals = async () => {
    const data = await getDeals(ownerId);
    callback(data);
  };

  fetchDeals();

  const subscription = supabase
    .channel(`public:deals:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
      fetchDeals();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function createDeal(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: result, error } = await supabase.from('deals').insert([{
    title: data.title,
    value: data.value,
    stage: data.stage,
    company_id: data.companyId || null,
    contact_id: data.contactId || null,
    property_id: data.propertyId || null,
    owner_id: data.ownerId || user.id
  }]).select();

  if (error) throw error;
  if (!result || result.length === 0) throw new Error("Failed to create deal");
  return result[0].id;
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

  const { error } = await supabase.from('deals').update(updateData).eq('id', id);
  if (error) throw error;
}

export async function deleteDeal(id: string) {
  const { error } = await supabase.from('deals').delete().eq('id', id);
  if (error) throw error;
}

// Goals
export async function getGoals(ownerId?: string) {
  let query = supabase.from('goals').select('*').order('month', { ascending: false });
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { data } = await query;
  if (!data) return [];
  return data.map(item => ({
    id: item.id,
    month: item.month,
    revenue: item.revenue,
    stageGoals: item.stage_goals,
    ownerId: item.owner_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  })) as Goal[];
}

export function subscribeToGoals(callback: (goals: Goal[]) => void, ownerId?: string) {
  const fetchGoals = async () => {
    const data = await getGoals(ownerId);
    callback(data);
  };

  fetchGoals();

  const subscription = supabase
    .channel(`public:goals:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => {
      fetchGoals();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function setGoal(month: string, stageGoals: { [stageId: string]: number }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // First, check if a goal for this month and user already exists to get its ID
  const { data: existingGoal } = await supabase
    .from('goals')
    .select('id')
    .eq('month', month)
    .eq('owner_id', user.id)
    .maybeSingle();

  const goalData: any = {
    month,
    stage_goals: stageGoals,
    owner_id: user.id,
    updated_at: new Date().toISOString()
  };

  if (existingGoal) {
    goalData.id = existingGoal.id;
  }

  const { error } = await supabase.from('goals').upsert(goalData);

  if (error) {
    console.error("Error in setGoal:", error);
    throw error;
  }
}

export async function getUserProfile(id: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    displayName: data.display_name,
    email: data.email,
    photoURL: data.photo_url,
    role: data.role,
    userType: data.user_type,
    isAdmin: data.is_admin
  } as UserProfile;
}

// User Profiles
export function subscribeToUsers(callback: (users: UserProfile[]) => void, ownerId?: string) {
  const fetchUsers = async () => {
    let query = supabase.from('profiles').select('*');
    if (ownerId) query = query.eq('id', ownerId);
    const { data } = await query;
    if (data) {
      callback(data.map(item => ({
        id: item.id,
        displayName: item.display_name,
        email: item.email,
        photoURL: item.photo_url,
        role: item.role,
        userType: item.user_type,
        isAdmin: item.is_admin
      })) as UserProfile[]);
    }
  };

  fetchUsers();

  const subscription = supabase
    .channel(`public:profiles:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      fetchUsers();
    })
    .subscribe();

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

  const { error } = await supabase.from('profiles').update(updateData).eq('id', id);
  if (error) throw error;
}

export async function deleteUserProfile(id: string) {
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
}

export async function isEmailRegistered(email: string) {
  const { data, error } = await supabase.from('profiles').select('id').eq('email', email.toLowerCase()).maybeSingle();
  if (error) return false;
  return !!data;
}

export async function createUserProfile(data: { displayName: string; email: string; role: 'Membro' | 'Admin'; userType: 'funcionário' | 'cliente' }) {
  // Generate a random UUID for the profile if it's a pre-registration
  // This avoids PK issues if auth.users doesn't have the user yet.
  // The auth-provider.tsx syncProfile logic will later "claim" this profile by updating the ID.
  const tempId = crypto.randomUUID();
  
  const { data: result, error } = await supabase.from('profiles').insert([{
    id: tempId,
    display_name: data.displayName,
    email: data.email.toLowerCase(),
    role: data.role,
    user_type: data.userType,
    is_admin: data.role === 'Admin'
  }]).select();

  if (error) throw error;
  return result[0].id;
}

// Activities
export async function getActivitiesByContact(contactId: string) {
  const { data } = await supabase.from('activities').select('*').eq('contact_id', contactId).order('date', { ascending: true });
  if (!data) return [];
  return data.map(item => ({
    id: item.id,
    title: item.title,
    description: item.description,
    date: item.date,
    type: item.type,
    status: item.status,
    contactId: item.contact_id,
    dealId: item.deal_id,
    ownerId: item.owner_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  })) as Activity[];
}

export function subscribeToActivities(callback: (activities: Activity[]) => void, ownerId?: string) {
  const fetchActivities = async () => {
    let query = supabase.from('activities').select('*').order('date', { ascending: true });
    if (ownerId) query = query.eq('owner_id', ownerId);
    const { data } = await query;
    if (data) {
      callback(data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        date: item.date,
        type: item.type,
        status: item.status,
        contactId: item.contact_id,
        dealId: item.deal_id,
        ownerId: item.owner_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })) as Activity[]);
    }
  };

  fetchActivities();

  const subscription = supabase
    .channel(`public:activities:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => {
      fetchActivities();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function createActivity(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: result, error } = await supabase.from('activities').insert([{
    title: data.title,
    description: data.description,
    date: data.date,
    type: data.type,
    status: data.status,
    contact_id: data.contactId || null,
    deal_id: data.dealId || null,
    owner_id: user.id
  }]).select();

  if (error) throw error;
  if (!result || result.length === 0) throw new Error("Failed to create activity");
  return result[0].id;
}

export async function updateActivity(id: string, data: any) {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.date !== undefined) updateData.date = data.date;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status;

  const { error } = await supabase.from('activities').update(updateData).eq('id', id);
  if (error) throw error;
}

export async function deleteActivity(id: string) {
  console.log("Attempting to delete activity with id:", id);
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) {
    console.error("Supabase delete error:", error);
    throw error;
  }
  console.log("Successfully deleted activity:", id);
}

// Timeline
export function subscribeToTimeline(category: string, relatedId: string, callback: (events: TimelineEvent[]) => void, ownerId?: string) {
  const fetchEvents = async () => {
    let query = supabase.from('timeline').select('*').eq('category', category).eq('related_id', relatedId).order('created_at', { ascending: false });
    if (ownerId) query = query.eq('owner_id', ownerId);
    const { data } = await query;
    if (data) {
      callback(data.map(item => ({
        id: item.id,
        type: item.type,
        category: item.category,
        relatedId: item.related_id,
        content: item.content,
        title: item.title,
        authorName: item.author_name,
        ownerId: item.owner_id,
        createdBy: item.created_by,
        metadata: item.metadata,
        createdAt: item.created_at
      })) as any);
    }
  };

  fetchEvents();

  const subscription = supabase
    .channel(`public:timeline:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline' }, () => {
      fetchEvents();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function createTimelineEvent(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: result, error } = await supabase.from('timeline').insert([{
    type: data.type,
    category: data.category,
    related_id: data.relatedId,
    content: data.content,
    title: data.title,
    author_name: data.authorName || user.email,
    owner_id: user.id,
    created_by: user.id,
    metadata: data.metadata
  }]).select();

  if (error) throw error;
  return result[0].id;
}

// Properties

/**
 * Utilitário de timeout para operações do Supabase com log de conectividade
 */
async function winTimeout<T>(promise: Promise<T>, ms: number = 90000, label: string = "Operação"): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const status = typeof navigator !== 'undefined' ? (navigator.onLine ? 'Conectado (Online)' : 'Desconectado (Offline)') : 'N/A';
      console.error(`[TIMEOUT_CRÍTICO] ${label} excedeu ${ms}ms. Status do Navegador: ${status}.`);
      reject(new Error(`TIMEOUT_DB: A operação no banco (${label}) excedeu ${ms}ms.`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Utilitário de retry para operações instáveis
 */
async function withRetry<T>(fn: () => Promise<T>, retries: number = 3, delay: number = 2000, label: string = "Operação"): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries + 1; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isTimeout = err.message?.includes('TIMEOUT_DB') || err.message?.includes('timeout');
      const isNetwork = err.message?.includes('fetch') || err.message?.includes('Network');
      
      if (i < retries && (isTimeout || isNetwork)) {
        console.warn(`[lib/db] ${label} falhou (tentativa ${i + 1}/${retries + 1}). Retentando em ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 1.5; // Backoff suave
      } else {
        break;
      }
    }
  }
  throw lastError;
}

/**
 * Helper para chamadas REST nativas ao Supabase (mais estável em iframes)
 */
async function supabaseNativeFetch(path: string, options: any = {}) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Tenta obter o token da sessão atual para respeitar RLS
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token || key;
  
  if (!sessionData.session) {
    console.warn(`[NativeFetch] Nenhuma sessão ativa encontrada para ${path}. Usando anon key.`);
  } else {
    // Log do início do token para debug sem expor segredos
    console.log(`[NativeFetch] Token encontrado (${sessionData.session.access_token.substring(0, 10)}...) para ${path}`);
  }
  
  const headers = {
    "apikey": key || "",
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[NativeFetch] Erro em ${path}:`, response.status, errorBody);
      throw new Error(`DB_ERROR: ${response.status} - ${errorBody}`);
    }

    if (response.status === 204) return null;
    
    // Tenta ler o corpo como texto primeiro para verificar se está vazio
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn(`[NativeFetch] Resposta não é um JSON válido em ${path}:`, text.substring(0, 100));
      return text;
    }
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      console.error(`[NativeFetch] Erro de rede/CORS em ${path}:`, err);
      throw new Error("Erro de conexão com o banco de dados. Verifique sua internet.");
    }
    throw err;
  }
}

export async function getProperties(ownerId?: string) {
  const startTime = Date.now();
  console.log("[lib/db] getProperties: Buscando imóveis via Fetch...");
  
  try {
    let path = `properties?select=*&order=created_at.desc&limit=60`;
    if (ownerId) path += `&owner_id=eq.${ownerId}`;
    
    const properties = await supabaseNativeFetch(path);
    if (!properties || properties.length === 0) return [];

    // Busca imagens
    const propertyIds = properties.map((p: any) => p.id);
    let images: any[] = [];
    try {
      images = await supabaseNativeFetch(`property_images?select=property_id,url&property_id=in.(${propertyIds.join(',')})`) || [];
    } catch (e) {
      console.warn("[lib/db] Erro ao carregar fotos (não fatal):", e);
    }

    console.log(`[lib/db] getProperties concluído em ${Date.now() - startTime}ms`);

    return properties.map((item: any) => {
      let urls: string[] = images
        .filter((img: any) => img.property_id === item.id)
        .map((img: any) => String(img.url));
      
      if (urls.length === 0 && item.image_url) {
        try {
          const parsed = typeof item.image_url === 'string' ? JSON.parse(item.image_url) : item.image_url;
          urls = Array.isArray(parsed) ? parsed : [String(item.image_url)];
        } catch {
          urls = [String(item.image_url)];
        }
      }

      return {
        id: item.id,
        title: String(item.title || "Sem título"),
        type: item.type,
        status: item.status,
        price: Number(item.price || 0),
        location: String(item.location || ""),
        cep: String(item.cep || ""),
        street: String(item.street || ""),
        neighborhood: String(item.neighborhood || ""),
        city: String(item.city || ""),
        state: String(item.state || ""),
        number: String(item.number || ""),
        complement: item.complement ? String(item.complement) : null,
        area: Number(item.area || 0),
        bedrooms: Number(item.bedrooms || 0),
        bathrooms: Number(item.bathrooms || 0),
        parkingSpots: Number(item.parking_spots || 0),
        acceptsFinancing: Boolean(item.accepts_financing),
        notes: item.notes ? String(item.notes) : null,
        description: item.description ? String(item.description) : null,
        imageUrls: urls,
        ownerId: item.owner_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      } as Property;
    });
  } catch (err: any) {
    console.error("[lib/db] getProperties FATAL:", err);
    throw err;
  }
}

export function subscribeToProperties(callback: (properties: Property[]) => void, ownerId?: string) {
  const fetchProperties = async () => {
    const data = await getProperties(ownerId);
    callback(data);
  };

  fetchProperties();
  return () => {};
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

  // Coluna legado por segurança
  let legacyImages = "[]";
  if (data.imageUrls && Array.isArray(data.imageUrls)) {
    legacyImages = JSON.stringify(data.imageUrls.filter((u: any) => typeof u === 'string'));
  }

  return { sanitized, legacyImages };
}

export async function createProperty(data: any, bypassUserId?: string) {
  const userId = bypassUserId;
  if (!userId) throw new Error("Usuário não identificado.");
  
  const { sanitized } = sanitizePropertyData(data, userId);
  
  let cleanImageUrls: string[] = [];
  if (Array.isArray(data.imageUrls)) {
    cleanImageUrls = data.imageUrls.map((u: any) => String(u || '').trim()).filter((u: string) => u.length > 0);
  }

  const insertData = JSON.parse(JSON.stringify({ 
    ...sanitized, 
    image_url: JSON.stringify(cleanImageUrls) 
  }));

  try {
    console.log("[lib/db] createProperty: Inserindo via Fetch...");
    const result = await supabaseNativeFetch('properties', {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify(insertData)
    });

    let propertyId: string;

    if (!result || !Array.isArray(result) || result.length === 0) {
      console.warn("[lib/db] createProperty: Inserção retornou vácuo, tentando buscar ID preventivamente...");
      // Fallback: busca o imóvel mais recente do usuário se o result for vácuo mas não deu erro
      const latest = await supabaseNativeFetch(`properties?owner_id=eq.${userId}&order=created_at.desc&limit=1`);
      if (!latest || latest.length === 0) throw new Error("Erro ao criar imóvel: Nenhum dado retornado.");
      propertyId = latest[0].id;
    } else {
      propertyId = result[0].id;
    }

    if (cleanImageUrls.length > 0) {
      console.log(`[lib/db] createProperty: Inserindo ${cleanImageUrls.length} fotos...`);
      for (const url of cleanImageUrls) {
        try {
          await supabaseNativeFetch('property_images', {
            method: "POST",
            body: JSON.stringify({ property_id: propertyId, url })
          });
        } catch (e) {
          console.warn("[lib/db] Erro ao inserir imagem individual:", url, e);
        }
      }
    }

    return propertyId;
  } catch (err) {
    console.error("[lib/db] createProperty FATAL:", err);
    throw err;
  }
}

export async function updateProperty(id: string, data: any, bypassUserId?: string) {
  if (!id) throw new Error("ID do imóvel é obrigatório.");
  const userId = bypassUserId;
  if (!userId) throw new Error("Usuário não identificado.");

  const { sanitized } = sanitizePropertyData(data, userId);

  let cleanImageUrls: string[] = [];
  if (Array.isArray(data.imageUrls)) {
    cleanImageUrls = data.imageUrls.map((u: any) => String(u || '').trim()).filter((u: string) => u.length > 0);
  }

  const updateData = JSON.parse(JSON.stringify({
    ...sanitized,
    image_url: JSON.stringify(cleanImageUrls),
    updated_at: new Date().toISOString(),
  }));

  try {
    console.log("[lib/db] updateProperty: Atualizando via Fetch...");
    await supabaseNativeFetch(`properties?id=eq.${id}`, {
      method: "PATCH",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify(updateData)
    });

    // Sincroniza property_images
    try {
      await supabaseNativeFetch(`property_images?property_id=eq.${id}`, {
        method: "DELETE"
      });
    } catch (e) {
       console.warn("[lib/db] Erro ao deletar imagens antigas:", e);
    }

    for (const url of cleanImageUrls) {
      try {
        await supabaseNativeFetch('property_images', {
          method: "POST",
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({ property_id: id, url })
        });
      } catch (e) {
        console.error("[lib/db] Erro ao inserir imagem individual:", url, e);
      }
    }

    console.log("[lib/db] updateProperty: FIM ok.");
    return id;
  } catch (err) {
    console.error("[lib/db] updateProperty FATAL:", err);
    throw err;
  }
}

export async function deleteProperty(id: string) {
  const { error } = await supabase.from('properties').delete().eq('id', id);
  if (error) throw error;
}


export async function getContact(id: string) {
  const { data, error } = await supabase.from('contacts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    role: data.role,
    email: data.email,
    phone: data.phone,
    type: data.type,
    department: data.department,
    companyId: data.company_id,
    source: data.source,
    ownerId: data.owner_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  } as Contact;
}

export async function getCompany(id: string) {
  const { data, error } = await supabase.from('companies').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    industry: data.industry,
    website: data.website,
    ownerId: data.owner_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  } as Company;
}

export async function getDeal(id: string) {
  const { data, error } = await supabase.from('deals').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    title: data.title === 'EM CONSTRUÇÃO' ? 'Em Construção' : data.title,
    value: data.value,
    stage: data.stage,
    probability: data.probability,
    status: data.status,
    contactId: data.contact_id,
    companyId: data.company_id,
    expectedCloseDate: data.expected_close_date,
    priority: data.priority,
    ownerId: data.owner_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  } as Deal;
}
export function subscribeToConversations(category: 'client' | 'team', callback: (conversations: Conversation[]) => void, ownerId?: string) {
  const fetchConversations = async () => {
    let query = supabase.from('conversations').select('*').eq('category', category).order('last_message_at', { ascending: false });
    
    if (ownerId) {
       // Using filter with 'cs' (contains) for array containment which is robust
       query = query.filter('participants', 'cs', `{${ownerId}}`);
    }
    const { data } = await query;
    if (data) {
      callback(data.map(item => ({
        id: item.id,
        participants: item.participants,
        participantDetails: item.participant_details,
        lastMessage: item.last_message,
        lastMessageAt: item.last_message_at,
        type: item.type,
        category: item.category,
        ownerId: item.owner_id,
        unreadCount: item.unread_count
      })) as Conversation[]);
    }
  };

  fetchConversations();

  const subscription = supabase
    .channel(`public:conversations:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
      fetchConversations();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export function subscribeToMessages(conversationId: string, callback: (messages: ChatMessage[]) => void) {
  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (data) {
      callback(data.map(item => ({
        id: item.id,
        conversationId: item.conversation_id,
        senderId: item.sender_id,
        content: item.content,
        type: item.type,
        fileName: item.file_name,
        fileUrl: item.file_url,
        createdAt: item.created_at,
        ownerId: item.owner_id
      })) as ChatMessage[]);
    }
  };

  fetchMessages();

  const subscription = supabase
    .channel(`public:messages:${conversationId}:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => {
      fetchMessages();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function sendChatMessage(conversationId: string, content: string, type: 'text' | 'image' | 'file' = 'text', fileData?: { name?: string, url?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: result, error } = await supabase.from('messages').insert([{
    conversation_id: conversationId,
    sender_id: user.id,
    content,
    type,
    file_name: fileData?.name,
    file_url: fileData?.url,
    owner_id: user.id
  }]).select();

  if (error) throw error;

  // Fetch conversation to update unread count for other participants
  const { data: conv } = await supabase.from('conversations').select('participants, unread_count').eq('id', conversationId).maybeSingle();
  
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

  // Update conversation
  await supabase.from('conversations').update(updateData).eq('id', conversationId);

  return result[0].id;
}

export async function markAsRead(conversationId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: conv } = await supabase.from('conversations').select('unread_count').eq('id', conversationId).maybeSingle();
  
  if (conv && conv.unread_count && (conv.unread_count[user.id] || 0) > 0) {
    const newUnreadCount = { ...conv.unread_count };
    newUnreadCount[user.id] = 0;

    await supabase.from('conversations').update({
      unread_count: newUnreadCount
    }).eq('id', conversationId);
  }
}

export function subscribeToTotalUnreadMessages(callback: (count: number) => void) {
  const fetchTotalUnread = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      callback(0);
      return;
    }

    const { data } = await supabase.from('conversations')
      .select('unread_count')
      .filter('participants', 'cs', `{${user.id}}`);

    if (data) {
      const total = data.reduce((acc, conv) => {
        return acc + (conv.unread_count?.[user.id] || 0);
      }, 0);
      callback(total);
    }
  };

  fetchTotalUnread();

  const subscription = supabase
    .channel(`public:conversations_unread:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
      fetchTotalUnread();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function createConversation(participants: string[], category: 'client' | 'team', details: Record<string, any>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: result, error } = await supabase.from('conversations').insert([{
    participants,
    participant_details: details,
    type: participants.length > 2 ? 'group' : 'direct',
    category,
    owner_id: user.id,
    last_message_at: new Date().toISOString(),
    unread_count: {}
  }]).select();

  if (error) throw error;
  return result[0].id;
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
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('category', category)
    .filter('participants', 'cs', `{${user.id},${participantId}}`);

  if (existing && existing.length > 0) {
    // Verify it's exactly these two for direct chat
    const exactMatch = existing.find(c => c.participants.length === 2);
    if (exactMatch) return exactMatch.id;
  }

  // Get current profile for details
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

  const details = {
    [user.id]: {
      name: profile?.display_name || user.email || "Usuário",
      email: user.email || "",
      photoURL: profile?.photo_url || null
    },
    [participantId]: {
      name: partnerDetails.name || partnerDetails.displayName,
      email: partnerDetails.email,
      photoURL: partnerDetails.photoURL || null
    }
  };

  return createConversation([user.id, participantId], category, details);
}
