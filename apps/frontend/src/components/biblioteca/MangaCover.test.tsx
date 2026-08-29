import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MangaCover } from "./MangaCover";

describe("MangaCover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve renderizar a capa do mangá", () => {
    render(<MangaCover sourceId="src-vinland-saga" title="Vinland Saga" />);

    const img = screen.getByRole("img", { name: "Vinland Saga" });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe(
      "/api/conversions/source/src-vinland-saga/covers/original",
    );
  });

  it("deve abrir o modal ao clicar na capa quando enableFullscreen=true", () => {
    render(<MangaCover sourceId="src-vinland-saga" title="Vinland Saga" enableFullscreen={true} />);

    const coverContainer = screen.getByTitle("Clique para ampliar a capa");
    fireEvent.click(coverContainer);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Fechar visualização da capa/i }),
    ).toBeInTheDocument();
  });

  it("deve fechar o modal ao clicar no botão de fechar", () => {
    render(<MangaCover sourceId="src-vinland-saga" title="Vinland Saga" enableFullscreen={true} />);

    fireEvent.click(screen.getByTitle("Clique para ampliar a capa"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /Fechar visualização da capa/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
