import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConversionOptions } from "@/hooks/useConversionOptions";
import type { ConversionOptions } from "@/types/conversion";

const mockOptions: ConversionOptions = {
  devices: [{ id: "K11", name: "Kindle 11", resolution: "1072x1448" }],
  formats: [{ id: "EPUB", name: "EPUB", default: true }],
  fields: [
    {
      id: "mangaMode",
      type: "boolean",
      component: "switch",
      label: "Mangá",
      description: "",
      help: "",
      default: false,
      group: "reading",
    },
  ],
  presets: [{ id: "manga", name: "Mangá", description: "Otimizado", values: { mangaMode: true } }],
};

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

let mockApiResponse: ConversionOptions | Error = mockOptions;
vi.mock("@/lib/api", () => ({
  conversionsApi: {
    getOptions: vi.fn().mockImplementation(() => {
      if (mockApiResponse instanceof Error) throw mockApiResponse;
      return Promise.resolve(mockApiResponse);
    }),
  },
}));

describe("useConversionOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiResponse = mockOptions;
  });

  it("deve retornar dados quando API responde", async () => {
    const { result } = renderHook(() => useConversionOptions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.devices).toHaveLength(1);
    expect(result.current.data?.formats[0].id).toBe("EPUB");
  });

  it("deve retornar isLoading enquanto carrega", () => {
    mockApiResponse = new Promise(() => {}) as any;

    const { result } = renderHook(() => useConversionOptions(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
  });
});
