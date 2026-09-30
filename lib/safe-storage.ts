/**
 * Utilitário seguro para manipulação de LocalStorage, SessionStorage e parsing JSON.
 * Evita SyntaxError (Invalid or unexpected token), QuotaExceededError e falhas em SSR.
 */

type StorageType = 'localStorage' | 'sessionStorage';

/**
 * Realiza JSON.parse de forma defensiva com captura estrita de erros.
 * Retorna o valor fallback fornecido caso a string seja inválida, vazia ou ocorra SyntaxError.
 */
export function safeJsonParse<T = any>(
  value: string | null | undefined,
  fallback: T | null = null
): T | null {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (
    trimmed === '' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === '[object Object]'
  ) {
    return fallback;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    console.warn('[safeJsonParse] Erro ao analisar JSON:', error, 'Valor recebido:', trimmed.slice(0, 80));
    return fallback;
  }
}

/**
 * Lê uma string do LocalStorage ou SessionStorage com proteção contra SSR e Storage desabilitado.
 */
export function safeGetItem(
  key: string,
  storageType: StorageType = 'localStorage'
): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window[storageType];
    if (!storage) return null;
    return storage.getItem(key);
  } catch (error) {
    console.warn(`[safeGetItem] Falha ao acessar ${storageType} para chave "${key}":`, error);
    return null;
  }
}

/**
 * Grava uma string no LocalStorage ou SessionStorage com proteção de cota e contexto.
 */
export function safeSetItem(
  key: string,
  value: string,
  storageType: StorageType = 'localStorage'
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const storage = window[storageType];
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[safeSetItem] Falha ao gravar em ${storageType} para chave "${key}":`, error);
    return false;
  }
}

/**
 * Remove um item do LocalStorage ou SessionStorage com segurança.
 */
export function safeRemoveItem(
  key: string,
  storageType: StorageType = 'localStorage'
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const storage = window[storageType];
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[safeRemoveItem] Falha ao remover de ${storageType} para chave "${key}":`, error);
    return false;
  }
}

/**
 * Helper que combina safeGetItem + safeJsonParse para leitura direta de objetos.
 */
export function safeGetJson<T = any>(
  key: string,
  fallback: T | null = null,
  storageType: StorageType = 'localStorage'
): T | null {
  const raw = safeGetItem(key, storageType);
  return safeJsonParse<T>(raw, fallback);
}

/**
 * Helper que combina JSON.stringify + safeSetItem para gravação direta de objetos.
 */
export function safeSetJson(
  key: string,
  value: any,
  storageType: StorageType = 'localStorage'
): boolean {
  try {
    const serialized = JSON.stringify(value);
    return safeSetItem(key, serialized, storageType);
  } catch (error) {
    console.warn(`[safeSetJson] Falha ao serializar objeto para chave "${key}":`, error);
    return false;
  }
}

const DEFAULT_TENANT_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Recupera as probabilidades do funil isoladas por Inquilino (Tenant).
 * Evita vazamento de configurações entre imobiliárias distintas.
 */
export function getTenantPipelineProbabilities(tenantId?: string | null): Record<string, number> | null {
  const resolvedTenant = tenantId || DEFAULT_TENANT_ID;
  const tenantKey = `pipeline_probabilities_${resolvedTenant}`;
  const tenantData = safeGetJson<Record<string, number>>(tenantKey);
  
  if (tenantData && typeof tenantData === 'object' && Object.keys(tenantData).length > 0) {
    return tenantData;
  }

  // Migração defensiva: apenas para o tenant padrão inicial
  if (resolvedTenant === DEFAULT_TENANT_ID) {
    const legacy = safeGetJson<Record<string, number>>('pipeline_probabilities');
    if (legacy && typeof legacy === 'object' && Object.keys(legacy).length > 0) {
      safeSetJson(tenantKey, legacy);
      return legacy;
    }
  }

  return null;
}

/**
 * Grava as probabilidades do funil isoladas por Inquilino (Tenant).
 */
export function saveTenantPipelineProbabilities(
  tenantId: string | null | undefined,
  probabilities: Record<string, number>
): boolean {
  const resolvedTenant = tenantId || DEFAULT_TENANT_ID;
  const tenantKey = `pipeline_probabilities_${resolvedTenant}`;
  const ok = safeSetJson(tenantKey, probabilities);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('storage_probabilities_updated'));
  }

  return ok;
}

