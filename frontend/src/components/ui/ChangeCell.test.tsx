import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChangeCell, parseChangePct } from "./ChangeCell";

describe("ChangeCell", () => {
  it("shows up arrow and green for positive", () => {
    render(<ChangeCell changePct="+2.41%" />);
    expect(screen.getByText("▲")).toBeInTheDocument();
    expect(screen.getByText("+2.41%")).toBeInTheDocument();
  });

  it("shows down arrow for negative", () => {
    render(<ChangeCell changePct="-1.08%" />);
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("parseChangePct handles flat", () => {
    expect(parseChangePct("0%").dir).toBe("flat");
  });
});
