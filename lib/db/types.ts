import { DEFAULT_TENANT_ID } from '../constants';

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
  suites?: number;
  bathrooms?: number;
  parkingSpots?: number;
  acceptsFinancing?: boolean;
  iptu?: number;
  condoFee?: number;
  buildingName?: string;
  notes?: string;
  description?: string;
  tags?: string[];
  imageUrls?: string[];
  isFeatured?: boolean;
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
  temperature?: 'quente' | 'morno' | 'frio';
  rawRole?: string | null;
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
  userLimit?: number;
  isBlocked?: boolean;
  cnpj?: string;
  city?: string;
  state?: string;
  phone?: string;
  contactEmail?: string;
  basePrice?: number;
  brokerLimit?: number;
  adminLimit?: number;
  extraBrokerPrice?: number;
  extraAdminPrice?: number;
  plan?: string;
  dueDay?: number;
  billingStatus?: string;
  billingSuspensionDate?: string;
  diffDays?: number;
  overdueCount?: number;
  oldestOverdueMonthKey?: string;
}

export interface TenantPlanCapacity {
  baseBrokers: number;
  baseAdmins: number;
  baseSlots: number;
  activeBrokers: number;
  activeAdmins: number;
  extraBrokers: number;
  extraAdmins: number;
  totalExtras: number;
  totalCapacity: number;
}

export function calculateTenantPlanCapacity(
  tenant?: Partial<Tenant> | null,
  tenantUsers: UserProfile[] = []
): TenantPlanCapacity {
  const baseBrokers = tenant?.brokerLimit !== undefined && tenant?.brokerLimit !== null ? Number(tenant.brokerLimit) : 2;
  const baseAdmins = tenant?.adminLimit !== undefined && tenant?.adminLimit !== null ? Number(tenant.adminLimit) : 1;
  const baseSlots = baseBrokers + baseAdmins;

  // Membros ativos da equipe (exclui contatos/clientes e membros inativos)
  const staff = tenantUsers.filter(u => u.userType !== 'cliente' && u.isActive !== false);
  const activeAdmins = staff.filter(u => u.role === 'Admin').length;
  const activeBrokers = staff.filter(u => u.role !== 'Admin').length;

  const extraBrokers = Math.max(0, activeBrokers - baseBrokers);
  const extraAdmins = Math.max(0, activeAdmins - baseAdmins);
  const totalExtras = extraBrokers + extraAdmins;

  // Capacidade total: base + extras (ou tenant.userLimit se tiver sido expandido manualmente além da base)
  const totalCapacity = Math.max(baseSlots + totalExtras, Number(tenant?.userLimit) || baseSlots);

  return {
    baseBrokers,
    baseAdmins,
    baseSlots,
    activeBrokers,
    activeAdmins,
    extraBrokers,
    extraAdmins,
    totalExtras,
    totalCapacity
  };
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
  securityKeyword?: string;
  isActive?: boolean;
  inactiveReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  amount: number;
  month: string; // 'YYYY-MM'
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  paidAt?: string;
  paidBy?: string;
  pdfUrl?: string;
  pixCode?: string;
  barcode?: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}
