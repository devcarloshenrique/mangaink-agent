import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsSection } from "./StatsSection";

describe("StatsSection", () => {
  it("deve renderizar as estatísticas formatadas em pt-BR", () => {
    render(<StatsSection chaptersConverted={127} storageGb={12.4} />);

    expect(screen.getByText("Estatísticas")).toBeInTheDocument();
    expect(screen.getByText("Capítulos convertidos")).toBeInTheDocument();
    expect(screen.getByText("Em armazenamento")).toBeInTheDocument();
  });
});
