// Cliente HTTP para comunicação com o backend MangaInk
// Backend: Fastify + JWT Bearer token na resposta JSON

import type { AuthResponse, LoginCredentials, RegisterData, UpdateProfileData, User } from "@/types/auth";

// ─── Constantes ───────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "mangaink_token";

// ─── Gerenciamento de token ───────────────────────────────────────────────────
/** Token mantido em memória para uso durante a sessão */
let _memoryToken: string | null = null;

export const tokenStore = {
  get(): string | null {
    if (_memoryToken) return _memoryToken;
    // Fallback para localStorage (persistência entre reloads)
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    _memoryToken = token;
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    _memoryToken = null;
    localStorage.removeItem(TOKEN_KEY);
  },
};

// ─── Classe de erro da API ────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Fetch base ───────────────────────────────────────────────────────────────
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let body: { error?: string; issues?: unknown } = {};
    try {
      body = await response.json();
    } catch {
      // ignora
    }
    throw new ApiError(response.status, body.error ?? "Erro desconhecido", body.issues);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

// ─── Endpoints de Auth ────────────────────────────────────────────────────────
export const authApi = {
  /** POST /auth/login */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const data = await request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    tokenStore.set(data.token);
    return data;
  },

  /** POST /auth/register */
  async register(payload: RegisterData): Promise<AuthResponse> {
    const data = await request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    tokenStore.set(data.token);
    return data;
  },

  /** GET /auth/me — valida token e retorna usuário atual */
  async me(): Promise<User> {
    return request<User>("/auth/me");
  },

  /** Logout local (o backend não possui endpoint dedicado ainda) */
  logout(): void {
    tokenStore.clear();
  },
};

/** PATCH /users/me */
export const userApi = {
  async updateMe(data: UpdateProfileData): Promise<User> {
    return request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};
