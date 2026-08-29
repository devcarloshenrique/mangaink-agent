import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { GuidedTour } from "./GuidedTour";

const mockDrive = vi.fn();
const mockDestroy = vi.fn();

vi.mock("driver.js", () => ({
  driver: vi.fn(() => ({
    drive: mockDrive,
    destroy: mockDestroy,
  })),
}));

describe("GuidedTour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("deve inicializar o driver após o timeout", async () => {
    vi.useFakeTimers();

    const steps = [
      {
        element: "#step-1",
        title: "Passo 1",
        description: "Desc 1",
      },
    ];

    const { unmount } = render(<GuidedTour steps={steps} startDelayMs={200} />);

    expect(mockDrive).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);

    expect(mockDrive).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockDestroy).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("não deve iniciar se storageKey já foi gravado e force=false", async () => {
    vi.useFakeTimers();
    localStorage.setItem("tour.test", "true");

    const steps = [
      {
        element: "#step-1",
        title: "Passo 1",
        description: "Desc 1",
      },
    ];

    render(<GuidedTour steps={steps} startDelayMs={200} storageKey="tour.test" />);

    vi.advanceTimersByTime(250);

    expect(mockDrive).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("deve iniciar mesmo com storageKey se force=true", async () => {
    vi.useFakeTimers();
    localStorage.setItem("tour.test", "true");

    const steps = [
      {
        element: "#step-1",
        title: "Passo 1",
        description: "Desc 1",
      },
    ];

    render(<GuidedTour steps={steps} startDelayMs={200} storageKey="tour.test" force={true} />);

    vi.advanceTimersByTime(250);

    expect(mockDrive).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
