import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { Link } from "../catalog/navigation";
import { useCatalog } from "../catalog/useCatalog";
import { BenchmarkName } from "../catalog/BenchmarkName";
import { EvidenceDetails } from "../catalog/EvidenceView";
import type { BenchmarkDetail, Observation } from "../catalog/types";
import {
  candidates,
  type Candidate,
  type Candidates,
  type Profile,
} from "./api";

export function CandidateEvidence({ item }: { item: Candidate }) {
  const result = useCatalog<Observation>(`observations/${item.observationId}`);
  const o = result.data;
  const benchmark = useCatalog<BenchmarkDetail>(
    o ? `benchmarks/${o.benchmarkId}` : null,
  );
  if (result.error)
    return (
      <p role="alert">
        Evidence unavailable.{" "}
        <button onClick={result.retry}>Retry evidence</button>
      </p>
    );
  if (!o) return <p role="status">Loading source evidence…</p>;
  if (
    o.id !== item.observationId ||
    o.modelId !== item.catalogModelId ||
    o.sourceSnapshotId !== item.snapshotId
  )
    return (
      <p role="alert">
        Evidence identity mismatch; selection must be revalidated.
      </p>
    );
  return (
    <div className="ci-evidence">
      {benchmark.data ? (
        <BenchmarkName benchmark={benchmark.data} />
      ) : (
        <span>{o.benchmarkName}</span>
      )}
      <p>
        {o.version ?? "Version unknown"} · {o.sourceName ?? "Source unknown"}
      </p>
      <p>
        Published {o.sourcePublicationDate ?? "Unknown"} · Retrieved{" "}
        {o.sourceFetchedAt?.slice(0, 10) ?? "Unknown"} · Snapshot #
        {item.snapshotId}
      </p>
      <EvidenceDetails observation={o} />
    </div>
  );
}
const explanations: Record<Profile["task"], string> = {
  ci_review:
    "CodeReviewBench F1 measures review findings against confirmed bugs. Recommendations require the same complete 30-PR / 95-bug Kodus replay protocol, judge and reasoning settings.",
  security_analysis:
    "RealVuln strict F3 emphasizes vulnerability recall. No complete comparable recommendation group is admitted at launch. Supported choices remain unranked.",
  test_generation:
    "Python uses TestGenEval Extra e_at_1 evidence under its original one-attempt protocol. It does not prove this CI runner finds bugs. Node has no primary ranking at launch.",
  ci_failure_diagnosis:
    "Diagnosis and optional repair have no primary ranking at launch. LogDx-CI and CI-Repair-Bench are supplementary research, without recommendation badges.",
};
export function EligibleModelPicker({
  profile,
  onPick,
  onUnauthorized,
  exact,
}: {
  profile: Profile;
  onPick: (item: Candidate) => void;
  onUnauthorized?: () => void;
  exact: { model: number | null; evidence: number | null };
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data?: Candidates;
    error?: string;
  }>({ key: "" });
  const key = JSON.stringify([profile, q, group, offset, retry, exact]);
  useEffect(() => {
    let live = true;
    const [p, query, g, start, , filter] = JSON.parse(key) as [
      Profile,
      string,
      string | null,
      number,
      number,
      typeof exact,
    ];
    candidates(p, query, g, start, filter)
      .then((data) => {
        if (live) setState({ key, data });
      })
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
        setState({
          key,
          error:
            e instanceof Error ? e.message : "Could not load eligible models.",
        });
      });
    return () => {
      live = false;
    };
  }, [key, onUnauthorized]);
  const data = state.key === key ? state.data : undefined;
  return (
    <section className="ci-panel" aria-label="Eligible model picker">
      <h2>Pick an eligible model</h2>
      <p>{explanations[profile.task]}</p>
      <details>
        <summary>How recommendations work</summary>
        <p>
          Scores only order eligible choices inside one explicitly selected
          comparable group. A benchmark runner is evidence, not this project's
          execution runner. Prices and speed never change this order.
        </p>
      </details>
      <label>
        Search these models
        <input
          value={q}
          maxLength={200}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
          placeholder="Model or hosting provider"
        />
      </label>
      {data && (
        <>
          <p className="ci-muted">
            Policy {data.policy.version} ·{" "}
            {data.policy.benchmarkVersion ?? "No primary benchmark policy"}
          </p>
          <label>
            Recommendation group
            <select
              aria-label="Recommendation group"
              value={group ?? ""}
              onChange={(e) => {
                setGroup(e.target.value || null);
                setOffset(0);
              }}
            >
              <option value="">Supported choices (unranked)</option>
              {data.groups.map((g, n) => (
                <option key={g.id} value={g.id}>
                  Comparable group {n + 1} · {g.supportedResults} supported /{" "}
                  {g.totalResults} source results · {g.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          {data.total === 0 ? (
            <p role="status">
              {exact.model
                ? "Requested exact model has no eligible choice for this task, deployment or evidence."
                : q
                  ? "No eligible matches for this search. Clear the search to inspect the available set."
                  : "No eligible runnable model for this profile. Pending integrations cannot be selected."}
            </p>
          ) : (
            <>
              {!data.items.some((i) => i.method === "benchmark_ranked") && (
                <p>
                  {group
                    ? "No comparable recommendation score for the choices on this page."
                    : "No comparable recommendation score is selected."}{" "}
                  These supported choices are unranked.
                </p>
              )}
              {(["benchmark_ranked", "supported_unranked"] as const).map(
                (method) => {
                  const rows = data.items.filter((i) => i.method === method);
                  if (!rows.length) return null;
                  return (
                    <section
                      key={method}
                      aria-label={
                        method === "benchmark_ranked"
                          ? "Benchmark recommendations"
                          : "Supported unranked choices"
                      }
                    >
                      <h3>
                        {method === "benchmark_ranked"
                          ? "Recommended by benchmark score"
                          : "Supported · unranked"}
                      </h3>
                      {rows.map((item) => (
                        <article
                          className="ci-model"
                          key={`${item.runtimeId}:${item.observationId}`}
                        >
                          <h4>{item.model}</h4>
                          <p>
                            {item.provider} · {item.providerModelId} ·
                            Deployment #{item.deploymentId}
                          </p>
                          {method === "benchmark_ranked" ? (
                            <p>
                              Rank {item.rank} · {data.policy.metric}:{" "}
                              <strong>{item.score}</strong> (
                              {data.policy.direction} is better). Source
                              reported: {item.reportedValue ?? "Unknown"}.
                            </p>
                          ) : (
                            <p>
                              No task recommendation claimed for this choice.
                            </p>
                          )}
                          <CandidateEvidence item={item} />
                          <button
                            className="primary-action"
                            onClick={() => onPick(item)}
                          >
                            Choose {item.model} · {item.provider} · evidence #
                            {item.observationId}
                          </button>
                        </article>
                      ))}
                    </section>
                  );
                },
              )}
              <div className="ci-actions">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset((n) => Math.max(0, n - 50))}
                >
                  Previous models
                </button>
                <span>
                  {offset + 1}–{Math.min(offset + 50, data.total)} of{" "}
                  {data.total} evidence choices
                </span>
                <button
                  disabled={offset + 50 >= data.total}
                  onClick={() => setOffset((n) => n + 50)}
                >
                  Next models
                </button>
              </div>
            </>
          )}
        </>
      )}
      {state.key !== key && <p role="status">Checking eligibility…</p>}
      {state.key === key && state.error && (
        <p role="alert">
          {state.error}{" "}
          <button
            onClick={() => {
              setGroup(null);
              setOffset(0);
              setRetry((n) => n + 1);
            }}
          >
            Reload eligible choices
          </button>
        </p>
      )}
      <Link
        href={`/benchmarks?setupReturn=${encodeURIComponent("/setup" + window.location.search)}`}
      >
        Inspect the full Explorer
      </Link>
    </section>
  );
}
