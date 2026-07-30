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

import { TabCapitulos } from "@/components/biblioteca/TabCapitulos";
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
});
