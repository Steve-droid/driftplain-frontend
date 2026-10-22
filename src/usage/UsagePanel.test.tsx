import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { UsagePanel } from "./UsagePanel";
import { usageFixture } from "./fixtures";

const expand = (build: string) =>
  fireEvent.click(screen.getByRole("button", { name: build }));

describe("selected-run dashboard", () => {
  it("keeps partial charges and unknowns separate, without savings claims", () => {
    render(<UsagePanel data={usageFixture} projectId={1} />);
    expect(screen.getByText("Complete estimates")).toBeInTheDocument();
    expect(screen.getByText("Partial known charges")).toBeInTheDocument();
    expect(screen.getAllByText(/unavailable/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/Cumulative saved|Baseline|Quality risk/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText(/findings rated · 1 accepted · 0 rejected/)).toBeInTheDocument();
  });

  it("charts cost per run, tokens and feedback beside the runs table", () => {
    render(<UsagePanel data={usageFixture} projectId={1} />);
    expect(screen.getByRole("region", { name: "Selected-model cost chart" })).toBeInTheDocument();
    expect(screen.getByText("Cost per run")).toBeInTheDocument();
    expect(screen.getByText("Tokens per run")).toBeInTheDocument();
    expect(screen.getByText("Findings feedback")).toBeInTheDocument();
    const table = screen.getByRole("region", { name: "CI run results" });
    expect(table).toHaveTextContent("report-12");
    expect(table).toHaveTextContent("aborted-13");
    expect(screen.getByRole("columnheader", { name: "Cost" })).toBeInTheDocument();
  });

  it("shows custom reports as reports and preserves missing validation", () => {
    render(<UsagePanel data={usageFixture} projectId={1} />);
    expect(screen.queryByText("Synthetic release summary")).not.toBeInTheDocument();
    expand("report-12");
    expand("aborted-13");
    expect(screen.getByText("Synthetic release summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Validation: not_run/)).toHaveLength(2);
    expect(screen.getByText(/Revision 12/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "aborted-13 details" })).toHaveTextContent("Execution: timed_out");
    expand("aborted-13");
    expect(screen.queryByRole("region", { name: "aborted-13 details" })).not.toBeInTheDocument();
  });
});

it("does not turn unavailable costs or legacy costs into a total", () => {
  const data = structuredClone(usageFixture);
  data.totals = {
    completeCost: null,
    partialCost: null,
    completeRuns: 0,
    partialRuns: 0,
    unavailableRuns: 1,
    legacyRuns: 1,
    reportedRuns: 2,
  };
  data.runs[0] = {
    ...data.runs[0],
    executionRevisionId: null,
    legacyCost: "1.25",
    billing: {
      ...data.runs[0].billing,
      basis: "legacy_input_output_only",
      knownCost: null,
      status: "unavailable",
      rateSnapshot: null,
    },
  };
  data.runs[1].billing.knownCost = null;
  data.runs[1].billing.status = "unavailable";
  render(<UsagePanel data={data} projectId={1} />);
  expand("report-12");
  expect(
    screen.getByText(/Stored legacy input\/output estimate/),
  ).toHaveTextContent("$1.25");
  expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(1);
  expect(
    screen.queryByRole("region", { name: "Selected-model cost chart" }),
  ).not.toBeInTheDocument();
});
