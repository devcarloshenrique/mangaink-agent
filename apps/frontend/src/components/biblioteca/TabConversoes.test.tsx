import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

const mockRemove = vi.fn().mockResolvedValue({ conversionId: "conv-1", status: "deleted" });
const mockDownload = vi.fn().mockResolvedValue(undefined);
const mockReconvert = vi.fn();
const mockCancel = vi.fn();

vi.mock("@/hooks/useConversionActions", () => ({
  useConversionActions: () => ({
    remove: mockRemove,
    download: mockDownload,
    reconvert: mockReconvert,
    cancel: mockCancel,
  }),
}));

const mockUseSourceConversions = vi.fn();
vi.mock("@/hooks/useSourceConversions", () => ({
  useSourceConversions: (sourceId: string) => mockUseSourceConversions(sourceId),
}));

import { TabConversoes } from "@/components/biblioteca/TabConversoes";
import type { ConversionLot } from "@/types/conversion-tab.types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockLotsData: ConversionLot[] = [
  {
    id: "conv-1",
    title: "MOBI · 12 jul",
    device: "Paperwhite 11",
    format: "MOBI",
    status: "completed",
    createdAt: "2026-07-12T10:00:00Z",
    totalMB: "24,5 MB",
    live: false,
    series: "Mushoku Tensei",
    vols: [
      {
        id: "job-1",
        vol: "Vol. 1",
        ch: "Cap. 1 – 6",
        size: "12,4 MB",
        state: "completed",
        outputFile: "Mushoku Tensei - Vol. 1.mobi",
      },
      {
        id: "job-2",
        vol: "Vol. 2",
        ch: "Cap. 7 – 12",
        size: "12,1 MB",
        state: "completed",
        outputFile: "Mushoku Tensei - Vol. 2.mobi",
      },
    ],
  },
  {
    id: "conv-2",
    title: "PDF · 15 jul",
    device: "Kindle Scribe",
    format: "PDF",
    status: "processing",
    createdAt: "2026-07-15T12:00:00Z",
    totalMB: "15,0 MB",
    live: true,
    series: "Mushoku Tensei",
    vols: [
      {
        id: "job-3",
        vol: "Vol. 1",
        ch: "Cap. 1 – 6",
        size: "15,0 MB",
        state: "converting",
        pct: 45,
      },
    ],
  },
];

describe("TabConversoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve exibir estado vazio quando não houver conversões", () => {
    mockUseSourceConversions.mockReturnValue({
      conversions: [],
      lots: [],
      selectedLot: null,
      selectedId: null,
      setSelectedId: vi.fn(),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<TabConversoes sourceId="src-test" />, { wrapper: Wrapper });

    expect(screen.getByText("Nenhuma conversão ainda")).toBeTruthy();
    expect(screen.getByText("Converter esta obra")).toBeTruthy();
  });

  it("deve redirecionar para o wizard ao clicar em converter esta obra no estado vazio", () => {
    mockUseSourceConversions.mockReturnValue({
      conversions: [],
      lots: [],
      selectedLot: null,
      selectedId: null,
      setSelectedId: vi.fn(),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<TabConversoes sourceId="src-test" />, { wrapper: Wrapper });

    const btn = screen.getByText("Converter esta obra");
    fireEvent.click(btn);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/wizard",
      search: { sourceId: "src-test" },
    });
  });

  it("deve renderizar os volumes e informações do lote selecionado", () => {
    mockUseSourceConversions.mockReturnValue({
      conversions: [{ conversionId: "conv-1" }, { conversionId: "conv-2" }],
      lots: mockLotsData,
      selectedLot: mockLotsData[0],
      selectedId: "conv-1",
      setSelectedId: vi.fn(),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<TabConversoes sourceId="src-test" seriesTitle="Mushoku Tensei" />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText("MOBI · 12 jul")).toBeTruthy();
    expect(screen.getByText("Paperwhite 11")).toBeTruthy();
    expect(screen.getAllByText(/Vol\. 1/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cap\. 1 – 6/)).toBeTruthy();
    expect(screen.getAllByText(/Vol\. 2/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cap\. 7 – 12/)).toBeTruthy();
    expect(screen.getAllByText("Pronto").length).toBeGreaterThan(0);
  });

  it("deve navegar para o leitor ao clicar no botão Ler de um volume concluído", () => {
    mockUseSourceConversions.mockReturnValue({
      conversions: [{ conversionId: "conv-1" }],
      lots: mockLotsData,
      selectedLot: mockLotsData[0],
      selectedId: "conv-1",
      setSelectedId: vi.fn(),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<TabConversoes sourceId="src-test" />, { wrapper: Wrapper });

    const lerButtons = screen.getAllByRole("button", { name: /ler/i });
    expect(lerButtons.length).toBe(2);
    fireEvent.click(lerButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/biblioteca/reader/$conversionId",
      params: { conversionId: "conv-1" },
      search: { jobId: "job-1" },
    });
  });

  it("deve permitir selecionar volumes e acionar download em lote", async () => {
    mockUseSourceConversions.mockReturnValue({
      conversions: [{ conversionId: "conv-1" }],
      lots: mockLotsData,
      selectedLot: mockLotsData[0],
      selectedId: "conv-1",
      setSelectedId: vi.fn(),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<TabConversoes sourceId="src-test" />, { wrapper: Wrapper });

    const selectAllCheckbox = screen.getByLabelText("Selecionar todos");
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText("2 selecionados")).toBeTruthy();

    const baixarBtn = screen.getByRole("button", { name: /^baixar$/i });
    fireEvent.click(baixarBtn);

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith("conv-1", "job-1");
      expect(mockDownload).toHaveBeenCalledWith("conv-1", "job-2");
    });
  });
});
