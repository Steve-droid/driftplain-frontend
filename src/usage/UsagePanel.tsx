import { useState } from "react";
import { ChevronDown, ChevronRight, Wallet, Info } from "lucide-react";
import { getRunFindings, submitFeedback } from "../api/savings";
import { FindingItem } from "../components/RunsTable";
import { KpiCard } from "../components/KpiCard";
import { formatDateTime, formatTokens } from "../lib/format";
import type { FindingRow, Verdict } from "../types/savings";
import type { UsageResponse, UsageRun } from "./types";
import { CostPerRunChart, FeedbackPerRunChart, TokensPerRunChart } from "./charts";
import { exampleFindings } from "./examples";
import { hasFeedback, hasKnownCost, pricedTokens, tokenCategories } from "./chartData";

// The selected-run dashboard: a KPI strip, cost per run, token and feedback breakdowns,
// then the runs table whose rows expand into results, usage, rates and findings. Cost
// strings render exactly as the API sent them; only the charts parse them to size bars.
// Nothing here compares against a baseline or gates money on feedback.

const money = (value: string | null) => (value == null ? "Unavailable" : `$${value}`);
const words = (s: string) => s.replaceAll("_", " ");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function UsagePanel({
  data,
  projectId,
  onRated,
  example = false,
}: {
  data: UsageResponse;
  projectId: number;
  onRated?: () => void;
  example?: boolean;
}) {
  const t = data.totals;
  const f = data.feedback;
  const runs = data.runs;
  const showTokens = tokenCategories(runs).length > 0;
  const showFeedback = hasFeedback(runs);
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-50">Usage and estimated cost</h1>
        <p className="mt-1 text-sm text-muted">
          Selected-model estimates for reported CI runs. Feedback and CI gates
          do not change incurred cost.
        </p>
      </div>

      <section
        aria-label="Usage summary"
        className="dashboard-summary"
      >
        <div className="card usage-hero">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted">Complete estimates</span>
            <Wallet size={18} className="text-accent" aria-hidden />
          </div>
          <div className="num usage-hero-value font-semibold text-accent">
            {money(t.completeCost)}
          </div>
          <div className="text-xs leading-relaxed text-muted">
            {plural(t.completeRuns, "run")} with complete billing categories
            <span className="mt-1 block text-faint">Selected period · USD</span>
          </div>
        </div>
        <KpiCard
          label="Partial known charges"
          value={t.partialRuns === 0 ? "None" : money(t.partialCost)}
          accent={t.partialCost == null ? "text-fg" : "text-unrated"}
          sub={t.partialRuns === 0 ? "No partially priced runs in this period" : `${plural(t.partialRuns, "run")} · additional charges may be missing`}
        />
        <KpiCard
          label="Cost coverage"
          value={String(t.reportedRuns)}
          sub={`reported runs · ${t.unavailableRuns} unavailable · ${t.legacyRuns} legacy`}
        />
        <KpiCard
          label="Feedback coverage"
          value={`${f.rated} / ${f.total}`}
          accent={f.rated > 0 ? "text-banked" : "text-fg"}
          sub={`findings rated · ${f.accepted} accepted · ${f.rejected} rejected`}
        />
      </section>

      {hasKnownCost(runs) ? <CostPerRunChart runs={runs} /> : (
        <section className="card flex min-h-48 flex-col items-center justify-center gap-3 text-center" aria-label="Cost chart unavailable">
          <Wallet size={24} className="text-faint" aria-hidden />
          <h2 className="font-medium text-fg">{runs.length ? "Cost estimates aren’t available yet" : "Your first run starts the story"}</h2>
          <p className="max-w-md text-sm text-muted">
            {runs.length ? "Run history is available below. Estimates appear when reported usage and pinned rates are available."
              : "Run your CI agent to see usage, estimated cost and results here."}
          </p>
        </section>
      )}

      {(showTokens || showFeedback) && (
        <section
          aria-label="Run breakdowns"
          className={`run-breakdowns ${showTokens && showFeedback ? "run-breakdowns-pair" : ""}`}
        >
          {showTokens && <TokensPerRunChart runs={runs} />}
          {showFeedback && <FeedbackPerRunChart runs={runs} />}
        </section>
      )}

      <RunsTable example={example} runs={runs} projectId={projectId} onRated={onRated} />

      <section className="rounded-xl border border-border/70 bg-panel/50 p-4 text-xs leading-relaxed text-muted">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-fg"><Info size={14} aria-hidden />Coverage and limitations</h2>
        <ul className="list-disc pl-5">
          <li>
            Acceptance does not measure recall or security coverage. Empty or
            unrated runs do not prove a clean repository.
          </li>
          {data.limitations.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

const COLUMNS = 11;

function RunsTable({
  runs,
  projectId,
  onRated,
  example = false,
}: {
  runs: UsageRun[];
  projectId: number;
  onRated?: () => void;
  example?: boolean;
}) {
  // Any number of runs can stay open; each keeps its own findings state while open.
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const th = "px-4 py-2 font-medium";
  return (
    <section className="card overflow-hidden p-0" aria-label="CI run results">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">CI runs</h2>
        <span className="text-xs text-faint">
          newest first · open a run for results, usage, rates and findings
        </span>
      </div>
      {/* Size expanded details against the visible container, not the wide scrolling table. */}
      <div className="overflow-x-auto [container-type:inline-size]" role="region" aria-label="Scrollable run history" tabIndex={0}>
        <table className="w-full text-sm">
          <caption className="sr-only">Reported CI runs, newest first. Expand a build for results and usage details.</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-faint">
              <th className={th}>Build</th>
              <th className={th}>Date</th>
              <th className={th}>Task</th>
              <th className={th}>Model</th>
              <th className={th}>Mode</th>
              <th className={`${th} text-right`}>Tokens</th>
              <th className={`${th} text-right`}>Cost</th>
              <th className={th}>Coverage</th>
              <th className={th}>Execution</th>
              <th className={th}>Gate</th>
              <th className={`${th} text-right`}>Findings</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <RunRow
                key={`${projectId}:${run.id}`}
                run={run}
                example={example}
                open={open.has(run.id)}
                onToggle={() => toggle(run.id)}
                projectId={projectId}
                onRated={onRated}
              />
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={COLUMNS} className="px-4 py-8 text-center text-muted">
                  No CI runs yet. Reported runs will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const buildOf = (r: UsageRun) => r.jenkinsBuildId ?? `Run ${r.id}`;

function RunRow({
  run: r,
  open,
  onToggle,
  projectId,
  onRated,
  example = false,
}: {
  run: UsageRun;
  open: boolean;
  onToggle: () => void;
  projectId: number;
  onRated?: () => void;
  example?: boolean;
}) {
  const result = r.taskResult;
  const build = buildOf(r);
  const tokens = pricedTokens(r);
  const hasFindings = !result || result.kind === "findings";
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t border-border/60 hover:bg-white/[0.02]"
      >
        <td className="px-4 py-2.5">
          {/* The whole row toggles; the button gives keyboard users a focus stop. */}
          <button
            type="button"
            aria-expanded={open}
            className="num flex min-h-8 items-center gap-1.5 text-fg"
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {build}
          </button>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 text-muted">
          {r.createdAt ? formatDateTime(r.createdAt) : "—"}
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 text-fg">{words(r.task)}</td>
        <td className="num px-4 py-2.5 text-fg">{r.model ?? "—"}</td>
        <td className="px-4 py-2.5 text-muted">{r.mode ? words(r.mode) : "legacy"}</td>
        <td className="num px-4 py-2.5 text-right text-muted">
          {tokens == null ? "—" : formatTokens(tokens)}
        </td>
        <td className="num px-4 py-2.5 text-right text-fg">{money(r.billing.knownCost)}</td>
        <td className="px-4 py-2.5">
          <CoveragePill status={r.billing.status} />
        </td>
        <td className="px-4 py-2.5">
          <ExecutionLabel status={result?.executionStatus ?? null} />
        </td>
        <td className="px-4 py-2.5">
          <GatePill gate={r.gate} />
        </td>
        <td className="num px-4 py-2.5 text-right text-muted">
          {hasFindings ? `${r.feedback.rated}/${r.feedback.total}` : "—"}
        </td>
      </tr>
      {open && (
        <tr className="bg-canvas/60">
          <td colSpan={COLUMNS} className="px-4 py-4">
            <section
              aria-label={`${build} details`}
              className="min-w-0 max-w-[calc(100cqw-2rem)] break-words"
            >
              <header className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-fg">
                    {build} · {words(r.task)}
                  </h3>
                  <p className="text-sm text-muted">
                    {r.model ?? "Model attribution unavailable"} ·{" "}
                    {r.mode ?? "legacy mode"}
                  </p>
                  <p className="text-xs text-muted">
                    {r.createdAt
                      ? new Date(r.createdAt).toLocaleString()
                      : "Date unavailable"}{" "}
                    · Revision {r.executionRevisionId ?? "unavailable"}
                  </p>
                </div>
                <div>
                  <p className="num text-fg">{money(r.billing.knownCost)}</p>
                  <p className="text-xs text-muted">
                    {words(r.billing.status)} · {words(r.billing.basis)}
                  </p>
                </div>
              </header>
              <RunDetails example={example} run={r} projectId={projectId} onRated={onRated} />
            </section>
          </td>
        </tr>
      )}
    </>
  );
}

function CoveragePill({ status }: { status: UsageRun["billing"]["status"] }) {
  const tone =
    status === "complete"
      ? "text-banked bg-banked"
      : status === "partial"
        ? "text-unrated bg-unrated"
        : "text-faint bg-faint";
  const [text, dot] = tone.split(" ");
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function ExecutionLabel({ status }: { status: string | null }) {
  if (status == null) return <span className="text-xs text-faint">not reported</span>;
  const tone =
    status === "completed"
      ? "text-banked"
      : status === "timed_out" || status === "failed"
        ? "text-risk"
        : "text-muted";
  return <span className={`whitespace-nowrap text-xs font-medium ${tone}`}>{words(status)}</span>;
}

// The agent's pass/fail decision recorded at ingest; distinct from feedback.
function GatePill({ gate }: { gate: string | null }) {
  if (gate === "pass" || gate === "fail") {
    const tone = gate === "pass" ? "text-banked bg-banked" : "text-risk bg-risk";
    const [text, dot] = tone.split(" ");
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {gate === "pass" ? "Pass" : "Fail"}
      </span>
    );
  }
  return <span className="text-xs text-faint">—</span>;
}

// Everything reported for one run: execution/validation/gate, reports, patches,
// validations, artifacts, usage and rates, then findings with owner feedback.
function RunDetails({
  run: r,
  projectId,
  onRated,
  example = false,
}: {
  run: UsageRun;
  projectId: number;
  onRated?: () => void;
  example?: boolean;
}) {
  const [findings, setFindings] = useState<FindingRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = r.taskResult;
  async function load() {
    if (example) { setFindings(exampleFindings(r)); return; }
    setBusy(true);
    setError(null);
    try {
      setFindings((await getRunFindings(projectId, r.id)).findings);
    } catch {
      setError("Could not load findings. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function rate(id: number, verdict: Verdict) {
    if (example) return;
    await submitFeedback(id, verdict);
    setFindings(
      (old) => old?.map((f) => (f.id === id ? { ...f, verdict } : f)) ?? null,
    );
    onRated?.();
  }
  return (
    <>
      <p className="mt-3 text-sm">
        Execution: {result?.executionStatus ?? "not reported"} · Validation:{" "}
        {result?.validationStatus ?? "not reported"} · CI gate:{" "}
        {r.gate ?? "not reported"}
      </p>
      {(result?.executionReason || r.gateReason) && (
        <p className="text-sm text-muted">
          {result?.executionReason ?? r.gateReason}
        </p>
      )}
      {r.legacyCost != null && (
        <p className="mt-2 text-sm text-muted">
          Stored legacy input/output estimate: {money(r.legacyCost)}. Cache and
          executed-model attribution are incomplete; excluded from new totals.
        </p>
      )}
      {result?.failure && (
        <p className="mt-3 text-sm">
          Original upstream failure: {result.failure.stage} ·{" "}
          {result.failure.originalStatus} · exit{" "}
          {result.failure.exitStatus ?? "unknown"}. Diagnosis does not clear
          this failure.
        </p>
      )}
      {result?.report && (
        <section className="mt-3 rounded-lg border border-border bg-panel p-3">
          <h4 className="font-semibold">
            {r.task === "ci_failure_diagnosis" ? "Diagnosis summary" : "Report"}
          </h4>
          <p className="whitespace-pre-wrap text-sm">{result.report.summary}</p>
          {result.report.cause && <p>Cause: {result.report.cause}</p>}
          {result.report.uncertainty && (
            <p className="mt-2 text-sm text-muted">
              Uncertainty: {result.report.uncertainty}
            </p>
          )}
          {result.report.noPatchReason && (
            <p className="text-sm">No patch: {result.report.noPatchReason}</p>
          )}
          <ul className="list-disc pl-5 text-sm">
            {result.report.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
      {result?.patch && (
        <section className="mt-3 text-sm">
          <h4 className="font-semibold">Proposed patch</h4>
          <p>
            Base commit: <code>{result.baseCommit}</code>
          </p>
          <p>
            Patch SHA-256: <code>{result.patch.sha256}</code>
          </p>
          <ul>
            {result.patch.files.map((f) => (
              <li key={f.path}>
                {f.operation}: {f.path}
              </li>
            ))}
          </ul>
          <p className="text-muted">
            Full patch remains in CI. Generation completion does not mean
            validation passed.
          </p>
        </section>
      )}
      {result?.validations.map((v) => (
        <section key={v.commandId} className="mt-3 text-sm">
          <h4 className="font-semibold">
            Validation · {v.commandId}: {v.status}
          </h4>
          <p>
            Executed revision {v.executionRevisionId} · exit{" "}
            {v.exitCode ?? "not reported"}
          </p>
          {v.reason && <p>{v.reason}</p>}
          {r.task === "test_generation" && (
            <>
              <p>
                Generated tests discovered:{" "}
                {v.generatedTestsDiscovered ?? "not reported"} · executed:{" "}
                {v.generatedTestsExecuted ?? "not reported"}
              </p>
              <details>
                <summary>Named-test evidence</summary>
                <pre className="overflow-x-auto whitespace-pre-wrap">
                  {v.testEvidence
                    ? JSON.stringify(v.testEvidence, null, 2)
                    : "Not reported"}
                </pre>
              </details>
            </>
          )}
        </section>
      ))}
      {(result?.artifacts.length ?? 0) > 0 && (
        <details className="mt-3 text-sm">
          <summary>Artifact metadata · full content retained in CI</summary>
          {result?.artifacts.map((a) => (
            <p key={a.id}>
              {a.kind}: {a.path} · {a.sizeBytes} bytes · SHA-256{" "}
              <code>{a.sha256}</code>
            </p>
          ))}
        </details>
      )}
      <details className="mt-3 text-sm">
        <summary>Usage, rates and attribution</summary>
        <p className="text-xs text-muted">
          Runtime {r.runtimeId ?? "unknown"} · deployment{" "}
          {r.deploymentId ?? "unknown"} · {r.runtimeVersion ?? "unversioned"}
        </p>
        <p className="text-xs text-muted">
          Usage coverage: {r.usageStatus}. Native counters may contain subsets;
          normalized OpenCode counters are disjoint and can zero-fill unknowns.
          HTTP retries are unknown for OpenCode.
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-1">
          {Object.entries(r.usage ?? r.legacyUsage ?? {}).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd>{v == null ? "Not reported" : String(v)}</dd>
            </div>
          ))}
        </dl>
        {!r.usage && !r.legacyUsage && <p>Usage not reported.</p>}
        {r.billing.categories.map((c) => (
          <p key={c.category}>
            {words(c.category)}: {c.tokens ?? "unknown"} tokens ·{" "}
            {c.ratePerMillion ?? "unknown"} USD / million · {money(c.cost)}
          </p>
        ))}
        {r.billing.rateSnapshot ? (
          <div className="mt-2">
            <p>
              Rate version: {r.billing.rateSnapshot.rateVersion} ·{" "}
              {r.billing.rateSnapshot.serviceTier}
            </p>
            <p>
              Observed {r.billing.rateSnapshot.observedAt} · pinned{" "}
              {r.billing.rateSnapshot.pinnedAt}
            </p>
            <p>
              Effective {r.billing.rateSnapshot.effectiveAt} through{" "}
              {r.billing.rateSnapshot.validUntil}. Estimate uses the revision’s
              pinned schedule.
            </p>
            <p>Source: {r.billing.rateSnapshot.source}</p>
          </div>
        ) : (
          <p>No immutable rate schedule available.</p>
        )}
        <ul>
          {r.billing.reasons.map((reason) => (
            <li key={reason}>{words(reason)}</li>
          ))}
        </ul>
      </details>
      {(!result || result.kind === "findings") && (
        <section className="mt-3">
          <p className="text-xs text-muted">
            {r.feedback.rated} / {r.feedback.total} rated ·{" "}
            {r.feedback.accepted} accepted · {r.feedback.rejected} rejected
          </p>
          <button
            className="compact-action mt-2"
            onClick={load}
            disabled={busy}
          >
            {busy ? "Loading findings…" : "View findings"}
          </button>
          {error && <p role="alert">{error}</p>}
          {findings &&
            (findings.length ? (
              <ul className="mt-2 flex flex-col gap-2">
                {findings.map((f) => (
                  <FindingItem key={f.id} finding={f} onRate={rate} readOnly={example} />
                ))}
              </ul>
            ) : (
              <p>
                No reported findings. This does not prove a clean repository.
              </p>
            ))}
        </section>
      )}
    </>
  );
}
