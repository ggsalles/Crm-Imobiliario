import * as fs from 'fs';
import * as path from 'path';
import { safeJsonParse } from './safe-storage';

import * as os from 'os';

export interface SecurityKeywordsStore {
  keywordsByUserId: Record<string, string>;
  keywordsByEmail: Record<string, string>;
}

function getKeywordsStoreFilePath(): string {
  try {
    const cwdPath = path.join(process.cwd(), 'security_keywords.json');
    if (fs.existsSync(cwdPath)) return cwdPath;
  } catch {
    // ignore
  }
  return path.join(os.tmpdir(), 'security_keywords.json');
}

const DEFAULT_STORE: SecurityKeywordsStore = {
  keywordsByUserId: {},
  keywordsByEmail: {}
};

export function getSecurityKeywordsStore(): SecurityKeywordsStore {
  try {
    const filePath = getKeywordsStoreFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = safeJsonParse<any>(content);
      if (parsed) {
        return {
          keywordsByUserId: parsed.keywordsByUserId || {},
          keywordsByEmail: parsed.keywordsByEmail || {}
        };
      }
    }
  } catch {
    // Non-fatal
  }
  return { ...DEFAULT_STORE };
}

export function saveSecurityKeywordsStore(store: SecurityKeywordsStore): void {
  try {
    const tmpPath = path.join(os.tmpdir(), 'security_keywords.json');
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    // Non-fatal in read-only lambdas
  }
}

export function getSecurityKeywordFromStore(userId?: string | null, email?: string | null): string | null {
  const store = getSecurityKeywordsStore();
  if (userId && store.keywordsByUserId[userId]) {
    return store.keywordsByUserId[userId];
  }
  if (email) {
    const cleanEmail = email.toLowerCase().trim();
    if (store.keywordsByEmail[cleanEmail]) {
      return store.keywordsByEmail[cleanEmail];
    }
  }
  return null;
}

export function setSecurityKeywordInStore(
  userId?: string | null,
  email?: string | null,
  keyword?: string | null
): void {
  const store = getSecurityKeywordsStore();
  const cleanKeyword = (keyword || '').trim();

  if (userId) {
    if (cleanKeyword) {
      store.keywordsByUserId[userId] = cleanKeyword;
    } else {
      delete store.keywordsByUserId[userId];
    }
  }

  if (email) {
    const cleanEmail = email.toLowerCase().trim();
    if (cleanKeyword) {
      store.keywordsByEmail[cleanEmail] = cleanKeyword;
    } else {
      delete store.keywordsByEmail[cleanEmail];
    }
  }

  saveSecurityKeywordsStore(store);
}
