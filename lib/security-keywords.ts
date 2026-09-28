import * as fs from 'fs';
import * as path from 'path';
import { safeJsonParse } from './safe-storage';

export interface SecurityKeywordsStore {
  keywordsByUserId: Record<string, string>;
  keywordsByEmail: Record<string, string>;
}

const KEYWORDS_STORE_PATH = path.join(process.cwd(), 'security_keywords.json');

const DEFAULT_STORE: SecurityKeywordsStore = {
  keywordsByUserId: {},
  keywordsByEmail: {}
};

export function getSecurityKeywordsStore(): SecurityKeywordsStore {
  try {
    if (fs.existsSync(KEYWORDS_STORE_PATH)) {
      const content = fs.readFileSync(KEYWORDS_STORE_PATH, 'utf-8');
      const parsed = safeJsonParse<any>(content);
      if (parsed) {
        return {
          keywordsByUserId: parsed.keywordsByUserId || {},
          keywordsByEmail: parsed.keywordsByEmail || {}
        };
      }
    }
  } catch (err) {
    console.error('[SecurityKeywords] Error reading security_keywords.json:', err);
  }
  return { ...DEFAULT_STORE };
}

export function saveSecurityKeywordsStore(store: SecurityKeywordsStore): void {
  try {
    fs.writeFileSync(KEYWORDS_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[SecurityKeywords] Error writing security_keywords.json:', err);
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
