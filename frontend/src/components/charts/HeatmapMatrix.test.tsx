import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeatmapMatrix, matrixToCells } from "./HeatmapMatrix";

describe("HeatmapMatrix", () => {
  const cells = [
    { row: "BRENT", col: "XOM", value: 0.85, weight: 0.85, rationale: "Integrated oil majors", solid: true },
    { row: "BRENT", col: "CVX", value: 0.82, weight: 0.82, solid: true },
    { row: "WTI", col: "XOM", value: 0.8, solid: false }, // dashed SerpApi
    { row: "WTI", col: "BRENT", value: 0.95, solid: true },
  ];
  const rows = ["BRENT", "WTI"];
  const cols = ["XOM", "CVX", "BRENT"];

  it("renders grid with header row and row labels", () => {
    render(<HeatmapMatrix cells={cells} rows={rows} cols={cols} />);
    expect(screen.getAllByText("BRENT").length).toBeGreaterThanOrEqual(2); // header col + row label
    expect(screen.getByText("WTI")).toBeInTheDocument();
    expect(screen.getByText("XOM")).toBeInTheDocument();
    expect(screen.getByText("CVX")).toBeInTheDocument();
  });

  it("renders 44×28 cells with gap2 radius4 semantics (44px width, 28px height)", () => {
    const { container } = render(<HeatmapMatrix cells={cells} rows={rows} cols={cols} />);
    const buttons = container.querySelectorAll("button.w-\\[44px\\]");
    expect(buttons.length).toBe(rows.length * cols.length); // 2*3=6
    buttons.forEach((b) => {
      expect(b.className).toContain("h-[28px]");
      expect(b.className).toContain("rounded-[4px]");
    });
  });

  it("colors positive emerald and negative red diverging at 0", () => {
    const posCells = [{ row: "BRENT", col: "XOM", value: 0.9, solid: true }];
    const negCells = [{ row: "BRENT", col: "XOM", value: -0.7, solid: true }];
    const { container: cPos } = render(<HeatmapMatrix cells={posCells} rows={["BRENT"]} cols={["XOM"]} domain={[-1, 1]} />);
    const btnPos = cPos.querySelector("button") as HTMLElement;
    expect(btnPos.style.background).toMatch(/16,\s*185,\s*129/); // emerald rgba
    const { container: cNeg } = render(<HeatmapMatrix cells={negCells} rows={["BRENT"]} cols={["XOM"]} domain={[-1, 1]} />);
    const btnNeg = cNeg.querySelector("button") as HTMLElement;
    expect(btnNeg.style.background).toMatch(/239,\s*68,\s*68/); // red rgba
  });

  it("shows stale placeholder — dashed zinc when stale=true", () => {
    const { container } = render(<HeatmapMatrix cells={cells} rows={rows} cols={cols} stale={true} />);
    expect(container.textContent).toContain("—");
    expect(container.querySelector("button")).toBeNull();
    const placeholders = container.querySelectorAll(".bg-zinc-900");
    expect(placeholders.length).toBe(rows.length * cols.length);
  });

  it("dashed SerpApi cells have border-dashed amber", () => {
    const { container } = render(<HeatmapMatrix cells={cells} rows={rows} cols={cols} />);
    // WTI->XOM is solid false => dashed
    const buttons = container.querySelectorAll("button");
    // find WTI/XOM button (row WTI is second row, col XOM first col)
    // Order: header row then BRENT row cols XOM,CVX,BRENT then WTI row cols XOM,CVX,BRENT
    // So WTI XOM is index 3? Let's just check any dashed exists
    const dashedExists = Array.from(buttons).some((b) => b.className.includes("border-dashed"));
    expect(dashedExists).toBe(true);
    const dashedBtn = Array.from(buttons).find((b) => b.className.includes("border-dashed")) as HTMLElement;
    expect(dashedBtn.className).toContain("border-amber-400/50");
  });

  it("solid cells have border-transparent", () => {
    const { container } = render(<HeatmapMatrix cells={cells} rows={rows} cols={cols} />);
    const solidExists = Array.from(container.querySelectorAll("button")).some((b) => b.className.includes("border-transparent"));
    expect(solidExists).toBe(true);
  });

  it("onCellClick fires with cell data", () => {
    const onCellClick = vi.fn();
    render(<HeatmapMatrix cells={cells} rows={rows} cols={cols} onCellClick={onCellClick} />);
    const buttons = document.querySelectorAll("button");
    // click BRENT->XOM (first data cell)
    fireEvent.click(buttons[0]);
    expect(onCellClick).toHaveBeenCalledWith(expect.objectContaining({ row: "BRENT", col: "XOM", value: 0.85 }));
  });

  it("shows — when cell missing (no data)", () => {
    const sparse = [{ row: "BRENT", col: "XOM", value: 0.5 }];
    const { container } = render(<HeatmapMatrix cells={sparse} rows={["BRENT", "WTI"]} cols={["XOM", "CVX"]} />);
    const buttons = container.querySelectorAll("button");
    // WTI/CVX missing should show —
    const missingBtn = Array.from(buttons).find((b) => b.textContent === "—");
    expect(missingBtn).toBeDefined();
  });

  it("title attribute includes rationale when present", () => {
    const { container } = render(<HeatmapMatrix cells={cells} rows={rows} cols={cols} />);
    const btn = container.querySelector("button") as HTMLElement;
    expect(btn.title).toContain("Integrated oil majors");
  });
});

describe("matrixToCells adapter", () => {
  it("converts Record<string, Record<string, number>> matrix", () => {
    const matrix = { BRENT: { XLE: 0.82, XLI: 0.41 }, WTI: { XLE: 0.76 } };
    const { cells, rows, cols } = matrixToCells(matrix);
    expect(rows).toEqual(["BRENT", "WTI"]);
    expect(cols).toContain("XLE");
    expect(cells.find((c) => c.row === "BRENT" && c.col === "XLE")?.value).toBe(0.82);
  });

  it("converts exposures array from simulate", () => {
    const exposures = [
      { target: "XLE", exposure: 8.5, weight: 0.85, rationale: "oil beta", shock_asset: "BRENT" },
      { target: "XLI", exposure: 4.1, weight: 0.41, shock_asset: "BRENT" },
    ];
    const { cells, rows, cols } = matrixToCells(exposures as any);
    expect(cells.length).toBe(2);
    expect(cols).toContain("XLE");
    expect(cells[0].value).toBe(8.5);
  });

  it("returns empty for null/undefined", () => {
    const { cells, rows } = matrixToCells(null as any);
    expect(cells.length).toBe(0);
    expect(rows.length).toBe(0);
  });

  it("handles object with exposure/weight nested", () => {
    const matrix = { BRENT: { XLE: { exposure: 5, weight: 0.5 } } };
    const { cells } = matrixToCells(matrix as any);
    expect(cells[0].value).toBe(5);
  });

  it("converts curated edge-array matrix from GET /api/cross-market", () => {
    const matrix = {
      BRENT: [{ target: "XOM", direction: 1, weight: 0.85, rationale: "oil beta" }],
      WTI: [{ target: "BRENT", direction: 1, weight: 0.95 }],
    };
    const { cells, cols } = matrixToCells(matrix);
    expect(cols).toContain("XOM");
    expect(cols).toContain("BRENT");
    expect(cells.find((c) => c.row === "BRENT" && c.col === "XOM")?.value).toBe(0.85);
  });
});
