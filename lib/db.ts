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
  let query = supabase.from('contacts').select('*').order('name', { ascending: true });
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { data } = await query;
  if (!data) return [];
  return data.map(item => ({
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
  let query = supabase.from('companies').select('*').order('name', { ascending: true });
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { data } = await query;
  if (!data) return [];
  return data.map(item => ({
    id: item.id,
    name: item.name,
    industry: item.industry,
    website: item.website,
    ownerId: item.owner_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  })) as Company[];
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
  let query = supabase.from('deals').select('*').order('created_at', { ascending: false });
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { data } = await query;
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
export async function getProperties(ownerId?: string) {
  console.log("[lib/db] getProperties: Buscando imóveis...");
  let query = supabase.from('properties').select('*').order('created_at', { ascending: false });
  if (ownerId) query = query.eq('owner_id', ownerId);
  
  // Timeout de 15s para leitura
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const startTime = Date.now();
  const { data, error } = await query;
  clearTimeout(timeoutId);
  
  console.log(`[lib/db] getProperties: Concluído em ${Date.now() - startTime}ms`);
  
  if (error) {
    console.error("Error fetching properties:", error);
    throw error;
  }
  if (!data) return [];
  return (data as any[]).map(item => ({
    id: item.id,
    title: item.title === 'EM CONSTRUÇÃO' ? 'Em Construção' : item.title,
    type: item.type,
    status: item.status,
    price: item.price,
    location: item.location,
    cep: item.cep,
    street: item.street,
    neighborhood: item.neighborhood,
    city: item.city,
    state: item.state,
    number: item.number,
    complement: item.complement,
    area: item.area,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    parkingSpots: item.parking_spots,
    acceptsFinancing: item.accepts_financing,
    notes: item.notes,
    description: item.description,
    imageUrls: (() => {
      if (!item.image_url) return [];
      if (Array.isArray(item.image_url)) return item.image_url;
      try {
        const str = String(item.image_url);
        // Handle PostgreSQL array format like {url1,url2}
        if (str.startsWith('{') && str.endsWith('}')) {
          return str.substring(1, str.length - 1)
            .split(',')
            .map(s => s.replace(/^"|"$/g, '').trim())
            .filter(s => s !== "");
        }
        // Handle JSON array format like ["url1","url2"]
        if (str.startsWith('[') && str.endsWith(']')) {
          const parsed = JSON.parse(str);
          return Array.isArray(parsed) ? parsed : [str];
        }
        return [str];
      } catch (e) {
        return [String(item.image_url)];
      }
    })(),
    ownerId: item.owner_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  })) as any[];
}

export function subscribeToProperties(callback: (properties: Property[]) => void, ownerId?: string) {
  const fetchProperties = async () => {
    const data = await getProperties(ownerId);
    callback(data);
  };

  fetchProperties();

  // Desativado Realtime para Imóveis devido a instabilidade no ambiente de iFrame
  // O componente chamará fetchData() manualmente após alterações
  return () => {};
}

async function getAuthUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

export async function createProperty(data: any, bypassUserId?: string) {
  const userId = bypassUserId;
  
  if (!userId) {
    throw new Error("Usuário não identificado. Por favor, faça login novamente.");
  }
  
  console.log(`[lib/db] createProperty: Iniciando para usuário ${userId}`);

  const rawUrls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
  const validUrls = rawUrls.filter((url: any) => 
    typeof url === 'string' && 
    url.trim() !== "" && 
    url.startsWith('http') && 
    !url.startsWith('data:image')
  ).slice(0, 15);
  
  const safeUrls = validUrls.map((url: string) => {
    return url.trim().replace(/[\n\r\t\s]/g, "").substring(0, 1000);
  });
  
  const description = data.description ? String(data.description).substring(0, 3000) : null;
  const notes = data.notes ? String(data.notes).substring(0, 3000) : null;

  const insertData = {
    title: String(data.title).substring(0, 200),
    type: data.type,
    status: data.status,
    price: Number(data.price || 0),
    location: String(data.location || "").substring(0, 500),
    cep: String(data.cep || "").substring(0, 10),
    street: String(data.street || "").substring(0, 200),
    neighborhood: String(data.neighborhood || "").substring(0, 200),
    city: String(data.city || "").substring(0, 200),
    state: String(data.state || "").substring(0, 2),
    number: String(data.number || "").substring(0, 20),
    complement: String(data.complement || "").substring(0, 500),
    area: Number(data.area || 0),
    bedrooms: Number(data.bedrooms || 0),
    bathrooms: Number(data.bathrooms || 0),
    parking_spots: Number(data.parkingSpots || 0),
    accepts_financing: !!data.acceptsFinancing,
    notes: notes,
    description: description,
    image_url: safeUrls,
    owner_id: userId
  };

  console.log(`[lib/db] createProperty: Enviando para Supabase...`);
  
  const startTime = Date.now();
  try {
    // Timeout de 10s para evitar travamento total no iFrame
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), 10000)
    );

    const supabasePromise = (async () => {
      const { data: result, error } = await supabase
        .from('properties')
        .insert([insertData])
        .select('id');

      if (error) {
        console.error("[lib/db] createProperty error:", error);
        throw new Error(`Erro Supabase: ${error.message} (${error.code})`);
      }
      return result && result[0] ? result[0].id : "sync_pending";
    })();

    const resultId = await Promise.race([supabasePromise, timeoutPromise]);
    console.log(`[lib/db] createProperty: Concluído em ${Date.now() - startTime}ms`);
    return resultId;
  } catch (err: any) {
    if (err.message === "NETWORK_TIMEOUT") {
      console.warn("[lib/db] createProperty: Timeout atingido, mas o registro pode ter sido salvo.");
      return "sync_pending";
    }
    throw err;
  }
}

