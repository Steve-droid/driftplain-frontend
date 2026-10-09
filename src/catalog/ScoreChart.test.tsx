import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Leaderboard } from "./ScoreChart";
import { benchmark, observation } from "./fixtures";
import { allPages } from "./api";
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  allPages: vi.fn(),
}));
const source = {
  id: 1,
  slug: "authors",
  name: "Author report",
  resultUrl: null,
  attribution: null,
  licenseText: null,
  snapshotId: 1,
  fetchedAt: null,
  publicationDate: null,
  refreshStatus: "ok" as const,
  checkedAt: null,
};
// Twelve low scores (0.1% … 1.2%) from one published table.
const rows = Array.from({ length: 12 }, (_, i) => ({
  ...observation,
  id: i + 1,
  modelId: i + 1,
  modelName: `Model ${i + 1}`,
  protocolConfiguration: {},
  metrics: [{ ...observation.metrics[0], value: String((i + 1) / 10) }],
}));
beforeEach(() => {
  vi.mocked(allPages).mockResolvedValue(rows);
});
describe("benchmark leaderboard", () => {
  it("scales bars to the best shown score and lets viewers choose models", async () => {
    render(<Leaderboard benchmarks={[{ ...benchmark, sources: [source] }]} fixedId={1} />);
    const chart = await screen.findByRole("list", { name: /Accuracy by model/ });
    const bars = within(chart).getAllByRole("listitem");
    expect(bars).toHaveLength(10);
    expect(bars[0]).toHaveTextContent("Model 12");
    expect(bars[0].style.getPropertyValue("--pct")).toBe("100");
    expect(bars[9].style.getPropertyValue("--pct")).toBe("25");
    expect(screen.getByText(/Correct answers\./)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Models · 10 of 12"));
    fireEvent.click(screen.getByRole("checkbox", { name: /Model 12/ }));
    expect(within(chart).getAllByRole("listitem")[0]).toHaveTextContent("Model 11");
    expect(within(chart).getAllByRole("listitem")[0].style.getPropertyValue("--pct")).toBe("100");
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(within(chart).getAllByRole("listitem")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect(screen.getByText(/No models selected/)).toBeInTheDocument();
  });
});
