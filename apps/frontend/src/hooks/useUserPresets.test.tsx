import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserPresets } from "@/hooks/useUserPresets";
import type { UserPresetListResponse, UserPresetResponse } from "@/types/conversion";

const mockPresets: UserPresetListResponse = {
  presets: [
    {
      id: "p1",
      name: "Meu Kindle",
      description: "Config Kindle",
      values: { mangaMode: true },
      isDefault: true,
      lastUsedAt: null,
      usageCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  limit: 20,
};

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

let mockListResponse: UserPresetListResponse | Error = mockPresets;
const mockCreate = vi.fn();
const mockUpdateMeta = vi.fn();
const mockUpdateValues = vi.fn();
const mockRemove = vi.fn();

vi.mock("@/lib/api", () => ({
  presetsApi: {
    list: vi.fn().mockImplementation(() => {
      if (mockListResponse instanceof Error) throw mockListResponse;
      return Promise.resolve(mockListResponse);
    }),
    create: (...args: unknown[]) => mockCreate(...args),
    updateMeta: (...args: unknown[]) => mockUpdateMeta(...args),
    updateValues: (...args: unknown[]) => mockUpdateValues(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
}));

describe("useUserPresets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListResponse = mockPresets;
    mockCreate.mockResolvedValue(mockPresets.presets[0]);
    mockUpdateMeta.mockResolvedValue(mockPresets.presets[0]);
    mockUpdateValues.mockResolvedValue(mockPresets.presets[0]);
    mockRemove.mockResolvedValue(undefined);
  });

  it("retorna lista de presets", async () => {
    const { result } = renderHook(() => useUserPresets(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].name).toBe("Meu Kindle");
    expect(result.current.limit).toBe(20);
    expect(result.current.isAtLimit).toBe(false);
  });

  it("detecta limite atingido", async () => {
    mockListResponse = { presets: [], limit: 0 };

    const { result } = renderHook(() => useUserPresets(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAtLimit).toBe(true);
  });

  it("create chama API e retorna preset criado", async () => {
    const newPreset: UserPresetResponse = {
      id: "p2",
      name: "Novo",
      values: {},
      isDefault: false,
      usageCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockCreate.mockResolvedValue(newPreset);

    const { result } = renderHook(() => useUserPresets(), { wrapper });

    const created = await result.current.create({ name: "Novo", values: {} });
    expect(created.id).toBe("p2");
    expect(mockCreate).toHaveBeenCalled();
    expect(mockCreate.mock.calls[0][0]).toEqual({ name: "Novo", values: {} });
  });

  it("remove chama API com presetId", async () => {
    const { result } = renderHook(() => useUserPresets(), { wrapper });

    await result.current.remove("p1");
    expect(mockRemove).toHaveBeenCalled();
    expect(mockRemove.mock.calls[0][0]).toBe("p1");
  });

  it("updateValues chama API corretamente", async () => {
    const { result } = renderHook(() => useUserPresets(), { wrapper });

    const created = await result.current.updateValues("p1", { gamma: 2.0 });
    expect(created).toBeDefined();
    expect(mockUpdateValues).toHaveBeenCalled();
    expect(mockUpdateValues.mock.calls[0][0]).toBe("p1");
    expect(mockUpdateValues.mock.calls[0][1]).toEqual({ gamma: 2.0 });
  });
});
