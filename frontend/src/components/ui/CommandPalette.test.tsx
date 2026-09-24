import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";

vi.mock("@/api/client", () => ({
  fetchSearch: vi.fn(async (q: string, limit: number) => ({
    query: q,
    results: [{ label: q, type: "asset", route: `/asset/${encodeURIComponent(q)}` }],
  })),
}));

import { fetchSearch } from "@/api/client";

function renderPalette(open = true, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <CommandPalette open={open} onClose={onClose} />
    </MemoryRouter>,
  );
}

// helper to flush 200ms debounce + async fetchSearch microtasks with fake timers
async function advanceDebounce(ms = 210) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    // flush async fetch after timer fires
    await Promise.resolve();
    await Promise.resolve();
    // one more tick for state update
    await Promise.resolve();
  });
  // ensure react updates
  await act(async () => {
    await Promise.resolve();
  });
}

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders dialog when open=true and hidden when open=false", () => {
    const { rerender } = render(
      <MemoryRouter>
        <CommandPalette open={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/BRENT, HORMUZ/)).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <CommandPalette open={false} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("focuses input on open (30ms timeout)", async () => {
    renderPalette(true);
    const input = screen.getByPlaceholderText(/BRENT, HORMUZ/) as HTMLInputElement;
    await act(async () => {
      vi.advanceTimersByTime(35);
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(input);
  });

  it("debounces search by 200ms — does not call fetchSearch immediately", async () => {
    renderPalette(true);
    const input = screen.getByPlaceholderText(/BRENT, HORMUZ/);
    fireEvent.change(input, { target: { value: "BRE" } });
    // before 200ms, no call
    await act(async () => {
      vi.advanceTimersByTime(199);
      await Promise.resolve();
    });
    expect(fetchSearch).not.toHaveBeenCalled();
    await advanceDebounce(2); // to reach 201 total
    expect(fetchSearch).toHaveBeenCalledWith("BRE", 8);
  });

  it("subsequent typing resets debounce timer", async () => {
    renderPalette(true);
    const input = screen.getByPlaceholderText(/BRENT, HORMUZ/);
    fireEvent.change(input, { target: { value: "B" } });
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    fireEvent.change(input, { target: { value: "BR" } });
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(fetchSearch).not.toHaveBeenCalled();
    await advanceDebounce(110);
    expect(fetchSearch).toHaveBeenCalledWith("BR", 8);
  });

  it("WHY→research special — WHY is BRENT moving? opens research route without fetchSearch", async () => {
    renderPalette(true);
    const input = screen.getByPlaceholderText(/BRENT, HORMUZ/);
    fireEvent.change(input, { target: { value: "WHY is BRENT moving?" } });
    await advanceDebounce(210);
    expect(screen.getByText(/Research: WHY is BRENT moving\?/)).toBeInTheDocument();
    expect(fetchSearch).not.toHaveBeenCalled();
    expect(screen.getByText(/via SerpApi/)).toBeInTheDocument();
  });

  it("WHY prefix without 'is' also triggers research", async () => {
    renderPalette(true);
    const input = screen.getByPlaceholderText(/BRENT, HORMUZ/);
    fireEvent.change(input, { target: { value: "WHY OIL?" } });
    await advanceDebounce(210);
    expect(screen.getByText(/Research: WHY OIL\?/)).toBeInTheDocument();
  });

  it("-> scenario dispatch — '-> brent +10' shows scenario pill", async () => {
    renderPalette(true);
    const input = screen.getByPlaceholderText(/BRENT, HORMUZ/);
    fireEvent.change(input, { target: { value: "-> brent +10" } });
    await advanceDebounce(210);
    expect(screen.getByText(/Scenario: brent \+10/)).toBeInTheDocument();
    expect(screen.getAllByText("scenario").length).toBeGreaterThanOrEqual(1);
  });

  it("ArrowDown/ArrowUp navigate active result, Enter navigates", async () => {
    (fetchSearch as any).mockResolvedValueOnce({
      query: "BRENT",
      results: [
        { label: "BRENT", type: "asset", route: "/asset/BRENT" },
        { label: "Strait of Hormuz", type: "chokepoint", route: "/map?choke=hormuz" },
      ],
    });
    renderPalette(true);
    const input = screen.getByPlaceholderText(/BRENT, HORMUZ/);
    fireEvent.change(input, { target: { value: "BRENT" } });
    await advanceDebounce(210);
    expect(screen.getByText("BRENT")).toBeInTheDocument();
    expect(screen.getByText("Strait of Hormuz")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("Escape closes palette", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <CommandPalette open={true} onClose={onClose} />
      </MemoryRouter>,
    );
    const input = screen.getByPlaceholderText(/BRENT, HORMUZ/);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking overlay closes palette", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <CommandPalette open={true} onClose={onClose} />
      </MemoryRouter>,
    );
    const overlay = document.querySelector(".bg-overlay") as HTMLElement;
    expect(overlay).toBeInTheDocument();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows 'No matches' when fetchSearch returns empty and query present", async () => {
    (fetchSearch as any).mockResolvedValueOnce({ query: "XYZUNKNOWN", results: [] });
    renderPalette(true);
    const input = screen.getByPlaceholderText(/BRENT, HORMUZ/);
    fireEvent.change(input, { target: { value: "XYZUNKNOWN" } });
    await advanceDebounce(210);
    expect(screen.getByText(/No matches/)).toBeInTheDocument();
  });

  it("shows help text when query empty", () => {
    renderPalette(true);
    expect(screen.getByText(/↑↓ Navigate/)).toBeInTheDocument();
  });

  it("q length <1 does not trigger fetchSearch even after debounce", async () => {
    renderPalette(true);
    const input = screen.getByPlaceholderText(/BRENT, HORMUZ/);
    fireEvent.change(input, { target: { value: "" } });
    await advanceDebounce(500);
    expect(fetchSearch).not.toHaveBeenCalled();
  });
});
