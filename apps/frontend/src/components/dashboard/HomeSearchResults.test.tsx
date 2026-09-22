import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { HomeSearchResults } from "./HomeSearchResults";
import type { ProviderRecord, SearchSourcesResponse } from "@/types/scraping";

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn().mockReturnValue("toast-1"),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock do hook useScraping
const mockInspect = vi.fn();
const mockReset = vi.fn();
let mockScrapingState = {
  sourceId: null as string | null,
  status: "idle",
  progress: 0,
  message: null as string | null,
  metadata: null as unknown,
  error: null as string | null,
};

vi.mock("@/hooks/useScraping", () => ({
  useScraping: () => ({
    state: mockScrapingState,
    inspect: mockInspect,
    reset: mockReset,
  }),
}));

const mockProviders: ProviderRecord[] = [
  {
    slug: "mangadex",
    name: "MangaDex",
    engine: "api",
    tags: [],
    status: "active",
    homepage: null,
    rateLimit: {
      maxConcurrent: 5,
      minTime: 100,
      reservoir: null,
      reservoirRefreshInterval: null,
    },
  },
];

const mockSearchData: SearchSourcesResponse = {
  query: "naruto",
  results: [
    {
      providerSlug: "mangadex",
      title: "Naruto Manga",
      url: "https://mangadex.org/title/naruto-1",
      coverUrl: null,
    },
  ],
  errors: [],
  searchedProviders: ["mangadex"],
  truncated: false,
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("HomeSearchResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScrapingState = {
      sourceId: null,
      status: "idle",
      progress: 0,
      message: null,
      metadata: null,
      error: null,
    };
  });

  it("renderiza os trilhos de resultados por provedor", () => {
    renderWithClient(
      <HomeSearchResults
        providers={mockProviders}
        debouncedQuery="naruto"
        data={mockSearchData}
        isFetching={false}
        error={null}
        refetch={vi.fn()}
      />,
    );

    expect(screen.getByText("MangaDex")).toBeInTheDocument();
    expect(screen.getByText("Naruto Manga")).toBeInTheDocument();
  });

  it("dispara inspect e exibe toast de loading ao clicar em um card", async () => {
    mockInspect.mockResolvedValueOnce(undefined);

    renderWithClient(
      <HomeSearchResults
        providers={mockProviders}
        debouncedQuery="naruto"
        data={mockSearchData}
        isFetching={false}
        error={null}
        refetch={vi.fn()}
      />,
    );

    const cardButton = screen.getByRole("button", { name: /Adicionar Naruto Manga/i });
    fireEvent.click(cardButton);

    expect(mockReset).toHaveBeenCalled();
    expect(mockInspect).toHaveBeenCalledWith("https://mangadex.org/title/naruto-1");
    expect(toast.loading).toHaveBeenCalledWith("Analisando obra e coletando capítulos...");
  });

  it("exibe toast de erro quando a inspeção falha", async () => {
    const { rerender } = renderWithClient(
      <HomeSearchResults
        providers={mockProviders}
        debouncedQuery="naruto"
        data={mockSearchData}
        isFetching={false}
        error={null}
        refetch={vi.fn()}
      />,
    );

    const cardButton = screen.getByRole("button", { name: /Adicionar Naruto Manga/i });
    fireEvent.click(cardButton);

    // Simula transição para failed
    mockScrapingState = {
      sourceId: null,
      status: "failed",
      progress: 0,
      message: null,
      metadata: null,
      error: "Fonte temporariamente offline",
    };

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <HomeSearchResults
          providers={mockProviders}
          debouncedQuery="naruto"
          data={mockSearchData}
          isFetching={false}
          error={null}
          refetch={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Fonte temporariamente offline");
    });
  });
});
