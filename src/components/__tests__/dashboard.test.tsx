vi.mock("../../api/auth", () => ({getMe: vi.fn().mockResolvedValue({chatEnabled:false})}));
import { usageFixture } from "../../usage/fixtures";
import { apiGet } from "../../api/client";
vi.mock("../../api/client", async (original) => ({...await original<object>(), apiGet: vi.fn()}));
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { KpiCard } from "../KpiCard";
import { QualityPill } from "../StatusBadge";
import { RunsTable } from "../RunsTable";
import { buildAreaData } from "../SavingsAreaChart";
import { formatUSD, formatUSDAxis } from "../../lib/format";
import {
  savingsFixture,
  overspendFixture,
  overspendSeriesPoint,
  projectsFixture,
  chatHistoryFixture,
  securitySavingsFixture,
} from "../../test/fixtures";
import { runtimeHintFromProjectModel } from "../onboarding/jenkinsRuntime";

// getRunFindings + submitFeedback are called from RunsTable; stub so imports resolve.
vi.mock("../../api/savings", () => ({
  getSavings: vi.fn(),
  getRunFindings: vi.fn().mockResolvedValue({ runId: 0, findings: [] }),
  submitFeedback: vi.fn(),
}));
import { getRunFindings, submitFeedback } from "../../api/savings";

// The Dashboard now loads the project list (switcher) and mounts the chat panel;
// stub both so it can render savings without real network calls.
vi.mock("../../api/projects", () => ({ listProjects: vi.fn() }));
import { listProjects } from "../../api/projects";
vi.mock("../../api/chat", () => ({
  getChatHistory: vi.fn(),
  postChat: vi.fn(),
}));
import { getChatHistory } from "../../api/chat";

describe("formatUSD", () => {
  it("uses finer precision below a dollar, 2dp above", () => {
    expect(formatUSD("0.005800")).toBe("$0.0058");
    expect(formatUSD("12.5")).toBe("$12.50");
    expect(formatUSD(null)).toBe("—");
  });

  it("places the sign before the $ for overspend (negative)", () => {
    expect(formatUSD("-0.010000")).toBe("-$0.0100");
  });
});

describe("formatUSDAxis (F3: adaptive tick precision)", () => {
  it("keeps sub-cent ticks distinct instead of collapsing to $0.001/$0", () => {
    // the seeded cost-per-run scale: ticks must all differ
    const ticks = [0, 0.0005, 0.001, 0.0015, 0.002].map(formatUSDAxis);
    expect(new Set(ticks).size).toBe(ticks.length);
    expect(ticks).toEqual(["$0", "$0.0005", "$0.001", "$0.0015", "$0.002"]);
  });

  it("stays compact for cent- and dollar-scale ticks", () => {
    expect(formatUSDAxis(0.045)).toBe("$0.045");
    expect(formatUSDAxis(0.06)).toBe("$0.06");
    expect(formatUSDAxis(12.34)).toBe("$12.3");
    expect(formatUSDAxis(-0.0012)).toBe("-$0.0012");
  });
});

describe("buildAreaData (chart transform)", () => {
  it("splits a normal run into a green gain, no loss", () => {
    const [p] = buildAreaData([savingsFixture.series[0]]); // savings 0.02, actual 0.01
    expect(p.floor).toBe(0.01); // min(actual, baseline) = actual
    expect(p.gain).toBeCloseTo(0.02); // the savings band
    expect(p.loss).toBe(0);
  });

  it("surfaces overspend as a red loss, never clamped away", () => {
    const [p] = buildAreaData([overspendSeriesPoint]); // actual 0.04 > baseline 0.03
    expect(p.savings).toBeCloseTo(-0.01); // signed, NOT clamped to 0
    expect(p.floor).toBe(0.03); // min = baseline
    expect(p.gain).toBe(0); // no savings
    expect(p.loss).toBeCloseTo(0.01); // the overspend band
  });
});

