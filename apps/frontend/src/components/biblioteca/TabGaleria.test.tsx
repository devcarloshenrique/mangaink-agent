import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { TabGaleria } from "./TabGaleria";
import { conversionsApi } from "@/lib/api";
import { toast } from "sonner";
import type { Cover } from "@/types/scraping";
import type { CoverRef } from "@/types/conversion";

vi.mock("@/lib/api", () => ({
  conversionsApi: {
    coverUrl: vi.fn((sourceId: string, cover: CoverRef) => {
      if (cover.kind === "upload") return `http://example.com/upload/${cover.uploadId}`;
      if (cover.kind === "gallery") return `http://example.com/gallery/${cover.coverId}`;
      if (cover.kind === "original") return `http://example.com/original`;
      return null;
    }),
    uploadCover: vi.fn(),
    deleteCover: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockCovers: Cover[] = [
  {
    id: "cov-orig",
    type: "original",
    label: "Original",
    imageUrl: "http://example.com/remote-orig.jpg",
  },
  {
    id: "cov-vol-1",
    type: "gallery",
    label: "Volume 1",
    imageUrl: "http://example.com/remote-v1.jpg",
  },
  {
    id: "cov-custom-1",
    type: "upload",
    label: "Minha Capa Especial.png",
    imageUrl: "http://example.com/remote-custom.jpg",
  },
];

describe("TabGaleria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renderiza cabeçalho com contagem de capas e título", () => {
    render(<TabGaleria sourceId="src-berserk" seriesTitle="Berserk" covers={mockCovers} />);

    expect(screen.getByText(/Galeria de Capas \(3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/3 capas disponíveis para Berserk/i)).toBeInTheDocument();
    expect(screen.getByText("Upload de Nova Capa")).toBeInTheDocument();
  });

  it("renderiza todas as capas com labels formatados amigavelmente", () => {
    render(<TabGaleria sourceId="src-berserk" seriesTitle="Berserk" covers={mockCovers} />);

    // Container unificado com labels amigáveis
    expect(screen.getByText(/Galeria de Capas \(3\)/i)).toBeInTheDocument();
    expect(screen.getByAltText("Capa Original")).toBeInTheDocument();
    expect(screen.getByAltText("Volume 1")).toBeInTheDocument();
    expect(screen.getByAltText("Minha Capa Especial")).toBeInTheDocument();
  });

  it("exibe mensagem vazia simpática quando não há nenhuma capa", () => {
    render(<TabGaleria sourceId="src-berserk" seriesTitle="Berserk" covers={[]} />);

    expect(screen.getByText(/Galeria de Capas \(0\)/i)).toBeInTheDocument();
    expect(screen.getByText("Nenhuma capa disponível")).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma capa foi encontrada para esta obra/i)).toBeInTheDocument();
    expect(screen.getByText("Enviar Primeira Capa")).toBeInTheDocument();
  });

  it("permite abrir o modal ampliado (lightbox) ao clicar em uma capa e fechar", async () => {
    render(<TabGaleria sourceId="src-berserk" seriesTitle="Berserk" covers={mockCovers} />);

    const volume1CoverImg = screen.getByAltText("Volume 1");
    fireEvent.click(volume1CoverImg);

    // Modal deve estar aberto exibindo a imagem e o botão de fechar
    const closeBtn = screen.getByRole("button", {
      name: "Fechar visualização da capa",
    });
    expect(closeBtn).toBeInTheDocument();

    // Fecha o modal
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Fechar visualização da capa" }),
      ).not.toBeInTheDocument();
    });
  });

  it("permite definir uma capa como Capa da Biblioteca a partir do modal", async () => {
    render(<TabGaleria sourceId="src-berserk" seriesTitle="Berserk" covers={mockCovers} />);

    // Clica no Volume 1
    const volume1CoverImg = screen.getByAltText("Volume 1");
    fireEvent.click(volume1CoverImg);

    const setMainBtn = screen.getByRole("button", {
      name: /Definir como Capa da Biblioteca/i,
    });
    expect(setMainBtn).toBeInTheDocument();

    fireEvent.click(setMainBtn);

    expect(toast.success).toHaveBeenCalledWith("Capa da biblioteca atualizada!");

    // O botão deve agora refletir que é a capa atual
    await waitFor(() => {
      expect(screen.getByText("Capa Atual da Biblioteca")).toBeInTheDocument();
    });
  });

  it("não deve renderizar o botão 'Usar no Wizard' nem flags textuais de label no modal", () => {
    render(<TabGaleria sourceId="src-berserk" seriesTitle="Berserk" covers={mockCovers} />);

    const volume1CoverImg = screen.getByAltText("Volume 1");
    fireEvent.click(volume1CoverImg);

    expect(screen.queryByText(/Usar no Wizard/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Usar no Wizard/i })).not.toBeInTheDocument();
  });

  it("não exibe botão de exclusão para capa original ou da galeria", () => {
    render(<TabGaleria sourceId="src-berserk" seriesTitle="Berserk" covers={mockCovers} />);

    // Capa original
    const origCoverImg = screen.getByAltText("Capa Original");
    fireEvent.click(origCoverImg);

    expect(
      screen.queryByRole("button", { name: "Excluir capa personalizada" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Excluir Capa")).not.toBeInTheDocument();

    // Fecha
    fireEvent.click(screen.getByRole("button", { name: "Fechar visualização da capa" }));

    // Capa volume 1 (galeria)
    const volume1CoverImg = screen.getByAltText("Volume 1");
    fireEvent.click(volume1CoverImg);

    expect(
      screen.queryByRole("button", { name: "Excluir capa personalizada" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Excluir Capa")).not.toBeInTheDocument();
  });

  it("exibe botão de exclusão para capa de upload, exclui com sucesso, reseta preferência se ativa, fecha modal e chama onCoverUploaded", async () => {
    const onCoverUploaded = vi.fn();
    vi.mocked(conversionsApi.deleteCover).mockResolvedValue({
      success: true,
      message: "Capa excluída com sucesso",
    });

    render(
      <TabGaleria
        sourceId="src-berserk"
        seriesTitle="Berserk"
        covers={mockCovers}
        onCoverUploaded={onCoverUploaded}
      />,
    );

    // Clica na capa de upload
    const customCoverImg = screen.getByAltText("Minha Capa Especial");
    fireEvent.click(customCoverImg);

    // Primeiro define ela como capa preferida para testar reset de preferência
    const setMainBtn = screen.getByRole("button", {
      name: /Definir como Capa da Biblioteca/i,
    });
    fireEvent.click(setMainBtn);
    expect(toast.success).toHaveBeenCalledWith("Capa da biblioteca atualizada!");

    // Botão de exclusão deve estar visível
    const deleteBtn = screen.getByRole("button", {
      name: "Excluir capa personalizada",
    });
    expect(deleteBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    await waitFor(() => {
      expect(conversionsApi.deleteCover).toHaveBeenCalledWith("cov-custom-1");
      expect(toast.success).toHaveBeenCalledWith("Capa personalizada excluída com sucesso!");
      expect(onCoverUploaded).toHaveBeenCalledTimes(1);
      // Modal fechado
      expect(
        screen.queryByRole("button", { name: "Fechar visualização da capa" }),
      ).not.toBeInTheDocument();
    });
  });

  it("realiza upload de capa personalizada com sucesso chamando API e callback onCoverUploaded", async () => {
    const onCoverUploaded = vi.fn();
    vi.mocked(conversionsApi.uploadCover).mockResolvedValue({
      uploadId: "up-123",
      name: "nova-capa.png",
      url: "http://example.com/nova-capa.png",
    });

    render(
      <TabGaleria
        sourceId="src-berserk"
        seriesTitle="Berserk"
        covers={mockCovers}
        onCoverUploaded={onCoverUploaded}
      />,
    );

    const file = new File(["dummy content"], "nova-capa.png", {
      type: "image/png",
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(conversionsApi.uploadCover).toHaveBeenCalledWith(file, "src-berserk", "nova-capa.png");
      expect(onCoverUploaded).toHaveBeenCalledTimes(1);
    });
  });
});
