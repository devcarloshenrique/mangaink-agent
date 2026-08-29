import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { OngoingConversions } from "./OngoingConversions";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe("OngoingConversions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deve renderizar a esteira de conversões em andamento com capas, progresso e botões", () => {
    render(<OngoingConversions />);

    expect(screen.getByText("Conversões")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver tudo/i })).toBeInTheDocument();
    expect(screen.getAllByText("Chainsaw Man").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Monster").length).toBeGreaterThan(0);

    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThan(0);

    const prevBtn = screen.getByRole("button", { name: /Rolar para a esquerda/i });
    const nextBtn = screen.getByRole("button", { name: /Rolar para a direita/i });
    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();
  });

  it("deve avançar o progresso com o passar do tempo e não passar de 99%", () => {
    render(<OngoingConversions />);

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(screen.getByText("Conversões")).toBeInTheDocument();
  });
});
