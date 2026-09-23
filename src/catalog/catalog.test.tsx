import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { BenchmarkName } from "./BenchmarkName";
import { benchmark, model, observation, page } from "./fixtures";
import { allPages, catalog } from "./api";
import { setToken } from "../api/client";
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  catalog: vi.fn(),
  allPages: vi.fn(),
}));
vi.mock("../api/projects", () => ({ listProjects: vi.fn() }));
import { listProjects } from "../api/projects";
const mock = vi.mocked(catalog);
beforeEach(() => {
  window.history.replaceState(null, "", "/benchmarks");
  vi.clearAllMocks();
  vi.mocked(allPages).mockResolvedValue([benchmark]);
  mock.mockImplementation(async (path) => {
    if (path.startsWith("benchmarks/"))
      return { ...benchmark, versions: [], taskTypes: [] };
    if (path.startsWith("benchmarks?")) return page([benchmark]);
    if (path.startsWith("models/")) return model;
    if (path.startsWith("models?")) return page([model]);
    if (path.startsWith("observations?")) return page([observation]);
    return page([]);
  });
});
afterEach(() => {
  localStorage.clear();
});
describe("anonymous catalog", () => {
  it("ignores expired sessions and never probes projects", async () => {
    setToken("expired-token");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: /GPQA Diamond/ }),
    ).toBeInTheDocument();
    expect(listProjects).not.toHaveBeenCalled();
  });
  it("keeps comparison choices when opening profiles and browsing", async () => {
    window.history.replaceState(null, "", "/models?compare=m2");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Add to compare" }),
    );
    expect(window.location.search).toContain("compare=m2%2Cm1");
    fireEvent.click(screen.getByRole("link", { name: "Alpha 1" }));
    expect(window.location.pathname).toBe("/models/1");
    expect(new URLSearchParams(window.location.search).get("compare")).toBe(
      "m2,m1",
    );
  });
  it("searches the server beyond loaded rows and opens keyboard results", async () => {
    mock.mockImplementation(async (path) =>
      path.startsWith("search?")
        ? page(
            path.includes("type=model")
              ? [
                  {
                    type: "model",
                    id: 99,
                    name: "Unloaded exact alias",
                    subtitle: null,
                  },
                ]
              : [],
          )
        : path.startsWith("models/99")
          ? { ...model, id: 99, name: "Unloaded exact alias" }
          : path.startsWith("observations?")
            ? page([])
            : page([benchmark]),
    );
    render(<App />);
    const input = screen.getByRole("combobox", {
      name: "Search models or benchmarks",
    });
    fireEvent.change(input, { target: { value: "exact-alias" } });
    await screen.findByRole("option", { name: "Unloaded exact alias" });
    expect(
      mock.mock.calls.some(([path]) => path.includes("q=exact-alias")),
    ).toBe(true);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(
      await screen.findByRole("heading", { name: "Unloaded exact alias" }),
    ).toBeInTheDocument();
  });
  it("requires an observation choice instead of choosing the maximum", async () => {
    window.history.replaceState(null, "", "/compare?compare=m1,m2");
    mock.mockImplementation(async (path) =>
      path.startsWith("models/")
        ? {
            ...model,
            id: Number(path.split("/")[1]),
            name: path.endsWith("/1") ? "Alpha" : "Beta",
          }
        : path.startsWith("observations?")
          ? page([
              { ...observation, id: 10 },
              {
                ...observation,
                id: 11,
                metrics: [{ ...observation.metrics[0], value: "99" }],
              },
            ])
          : page([benchmark]),
    );
    vi.mocked(allPages).mockImplementation(async (path) =>
      path === "benchmarks"
        ? [benchmark]
        : [
            { ...observation, id: 10 },
            {
              ...observation,
              id: 11,
              metrics: [{ ...observation.metrics[0], value: "99" }],
            },
          ],
    );
    render(<App />);
    const select = await screen.findByRole("combobox", {
      name: /Observation for Alpha/,
    });
    expect(select).toHaveValue("");
    fireEvent.change(select, { target: { value: "10" } });
    expect(window.location.search).toContain("observations=10");
    await waitFor(() => expect(select).toHaveValue("10"));
  });
});
describe("benchmark explanations", () => {
  it("restores focus and dismisses with Escape from the methodology link", () => {
    render(<BenchmarkName benchmark={benchmark} />);
    const info = screen.getByRole("button", { name: /What does/ });
    fireEvent.focus(info);
    const link = screen.getByRole("link", { name: /Methodology/ });
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(info).toHaveFocus();
  });
  it("supports touch click and close without immediately reopening", () => {
    render(<BenchmarkName benchmark={benchmark} />);
    const info = screen.getByRole("button", { name: /What does/ });
    fireEvent.click(info);
    fireEvent.click(screen.getByRole("button", { name: "Close explanation" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(info).toHaveFocus();
  });
});
