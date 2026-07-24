import { describe, expect, it } from "vitest";
import { useChapterPages } from "@/hooks/useChapterPages";
import { renderHook } from "@testing-library/react";

describe("useChapterPages", () => {
  it("deve gerar URLs corretas para cada indice de pagina", () => {
    const { result } = renderHook(() =>
      useChapterPages("src-test", "chap-001", 3),
    );

    expect(result.current).toHaveLength(3);
    expect(result.current[0]).toContain(
      "/api/sources/src-test/chapters/chap-001/images/1",
    );
    expect(result.current[1]).toContain(
      "/api/sources/src-test/chapters/chap-001/images/2",
    );
    expect(result.current[2]).toContain(
      "/api/sources/src-test/chapters/chap-001/images/3",
    );
  });

  it("deve retornar array vazio quando totalPages=0", () => {
    const { result } = renderHook(() =>
      useChapterPages("src-test", "chap-001", 0),
    );

    expect(result.current).toEqual([]);
  });

  it("deve retornar array vazio quando sourceId vazio", () => {
    const { result } = renderHook(() =>
      useChapterPages("", "chap-001", 5),
    );

    expect(result.current).toEqual([]);
  });

  it("deve retornar array vazio quando chapterId vazio", () => {
    const { result } = renderHook(() =>
      useChapterPages("src-test", "", 5),
    );

    expect(result.current).toEqual([]);
  });

  it("deve gerar 20 URLs para 20 paginas", () => {
    const { result } = renderHook(() =>
      useChapterPages("src", "ch1", 20),
    );

    expect(result.current).toHaveLength(20);
    expect(result.current[0]).toContain("/images/1");
    expect(result.current[19]).toContain("/images/20");
  });
});
