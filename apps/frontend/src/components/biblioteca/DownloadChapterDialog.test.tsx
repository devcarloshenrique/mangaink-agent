import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DownloadChapterDialog } from "@/components/biblioteca/DownloadChapterDialog";

describe("DownloadChapterDialog", () => {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve exibir o modal quando open=true", () => {
    render(
      <DownloadChapterDialog
        open={true}
        onOpenChange={onOpenChange}
        chapterTitle="Capítulo 42"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Baixar Capitulo")).toBeTruthy();
    expect(screen.getByText(/Capítulo 42/)).toBeTruthy();
    expect(
      screen.getByText(/nao esta em cache. Deseja baixar para ler?/),
    ).toBeTruthy();
  });

  it("deve chamar onConfirm e fechar ao clicar em Baixar e Ler", () => {
    render(
      <DownloadChapterDialog
        open={true}
        onOpenChange={onOpenChange}
        chapterTitle="Cap 1"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByText("Baixar e Ler"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("deve fechar ao clicar em Cancelar", () => {
    render(
      <DownloadChapterDialog
        open={true}
        onOpenChange={onOpenChange}
        chapterTitle="Cap 1"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("deve usar SpeechBubble para exibir o texto", () => {
    render(
      <DownloadChapterDialog
        open={true}
        onOpenChange={onOpenChange}
        chapterTitle="Cap X"
        onConfirm={onConfirm}
      />,
    );

    // SpeechBubble renders the text inside
    expect(screen.getByText(/Cap X/)).toBeTruthy();
  });
});
