import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ExecutionSetup } from "./ExecutionSetup";
import { candidates, revalidate, createExecutionProject } from "./api";
import { catalog } from "../catalog/api";
import { observation, benchmark } from "../catalog/fixtures";
import type { Candidate, Candidates } from "./api";
vi.mock("./api", () => ({
  candidates: vi.fn(),
  revalidate: vi.fn(),
  createExecutionProject: vi.fn(),
  updateExecutionProject: vi.fn(),
  getExecutionProject: vi.fn(),
  getCommand: vi.fn(),
  issueToken: vi.fn(),
}));
vi.mock("../catalog/api", async (original) => ({
  ...(await original<typeof import("../catalog/api")>()),
  catalog: vi.fn(),
}));
export const row: Candidate = {
  runtimeId: 1,
  catalogModelId: 1,
  model: "Exact Alpha",
  provider: "Provider A",
  providerModelId: "alpha-exact",
  deploymentId: 9,
  observationId: 1,
  snapshotId: 1,
  method: "supported_unranked",
  group: null,
  score: null,
  reportedValue: null,
  sourceRank: null,
  sourceGroupRank: null,
  benchmarkRunner: null,
  executionMode: "single_call",
  runtimeVersion: "v1",
  rank: null,
  position: null,
};
const page: Candidates = {
  policy: {
    task: "ci_review",
    mode: "single_call",
    language: null,
    proposeFix: false,
    version: "v1",
    benchmark: null,
    benchmarkVersion: null,
    metric: null,
    direction: null,
  },
  items: [row],
  groups: [],
  total: 1,
  offset: 0,
};
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/setup");
  vi.mocked(candidates).mockResolvedValue(page);
  vi.mocked(revalidate).mockResolvedValue(row);
  vi.mocked(catalog).mockImplementation(async (path) =>
    path.startsWith("observations/")
      ? { ...observation, id: 1, modelId: 1, sourceSnapshotId: 1 }
      : path.startsWith("benchmarks/")
        ? benchmark
        : { id: 1, name: "Exact Alpha" },
  );
});
it("searches eligible models directly and requires an explicit provider/evidence choice", async () => {
  render(<ExecutionSetup />);
  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "ci_review" },
  });
  fireEvent.change(await screen.findByLabelText("Search these models"), {
    target: { value: "Alpha" },
  });
  await waitFor(() =>
    expect(candidates).toHaveBeenLastCalledWith(
      expect.objectContaining({ task: "ci_review" }),
      "Alpha",
      null,
      0,
      { model: null, evidence: null },
    ),
  );
  expect(
    screen.getByRole("button", { name: "Continue to Jenkins" }),
  ).toBeDisabled();
  fireEvent.click(
    await screen.findByRole("button", { name: /Choose Exact Alpha/ }),
  );
  fireEvent.change(screen.getByLabelText("Project name"), {
    target: { value: "Review repo" },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Continue to Jenkins" }),
    ).toBeEnabled(),
  );
  expect(
    screen.getByText(/No comparable recommendation score/),
  ).toBeInTheDocument();
  expect(createExecutionProject).not.toHaveBeenCalled();
});
it("invalidates a pick immediately on profile changes and keeps its label visible", async () => {
  render(<ExecutionSetup />);
  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "ci_review" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: /Choose Exact Alpha/ }),
  );
  await waitFor(() => expect(revalidate).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "ci_failure_diagnosis" },
  });
  expect(screen.getByText(/Previous pick: Exact Alpha/)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Continue to Jenkins" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByLabelText("Propose a fix"));
  await waitFor(() =>
    expect(candidates).toHaveBeenLastCalledWith(
      expect.objectContaining({
        task: "ci_failure_diagnosis",
        proposeFix: true,
      }),
      "",
      null,
      0,
      { model: null, evidence: null },
    ),
  );
});
it("keeps an unsupported explorer model visible without substituting another variant", async () => {
  window.history.replaceState(null, "", "/setup?model=99&evidence=44");
  vi.mocked(candidates).mockResolvedValue({ ...page, items: [], total: 0 });
  render(<ExecutionSetup />);
  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "ci_review" },
  });
  expect(
    await screen.findByText(/Requested exact model has no eligible choice/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Choose Exact Alpha/ }),
  ).not.toBeInTheDocument();
});
it("distinguishes an empty runnable set from missing scores", async () => {
  vi.mocked(candidates).mockResolvedValue({ ...page, items: [], total: 0 });
  render(<ExecutionSetup />);
  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "security_analysis" },
  });
  expect(
    await screen.findByText(/No eligible runnable model/),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/No comparable recommendation score/),
  ).not.toBeInTheDocument();
});

it("renders the admitted score order and exact precision separately from unranked evidence", async () => {
  vi.mocked(candidates).mockImplementation(async (_p, _q, group) => ({
    ...page,
    groups: [{ id: "g1", supportedResults: 2, totalResults: 5 }],
    items: group
      ? [
          {
            ...row,
            model: "Higher score",
            runtimeId: 2,
            method: "benchmark_ranked",
            group: "g1",
            score: "91.25000001",
            rank: 1,
          },
          {
            ...row,
            model: "Lower score",
            runtimeId: 3,
            method: "benchmark_ranked",
            group: "g1",
            score: "80.12345678",
            rank: 2,
          },
          { ...row, model: "Wrong benchmark", runtimeId: 4 },
        ]
      : [row],
  }));
  render(<ExecutionSetup />);
  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "ci_review" },
  });
  fireEvent.change(await screen.findByLabelText("Recommendation group"), {
    target: { value: "g1" },
  });
  const recommendations = await screen.findByRole("region", {
    name: "Benchmark recommendations",
  });
  expect(recommendations.textContent!.indexOf("Higher score")).toBeLessThan(
    recommendations.textContent!.indexOf("Lower score"),
  );
  expect(recommendations).toHaveTextContent("91.25000001");
  expect(recommendations).not.toHaveTextContent("Wrong benchmark");
  expect(
    screen.getByRole("region", { name: "Supported unranked choices" }),
  ).toHaveTextContent("Wrong benchmark");
});

it("revalidates a restored choice and blocks disabled choices without replacing them", async () => {
  const { saveDraft, defaultFields, profileFor } = await import("./draft");
  saveDraft(null, {
    task: "ci_review",
    language: "python",
    fix: false,
    name: "Saved",
    fields: defaultFields(),
    selection: {
      ...profileFor("ci_review"),
      runtimeId: 1,
      observationId: 1,
      method: "supported_unranked",
      group: null,
    },
    label: "Exact Alpha",
    projectId: null,
  });
  vi.mocked(revalidate).mockRejectedValue(
    new Error("The runtime was disabled. Pick again."),
  );
  render(<ExecutionSetup />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "runtime was disabled",
  );
  expect(screen.getByText(/Previous pick: Exact Alpha/)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Continue to Jenkins" }),
  ).toBeDisabled();
  expect(createExecutionProject).not.toHaveBeenCalled();
});
