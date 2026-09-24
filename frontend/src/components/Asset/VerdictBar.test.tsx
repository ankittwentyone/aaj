import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerdictBar } from "./VerdictBar";

describe("VerdictBar", () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, writable: true });
  });

  it("renders diverging bar when viewport >=520", () => {
    Object.defineProperty(window, "innerWidth", { value: 800, writable: true });
    const { container } = render(<VerdictBar priceDelta={2.1} physicalDelta={10.9} />);
    // Diverging bar uses w-full h-10 rounded-pill bg-raised
    expect(container.querySelector(".bg-success")).toBeInTheDocument();
    expect(container.querySelector(".bg-warning")).toBeInTheDocument();
    expect(container.querySelector(".w-px")).toBeInTheDocument(); // center divider
  });

  it("renders stacked pills fallback when viewport <520 (sparkline_fallback)", () => {
    Object.defineProperty(window, "innerWidth", { value: 400, writable: true });
    const { container } = render(<VerdictBar priceDelta={2.1} physicalDelta={10.9} />);
    expect(screen.getByText(/Physical/)).toBeInTheDocument();
    expect(screen.getByText(/Narrative/)).toBeInTheDocument();
    expect(container.querySelector(".bg-success")).not.toBeInTheDocument(); // no diverging bar
  });

  it("shows correct percentages in fallback pills", () => {
    Object.defineProperty(window, "innerWidth", { value: 320, writable: true });
    render(<VerdictBar priceDelta={-1.5} physicalDelta={3.2} />);
    expect(screen.getByText(/Physical \+3\.2%/)).toBeInTheDocument();
    expect(screen.getByText(/Narrative -1\.5%/)).toBeInTheDocument();
  });

  it("scales bar widths proportionally — physical larger than price", () => {
    Object.defineProperty(window, "innerWidth", { value: 1000, writable: true });
    const { container } = render(<VerdictBar priceDelta={2} physicalDelta={8} />);
    const bars = container.querySelectorAll("div[style]");
    // find left and right bars by bg class
    const left = container.querySelector(".bg-success") as HTMLElement;
    const right = container.querySelector(".bg-warning") as HTMLElement;
    expect(left).toBeInTheDocument();
    expect(right).toBeInTheDocument();
    const leftW = parseFloat(left.style.width.replace("%", ""));
    const rightW = parseFloat(right.style.width.replace("%", ""));
    // physical 8 vs max 8 => leftW 50%, price 2 vs max 8 => 12.5%
    expect(leftW).toBeGreaterThan(rightW);
  });

  it("handles zero deltas — still renders bar with minimal width", () => {
    Object.defineProperty(window, "innerWidth", { value: 800, writable: true });
    const { container } = render(<VerdictBar priceDelta={0} physicalDelta={0} />);
    expect(container.querySelector(".bg-success")).toBeInTheDocument();
    expect(container.querySelector(".bg-warning")).toBeInTheDocument();
  });

  it("uses NO d3 — pure div + CSS (check no d3 imports in rendered output)", () => {
    Object.defineProperty(window, "innerWidth", { value: 800, writable: true });
    const { container } = render(<VerdictBar priceDelta={5} physicalDelta={5} />);
    expect(container.innerHTML).not.toContain("d3");
  });
});
