import * as fs from 'fs';
import * as path from 'path';
import { safeJsonParse } from './safe-storage';

export interface CustomUserProfile {
  id: string;
  display_name: string;
  email: string;
  photo_url?: string | null;
  role: 'Membro' | 'Admin';
  user_type: 'funcionário' | 'cliente';
  is_admin: boolean;
  tenant_id: string;
  tenantIds: string[];
  is_active?: boolean;
  inactive_reason?: string | null;
  security_keyword?: string | null;
  password?: string;
  created_at: string;
  updated_at: string;
}

const CUSTOM_USERS_FILE = path.join(process.cwd(), 'custom_users.json');

export function getCustomUsersStore(): CustomUserProfile[] {
  try {
    if (fs.existsSync(CUSTOM_USERS_FILE)) {
      const content = fs.readFileSync(CUSTOM_USERS_FILE, 'utf-8');
      const parsed = safeJsonParse<any>(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[CustomUsers] Error reading custom_users.json:', err);
  }
  return [];
}

export function saveCustomUsersStore(users: CustomUserProfile[]): void {
  try {
    fs.writeFileSync(CUSTOM_USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CustomUsers] Error writing custom_users.json:', err);
  }
}

export function upsertCustomUser(user: Partial<CustomUserProfile> & { id: string; email: string }): CustomUserProfile {
  const users = getCustomUsersStore();
  const existingIndex = users.findIndex(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
  
  const now = new Date().toISOString();
  if (existingIndex >= 0) {
    const existing = users[existingIndex];
    const updated: CustomUserProfile = {
      ...existing,
      ...user,
      email: user.email.toLowerCase(),
      tenantIds: user.tenantIds || existing.tenantIds || [user.tenant_id || existing.tenant_id],
      updated_at: now
    };
    users[existingIndex] = updated;
    saveCustomUsersStore(users);
    return updated;
  } else {
    const newUser: CustomUserProfile = {
      id: user.id,
      display_name: user.display_name || user.email.split('@')[0] || 'Usuário',
      email: user.email.toLowerCase(),
      photo_url: user.photo_url || null,
      role: user.role || 'Membro',
      user_type: user.user_type || 'funcionário',
      is_admin: user.role === 'Admin' || !!user.is_admin,
      tenant_id: user.tenant_id || '11111111-1111-1111-1111-111111111111',
      tenantIds: user.tenantIds || [user.tenant_id || '11111111-1111-1111-1111-111111111111'],
      is_active: user.is_active !== false,
      inactive_reason: user.inactive_reason || null,
      security_keyword: user.security_keyword || null,
      password: user.password,
      created_at: now,
      updated_at: now
    };
    users.push(newUser);
    saveCustomUsersStore(users);
    return newUser;
  }
}

export function deleteCustomUser(idOrEmail: string): boolean {
  const users = getCustomUsersStore();
  const filtered = users.filter(u => u.id !== idOrEmail && u.email.toLowerCase() !== idOrEmail.toLowerCase());
  if (filtered.length !== users.length) {
    saveCustomUsersStore(filtered);
    return true;
  }
  return false;
}
