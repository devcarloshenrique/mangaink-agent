import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/useReadingProgress", () => ({
  useBatchMarkRead: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ updatedCount: 3, readChapterIds: [] }),
    isPending: false,
  }),
}));

vi.mock("@/lib/api", () => ({
  chaptersApi: {
    deleteCache: vi.fn().mockResolvedValue({ deleted: true }),
    deleteCacheBatch: vi.fn().mockResolvedValue({ deletedCount: 2, totalCount: 2, failedCount: 0 }),
  },
  conversionsApi: {
    create: vi.fn().mockResolvedValue({ conversionId: "conv-1" }),
    events: () => ({ close: vi.fn() }),
  },
}));

const mockActiveDownloads = vi.hoisted(() => ({
  downloadingChapterIds: new Set<string>(),
  failedChapterMap: new Map<string, string>(),
}));

vi.mock("@/hooks/useSourceActiveDownloads", () => ({
  useSourceActiveDownloads: () => mockActiveDownloads,
}));

import { TabCapitulos } from "@/components/biblioteca/TabCapitulos";
import { chaptersApi } from "@/lib/api";
import type { Chapter } from "@/types/scraping";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const makeChapter = (overrides: Partial<Chapter> = {}) => ({
  id: "chap_0001",
  number: "1",
  title: "Capítulo 1",
  url: "https://test.com/ch/1",
  pages: 20,
  volume: null,
  isDownloaded: false,
  isRead: false,
  ...overrides,
});

