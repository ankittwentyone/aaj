import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AnomalyStrip } from "./AnomalyStrip";

function renderStrip(strip: any) {
  return render(
    <MemoryRouter>
      <AnomalyStrip strip={strip} />
    </MemoryRouter>,
  );
}

describe("AnomalyStrip", () => {
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 1000 * 60 * 60).toISOString();

  it("shows quiet message when no anomaly", () => {
    renderStrip(null as any);
    expect(screen.getByText(/Monitoring chokepoints/)).toBeInTheDocument();
  });

  it("shows quiet when anomaly missing id", () => {
    renderStrip({ news_count: 5 });
    expect(screen.getByText(/Monitoring chokepoints/)).toBeInTheDocument();
  });

  it("renders chokepoint when id present even if stale undefined", () => {
    renderStrip({ max_chokepoint_anomaly: { id: "hormuz", pct_change: 5 } });
    expect(screen.getByText(/HORMUZ/)).toBeInTheDocument();
  });

  it("renders chokepoint anomaly with pct_change and stale badge logic", () => {
    const strip = {
      max_chokepoint_anomaly: { id: "hormuz", pct_change: 10.9, stale: false, retrieved_at: now },
      news_count: 8,
    };
    renderStrip(strip);
    expect(screen.getByText(/HORMUZ/)).toBeInTheDocument();
    expect(screen.getByText(/\+10\.90%/)).toBeInTheDocument();
    expect(screen.getByText(/NEWS 8/)).toBeInTheDocument();
  });

  it("shows negative pct_change correctly", () => {
    const strip = {
      max_chokepoint_anomaly: { id: "suez", pct_change: -3.9, stale: false, retrieved_at: now },
      news_count: 2,
    };
    const { container } = renderStrip(strip);
    expect(container.textContent).toContain("-3.90%");
    expect(container.textContent).toContain("SUEZ");
  });

  it("renders STALE pill when tier is red (stale:true)", () => {
    const strip = {
      max_chokepoint_anomaly: { id: "hormuz", pct_change: 5.0, stale: true, retrieved_at: now },
      news_count: 8,
    };
    const { container } = renderStrip(strip);
    expect(container.textContent).toContain("STALE");
  });

  it("does not show STALE when fresh", () => {
    const strip = {
      max_chokepoint_anomaly: { id: "hormuz", pct_change: 2.1, stale: false, retrieved_at: now },
      news_count: 3,
    };
    const { container } = renderStrip(strip);
    expect(container.textContent).not.toContain("STALE");
  });

  it("uses staleTier via TTL_S map:box 30s — old timestamp triggers amber/red", () => {
    const strip = {
      max_chokepoint_anomaly: { id: "hormuz", pct_change: 4.2, stale: false, retrieved_at: old },
      news_count: 5,
    };
    const { container } = renderStrip(strip);
    // old timestamp (>90s for ttl 30) should be red => text-danger
    expect(container.innerHTML).toContain("text-danger");
  });

  it("has correct height h-8 and border-y styling", () => {
    const strip = {
      max_chokepoint_anomaly: { id: "hormuz", pct_change: 1, stale: false, retrieved_at: now },
      news_count: 1,
    };
    const { container } = renderStrip(strip);
    expect(container.firstChild).toHaveClass("h-8");
    expect(container.firstChild).toHaveClass("border-y");
  });

  it("shows NEWS count badge", () => {
    const strip = {
      max_chokepoint_anomaly: { id: "hormuz", pct_change: 1, stale: false, retrieved_at: now },
      news_count: 12,
    };
    renderStrip(strip);
    expect(screen.getByText("NEWS 12")).toBeInTheDocument();
  });
});
