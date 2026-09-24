import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ResearchDesk from "@/routes/ResearchDesk";
import { InstrumentProvider } from "@/context/InstrumentContext";
import { ReportView } from "@/components/Research/ReportView";

vi.mock("@/api/useResearchWS", () => ({
  useResearchWS: () => ({
    events: [],
    final: null,
    status: "idle",
    run: vi.fn(),
  }),
}));

function wrap(initialEntry: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <InstrumentProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/research" element={<ResearchDesk />} />
          </Routes>
        </MemoryRouter>
      </InstrumentProvider>
    </QueryClientProvider>,
  );
}

describe("ResearchDesk", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("mounts /research without crashing", () => {
    wrap("/research");
    expect(screen.getByText(/Research desk/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Investigate/i })).toBeInTheDocument();
  });
});

describe("ReportView", () => {
  it("renders evidence with missing provider", () => {
    render(
      <ReportView
        report="## Test"
        evidence={[{ dataset: "google_news", engine: "google_news", query: "oil" }]}
      />,
    );
    expect(screen.getByText(/Test/)).toBeInTheDocument();
  });
});
