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
      <EvidenceDetails observation={o} />
    </div>
  );
}
const hints: Record<Profile["task"], string> = {
  other: "Any model verified for this mode. No benchmark is matched to a custom task.",
  ci_review: "Ranked by CodeReviewBench F1 when the evidence is directly comparable.",
  security_analysis: "Verified models only; no comparable ranking exists yet, so the list is unranked.",
  test_generation: "Python can be ranked by TestGenEval; Node has no ranking yet.",
  ci_failure_diagnosis: "Verified models only; diagnosis has no primary ranking yet.",
};
const explanations: Record<Profile["task"], string> = {
  other:
    "Benchmark results help you compare models; Driftplain has not matched a benchmark to this task. Only exact support for the selected mode permits a choice.",
  ci_review:
    "CodeReviewBench F1 measures review findings against confirmed bugs. Recommendations require the same complete 30-PR / 95-bug Kodus replay protocol, judge and reasoning settings.",
  security_analysis:
    "RealVuln strict F3 emphasizes vulnerability recall. No complete comparable recommendation group is admitted at launch. Supported choices remain unranked.",
  test_generation:
    "Python uses TestGenEval Extra e_at_1 evidence under its original one-attempt protocol. It does not prove this CI runner finds bugs. Node has no primary ranking at launch.",
  ci_failure_diagnosis:
    "Diagnosis and optional repair have no primary ranking at launch. LogDx-CI and CI-Repair-Bench are supplementary research, without recommendation badges.",
};
const SEARCH_DELAY_MS = 250;
function isChosen(
  item: Candidate,
  selected?: { runtimeId: number; observationId: number } | null,
) {
  return (
    selected?.runtimeId === item.runtimeId &&
    selected.observationId === item.observationId
  );
}
export function EligibleModelPicker({
  profile,
  onPick,
  onUnauthorized,
  exact,
  selected,
}: {
  profile: Profile;
  onPick: (item: Candidate) => void;
  onUnauthorized?: () => void;
  exact: { model: number | null; evidence: number | null };
  selected?: { runtimeId: number; observationId: number } | null;
}) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data?: Candidates;
    error?: string;
  }>({ key: "" });
  // Typing updates the box at once; the request waits until the user pauses.
  useEffect(() => {
    if (q === query) return;
    const timer = setTimeout(() => setQuery(q), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [q, query]);
  const key = JSON.stringify([profile, query, group, offset, retry, exact]);
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
  // The last loaded page stays on screen while a new one is fetched, so the list
  // does not blink away on every keystroke. Errors replace it.
  const loading = state.key !== key;
  const data = state.error ? undefined : state.data;
  // Nothing is runnable for this profile at all: say so instead of offering a search.
  const empty = !!data && data.total === 0 && !query && !group;
  return (
    <section
      className="ci-panel"
      aria-label="Eligible model picker"
      aria-busy={loading}
    >
      <h2>Pick a model</h2>
      <p className="ci-hint">{hints[profile.task]}</p>
      <details className="ci-details">
        <summary>Why these models?</summary>
        <p>{explanations[profile.task]}</p>
        {profile.task !== "other" && (
          <p>
            Scores only order eligible choices inside one explicitly selected
            comparable group. A benchmark runner is evidence, not this project's
            execution runner. Prices and speed never change this order.
          </p>
        )}
        {data && (
          <p className="ci-muted">
            Policy {data.policy.version} ·{" "}
            {data.policy.benchmarkVersion ?? "No primary benchmark policy"}
          </p>
        )}
      </details>
      {!empty && (
        <div className="ci-options">
          <label>
            Search these models
            <input
              type="search"
              value={q}
              maxLength={200}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
              placeholder="Model or hosting provider"
            />
          </label>
          {data && profile.task !== "other" && (
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
          )}
        </div>
      )}
      {data && (
        <>
          {data.total === 0 ? (
            <p role="status" className="ci-empty">
              {exact.model
                ? "Requested exact model has no eligible choice for this task, deployment or evidence."
                : query
                  ? "No eligible matches for this search. Clear the search to inspect the available set."
                  : "No eligible runnable model for this profile yet. Models become selectable once their runtime is verified; pending integrations cannot be selected."}
            </p>
          ) : (
            <>
              {!data.items.some((i) => i.method === "benchmark_ranked") && (
                <p className="ci-hint">
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
                      <div className="ci-model-list">
                        {rows.map((item) => (
                          <article
                            className={
                              isChosen(item, selected)
                                ? "ci-model ci-model-chosen"
                                : "ci-model"
                            }
                            key={`${item.runtimeId}:${item.observationId}`}
                          >
                            <div className="ci-model-head">
                              <h4>{item.model}</h4>
                              {method === "benchmark_ranked" && (
                                <span className="ci-rank">#{item.rank}</span>
                              )}
                            </div>
                            <p className="ci-muted">
                              {item.provider} · <code>{item.providerModelId}</code> ·
                              Deployment #{item.deploymentId}
                            </p>
                            {method === "benchmark_ranked" ? (
                              <p>
                                Rank {item.rank} · {data.policy.metric}:{" "}
                                <strong className="num">{item.score}</strong> (
                                {data.policy.direction} is better). Source
                                reported: {item.reportedValue ?? "Unknown"}.
                              </p>
                            ) : (
                              <p className="ci-muted">
                                No task recommendation claimed for this choice.
                              </p>
                            )}
                            <CandidateEvidence item={item} />
                            <button
                              className="primary-action ci-choose"
                              aria-label={`Choose ${item.model} · ${item.provider} · evidence #${item.observationId}`}
                              aria-pressed={isChosen(item, selected)}
                              onClick={() => onPick(item)}
                            >
                              {isChosen(item, selected) ? "Chosen ✓" : "Choose"}
                            </button>
                          </article>
                        ))}
                      </div>
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
      {loading && (
        <p role="status" className="ci-muted">
          {data ? "Updating…" : "Checking eligibility…"}
        </p>
      )}
      {!loading && state.error && (
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
        className="text-link"
        href={`/benchmarks?setupReturn=${encodeURIComponent("/setup" + window.location.search)}`}
      >
        Inspect the full Explorer
      </Link>
    </section>
  );
}
