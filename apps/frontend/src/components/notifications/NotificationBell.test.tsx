import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mocked = vi.hoisted(() => ({
  navigate: vi.fn(),
  notifications: {
    notifications: [] as unknown[],
    unreadCount: 0,
    isLoading: false,
    pulseSignal: 0,
    lastNotificationId: null as string | null,
    triggerPulse: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    clearHistory: vi.fn(),
  },
  list: vi.fn(async (_limit?: number) => ({ items: [], unreadCount: 0 })),
  activeConversions: [] as Array<{
    conversionId: string;
    title: string;
    progress: number;
    completedJobs: number;
    totalJobs: number;
    output?: { format: string };
    downloadOnly?: boolean;
  }>,
  liveProgressOverrides: new Map<string, Record<string, unknown>>(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocked.navigate,
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => mocked.notifications,
}));

vi.mock("@/hooks/useConversions", () => ({
  useActiveConversions: () => ({ data: { items: mocked.activeConversions } }),
}));

vi.mock("@/hooks/useLiveConversionProgress", () => ({
  useLiveConversionProgress: () =>
    new Map(
      mocked.activeConversions.map((c) => [
        c.conversionId,
        {
          overall: c.progress,
          done: false,
          downloadOnly: c.downloadOnly ?? false,
          chaptersDone: 0,
          chaptersTotal: 0,
          chaptersFailed: 0,
          ...(mocked.liveProgressOverrides.get(c.conversionId) ?? {}),
        },
      ]),
    ),
}));

vi.mock("@/lib/api", () => ({
  notificationsApi: {
    list: (limit?: number) => mocked.list(limit),
    events: () => ({ close: vi.fn() }),
  },
  conversionsApi: {
    cancel: vi.fn().mockResolvedValue({ conversionId: "c-1", status: "cancelled" }),
  },
}));

import { NotificationBell } from "@/components/notifications/NotificationBell";
import type { NotificationDTO } from "@mangaink/shared";

function makeNotification(overrides: Partial<NotificationDTO> = {}): NotificationDTO {
  return {
    id: "n-1",
    userId: "u-1",
    type: "volume_ready",
    title: '"Obra X" pronto',
    message: "Conversão concluída",
    metadata: null,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.notifications.notifications = [];
  mocked.notifications.unreadCount = 0;
  mocked.activeConversions = [];
  mocked.liveProgressOverrides.clear();
});

/** Abre o dropdown do sino — o conteúdo só monta com o menu aberto (Radix). */
function openBellMenu() {
  const trigger = document.querySelector('button[aria-haspopup="menu"]')!;
  expect(trigger).toBeTruthy();
  fireEvent.pointerDown(trigger);
  fireEvent.pointerUp(trigger);
  fireEvent.click(trigger);
}

describe("NotificationBell", () => {
  it("renderiza itens persistidos com badge de não lidas", () => {
    mocked.notifications.notifications = [
      makeNotification(),
      makeNotification({
        id: "n-2",
        type: "conversion_failed",
        title: "Falhou",
        readAt: new Date().toISOString(),
      }),
    ];
    mocked.notifications.unreadCount = 1;

    render(<NotificationBell />, { wrapper: Wrapper });
    openBellMenu();

    expect(screen.getByText('"Obra X" pronto')).toBeTruthy();
    expect(screen.getByText("Falhou")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy(); // badge
    // Barra contextual rápida presente quando há não lidas
    expect(screen.getByText("1 nova")).toBeTruthy();
    expect(screen.getByText("Marcar todas como lidas")).toBeTruthy();
  });

  it("clicar no item marca como lida e navega para a conversão (metadata)", () => {
    mocked.notifications.notifications = [
      makeNotification({ metadata: { conversionId: "conv-9" } }),
    ];

    render(<NotificationBell />, { wrapper: Wrapper });
    openBellMenu();

    const item = screen.getAllByRole("menuitem").find((el) => el.textContent?.includes("Obra X"))!;
    fireEvent.click(item);

    expect(mocked.notifications.markAsRead).toHaveBeenCalledWith("n-1");
    expect(mocked.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/biblioteca/converter/$jobId",
        params: { jobId: "conv-9" },
      }),
    );
  });

  it("clicar em notificação com sourceId navega para a página da obra", () => {
    mocked.notifications.notifications = [
      makeNotification({
        type: "download_completed",
        message: "2/3 capítulo(s) baixado(s) • 1 falha(s)",
        metadata: {
          sourceId: "src-1",
        },
      }),
    ];

    render(<NotificationBell />, { wrapper: Wrapper });
    openBellMenu();

    // Mensagem com contagem direta na linha (sem dropdown de accordion).
    expect(screen.getByText("2/3 capítulo(s) baixado(s) • 1 falha(s)")).toBeTruthy();

    const items = screen.getAllByRole("menuitem");
    const item = items.find((el) => el.textContent?.includes("2/3 capítulo(s)"));
    expect(item).toBeTruthy();

    fireEvent.click(item!);
    expect(mocked.notifications.markAsRead).toHaveBeenCalledWith("n-1");
    expect(mocked.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/biblioteca/$sourceId", params: { sourceId: "src-1" } }),
    );
  });

  it("renderiza notificação de chapter_cache_deleted e navega para a obra ao clicar", () => {
    mocked.notifications.notifications = [
      makeNotification({
        type: "chapter_cache_deleted",
        title: '"Boruto" — capítulos apagados',
        message: "5 capítulo(s) apagado(s) do disco",
        metadata: {
          sourceId: "src-boruto",
          successfulChapters: 5,
        },
      }),
    ];

    render(<NotificationBell />, { wrapper: Wrapper });
    openBellMenu();

    expect(screen.getByText('"Boruto" — capítulos apagados')).toBeTruthy();
    expect(screen.getByText("5 capítulo(s) apagado(s) do disco")).toBeTruthy();

    const item = screen.getAllByRole("menuitem").find((el) => el.textContent?.includes("Boruto"))!;
    fireEvent.click(item);

    expect(mocked.notifications.markAsRead).toHaveBeenCalledWith("n-1");
    expect(mocked.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/biblioteca/$sourceId", params: { sourceId: "src-boruto" } }),
    );
  });

  it("limpar histórico usa confirmação em duas etapas", async () => {
    render(<NotificationBell />, { wrapper: Wrapper });
    openBellMenu();

    fireEvent.click(screen.getByText(/Ver histórico completo/i));

    await waitFor(() => {
      expect(screen.getAllByText("Limpar histórico").length).toBeGreaterThan(0);
    });
    // Reconsulta o botão a cada clique — re-renders do React Query podem
    // substituir os nós entre uma ação e outra.
    const getConfirmBtn = () =>
      screen
        .getAllByRole("button")
        .find(
          (b) =>
            b.textContent?.includes("Limpar histórico") ||
            b.textContent?.includes("Confirmar exclusão"),
        )!;

    // Aguarda o botão habilitado (historyQuery carregada).
    await waitFor(() => expect(getConfirmBtn()).not.toBeDisabled());
    fireEvent.click(getConfirmBtn());
    await waitFor(() => expect(screen.getByText("Confirmar exclusão?")).toBeTruthy());
    expect(mocked.notifications.clearHistory).not.toHaveBeenCalled();

    fireEvent.click(getConfirmBtn());
    expect(mocked.notifications.clearHistory).toHaveBeenCalledTimes(1);
  });

  it("REGRESSÃO anti-overflow: truncate com min-w-0 e container sem scroll-x", () => {
    mocked.notifications.notifications = [
      makeNotification({
        title:
          "O Exilado Cavaleiro Pesado Reencarnado e Incomparável com o Conhecimento do Jogo — Volume 17 (definitivo)",
      }),
    ];
    mocked.activeConversions = [
      {
        conversionId: "conv-long-1",
        title: "O Exilado Cavaleiro Pesado Reencarnado e Incomparável com o Conhecimento do Jogo",
        progress: 10,
        completedJobs: 0,
        totalJobs: 1,
      },
    ];

    const { container } = render(<NotificationBell />, { wrapper: Wrapper });
    openBellMenu();

    // Títulos truncam DENTRO do flex (min-w-0) — sem isso, min-width:auto
    // força a largura do texto e estoura o dropdown (scrollbar horizontal).
    // (Radix porta o conteúdo para document.body — consultar o document.)
    const truncated = document.querySelectorAll("span.truncate.min-w-0");
    expect(truncated.length).toBeGreaterThanOrEqual(2);

    // Containers de lista bloqueiam scroll horizontal (cinto de segurança).
    expect(document.querySelector("div.overflow-y-auto.overflow-x-hidden")).toBeTruthy();

    // Mensagens quebram palavras longas em vez de estourar.
    expect(document.querySelector("p.break-words")).toBeTruthy();
  });

  it("abrir o sino invalida a lista de notificações (frescor sem depender do SSE)", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    render(
      <QueryClientProvider client={client}>
        <NotificationBell />
      </QueryClientProvider>,
    );

    const trigger = document.querySelector('button[aria-haspopup="menu"]')!;
    fireEvent.pointerDown(trigger);
    fireEvent.pointerUp(trigger);
    fireEvent.click(trigger);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] }),
    );
  });

  it("REGRESSÃO: modal 'histórico completo' também mostra Em andamento", () => {
    mocked.activeConversions = [
      {
        conversionId: "conv-live-1",
        title: "Berserk (download-only)",
        progress: 42,
        completedJobs: 0,
        totalJobs: 1,
      },
    ];

    render(<NotificationBell />, { wrapper: Wrapper });
    openBellMenu();

    // Dropdown tem a seção…
    expect(screen.getAllByText("Em andamento").length).toBeGreaterThan(0);
    expect(screen.getByText("Berserk (download-only)")).toBeTruthy();

    // …e o modal de histórico TAMBÉM (bug: só mostrava notificações persistidas).
    fireEvent.click(screen.getByText(/Ver histórico completo/i));

    const section = screen.getAllByText("Em andamento");
    expect(section.length).toBeGreaterThan(0);
    const row = screen.getByText("Berserk (download-only)");
    expect(row).toBeTruthy();
    // Barra ao vivo com o % do liveProgress (42), não do fallback.
    expect(screen.getByText("0/1 volume(s) • 42%")).toBeTruthy();
    // Clicar na linha fecha o modal e navega para a página do job.
    fireEvent.click(row);
    expect(mocked.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/biblioteca/converter/$jobId",
        params: { jobId: "conv-live-1" },
      }),
    );
  });

  it("download-only: rótulo mostra contagem de capítulos + falhas em tempo real (sem 'volume' e sem badge EPUB)", () => {
    mocked.activeConversions = [
      {
        conversionId: "conv-dl-1",
        title: "Chainsaw Man (download de capítulos)",
        progress: 25,
        completedJobs: 0,
        totalJobs: 1,
        output: { format: "epub" }, // dummy do planner
        downloadOnly: true,
      },
    ];
    mocked.liveProgressOverrides.set("conv-dl-1", {
      downloadOnly: true,
      chaptersDone: 3,
      chaptersTotal: 12,
      chaptersFailed: 1,
      overall: 25,
    });

    render(<NotificationBell />, { wrapper: Wrapper });
    openBellMenu();

    // Rótulo: capítulos e falhas em tempo real, não volumes.
    expect(screen.getByText("3/12 capítulo(s) • 1 falha(s) • 25%")).toBeTruthy();

    // O badge dummy "EPUB" é ocultado para download-only.
    expect(screen.queryByText("EPUB")).toBeNull();
  });

  it("renderiza notificação conversion_cancelled com estilo riscado e badge Cancelado", () => {
    mocked.notifications.notifications = [
      makeNotification({
        type: "conversion_cancelled",
        title: '"Boruto" — download cancelado',
        message: "Download cancelado pelo usuário",
      }),
    ];

    render(<NotificationBell />, { wrapper: Wrapper });
    openBellMenu();

    expect(screen.getByText('"Boruto" — download cancelado')).toBeTruthy();
    expect(screen.getByText("Cancelado")).toBeTruthy();
    expect(screen.getByText("Download cancelado pelo usuário")).toBeTruthy();
  });

  it("permite cancelar download ativo diretamente no botão de cancelamento", async () => {
    mocked.activeConversions = [
      {
        conversionId: "conv-cancel-1",
        title: "Boruto (download)",
        progress: 10,
        completedJobs: 0,
        totalJobs: 1,
        downloadOnly: true,
      },
    ];

    render(<NotificationBell />, { wrapper: Wrapper });
    openBellMenu();

    const cancelBtn = screen.getByRole("button", { name: /Cancelar Boruto/i });
    expect(cancelBtn).toBeTruthy();

    fireEvent.click(cancelBtn);

    const { conversionsApi } = await import("@/lib/api");
    expect(conversionsApi.cancel).toHaveBeenCalledWith("conv-cancel-1");
  });
});
