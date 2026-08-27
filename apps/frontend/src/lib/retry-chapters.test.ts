import { describe, it, expect } from "vitest";
import { pickRetryChapters } from "./retry-chapters";

describe("pickRetryChapters", () => {
  it("retorna apenas os capítulos com problema, sem duplicar", () => {
    expect(
      pickRetryChapters(
        ["chap_0007", "chap_0003", "chap_0007"],
        [["chap_0001", "chap_0003", "chap_0007"]],
      ),
    ).toEqual(["chap_0007", "chap_0003"]);
  });

  it("fallback: sem problemas, refaz todos os capítulos originais em ordem", () => {
    expect(pickRetryChapters([], [["chap_0001", "chap_0002"], ["chap_0003"]])).toEqual([
      "chap_0001",
      "chap_0002",
      "chap_0003",
    ]);
  });

  it("fallback dedupa capítulos repetidos entre livros", () => {
    expect(pickRetryChapters([], [["chap_0001"], ["chap_0001", "chap_0002"]])).toEqual([
      "chap_0001",
      "chap_0002",
    ]);
  });

  it("lista de problemas tem precedência mesmo com originais presentes", () => {
    expect(pickRetryChapters(["chap_0009"], [["chap_0001", "chap_0009"]])).toEqual(["chap_0009"]);
  });

  it("sem problemas e sem originais → vazio (retry é no-op)", () => {
    expect(pickRetryChapters([], [])).toEqual([]);
  });
});
