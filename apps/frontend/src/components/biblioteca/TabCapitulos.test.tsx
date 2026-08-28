import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

const mockBatchMutateAsync = vi.fn();
vi.mock("@/hooks/useReadingProgress", () => ({
  useBatchMarkRead: () => ({
    mutateAsync: mockBatchMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/lib/api", () => ({
  chaptersApi: {
    download: vi.fn().mockResolvedValue(undefined),
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

const makeChapter = (overrides: Partial<Chapter> = {}): Chapter => ({
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
    mockActiveDownloads.downloadingChapterIds = new Set();
    mockActiveDownloads.failedChapterMap = new Map();
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

  it("deve alternar a ordenação entre crescente e decrescente", () => {
    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "Primeiro" }),
      makeChapter({ id: "ch2", number: "2", title: "Segundo" }),
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

    const sortButton = screen.getByLabelText(/ordenar decrescente/i);
    fireEvent.click(sortButton);

    expect(screen.getByLabelText(/ordenar crescente/i)).toBeInTheDocument();
  });

  it("deve filtrar por capítulos não lidos e baixados via abas de filtro", () => {
    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "Lido Baixado", isDownloaded: true }),
      makeChapter({ id: "ch2", number: "2", title: "Não Lido Não Baixado", isDownloaded: false }),
    ];
    const readSet = new Set(["ch1"]);

    render(
      <TabCapitulos
        chapters={chapters}
        sourceId="src-test"
        readChapterIds={readSet}
        onToggleRead={onToggleRead}
        onDownloadRequest={onDownloadRequest}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByRole("tab", { name: /não lidos/i }));
    expect(screen.queryByText("Lido Baixado")).not.toBeInTheDocument();
    expect(screen.getByText("Não Lido Não Baixado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /baixados/i }));
    expect(screen.getByText("Lido Baixado")).toBeInTheDocument();
    expect(screen.queryByText("Não Lido Não Baixado")).not.toBeInTheDocument();
  });

  it("deve navegar para o leitor ao clicar em capítulo baixado e solicitar download quando não baixado", () => {
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

    // Clicar no baixado navega para o leitor
    fireEvent.click(screen.getByText("Cap 1"));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/biblioteca/reader-chapter/$sourceId",
      params: { sourceId: "src-test" },
      search: { chapterId: "ch1" },
    });

    // Clicar no não baixado solicita download
    fireEvent.click(screen.getByText("Cap 2"));
    expect(onDownloadRequest).toHaveBeenCalledWith("src-test", "ch2", "Cap 2");
  });

  it("deve acionar toggleRead ao clicar no botão de olho", () => {
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

    const eyeButton = screen.getByLabelText("Marcar como lido");
    fireEvent.click(eyeButton);

    expect(onToggleRead).toHaveBeenCalledWith("ch1", true);
  });

  it("deve abrir o MoreMenu e executar ações para capítulo baixado", () => {
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

    const menuTrigger = screen.getByLabelText(/ações de download para capítulo 1/i);
    fireEvent.click(menuTrigger);

    const apagarOption = screen.getByRole("menuitem", { name: /apagar do disco/i });
    expect(apagarOption).toBeInTheDocument();

    fireEvent.click(apagarOption);
    expect(chaptersApi.deleteCache).toHaveBeenCalledWith("src-test", "ch1");
  });

  it("deve permitir seleção em lote e disparar marcação de lidos", async () => {
    mockBatchMutateAsync.mockResolvedValue({ updatedCount: 2, readChapterIds: ["ch1", "ch2"] });
    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "Cap 1" }),
      makeChapter({ id: "ch2", number: "2", title: "Cap 2" }),
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

    fireEvent.click(screen.getByRole("button", { name: /selecionar/i }));
    fireEvent.click(screen.getByLabelText("Selecionar todos os capítulos"));

    const markReadBtn = screen.getByRole("button", { name: /marcar 2 como lidos/i });
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(mockBatchMutateAsync).toHaveBeenCalledWith({
        chapterIds: ["ch1", "ch2"],
        markAsRead: true,
      });
    });
  });

  it("deve ativar o modo de seleção ao realizar long-press e não desmarcar no click subsequente", () => {
    vi.useFakeTimers();
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

    const rowButton = screen.getByText("Cap 1").closest("button")!;

    act(() => {
      fireEvent.touchStart(rowButton);
      vi.advanceTimersByTime(500);
      fireEvent.touchEnd(rowButton);
    });

    // Modo de seleção ativado com 1 selecionado
    expect(screen.getByText("1 selecionados")).toBeInTheDocument();

    // Evento sintético de click não deve desmarcar o item
    act(() => {
      fireEvent.click(rowButton);
    });

    expect(screen.getByText("1 selecionados")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("deve permitir toque e clique subsequente em outra linha após long-press cancelado sem clique", () => {
    vi.useFakeTimers();
    const chapters = [
      makeChapter({ id: "ch1", number: "1", title: "Cap 1" }),
      makeChapter({ id: "ch2", number: "2", title: "Cap 2" }),
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

    const btn1 = screen.getByText("Cap 1").closest("button")!;
    const btn2 = screen.getByText("Cap 2").closest("button")!;

    // 1. Long press disparado na linha 1 mas dedo arrastado sem emitir click
    act(() => {
      fireEvent.touchStart(btn1);
      vi.advanceTimersByTime(500);
      fireEvent.touchMove(btn1);
      fireEvent.touchEnd(btn1);
    });

    expect(screen.getByText("1 selecionados")).toBeInTheDocument();

    // 2. Novo toque na linha 2: novo touchStart deve resetar a flag preventNextClick
    act(() => {
      fireEvent.touchStart(btn2);
      fireEvent.touchEnd(btn2);
      fireEvent.click(btn2);
    });

    // Como estamos em modo seleção, a linha 2 deve ser selecionada (total 2)
    expect(screen.getByText("2 selecionados")).toBeInTheDocument();
    vi.useRealTimers();
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