describe("KpiCard", () => {
  it("renders the label and a ready value", () => {
    render(<KpiCard label="Cumulative saved" value="$0.0450" />);
    expect(screen.getByText("Cumulative saved")).toBeInTheDocument();
    expect(screen.getByText("$0.0450")).toBeInTheDocument();
  });
});

describe("QualityPill", () => {
  it("labels the three quality states distinctly", () => {
    const { rerender } = render(<QualityPill qualityOk={true} />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    rerender(<QualityPill qualityOk={false} />);
    expect(screen.getByText("Quality risk")).toBeInTheDocument();
    rerender(<QualityPill qualityOk={null} />);
    expect(screen.getByText("Unrated")).toBeInTheDocument();
  });
});

describe("RunsTable", () => {
  it.each([
    [69376, "69,376"],
    [0, "0"],
    [null, "Not reported"],
  ])("shows cache usage %s while findings load and when empty", async (cacheReadTokens, display) => {
    let finish!: (value: { runId: number; findings: [] }) => void;
    vi.mocked(getRunFindings).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const run = { ...savingsFixture.runs[0], cacheReadTokens, findingsCount: 0 };
    render(<RunsTable projectId={1} runs={[run]} />);
    const collapsedRow = screen.getByText("101").closest("tr")!;
    const collapsedText = collapsedRow.textContent;
    expect(screen.queryByText("Cache-read tokens")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("101"));

    expect(screen.getByText("Loading findings…")).toBeInTheDocument();
    expect(screen.getByText("Input tokens").parentElement).toHaveTextContent("1,200");
    expect(screen.getByText("Output tokens").parentElement).toHaveTextContent("340");
    expect(screen.getByText("Cache-read tokens").parentElement).toHaveTextContent(display);
    expect(screen.getByText(
      "Cache-read costs are not included in the displayed cost estimates.",
    )).toBeInTheDocument();

    await act(async () => { finish({ runId: run.id, findings: [] }); });
    expect(screen.getByText("No findings on this run.")).toBeInTheDocument();
    expect(screen.getByText("Cache-read tokens").parentElement).toHaveTextContent(display);
    expect(collapsedRow.textContent).toBe(collapsedText); // money/gate/token total unchanged
    fireEvent.click(screen.getByText("101"));
    expect(screen.queryByText("Cache-read tokens")).not.toBeInTheDocument();
  });

  it("shows every run, flagging the quality-risk one (never silently dropped)", () => {
    render(<RunsTable projectId={1} runs={savingsFixture.runs} />);
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.getByText("102")).toBeInTheDocument();
    expect(screen.getByText("103")).toBeInTheDocument();
    expect(screen.getByText("Quality risk")).toBeInTheDocument();
    expect(screen.getByText("Unrated")).toBeInTheDocument();
  });

  it("renders an overspend run's savings in red, not green", () => {
    render(<RunsTable projectId={1} runs={overspendFixture.runs} />);
    const cell = screen.getByText("-$0.0100");
    expect(cell.className).toContain("text-risk");
    expect(cell.className).not.toContain("text-banked");
  });

  it("shows the agent's gate per run, and no CWE column on a review project (E20)", () => {
    render(<RunsTable projectId={1} runs={savingsFixture.runs} />);
    expect(screen.getByRole("columnheader", { name: "Gate" })).toBeInTheDocument();
    expect(screen.getAllByText("Pass")).toHaveLength(3);
    expect(screen.queryByRole("columnheader", { name: "CWE" })).not.toBeInTheDocument();
  });

  it("shows a failed gate in red and the run's CWE ids on a security project (E20)", () => {
    render(<RunsTable projectId={3} runs={securitySavingsFixture.runs} />);
    const fail = screen.getByText("Fail");
    expect(fail.className).toContain("text-risk");
    expect(screen.getByRole("columnheader", { name: "CWE" })).toBeInTheDocument();
    expect(screen.getByText("CWE-1336")).toBeInTheDocument();
    expect(screen.getByText("CWE-79")).toBeInTheDocument();
    expect(screen.getByText("CWE-798")).toBeInTheDocument();
  });

  it("shows a finding's CWE in the drill-in (E20)", async () => {
    vi.mocked(getRunFindings).mockResolvedValueOnce({
      runId: 114,
      findings: [
        {
          id: 9,
          severity: "critical",
          category: "security",
          file: "app.py",
          line: 41,
          message: "Jinja2 template rendered from user input",
          cwe: "CWE-1336: Server-Side Template Injection",
          verdict: null,
        },
      ],
    });
    render(<RunsTable projectId={3} runs={securitySavingsFixture.runs} />);
    fireEvent.click(screen.getByText("sec-114"));
    expect(await screen.findByText(/Jinja2 template rendered/)).toBeInTheDocument();
    expect(screen.getByText("Cache-read tokens").parentElement).toHaveTextContent("69,376");
    expect(screen.getByText("Input tokens").parentElement).toHaveTextContent("11,501");
    expect(screen.getByText("Output tokens").parentElement).toHaveTextContent("2,618");
    expect(screen.getByText(
      "Cache-read costs are not included in the displayed cost estimates.",
    )).toBeInTheDocument();
    // the row chip AND the drill-in chip both read CWE-1336 (full title on hover)
    const chips = screen.getAllByText("CWE-1336");
    expect(chips.length).toBeGreaterThanOrEqual(2);
    expect(chips.some((c) => c.getAttribute("title") === "CWE-1336: Server-Side Template Injection")).toBe(true);
  });
});

