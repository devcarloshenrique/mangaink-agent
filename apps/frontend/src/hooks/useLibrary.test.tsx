import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { libraryApi } from "@/lib/api";
import { useLibrary, useAddToLibrary, useRemoveFromLibrary, useToggleFavorite } from "./useLibrary";

vi.mock("@/lib/api", () => ({
  libraryApi: {
    list: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    toggleFavorite: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe("useLibrary hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useLibrary", () => {
    it("deve carregar itens da biblioteca com queryKey ['library', options]", async () => {
      const mockResponse = {
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

      vi.mocked(libraryApi.list).mockResolvedValue(mockResponse);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLibrary({ isFavorite: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockResponse);
      expect(libraryApi.list).toHaveBeenCalledWith({ isFavorite: true });
    });
  });

  describe("useAddToLibrary", () => {
    it("deve executar mutação de add e invalidar query ['library']", async () => {
      const mockItem = {
        id: "lib-1",
        userId: "user-1",
        sourceId: "src-1",
        isFavorite: false,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      };

      vi.mocked(libraryApi.add).mockResolvedValue(mockItem);

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useAddToLibrary(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync("src-1");
      });

      expect(libraryApi.add).toHaveBeenCalledWith("src-1");
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["library"] }),
      );
    });
  });

  describe("useRemoveFromLibrary", () => {
    it("deve executar mutação de remoção e invalidar query ['library']", async () => {
      vi.mocked(libraryApi.remove).mockResolvedValue({ success: true });

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useRemoveFromLibrary(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync("src-1");
      });

      expect(libraryApi.remove).toHaveBeenCalledWith("src-1");
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["library"] }),
      );
    });
  });

  describe("useToggleFavorite", () => {
    it("deve executar toggleFavorite com update otimista e invalidar ['library']", async () => {
      const initialLibrary = {
        items: [
          {
            id: "lib-1",
            userId: "user-1",
            sourceId: "src-1",
            title: "Berserk",
            author: "Kentaro Miura",
            coverUrl: "http://example.com/cover.jpg",
            chaptersCount: 364,
            isFavorite: false,
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-01T00:00:00.000Z",
          },
        ],
        total: 1,
      };

      vi.mocked(libraryApi.toggleFavorite).mockResolvedValue({
        id: "lib-1",
        userId: "user-1",
        sourceId: "src-1",
        isFavorite: true,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      });

      const { wrapper, queryClient } = createWrapper();
      queryClient.setQueryData(["library", undefined], initialLibrary);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useToggleFavorite(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ sourceId: "src-1", isFavorite: true });
      });

      expect(libraryApi.toggleFavorite).toHaveBeenCalledWith("src-1", true);
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["library"] }),
      );
    });
  });
});
