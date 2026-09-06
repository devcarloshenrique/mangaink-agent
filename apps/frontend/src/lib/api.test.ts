import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { conversionsApi, libraryApi, tokenStore } from "./api";

describe("conversionsApi.coverUrl", () => {
  const sourceId = "src_123";

  it("retorna URL para capa original", () => {
    expect(conversionsApi.coverUrl(sourceId, { kind: "original" })).toBe(
      "/api/conversions/source/src_123/covers/original",
    );
  });

  it("retorna URL para capa da galeria", () => {
    expect(conversionsApi.coverUrl(sourceId, { kind: "gallery", coverId: "cov_99" })).toBe(
      "/api/conversions/source/src_123/covers/cov_99",
    );
  });

  it("retorna URL para capa enviada por upload", () => {
    expect(
      conversionsApi.coverUrl(sourceId, {
        kind: "upload",
        uploadId: "up_abc_123",
        name: "capa.png",
      }),
    ).toBe("/api/conversions/covers/uploaded/up_abc_123");
  });

  it("retorna null se tipo for desconhecido ou inválido", () => {
    expect(conversionsApi.coverUrl(sourceId, { kind: "unknown" })).toBeNull();
    expect(conversionsApi.coverUrl(sourceId, { kind: "gallery" })).toBeNull();
    expect(conversionsApi.coverUrl(sourceId, { kind: "upload" })).toBeNull();
  });
});

describe("conversionsApi.uploadCover", () => {
  const originalFetch = globalThis.fetch;
  const originalFileReader = globalThis.FileReader;

  beforeEach(() => {
    tokenStore.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalFileReader;
    vi.restoreAllMocks();
  });

  it("converte arquivo para base64 e envia para /api/conversions/covers/upload sem sourceId e label opcionais", async () => {
    // Mock FileReader
    class MockFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: string | null = null;

      readAsDataURL() {
        this.result = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA";
        setTimeout(() => {
          this.onload?.();
        }, 0);
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    const mockResponse = {
      uploadId: "upl_12345",
      name: "minha_capa.png",
      url: "/api/conversions/covers/uploaded/upl_12345",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const file = new File(["dummy content"], "minha_capa.png", { type: "image/png" });

    const result = await conversionsApi.uploadCover(file);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/conversions/covers/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: "minha_capa.png",
        contentType: "image/png",
        base64Data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
      }),
      credentials: "include",
    });

    expect(result).toEqual(mockResponse);
  });

  it("envia sourceId e label no body de uploadCover quando fornecidos", async () => {
    class MockFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: string | null = null;

      readAsDataURL() {
        this.result = "data:image/jpeg;base64,jpegdata==";
        setTimeout(() => {
          this.onload?.();
        }, 0);
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    const mockResponse = {
      uploadId: "upl_custom_777",
      name: "Volume 3 Personalizado.jpg",
      url: "/api/conversions/covers/uploaded/upl_custom_777",
      sourceId: "src_berserk_123",
      coverId: "cov_custom_777",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockResponse,
    });

    const file = new File(["dummy content"], "Volume 3 Personalizado.jpg", { type: "image/jpeg" });

    const result = await conversionsApi.uploadCover(
      file,
      "src_berserk_123",
      "Volume 3 Personalizado.jpg",
    );

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/conversions/covers/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceId: "src_berserk_123",
        label: "Volume 3 Personalizado.jpg",
        fileName: "Volume 3 Personalizado.jpg",
        contentType: "image/jpeg",
        base64Data: "data:image/jpeg;base64,jpegdata==",
      }),
      credentials: "include",
    });

    expect(result).toEqual(mockResponse);
  });

  it("deleteCover deve chamar DELETE /api/conversions/covers/:coverId", async () => {
    const mockResponse = {
      success: true,
      message: "Capa excluída com sucesso",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await conversionsApi.deleteCover("cov_custom_123");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/conversions/covers/cov_custom_123", {
      method: "DELETE",
      headers: {},
      credentials: "include",
    });
    expect(result).toEqual(mockResponse);
  });
});

describe("libraryApi", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    tokenStore.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("libraryApi.list deve chamar GET /api/library com query params corretos", async () => {
    const mockData = {
      items: [
        {
          id: "lib-1",
          userId: "user-1",
          sourceId: "src-1",
          title: "Berserk",
          author: "Kentaro Miura",
          coverUrl: "http://example.com/cover.jpg",
          chaptersCount: 364,
          isFavorite: true,
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      total: 1,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await libraryApi.list({ isFavorite: true, query: "berserk" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/library?isFavorite=true&query=berserk",
      expect.objectContaining({
        credentials: "include",
      }),
    );
    expect(result).toEqual(mockData);
  });

  it("libraryApi.add deve chamar POST /api/library com sourceId", async () => {
    const mockItem = {
      id: "lib-1",
      userId: "user-1",
      sourceId: "src-berserk",
      isFavorite: false,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockItem,
    });

    const result = await libraryApi.add("src-berserk");

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/library", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sourceId: "src-berserk" }),
      credentials: "include",
    });
    expect(result).toEqual(mockItem);
  });

  it("libraryApi.remove deve chamar DELETE /api/library/:sourceId", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const result = await libraryApi.remove("src-berserk");

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/library/src-berserk", {
      method: "DELETE",
      headers: {},
      credentials: "include",
    });
    expect(result).toEqual({ success: true });
  });

  it("libraryApi.toggleFavorite deve chamar PATCH /api/library/:sourceId/favorite", async () => {
    const mockItem = {
      id: "lib-1",
      userId: "user-1",
      sourceId: "src-berserk",
      isFavorite: true,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockItem,
    });

    const result = await libraryApi.toggleFavorite("src-berserk", true);

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/library/src-berserk/favorite", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isFavorite: true }),
      credentials: "include",
    });
    expect(result).toEqual(mockItem);
  });
});
