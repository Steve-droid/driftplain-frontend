import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getRunFindings, submitFeedback } from "../api/savings";
import { FindingItem } from "../components/RunsTable";
import type { FindingRow, Verdict } from "../types/savings";
import type { UsageResponse, UsageRun } from "./types";

const money = (value: string | null) =>
  value == null ? "Unavailable" : `$${value}`;
const words = (s: string) => s.replaceAll("_", " ");

export function UsagePanel({
  data,
  projectId,
  onRated,
}: {
  data: UsageResponse;
  projectId: number;
  onRated?: () => void;
}) {
  const t = data.totals;
  return (
    <>
      <section className="card">
        <h1 className="text-xl font-semibold">Usage and estimated cost</h1>
        <p className="mt-2 text-sm text-muted">
          Selected-model estimates for reported CI runs. Feedback and CI gates
          do not change incurred cost.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Complete estimates"
            value={money(t.completeCost)}
            detail={`${t.completeRuns} runs with complete billing categories`}
          />
          <Metric
            label="Partial known charges"
            value={money(t.partialCost)}
            detail={`${t.partialRuns} runs · additional charges may be missing`}
          />
          <Metric
            label="Cost coverage"
            value={`${t.reportedRuns} reported runs`}
            detail={`${t.unavailableRuns} unavailable · ${t.legacyRuns} legacy`}
          />
          <Metric
            label="Feedback coverage"
            value={`${data.feedback.rated} / ${data.feedback.total} findings rated`}
            detail={`${data.feedback.accepted} accepted · ${data.feedback.rejected} rejected`}
          />
        </div>
        <p className="mt-4 text-xs text-muted">
          Acceptance does not measure recall or security coverage. Empty or
          unrated runs do not prove a clean repository.
        </p>
      </section>
      {data.runs.some((r) => r.billing.knownCost != null) && (
        <section className="card" aria-label="Selected-model cost chart">
          <h2 className="font-semibold">Estimates by reported run</h2>
          <p className="text-xs text-muted">
            Current page · unavailable and legacy costs omitted · bars are
            separate, never stacked.
          </p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...data.runs].reverse().map((r) => ({
                  build: r.jenkinsBuildId ?? String(r.id),
                  complete:
                    r.billing.status === "complete"
                      ? Number(r.billing.knownCost)
                      : null,
                  partial:
                    r.billing.status === "partial"
                      ? Number(r.billing.knownCost)
                      : null,
                }))}
              >
                <XAxis dataKey="build" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="complete"
                  name="Complete estimate (USD)"
                  fill="#65b6ff"
                />
                <Bar
                  dataKey="partial"
                  name="Partial known charges (USD)"
                  fill="#eebc65"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
      <section className="flex flex-col gap-3" aria-label="CI run results">
        {data.runs.length === 0 && (
          <p className="card text-muted">
            No CI runs yet. Reported runs will appear here.
          </p>
        )}
        {data.runs.map((run) => (
          <RunCard
            key={`${projectId}:${run.id}`}
            run={run}
            projectId={projectId}
            onRated={onRated}
          />
        ))}
      </section>
      <section className="card text-xs text-muted">
        <h2 className="mb-2 font-semibold">Coverage and limitations</h2>
        <ul className="list-disc pl-5">
          {data.limitations.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div>
      <h2 className="text-xs text-muted">{label}</h2>
      <p className="my-1 break-words font-mono text-lg">{value}</p>
      <p className="text-xs text-muted">{detail}</p>
    </div>
  );
}
function RunCard({
  run: r,
  projectId,
  onRated,
}: {
  run: UsageRun;
  projectId: number;
  onRated?: () => void;
}) {
  const [findings, setFindings] = useState<FindingRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = r.taskResult;
  async function load() {
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
    await submitFeedback(id, verdict);
    setFindings(
      (old) => old?.map((f) => (f.id === id ? { ...f, verdict } : f)) ?? null,
    );
    onRated?.();
  }
  return (
    <article className="card min-w-0 break-words">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            {r.jenkinsBuildId ?? `Run ${r.id}`} · {words(r.task)}
          </h2>
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
          <p className="font-mono">{money(r.billing.knownCost)}</p>
          <p className="text-xs text-muted">
            {words(r.billing.status)} · {words(r.billing.basis)}
          </p>
        </div>
      </header>
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
        <section className="mt-3 rounded border border-border p-3">
          <h3 className="font-semibold">
            {r.task === "ci_failure_diagnosis" ? "Diagnosis summary" : "Report"}
          </h3>
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
          <h3 className="font-semibold">Proposed patch</h3>
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
          <h3 className="font-semibold">
            Validation · {v.commandId}: {v.status}
          </h3>
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
                  <FindingItem key={f.id} finding={f} onRate={rate} />
                ))}
              </ul>
            ) : (
              <p>
                No reported findings. This does not prove a clean repository.
              </p>
            ))}
        </section>
      )}
    </article>
  );
}