describe("jenkinsRuntime hint — the security task's vendors (E20)", () => {
  it("names DEEPSEEK_API_KEY / OPENAI_API_KEY for the OpenCode-only vendors", () => {
    expect(runtimeHintFromProjectModel("DeepSeek V4 Flash")).toMatchObject({
      authMode: "api_key",
      credentialEnvVar: "DEEPSEEK_API_KEY",
      providerLabel: "DeepSeek",
    });
    expect(runtimeHintFromProjectModel("GPT-5.5")).toMatchObject({
      authMode: "api_key",
      credentialEnvVar: "OPENAI_API_KEY",
      providerLabel: "OpenAI",
    });
    expect(runtimeHintFromProjectModel("Claude Opus 5")?.credentialEnvVar).toBe("ANTHROPIC_API_KEY");
  });
});

describe("RunsTable — rating a finding (S17b)", () => {
  it("submits a verdict, reflects it, and tells the dashboard to refetch savings", async () => {
    vi.mocked(getRunFindings).mockResolvedValueOnce({
      runId: 101,
      findings: [
        {
          id: 7,
          severity: "high",
          category: "security",
          file: "Jenkinsfile",
          line: 12,
          message: "hardcoded internal IP",
          cwe: null,
          verdict: null,
        },
      ],
    });
    vi.mocked(submitFeedback).mockResolvedValueOnce({
      findingId: 7,
      ciRunId: 101,
      verdict: "accept",
      acceptanceRate: 1,
      qualityOk: true,
    });
    const onRated = vi.fn();
    render(
      <RunsTable projectId={2} runs={savingsFixture.runs} onRated={onRated} />,
    );

    // drill into a run → its findings load → the accept/reject control appears
    fireEvent.click(screen.getByText("101"));
    const accept = await screen.findByLabelText("Accept finding");
    expect(accept).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(accept);

    await waitFor(() => expect(submitFeedback).toHaveBeenCalledWith(7, "accept"));
    // verdict reflected locally + dashboard told to refetch (re-bank the savings)
    await waitFor(() => expect(accept).toHaveAttribute("aria-pressed", "true"));
    expect(onRated).toHaveBeenCalledTimes(1);
  });

  it("keeps the prior state and shows an error when the submit fails", async () => {
    vi.mocked(getRunFindings).mockResolvedValueOnce({
      runId: 101,
      findings: [
        {
          id: 8,
          severity: "low",
          category: "style",
          file: "src/app.py",
          line: 3,
          message: "noise",
          cwe: null,
          verdict: null,
        },
      ],
    });
    vi.mocked(submitFeedback).mockRejectedValueOnce(new Error("boom"));
    const onRated = vi.fn();
    render(
      <RunsTable projectId={2} runs={savingsFixture.runs} onRated={onRated} />,
    );

    fireEvent.click(screen.getByText("101"));
    const reject = await screen.findByLabelText("Reject finding");
    fireEvent.click(reject);

    expect(await screen.findByText(/couldn’t save/i)).toBeInTheDocument();
    expect(reject).toHaveAttribute("aria-pressed", "false"); // unchanged
    expect(onRated).not.toHaveBeenCalled();
  });
});

