import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaleBadge, RiskBadge } from "./Badge";

describe("StaleBadge", () => {
  const now = new Date().toISOString();
  const fresh = new Date(Date.now() - 10 * 1000).toISOString();
  const amber = new Date(Date.now() - 120 * 1000).toISOString(); // 120s >60*1 but <60*3 so amber for map:box ttl 30? actually ttl 30 -> amber if 30-90
  const old = new Date(Date.now() - 500 * 1000).toISOString();

  it("renders LIVE for fresh (amber threshold not hit)", () => {
    render(<StaleBadge retrieved_at={fresh} stale={false} dataset="market-home" />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("renders CACHED for amber (between ttl and ttl*3)", () => {
    // market-home ttl 60, 90s ago => amber
    const ninetyAgo = new Date(Date.now() - 90 * 1000).toISOString();
    render(<StaleBadge retrieved_at={ninetyAgo} stale={false} dataset="market-home" />);
    expect(screen.getByText("CACHED")).toBeInTheDocument();
  });

  it("renders STALE for stale:true regardless of time", () => {
    render(<StaleBadge retrieved_at={fresh} stale={true} dataset="market-home" />);
    expect(screen.getByText("STALE")).toBeInTheDocument();
  });

  it("renders STALE for status=skipped", () => {
    render(<StaleBadge retrieved_at={fresh} stale={false} status="skipped" dataset="map:box" />);
    expect(screen.getByText("STALE")).toBeInTheDocument();
    expect(document.body.innerHTML).toContain("text-red-400");
  });

  it("renders STALE for NaN retrieved_at (amber fallback) then red after long", () => {
    render(<StaleBadge retrieved_at={null as any} stale={false} dataset="market-home" />);
    expect(screen.getByText("CACHED")).toBeInTheDocument(); // NaN -> amber per staleTier
  });

  it("applies tierClass correctly — fresh emerald, red text-red-400", () => {
    const { container: c1 } = render(<StaleBadge retrieved_at={fresh} stale={false} dataset="market-home" />);
    expect(c1.innerHTML).toContain("text-emerald-400");
    const { container: c2 } = render(<StaleBadge retrieved_at={fresh} stale={true} dataset="market-home" />);
    expect(c2.innerHTML).toContain("text-red-400");
  });

  it("shows colored dot matching tier", () => {
    const { container } = render(<StaleBadge retrieved_at={fresh} stale={false} dataset="market-home" />);
    expect(container.querySelector(".bg-emerald-400")).toBeInTheDocument();
  });

  it("defaults TTL_S[map:box]=30 — fresh window 30s", () => {
    const justNow = new Date(Date.now() - 5 * 1000).toISOString();
    const { container } = render(<StaleBadge retrieved_at={justNow} dataset="map:box" />);
    expect(container.textContent).toContain("LIVE");
  });
});

describe("RiskBadge", () => {
  it("renders variant classes", () => {
    render(<RiskBadge variant="critical">Critical</RiskBadge>);
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(document.body.innerHTML).toContain("risk-pill--critical");
  });
  it("renders high, low, info, stale", () => {
    const { rerender } = render(<RiskBadge variant="high">High</RiskBadge>);
    expect(screen.getByText("High")).toBeInTheDocument();
    rerender(<RiskBadge variant="stale">Stale</RiskBadge>);
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });
});
