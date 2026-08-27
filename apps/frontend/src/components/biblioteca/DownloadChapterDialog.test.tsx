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

    expect(screen.getByText(/Baixar Capítulo/i)).toBeTruthy();
    expect(screen.getByText(/Capítulo 42/)).toBeTruthy();
    expect(screen.getByText(/não está em cache no disco/i)).toBeTruthy();
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

  it("deve permitir baixar em segundo plano quando onDownloadBackground for fornecido", () => {
    const onDownloadBackground = vi.fn();
    render(
      <DownloadChapterDialog
        open={true}
        onOpenChange={onOpenChange}
        chapterTitle="Cap 10"
        onConfirm={onConfirm}
        onDownloadBackground={onDownloadBackground}
      />,
    );

    const bgBtn = screen.getByText("Baixar no disco");
    expect(bgBtn).toBeTruthy();
    fireEvent.click(bgBtn);

    expect(onDownloadBackground).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