describe("TabCapitulos", () => {
  const onDownloadRequest = vi.fn();
  const onToggleRead = vi.fn();
  const emptySet = new Set<string>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve renderizar capitulos com badges isDownloaded", () => {
    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "Cap 1", isDownloaded: true }),
      makeChapter({ id: "ch2", number: "2", title: "Cap 2", isDownloaded: false }),
    ];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        readChapterIds={emptySet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Cap 1")).toBeTruthy();
    expect(screen.getByText("Cap 2")).toBeTruthy();
  });

  it("deve exibir mensagem quando lista vazia", () => {
    render(
      <TabCapitulos
        chapters={[]}
        sourceId="src-test"
        readChapterIds={emptySet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Nenhum capítulo disponível.")).toBeTruthy();
  });

  it("deve filtrar capitulos por numero na barra de pesquisa", () => {
    const chapters = [
      makeChapter({ id: "ch1", number: "10", title: "Capitulo Dez" }),
      makeChapter({ id: "ch2", number: "20", title: "Capitulo Vinte" }),
    ];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        readChapterIds={emptySet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    const input = screen.getByPlaceholderText("Buscar por título...");
    fireEvent.change(input, { target: { value: "10" } });

    expect(screen.getByText((c) => c.includes("10"))).toBeTruthy();
    expect(screen.queryByText((c) => c.includes("Vinte"))).toBeNull();
    expect(screen.getByText("1 de 2 capítulos")).toBeTruthy();
  });

  it("deve exibir mensagem de nenhum resultado quando filtro nao encontra", () => {
    const chapters = [makeChapter({ id: "ch1", number: "1", title: "Cap 1" })];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        readChapterIds={emptySet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    const input = screen.getByPlaceholderText("Buscar por título...");
    fireEvent.change(input, { target: { value: "inexistente" } });

    expect(screen.getByText(/Nenhum capítulo encontrado/)).toBeTruthy();
  });

  it("deve filtrar capitulos por titulo", () => {
    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "O Inicio" }),
      makeChapter({ id: "ch2", number: "2", title: "O Fim" }),
    ];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        readChapterIds={emptySet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    const input = screen.getByPlaceholderText("Buscar por título...");
    fireEvent.change(input, { target: { value: "Inicio" } });

    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent).toBe("Inicio");
    expect(screen.queryByText("O Fim")).toBeNull();
  });

  it("deve executar batchDeleteCache chamando deleteCacheBatch sem toast de loading", async () => {
    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "Cap 1", isDownloaded: true }),
      makeChapter({ id: "ch2", number: "2", title: "Cap 2", isDownloaded: true }),
    ];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        readChapterIds={emptySet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    // Ativa modo seleção
    const selectBtn = screen.getByRole("button", { name: "Selecionar capítulos" });
    fireEvent.click(selectBtn);

    // Seleciona todos
    const selectAllCheckbox = screen.getByLabelText("Selecionar todos os capítulos");
    fireEvent.click(selectAllCheckbox);

    // Clica no botão de apagar
    const deleteBtn = screen.getByRole("button", { name: /Apagar 2 do disco/i });
    fireEvent.click(deleteBtn);

    expect(chaptersApi.deleteCacheBatch).toHaveBeenCalledWith("src-test", ["ch1", "ch2"]);
  });

  it("deve filtrar apenas capítulos baixados ao selecionar tudo e apagar do disco", async () => {
    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "Cap 1", isDownloaded: true }),
      makeChapter({ id: "ch2", number: "2", title: "Cap 2", isDownloaded: false }),
      makeChapter({ id: "ch3", number: "3", title: "Cap 3", isDownloaded: true }),
    ];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        readChapterIds={emptySet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    // Ativa modo seleção
    fireEvent.click(screen.getByRole("button", { name: "Selecionar capítulos" }));

    // Seleciona todos (3 selecionados, mas só 2 baixados)
    fireEvent.click(screen.getByLabelText("Selecionar todos os capítulos"));

    // O botão deve indicar exatamente "Apagar 2 do disco"
    const deleteBtn = screen.getByRole("button", { name: /Apagar 2 do disco/i });
    expect(deleteBtn).toBeTruthy();

    fireEvent.click(deleteBtn);

    // Envia apenas ch1 e ch3 para o backend
    expect(chaptersApi.deleteCacheBatch).toHaveBeenCalledWith("src-test", ["ch1", "ch3"]);
  });

  it("não deve exibir botão de apagar se nenhum dos selecionados estiver baixado", () => {
    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "Cap 1", isDownloaded: false }),
      makeChapter({ id: "ch2", number: "2", title: "Cap 2", isDownloaded: false }),
    ];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        readChapterIds={emptySet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByRole("button", { name: "Selecionar capítulos" }));
    fireEvent.click(screen.getByLabelText("Selecionar todos os capítulos"));

    // Não deve renderizar botão de apagar do disco
    expect(screen.queryByRole("button", { name: /Apagar .* do disco/i })).toBeNull();
  });

  it("deve exibir spinner e texto 'Baixando...' para capítulos em download", () => {
    mockActiveDownloads.downloadingChapterIds = new Set(["ch1"]);
    mockActiveDownloads.failedChapterMap = new Map();

    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "Cap 1", isDownloaded: false }),
      makeChapter({ id: "ch2", number: "2", title: "Cap 2", isDownloaded: false }),
    ];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        readChapterIds={emptySet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Baixando...")).toBeTruthy();
  });

  it("deve exibir aviso e badge para capítulos com unavailableReason vindo da API mesmo sem live map", () => {
    mockActiveDownloads.downloadingChapterIds = new Set();
    mockActiveDownloads.failedChapterMap = new Map();

    const chapters = [
      makeChapter({
        id: "ch1",
        number: "1",
        title: "Cap 1",
        isDownloaded: false,
        unavailableReason: "Indisponível no site de origem",
      }),
      makeChapter({ id: "ch2", number: "2", title: "Cap 2", isDownloaded: false }),
    ];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        readChapterIds={emptySet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Indisponível no site de origem")).toBeTruthy();
  });

  it("não deve exibir spinner de download se o capítulo já estiver baixado (isDownloaded: true)", () => {
    mockActiveDownloads.downloadingChapterIds = new Set(["ch1"]);
    mockActiveDownloads.failedChapterMap = new Map();

    const chapters = [makeChapter({ id: "ch1", number: "1", title: "Cap 1", isDownloaded: true })];

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        readChapterIds={emptySet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByText("Baixando...")).toBeNull();
  });
});
