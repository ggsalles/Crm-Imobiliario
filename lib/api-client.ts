/**
 * Cliente HTTP Centralizado (apiClient)
 * Fornece métodos tipados (get, post, put, patch, delete) com:
 * - Tratamento defensivo de JSON (sem SyntaxError de corpo vazio)
 * - Injeção automática de Bearer Token e x-tenant-id
 * - Timeout configurável com AbortController
 * - Detecção e notificação de sessão expirada (401/403)
 * - Suporte a SSR e Browser
 */

import { supabase } from "@/lib/supabase";
import { safeJsonParse, safeGetItem } from "@/lib/safe-storage";

export interface ApiClientOptions extends RequestInit {
  timeout?: number;
  skipAuth?: boolean;
}

export class ApiClientError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Obtém a sessão atual com fallback resiliente
 */
async function getAuthToken(): Promise<{ token: string | null; tenantId: string | null; userId: string | null; email: string | null }> {
  if (typeof window === "undefined") {
    return { token: null, tenantId: null, userId: null, email: null };
  }

  try {
    let token: string | null = null;
    let userId: string | null = null;
    let email: string | null = null;

    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      token = session?.access_token || null;
      userId = session?.user?.id || null;
      email = session?.user?.email || null;
    } catch {}

    if (!token || !userId) {
      const rawSession = safeGetItem("crm-imob-session-v5", "sessionStorage") ||
                         safeGetItem("crm-imob-session-v4", "sessionStorage") ||
                         safeGetItem("crm-imob-session-v4", "localStorage");
      if (rawSession) {
        const parsed = safeJsonParse<{ access_token?: string; user?: { id?: string; email?: string } }>(rawSession);
        if (parsed?.access_token && !token) {
          token = parsed.access_token;
        }
        if (parsed?.user?.id && !userId) {
          userId = parsed.user.id;
        }
        if (parsed?.user?.email && !email) {
          email = parsed.user.email;
        }
      }
    }

    let activeTenant: string | null = null;
    if (userId) {
      activeTenant = safeGetItem(`active-tenant-id:${userId}`, "sessionStorage");
    }
    if (!activeTenant) {
      activeTenant = safeGetItem("login-chosen-tenant-id", "sessionStorage");
    }
    if (!activeTenant) {
      activeTenant = safeGetItem("active-tenant-id", "sessionStorage") || safeGetItem("active-tenant-id", "localStorage");
    }
    if (!activeTenant && userId) {
      const cachedProfileStr = safeGetItem(`local-profile:${userId}`, "sessionStorage");
      if (cachedProfileStr) {
        const cached = safeJsonParse<any>(cachedProfileStr, null);
        activeTenant = cached?.tenantId || null;
        if (!email && cached?.email) email = cached.email;
      }
    }

    return { token, tenantId: activeTenant, userId, email };
  } catch {
    return { token: null, tenantId: null, userId: null, email: null };
  }
}

/**
 * Função base de requisição com tratamento completo de resiliência
 */
export async function apiRequest<T = any>(
  url: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const isServer = typeof window === "undefined";
  const { timeout = 12000, skipAuth = false, headers: customHeaders, ...fetchOptions } = options;

  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  // Se body existir e não for FormData e não tiver Content-Type, define como JSON
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !reqHeaders["Content-Type"]) {
    reqHeaders["Content-Type"] = "application/json";
  }

  // Injeção de autenticação e tenant
  if (!skipAuth && !isServer) {
    const { token, tenantId, userId, email } = await getAuthToken();
    if (token && !reqHeaders["Authorization"]) {
      reqHeaders["Authorization"] = `Bearer ${token}`;
    }
    if (tenantId && tenantId !== "undefined" && tenantId !== "null" && !reqHeaders["x-tenant-id"]) {
      reqHeaders["x-tenant-id"] = tenantId;
    }
    if (userId && !reqHeaders["x-user-id"]) {
      reqHeaders["x-user-id"] = userId;
    }
    if (email && !reqHeaders["x-user-email"]) {
      reqHeaders["x-user-email"] = email;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: reqHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Tratamento de expiração de sessão
    if ((response.status === 401 || response.status === 403) && !isServer && !skipAuth) {
      console.warn(`[apiClient] Requisição não autorizada (${response.status}) para ${url}`);
      window.dispatchEvent(new CustomEvent("app-session-expired"));
    }

    const rawText = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    // Tratamento defensivo de erro HTTP
    if (!response.ok) {
      let errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
      let errorData: any = null;

      if (rawText && rawText.trim().length > 0) {
        errorData = isJson ? safeJsonParse(rawText, null) : rawText;
        if (errorData && typeof errorData === "object" && errorData.error) {
          errorMessage = errorData.error;
        } else if (typeof errorData === "string" && errorData.length < 150) {
          errorMessage = errorData;
        }
      }

      throw new ApiClientError(errorMessage, response.status, errorData);
    }

    // Tratamento defensivo de respostas de sucesso vazias (204 No Content ou corpo vazio)
    if (!rawText || rawText.trim() === "") {
      return null as unknown as T;
    }

    if (isJson || rawText.trim().startsWith("{") || rawText.trim().startsWith("[")) {
      const parsed = safeJsonParse<T>(rawText, null as unknown as T);
      return parsed;
    }

    return rawText as unknown as T;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error?.name === "AbortError") {
      throw new ApiClientError(`A requisição excedeu o tempo limite de ${Math.round(timeout / 1000)}s.`, 408);
    }

    if (error instanceof ApiClientError) {
      throw error;
    }

    throw new ApiClientError(error?.message || "Falha de conexão com o servidor.", 0);
  }
}

/**
 * Instância exportada do cliente com métodos utilitários
 */
export const apiClient = {
  get: <T = any>(url: string, options?: ApiClientOptions) =>
    apiRequest<T>(url, { ...options, method: "GET" }),

  post: <T = any>(url: string, body?: any, options?: ApiClientOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: "POST",
      body: body !== undefined && !(body instanceof FormData) ? JSON.stringify(body) : body,
    }),

  put: <T = any>(url: string, body?: any, options?: ApiClientOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: "PUT",
      body: body !== undefined && !(body instanceof FormData) ? JSON.stringify(body) : body,
    }),

  patch: <T = any>(url: string, body?: any, options?: ApiClientOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: "PATCH",
      body: body !== undefined && !(body instanceof FormData) ? JSON.stringify(body) : body,
    }),

  delete: <T = any>(url: string, options?: ApiClientOptions) =>
    apiRequest<T>(url, { ...options, method: "DELETE" }),
};