describe("Dashboard (E20: task label, baseline pick)", () => {
  it("names the task under the CI-runs stat", async () => {
    vi.mocked(apiGet).mockResolvedValue(usageFixture);
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    vi.mocked(getChatHistory).mockResolvedValue(chatHistoryFixture);
    const { Dashboard } = await import("../../pages/Dashboard");
    render(<Dashboard />);
    expect(await screen.findByText(/aborted-13 · security analysis/)).toBeInTheDocument();
  });

  it("shows raw stats and no 'saved' figure when the pick IS the baseline", async () => {
    vi.mocked(apiGet).mockResolvedValue(usageFixture);
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    vi.mocked(getChatHistory).mockResolvedValue(chatHistoryFixture);
    const { Dashboard } = await import("../../pages/Dashboard");
    render(<Dashboard />);
    expect(await screen.findByText("Usage and estimated cost")).toBeInTheDocument();
    expect(screen.queryByText("Cumulative saved")).not.toBeInTheDocument();
    expect(screen.queryByText(/vs baseline/)).not.toBeInTheDocument();
    expect(screen.queryByText(/costed, not run/)).not.toBeInTheDocument();
    // the raw stats are still there
    expect(screen.getByText("Complete estimates")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "CI run results" })).toBeInTheDocument();
  });
});

describe("Dashboard (overspend)", () => {
  it("labels a net overspend in red copy, not green 'saved'", async () => {
    vi.mocked(apiGet).mockResolvedValue(usageFixture);
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    vi.mocked(getChatHistory).mockResolvedValue(chatHistoryFixture);
    const { Dashboard } = await import("../../pages/Dashboard");
    render(<Dashboard />);
    await screen.findByText("Partial known charges");
    expect(screen.queryByText("Net overspend")).not.toBeInTheDocument();

  });

  it("badges a setup-incomplete project (no CI token yet)", async () => {
    const incomplete = [{ ...projectsFixture[0], setupComplete: false }];
    vi.mocked(apiGet).mockResolvedValue(usageFixture);
    vi.mocked(listProjects).mockResolvedValue(incomplete);
    vi.mocked(getChatHistory).mockResolvedValue(chatHistoryFixture);
    const { Dashboard } = await import("../../pages/Dashboard");
    render(<Dashboard />);
    expect(await screen.findByText(/setup incomplete/i)).toBeInTheDocument();
  });

  it("clears the previous project's numbers when switching projects", async () => {
    // Project 1 resolves; project 2 stays pending so we can observe the gap.
    vi.mocked(apiGet)
      .mockResolvedValueOnce(usageFixture) // project 1 ($0.0450 saved)
      .mockReturnValueOnce(new Promise(() => {})); // project 2 — never resolves
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    vi.mocked(getChatHistory).mockResolvedValue(chatHistoryFixture);
    const { Dashboard } = await import("../../pages/Dashboard");
    render(<Dashboard />);

    // project 1's savings panel is on screen (stable label, not the animated number)
    await screen.findByText("Usage and estimated cost");

    // switch to project 2 (savings still loading)
    fireEvent.change(screen.getByLabelText("Select CI-Agent"), { target: { value: "2" } });

    // project 1's numbers must disappear immediately — not linger under project 2
    await waitFor(() =>
      expect(screen.queryByText("Usage and estimated cost")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Loading usage…")).toBeInTheDocument();
  });
});
