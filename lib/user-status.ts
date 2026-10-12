import * as fs from 'fs';
import * as path from 'path';
import { safeJsonParse } from './safe-storage';

import * as os from 'os';

export interface InactiveUserDetails {
  inactive: boolean;
  reason?: string;
  inactivatedAt?: string;
  inactivatedBy?: string;
}

export interface InactiveUsersStore {
  inactiveUserIds: string[];
  details: Record<string, InactiveUserDetails>;
}

function getInactiveStoreFilePath(): string {
  try {
    const cwdPath = path.join(process.cwd(), 'inactive_users.json');
    if (fs.existsSync(cwdPath)) return cwdPath;
  } catch {
    // ignore
  }
  return path.join(os.tmpdir(), 'inactive_users.json');
}

const DEFAULT_STORE: InactiveUsersStore = {
  inactiveUserIds: [],
  details: {}
};

export function getInactiveUsersStore(): InactiveUsersStore {
  try {
    const filePath = getInactiveStoreFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = safeJsonParse<any>(content);
      if (parsed && Array.isArray(parsed.inactiveUserIds)) {
        return {
          inactiveUserIds: parsed.inactiveUserIds,
          details: parsed.details || {}
        };
      }
    }
  } catch {
    // Non-fatal
  }
  return { ...DEFAULT_STORE };
}

export function saveInactiveUsersStore(store: InactiveUsersStore): void {
  try {
    const tmpPath = path.join(os.tmpdir(), 'inactive_users.json');
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    // Non-fatal in read-only lambdas
  }
}

export function isUserInactiveInStore(userId: string): boolean {
  if (!userId) return false;
  const store = getInactiveUsersStore();
  return store.inactiveUserIds.includes(userId);
}

export function getUserInactiveDetail(userId: string): InactiveUserDetails | null {
  if (!userId) return null;
  const store = getInactiveUsersStore();
  if (store.details && store.details[userId]) {
    return store.details[userId];
  }
  if (store.inactiveUserIds.includes(userId)) {
    return { inactive: true };
  }
  return null;
}

export function setUserInactiveInStore(
  userId: string, 
  inactive: boolean, 
  reason?: string, 
  by?: string
): void {
  if (!userId) return;
  const store = getInactiveUsersStore();

  if (inactive) {
    if (!store.inactiveUserIds.includes(userId)) {
      store.inactiveUserIds.push(userId);
    }
    store.details[userId] = {
      inactive: true,
      reason: reason || undefined,
      inactivatedAt: new Date().toISOString(),
      inactivatedBy: by || undefined
    };
  } else {
    store.inactiveUserIds = store.inactiveUserIds.filter(id => id !== userId);
    delete store.details[userId];
  }

  saveInactiveUsersStore(store);
}
