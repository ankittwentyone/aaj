import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TracePanel } from "./TracePanel";

describe("TracePanel", () => {
  const now = new Date().toISOString();
  const events = [
    { session: "s1", node: "resolve", label: "Resolve query", stage: "Discover", status: "done" as const, engine: "serpapi", query: "BRENT", result_count: 3, timestamp: now, duration_ms: 120 },
    { session: "s1", node: "news_search", label: "News search", stage: "Discover", status: "done" as const, engine: "google_news", query: "BRENT news", result_count: 5, timestamp: now, duration_ms: 160 },
    { session: "s1", node: "physical_corroborate", label: "Physical corroboration", stage: "Corroborate", status: "done" as const, engine: "aisstream", result_count: 12, timestamp: now, duration_ms: 100 },
    { session: "s1", node: "synthesize", label: "Synthesize report", stage: "Synthesize", status: "done" as const, engine: "llm", timestamp: now, duration_ms: 250 },
  ];

  it("renders three agent lanes", () => {
    render(<TracePanel events={events} />);
    expect(screen.getByText(/^Discover —/)).toBeInTheDocument();
    expect(screen.getByText(/^Corroborate —/)).toBeInTheDocument();
    expect(screen.getByText(/^Synthesize —/)).toBeInTheDocument();
  });

  it("shows lane step counts", () => {
    render(<TracePanel events={events} />);
    expect(screen.getByText(/^Discover — 2\/2/)).toBeInTheDocument();
    expect(screen.getByText(/^Corroborate — 1\/1/)).toBeInTheDocument();
    expect(screen.getByText(/^Synthesize — 1\/1/)).toBeInTheDocument();
  });

  it("shows skeleton when pending", () => {
    render(<TracePanel events={[]} />);
    expect(screen.getByText(/Running discovery/)).toBeInTheDocument();
  });

  it("lists trace labels", () => {
    render(<TracePanel events={events} />);
    expect(screen.getByText("Resolve query")).toBeInTheDocument();
    expect(screen.getByText("News search")).toBeInTheDocument();
  });
});
