import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { loadProviderPage, useProviderSearch } from "./useProviderSearch";
import { scrapingApi } from "@/lib/api";
import type { SearchSourcesResponse } from "@/types/scraping";

vi.mock("@/lib/api", () => ({
  scrapingApi: {
    search: vi.fn(),
  },
}));

const mockSearchResponse: SearchSourcesResponse = {
  query: "one piece",
  results: [
    {
      providerSlug: "mangalivre",
      title: "One Piece",
      url: "https://mangalivre.net/manga/one-piece/1",
      coverUrl: "https://mangalivre.net/cover.jpg",
    },
  ],
  errors: [],
  searchedProviders: ["mangalivre"],
  truncated: false,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useProviderSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(scrapingApi.search).mockResolvedValue(mockSearchResponse);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("inicia com valores padrões e desabilitado para queries vazias", () => {
    const { result } = renderHook(() => useProviderSearch(), {
      wrapper: createWrapper(),
    });

    expect(result.current.query).toBe("");
    expect(result.current.debouncedQuery).toBe("");
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
    expect(result.current.error).toBeNull();
    expect(scrapingApi.search).not.toHaveBeenCalled();
  });

  it("aplica debounce de 300ms ao atualizar query com setQuery", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useProviderSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery("naruto");
    });

    expect(result.current.query).toBe("naruto");
    expect(result.current.debouncedQuery).toBe("");

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current.debouncedQuery).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.debouncedQuery).toBe("naruto");
  });

  it("não dispara busca na API quando debouncedQuery tiver menos de 2 caracteres", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useProviderSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery("a");
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedQuery).toBe("a");
    expect(scrapingApi.search).not.toHaveBeenCalled();
  });

  it("dispara busca e popula data quando a busca for concluída", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useProviderSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery("one piece");
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedQuery).toBe("one piece");

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(scrapingApi.search).toHaveBeenCalledWith(
      "one piece",
      undefined,
      expect.any(AbortSignal),
    );
    expect(result.current.data).toEqual(mockSearchResponse);
  });

  it("expõe erro caso a requisição falhe", async () => {
    vi.useFakeTimers();
    vi.mocked(scrapingApi.search).mockRejectedValueOnce(new Error("Falha na rede"));

    const { result } = renderHook(() => useProviderSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery("bleach");
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.error).toEqual(new Error("Falha na rede"));
  });

  it("carrega página específica de um provedor usando loadProviderPage do hook", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useProviderSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery("dragon ball");
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await act(async () => {
      await result.current.loadProviderPage("mangalivre", 10, 5);
    });

    expect(scrapingApi.search).toHaveBeenCalledWith(
      "dragon ball",
      { providers: "mangalivre", limit: 5, offset: 10 },
      undefined,
    );
  });
});

describe("loadProviderPage standalone", () => {
  it("chama scrapingApi.search com parâmetros corretos", async () => {
    vi.mocked(scrapingApi.search).mockResolvedValueOnce(mockSearchResponse);

    const controller = new AbortController();
    const res = await loadProviderPage("hunter x hunter", "mangadex", 20, 10, controller.signal);

    expect(scrapingApi.search).toHaveBeenCalledWith(
      "hunter x hunter",
      { providers: "mangadex", limit: 10, offset: 20 },
      controller.signal,
    );
    expect(res).toEqual(mockSearchResponse);
  });
});