export async function updateProperty(id: string, data: any, bypassUserId?: string) {
  if (!id) throw new Error("ID do imóvel não fornecido.");

  console.log(`[lib/db] updateProperty: Iniciando para ID ${id}`);

  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) updateData.title = String(data.title).substring(0, 200);
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.price !== undefined) updateData.price = Number(data.price || 0);
  if (data.location !== undefined) updateData.location = String(data.location).substring(0, 500);
  if (data.cep !== undefined) updateData.cep = String(data.cep).substring(0, 10);
  if (data.street !== undefined) updateData.street = String(data.street).substring(0, 200);
  if (data.neighborhood !== undefined) updateData.neighborhood = String(data.neighborhood).substring(0, 200);
  if (data.city !== undefined) updateData.city = String(data.city).substring(0, 200);
  if (data.state !== undefined) updateData.state = String(data.state).substring(0, 2);
  if (data.number !== undefined) updateData.number = String(data.number).substring(0, 20);
  if (data.complement !== undefined) updateData.complement = String(data.complement).substring(0, 500);
  if (data.area !== undefined) updateData.area = Number(data.area || 0);
  if (data.bedrooms !== undefined) updateData.bedrooms = Number(data.bedrooms || 0);
  if (data.bathrooms !== undefined) updateData.bathrooms = Number(data.bathrooms || 0);
  if (data.parkingSpots !== undefined) updateData.parking_spots = Number(data.parkingSpots || 0);
  if (data.acceptsFinancing !== undefined) updateData.accepts_financing = !!data.acceptsFinancing;
  
  if (data.notes !== undefined) updateData.notes = String(data.notes || "").substring(0, 3000);
  if (data.description !== undefined) updateData.description = String(data.description || "").substring(0, 3000);
  
  if (data.imageUrls !== undefined) {
    const rawUrls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
    const validUrls = rawUrls.filter((url: any) => 
      typeof url === 'string' && 
      url.trim() !== "" && 
      url.startsWith('http') && 
      !url.startsWith('data:image')
    ).slice(0, 15);
    const safeUrls = validUrls.map((url: string) => {
      return url.trim().replace(/[\n\r\t\s]/g, "").substring(0, 1000);
    });
    updateData.image_url = safeUrls;
  }

  console.log(`[lib/db] updateProperty: Enviando para Supabase...`);
  
  const startTime = Date.now();
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), 10000)
    );

    const supabasePromise = (async () => {
      const { error } = await supabase
        .from('properties')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error("[lib/db] updateProperty error:", error);
        throw new Error(`Erro Supabase: ${error.message} (${error.code})`);
      }
      return true;
    })();

    await Promise.race([supabasePromise, timeoutPromise]);
    console.log(`[lib/db] updateProperty: Concluído em ${Date.now() - startTime}ms`);
  } catch (err: any) {
    if (err.message === "NETWORK_TIMEOUT") {
      console.warn("[lib/db] updateProperty: Timeout atingido.");
      return;
    }
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
    .upload(filePath, file);

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
