import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MangaCover } from "./MangaCover";
import { setPreferredCover } from "@/lib/custom-covers";

describe("MangaCover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("deve renderizar a capa original por padrão", () => {
    render(<MangaCover sourceId="src-vinland-saga" title="Vinland Saga" />);

    const img = screen.getByRole("img", { name: "Vinland Saga" });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe(
      "/api/conversions/source/src-vinland-saga/covers/original",
    );
  });

  it("deve renderizar a capa preferida quando definida", () => {
    setPreferredCover("src-vinland-saga", {
      id: "cov-vol-5",
      type: "gallery",
      label: "Volume 5",
      imageUrl: "",
    });

    render(<MangaCover sourceId="src-vinland-saga" title="Vinland Saga" />);

    const img = screen.getByRole("img", { name: "Vinland Saga" });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe(
      "/api/conversions/source/src-vinland-saga/covers/cov-vol-5",
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

  it("deve disparar onChangeCover ao clicar no botão 'Trocar Capa'", () => {
    const onChangeCover = vi.fn();
    render(
      <MangaCover sourceId="src-vinland-saga" title="Vinland Saga" onChangeCover={onChangeCover} />,
    );

    const changeCoverBtn = screen.getByRole("button", { name: "Trocar capa da obra" });
    expect(changeCoverBtn).toBeInTheDocument();

    fireEvent.click(changeCoverBtn);
    expect(onChangeCover).toHaveBeenCalledTimes(1);

    // Não deve abrir o modal de tela cheia quando o botão de troca for clicado
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
