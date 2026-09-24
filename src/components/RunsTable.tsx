import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import type { FindingRow, SavingsRunRow, Verdict } from "../types/savings";
import { getRunFindings, submitFeedback } from "../api/savings";
import { formatDateTime, formatTokens, formatUSD, toNumber } from "../lib/format";
import { QualityPill } from "./StatusBadge";

// Runs table (build · date · model · tokens · actual · baseline · savings · gate ·
// quality · CWE · #findings). Click a row to drill into that run's findings (Fork 4
// endpoint). The gate is the agent's own pass/fail decision, recorded at ingest (it
// acted in CI); quality is the human accept/reject signal — two different things, both
// shown. The CWE column appears only when a run carries one (the security task). Each
// finding carries an accept/reject control (S17b): rating it recomputes the run's
// quality gate, which banks or excludes its savings — so `onRated` tells the dashboard
// to refetch savings.
export function RunsTable({
  projectId,
  runs,
  onRated,
}: {
  projectId: number;
  runs: SavingsRunRow[];
  onRated?: () => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(false);
  // Guards against a stale response winning when rows are toggled quickly: only the
  // most recent request's result is applied (compare against the latest run id).
  const latestReq = useRef<number | null>(null);

  async function toggle(runId: number) {
    if (openId === runId) {
      setOpenId(null);
      latestReq.current = null;
      return;
    }
    setOpenId(runId);
    setFindings([]);
    setLoading(true);
    latestReq.current = runId;
    try {
      const res = await getRunFindings(projectId, runId);
      if (latestReq.current !== runId) return; // a newer row was opened — drop this
      setFindings(res.findings);
    } catch {
      if (latestReq.current === runId) setFindings([]);
    } finally {
      if (latestReq.current === runId) setLoading(false);
    }
  }

  // Submit a verdict, then reflect it locally and tell the dashboard to refetch savings
  // (the run's quality_ok may have flipped, re-banking or excluding its savings). Throws
  // on failure so the FindingItem can surface an inline error and keep its prior state.
  async function rateFinding(findingId: number, verdict: Verdict) {
    const res = await submitFeedback(findingId, verdict);
    setFindings((prev) =>
      prev.map((f) => (f.id === findingId ? { ...f, verdict: res.verdict } : f)),
    );
    onRated?.();
  }

  // newest first in the table (series stays chronological for the charts).
  const rows = [...runs].reverse();
  // E20: security runs carry CWE ids; a review project would show an empty column.
  const showCwe = rows.some((r) => (r.cwes ?? []).length > 0);
  const colSpan = showCwe ? 11 : 10;

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">CI runs</h3>
      </div>
      {/* Size expanded usage against the visible container, not the wide scrolling table. */}
      <div className="overflow-x-auto [container-type:inline-size]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-faint">
              <th className="px-4 py-2 font-medium">Build</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Model</th>
              <th className="px-4 py-2 text-right font-medium">Tokens</th>
              <th className="px-4 py-2 text-right font-medium">Actual</th>
              <th className="px-4 py-2 text-right font-medium">Baseline</th>
              <th className="px-4 py-2 text-right font-medium">Savings</th>
              <th className="px-4 py-2 font-medium">Gate</th>
              <th className="px-4 py-2 font-medium">Quality</th>
              {showCwe && <th className="px-4 py-2 font-medium">CWE</th>}
              <th className="px-4 py-2 text-right font-medium">Findings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <FragmentRow
                key={r.id}
                run={r}
                open={openId === r.id}
                loading={loading && openId === r.id}
                findings={openId === r.id ? findings : []}
                showCwe={showCwe}
                colSpan={colSpan}
                onToggle={() => toggle(r.id)}
                onRate={rateFinding}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-muted">
                  No CI runs yet. The dashboard fills in as the agent posts runs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({
  run,
  open,
  loading,
  findings,
  showCwe,
  colSpan,
  onToggle,
  onRate,
}: {
  run: SavingsRunRow;
  open: boolean;
  loading: boolean;
  findings: FindingRow[];
  showCwe: boolean;
  colSpan: number;
  onToggle: () => void;
  onRate: (findingId: number, verdict: Verdict) => Promise<void>;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t border-border/60 hover:bg-white/[0.02]"
      >
        <td className="px-4 py-2.5">
          <span className="flex items-center gap-1.5 num text-fg">
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {run.jenkinsBuildId ?? "—"}
          </span>
        </td>
        <td className="px-4 py-2.5 text-muted">{formatDateTime(run.createdAt)}</td>
        <td className="px-4 py-2.5 num text-fg">{run.model ?? "—"}</td>
        <td className="px-4 py-2.5 num text-right text-muted">
          {formatTokens((run.tokensIn ?? 0) + (run.tokensOut ?? 0))}
        </td>
        <td className="px-4 py-2.5 num text-right text-fg">
          {formatUSD(run.actualCost)}
        </td>
        <td className="px-4 py-2.5 num text-right text-muted">
          {formatUSD(run.baselineCost)}
        </td>
        <td
          className={`px-4 py-2.5 num text-right font-medium ${
            run.savings != null && toNumber(run.savings) < 0
              ? "text-risk"
              : "text-banked"
          }`}
        >
          {formatUSD(run.savings)}
        </td>
        <td className="px-4 py-2.5">
          <GatePill gate={run.gate} />
        </td>
        <td className="px-4 py-2.5">
          <QualityPill qualityOk={run.qualityOk} />
        </td>
        {showCwe && (
          <td className="px-4 py-2.5 num text-xs text-muted">
            {(run.cwes ?? []).length > 0 ? <CweList cwes={run.cwes} /> : "—"}
          </td>
        )}
        <td className="px-4 py-2.5 num text-right text-muted">
          {run.findingsCount}
        </td>
      </tr>
      {open && (
        <tr className="bg-canvas/60">
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="mb-3 max-w-[calc(100cqw-2rem)] border-b border-border/60 pb-3">
              <dl className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
                <TokenUsage label="Input tokens" value={run.tokensIn} />
                <TokenUsage label="Output tokens" value={run.tokensOut} />
                <TokenUsage label="Cache-read tokens" value={run.cacheReadTokens} />
              </dl>
              <p className="mt-2 text-xs text-muted">
                Cache-read costs are not included in the displayed cost estimates.
              </p>
            </div>
            {loading ? (
              <p className="text-xs text-muted">Loading findings…</p>
            ) : findings.length === 0 ? (
              <p className="text-xs text-muted">No findings on this run.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {findings.map((f) => (
                  <FindingItem key={f.id} finding={f} onRate={onRate} />
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function TokenUsage({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 num text-fg">
        {value == null ? "Not reported" : value.toLocaleString("en-US")}
      </dd>
    </div>
  );
}

// One finding row in the drill-in, with an accept/reject control (S17b). Rating it is
// the quality signal: accept = a real, useful catch; reject = noise. The chosen verdict
// is highlighted (green accept / red reject); a failed submit shows inline and leaves the
// prior verdict intact. `submitting` holds the in-flight verdict so only that button spins.
export function FindingItem({
  finding,
  onRate,
}: {
  finding: FindingRow;
  onRate: (findingId: number, verdict: Verdict) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState<Verdict | null>(null);
  const [error, setError] = useState(false);

  async function rate(verdict: Verdict) {
    if (submitting) return; // ignore clicks while a verdict is in flight
    setSubmitting(verdict);
    setError(false);
    try {
      await onRate(finding.id, verdict);
    } catch {
      setError(true);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <li className="flex items-start gap-2 text-xs text-muted">
      <span className="num shrink-0 text-faint">
        {finding.category ?? "—"}/{finding.severity ?? "—"}
      </span>
      <span className="num shrink-0 text-fg">
        {finding.file ?? "—"}
        {finding.line != null ? `:${finding.line}` : ""}
      </span>
      {finding.cwe && (
        <span
          className="num shrink-0 rounded border border-risk/40 bg-risk/10 px-1.5 py-0.5 text-[11px] text-risk"
          title={finding.cwe}
        >
          {finding.cwe.split(":")[0]}
        </span>
      )}
      <span className="text-muted">{finding.message}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {error && <span className="text-risk">couldn’t save</span>}
        <VerdictButton
          label="Accept finding"
          active={finding.verdict === "accept"}
          busy={submitting === "accept"}
          tone="banked"
          onClick={() => rate("accept")}
          disabled={submitting != null}
        />
        <VerdictButton
          label="Reject finding"
          active={finding.verdict === "reject"}
          busy={submitting === "reject"}
          tone="risk"
          onClick={() => rate("reject")}
          disabled={submitting != null}
        />
      </div>
    </li>
  );
}

// The agent's pass/fail decision on this run (its exit code in CI), recorded at ingest.
// Distinct from quality: the gate is what CI did, quality is what the human said.
function GatePill({ gate }: { gate: string | null }) {
  if (gate === "pass")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-banked">
        <span className="h-1.5 w-1.5 rounded-full bg-banked" />
        Pass
      </span>
    );
  if (gate === "fail")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-risk">
        <span className="h-1.5 w-1.5 rounded-full bg-risk" />
        Fail
      </span>
    );
  return <span className="text-xs text-faint">—</span>;
}

// Up to three CWE ids inline, then "+n" — the drill-in lists every finding's full CWE.
function CweList({ cwes }: { cwes: string[] }) {
  const shown = cwes.slice(0, 3);
  const more = cwes.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((c) => (
        <span key={c} className="rounded border border-border bg-panel-2 px-1.5 py-0.5 text-fg">
          {c}
        </span>
      ))}
      {more > 0 && <span className="text-faint">+{more}</span>}
    </span>
  );
}

// Accept/reject toggle button. `active` = this is the recorded verdict (filled); idle =
// outlined, hover hints the tone. `busy` swaps the icon for a spinner. aria-pressed makes
// the verdict state explicit for assistive tech (and the tests).
function VerdictButton({
  label,
  active,
  busy,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  busy: boolean;
  tone: "banked" | "risk";
  onClick: () => void;
  disabled: boolean;
}) {
  const Icon = tone === "banked" ? Check : X;
  const activeCls =
    tone === "banked"
      ? "border-banked/40 bg-banked/10 text-banked"
      : "border-risk/40 bg-risk/10 text-risk";
  const idleCls =
    tone === "banked"
      ? "border-border text-muted hover:text-banked"
      : "border-border text-muted hover:text-risk";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-6 w-6 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? activeCls : idleCls
      }`}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
    </button>
  );
}
