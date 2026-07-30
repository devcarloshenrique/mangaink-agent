// Cliente HTTP para comunicação com o backend MangaInk
// Backend: Fastify + JWT Bearer token na resposta JSON

import type {
  AuthResponse,
  LoginCredentials,
  RegisterData,
  UpdateProfileData,
  User,
} from "@/types/auth";
import type { InspectTriggerResponse, SourceInspectResponse } from "@/types/scraping";
import type {
  ConversionOptions,
  ConversionState,
  CreateConversionBody,
  CreateConversionResponse,
  ConversionListResult,
  ConversionStatus,
  UserPresetListResponse,
  UserPresetResponse,
  CreateUserPresetInput,
  UpdateUserPresetMetaInput,
} from "@/types/conversion";
import type { SSEJournalEvent } from "@/types/conversion";
import type { ChapterDownloadStatus, ChapterDownloadResponse } from "@/types/chapter-reader";
import type {
  ReadingProgress,
  MarkReadResponse,
  UnmarkReadResponse,
  BatchMarkReadInput,
  BatchMarkReadResponse,
} from "@/types/reading";
import { createSSEStream } from "@/lib/sse";

// ─── Constantes ───────────────────────────────────────────────────────────────
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

  const hasBody = options.body != null;

  const headers: HeadersInit = {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(path, {
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

// ─── Scraping API ─────────────────────────────────────────────────────────────

export const scrapingApi = {
  /**
   * POST /api/conversions/source/inspect
   * Dispara inspeção de URL. Retorna { sourceId, status }.
   * status = "ready" (200) → cache válido; status = "processing" (202) → job enfileirado
   */
  async inspect(url: string, refresh = false): Promise<InspectTriggerResponse> {
    const qs = refresh ? "?refresh=true" : "";
    return request<InspectTriggerResponse>(`/api/conversions/source/inspect${qs}`, {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  },

  /** GET /api/conversions/source/inspect/:sourceId — metadados completos */
  async getSource(sourceId: string): Promise<SourceInspectResponse> {
    return request<SourceInspectResponse>(`/api/conversions/source/inspect/${sourceId}`);
  },

  /**
   * SSE /api/conversions/source/inspect/:sourceId/events
   * SEM auth (token não necessário para scraping SSE)
   * Retorna { close } para fechar o stream.
   */
  inspectEvents(
    sourceId: string,
    handlers: {
      onProgress?: (data: { stage: string; message: string; progress: number }) => void;
      onCompleted?: (data: { sourceId: string }) => void;
      onFailed?: (data: { message: string }) => void;
      onError?: (error: Error) => void;
    },
  ): { close: () => void } {
    const url = `/api/conversions/source/inspect/${sourceId}/events`;
    return createSSEStream(url, {
      onEvent(event, data) {
        if (event === "progress") handlers.onProgress?.(data as never);
        else if (event === "completed") handlers.onCompleted?.(data as never);
        else if (event === "failed") handlers.onFailed?.(data as never);
      },
      onError: handlers.onError,
    });
    // sem token — endpoint público
  },
};

// ─── Conversions API ──────────────────────────────────────────────────────────

export const conversionsApi = {
  /**
   * GET /api/conversions/options — público (sem auth)
   * Catálogo de dispositivos, formatos, campos e presets.
   */
  async getOptions(): Promise<ConversionOptions> {
    return request<ConversionOptions>("/api/conversions/options");
  },

  /**
   * POST /api/conversions — requer auth
   * Cria uma nova Conversion. Retorna { conversionId, totalJobs, queued }.
   */
  async create(body: CreateConversionBody): Promise<CreateConversionResponse> {
    return request<CreateConversionResponse>("/api/conversions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** GET /api/conversions/:conversionId — estado agregado */
  async get(conversionId: string): Promise<ConversionState> {
    return request<ConversionState>(`/api/conversions/${conversionId}`);
  },

  /** GET /api/conversions/source/:sourceId/covers/:coverId — serve cover image bytes */
  coverUrl(sourceId: string, cover: { kind: string; coverId?: string }): string | null {
    if (cover.kind === "original") {
      return `/api/conversions/source/${sourceId}/covers/original`;
    }
    if (cover.kind === "gallery" && cover.coverId) {
      return `/api/conversions/source/${sourceId}/covers/${cover.coverId}`;
    }
    return null;
  },

  /** GET /api/conversions — listagem paginada por usuário */
  async list(params?: {
    page?: number;
    limit?: number;
    status?: ConversionStatus[];
    sourceId?: string;
  }): Promise<ConversionListResult> {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.sourceId) search.set("sourceId", params.sourceId);
    if (params?.status && params.status.length > 0) {
      search.set("status", params.status.join(","));
    }
    const qs = search.toString();
    return request<ConversionListResult>(`/api/conversions${qs ? `?${qs}` : ""}`);
  },

  /** DELETE /api/conversions/:conversionId — remove permanentemente */
  async remove(conversionId: string): Promise<{ conversionId: string; status: "deleted" }> {
    return request(`/api/conversions/${conversionId}`, { method: "DELETE" });
  },

  /** POST /api/conversions/:conversionId/cancel — cancela sem remover */
  async cancel(conversionId: string): Promise<{ conversionId: string; status: "cancelled" }> {
    return request(`/api/conversions/${conversionId}/cancel`, { method: "POST" });
  },

  /** GET /api/conversions/:conversionId/logs — eventos do journal (Redis) */
  async getLogs(conversionId: string): Promise<SSEJournalEvent[]> {
    return request<SSEJournalEvent[]>(`/api/conversions/${conversionId}/logs`);
  },

  /**
   * SSE /api/conversions/:conversionId/events — requer auth (token injetado)
   * Fan-in de todos os Jobs da Conversion.
   */
  events(
    conversionId: string,
    handlers: {
      onEvent: (event: string, data: unknown) => void;
      onError?: (error: Error) => void;
    },
  ): { close: () => void } {
    const url = `/api/conversions/${conversionId}/events`;
    const token = tokenStore.get() ?? undefined;
    return createSSEStream(url, handlers, token);
  },
};

// ─── User Presets API ─────────────────────────────────────────────────────────

export const presetsApi = {
  /** GET /api/conversions/presets — lista presets do usuario */
  async list(): Promise<UserPresetListResponse> {
    return request<UserPresetListResponse>("/api/conversions/presets");
  },

  /** POST /api/conversions/presets — cria novo preset */
  async create(body: CreateUserPresetInput): Promise<UserPresetResponse> {
    return request<UserPresetResponse>("/api/conversions/presets", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** PATCH /api/conversions/presets/:id — edita metadados */
  async updateMeta(presetId: string, body: UpdateUserPresetMetaInput): Promise<UserPresetResponse> {
    return request<UserPresetResponse>(`/api/conversions/presets/${presetId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  /** PUT /api/conversions/presets/:id/values — atualiza valores */
  async updateValues(
    presetId: string,
    values: Record<string, string | number | boolean>,
  ): Promise<UserPresetResponse> {
    return request<UserPresetResponse>(`/api/conversions/presets/${presetId}/values`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    });
  },

  /** DELETE /api/conversions/presets/:id — exclui preset */
  async remove(presetId: string): Promise<void> {
    return request(`/api/conversions/presets/${presetId}`, { method: "DELETE" });
  },
};

// ─── Chapters API ─────────────────────────────────────────────────────────────

export const chaptersApi = {
  /** POST /api/sources/:sourceId/chapters/:chapterId/download */
  async download(sourceId: string, chapterId: string): Promise<ChapterDownloadResponse> {
    return request<ChapterDownloadResponse>(
      `/api/sources/${sourceId}/chapters/${chapterId}/download`,
      {
        method: "POST",
      },
    );
  },

  /** GET /api/sources/:sourceId/chapters/:chapterId/download */
  async getDownloadStatus(sourceId: string, chapterId: string): Promise<ChapterDownloadStatus> {
    return request<ChapterDownloadStatus>(
      `/api/sources/${sourceId}/chapters/${chapterId}/download`,
    );
  },

  /** URL para EventSource SSE */
  downloadEventsUrl(sourceId: string, chapterId: string): string {
    return `/api/sources/${sourceId}/chapters/${chapterId}/download/events`;
  },

  /** URL da página (imagem) — endpoint público, sem auth */
  pageUrl(sourceId: string, chapterId: string, index: number): string {
    return `/api/sources/${sourceId}/chapters/${chapterId}/images/${index}`;
  },

  /** DELETE /api/sources/:sourceId/chapters/:chapterId/cache */
  async deleteCache(
    sourceId: string,
    chapterId: string,
  ): Promise<{ deleted: boolean; reason?: string }> {
    return request(`/api/sources/${sourceId}/chapters/${chapterId}/cache`, {
      method: "DELETE",
    });
  },
};

// ─── Reading API ────────────────────────────────────────────────────────────────

export const readingApi = {
  /** POST /api/reading/:sourceId/chapters/:chapterId — marca capítulo como lido */
  async markRead(sourceId: string, chapterId: string): Promise<MarkReadResponse> {
    return request<MarkReadResponse>(`/api/reading/${sourceId}/chapters/${chapterId}`, {
      method: "POST",
    });
  },

  /** DELETE /api/reading/:sourceId/chapters/:chapterId — desmarca capítulo */
  async unmarkRead(sourceId: string, chapterId: string): Promise<UnmarkReadResponse> {
    return request<UnmarkReadResponse>(`/api/reading/${sourceId}/chapters/${chapterId}`, {
      method: "DELETE",
    });
  },

  /** GET /api/reading/:sourceId — lista progresso de leitura */
  async getProgress(sourceId: string): Promise<ReadingProgress> {
    return request<ReadingProgress>(`/api/reading/${sourceId}`);
  },

  /** PUT /api/reading/:sourceId/batch — marca/desmarca em lote */
  async batchMarkRead(sourceId: string, body: BatchMarkReadInput): Promise<BatchMarkReadResponse> {
    return request<BatchMarkReadResponse>(`/api/reading/${sourceId}/batch`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
};
