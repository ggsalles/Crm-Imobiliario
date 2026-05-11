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
  imageUrl?: string;
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
  if (data.companyId !== undefined) updateData.company_id = data.companyId;

  const { error } = await supabase.from('contacts').update(updateData).eq('id', id);
  if (error) throw error;
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
    title: item.title,
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
    owner_id: user.id
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
  if (data.companyId !== undefined) updateData.company_id = data.companyId;
  if (data.contactId !== undefined) updateData.contact_id = data.contactId;
  if (data.propertyId !== undefined) updateData.property_id = data.propertyId;

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

  const { error } = await supabase.from('goals').upsert({
    month,
    stage_goals: stageGoals,
    owner_id: user.id,
    updated_at: new Date().toISOString()
  }, { onConflict: 'owner_id, month' });

  if (error) throw error;
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
  let query = supabase.from('properties').select('*').order('created_at', { ascending: false });
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { data } = await query;
  if (!data) return [];
  return data.map(item => ({
    id: item.id,
    title: item.title,
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
    imageUrl: item.image_url,
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

  const subscription = supabase
    .channel(`public:properties:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => {
      fetchProperties();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export async function createProperty(data: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: result, error } = await supabase.from('properties').insert([{
    title: data.title,
    type: data.type,
    status: data.status,
    price: data.price,
    location: data.location,
    cep: data.cep,
    street: data.street,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    number: data.number,
    complement: data.complement,
    area: data.area,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    parking_spots: data.parkingSpots,
    accepts_financing: data.acceptsFinancing,
    notes: data.notes,
    description: data.description,
    image_url: data.imageUrl,
    owner_id: user.id
  }]).select();

  if (error) throw error;
  return result[0].id;
}

export async function updateProperty(id: string, data: any) {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.cep !== undefined) updateData.cep = data.cep;
  if (data.street !== undefined) updateData.street = data.street;
  if (data.neighborhood !== undefined) updateData.neighborhood = data.neighborhood;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.state !== undefined) updateData.state = data.state;
  if (data.number !== undefined) updateData.number = data.number;
  if (data.complement !== undefined) updateData.complement = data.complement;
  if (data.area !== undefined) updateData.area = data.area;
  if (data.bedrooms !== undefined) updateData.bedrooms = data.bedrooms;
  if (data.bathrooms !== undefined) updateData.bathrooms = data.bathrooms;
  if (data.parkingSpots !== undefined) updateData.parking_spots = data.parkingSpots;
  if (data.acceptsFinancing !== undefined) updateData.accepts_financing = data.acceptsFinancing;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;

  const { error } = await supabase.from('properties').update(updateData).eq('id', id);
  if (error) throw error;
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
    title: data.title,
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

  // Update conversation last message
  await supabase.from('conversations').update({
    last_message: content,
    last_message_at: new Date().toISOString()
  }).eq('id', conversationId);

  return result[0].id;
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
