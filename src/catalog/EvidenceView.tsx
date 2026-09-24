import { setupHref } from "../execution/draft";
import type { Benchmark, Observation, Metric, Source } from "./types";
import { BenchmarkName } from "./BenchmarkName";
import { formatMetric, safeUrl } from "./evidence";
import { Link } from "./navigation";
export function SourceStatus({ source }: { source: Source }) {
  return (
    <div className="source-status">
      <strong>{source.name}</strong>
      <p>
        {source.snapshotId == null
          ? "No validated snapshot available."
          : `Active snapshot #${source.snapshotId}`}
        {source.refreshStatus === "failed"
          ? " · Latest refresh failed; showing last validated evidence."
          : source.refreshStatus === "unknown"
            ? " · Refresh status unknown."
            : ""}
      </p>
      <p>
        Published: {source.publicationDate ?? "Unknown"} · Retrieved:{" "}
        {source.fetchedAt?.slice(0, 10) ?? "Unknown"} · Checked:{" "}
        {source.checkedAt?.slice(0, 10) ?? "Unknown"}
      </p>
      {safeUrl(source.resultUrl) && (
        <a href={safeUrl(source.resultUrl)} target="_blank" rel="noreferrer">
          Source results ↗
        </a>
      )}
      {source.attribution && <p>{source.attribution}</p>}
      {source.licenseText && <small>{source.licenseText}</small>}
    </div>
  );
}
export function MetricDetails({ metric: m }: { metric: Metric }) {
  return (
    <div className="metric-details">
      <strong>
        {m.name}: {formatMetric(m)}
      </strong>
      <p>{m.description}</p>
      <p>
        {m.direction === "higher"
          ? "Higher is better"
          : m.direction === "lower"
            ? "Lower is better"
            : "Not ranked"}
        {m.category && ` · ${m.category}`}
        {m.subset && ` · ${m.subset}`}
        {m.aggregation && ` · ${m.aggregation}`}
      </p>
      {m.value == null && (
        <p>{m.missingReason ?? "The source did not report a measurement."}</p>
      )}
      <p>
        Sample: {m.sampleSize ?? "Unknown"} · Denominator:{" "}
        {m.denominator ?? "Unknown"} · Attempts: {m.attempts ?? "Unknown"}
      </p>
      {(m.confidenceLow != null || m.confidenceHigh != null) && (
        <p>
          {m.uncertaintyType ?? "Reported uncertainty"}
          {m.confidenceLevel != null && ` (${m.confidenceLevel}%)`}:{" "}
          {m.confidenceLow ?? "Unknown"}–{m.confidenceHigh ?? "Unknown"}{" "}
          {m.unit}
        </p>
      )}
    </div>
  );
}
export function EvidenceDetails({
  observation: o,
}: {
  observation: Observation;
}) {
  return (
    <details className="evidence-details">
      <summary>Source & settings · observation #{o.id}</summary>
      <dl>
        <dt>Source label</dt>
        <dd>
          {o.sourceModelLabel}
          {o.modelId == null && " · Unresolved model identity"}
        </dd>
        <dt>Version</dt>
        <dd>{o.version ?? "Unknown"}</dd>
        <dt>Runner</dt>
        <dd>
          {o.runner ?? "Unknown"} {o.runnerVersion}
        </dd>
        <dt>Protocol</dt>
        <dd>{o.protocol ?? "Unknown"}</dd>
        <dt>Evaluator</dt>
        <dd>{o.evaluator ?? "Unknown"}</dd>
        <dt>Coverage</dt>
        <dd>{o.coverageNote ?? "Not reported"}</dd>
        <dt>Provenance</dt>
        <dd>
          {o.provenanceStatus} · {o.origin} · {o.snapshotStatus} snapshot #
          {o.sourceSnapshotId ?? "Unknown"}
        </dd>
        <dt>Source publication</dt>
        <dd>{o.sourcePublicationDate ?? "Unknown"}</dd>
        <dt>Observation date</dt>
        <dd>{o.observedAt ?? "Unknown"}</dd>
        <dt>Retrieved</dt>
        <dd>{o.sourceFetchedAt ?? "Unknown"}</dd>
        <dt>Context window</dt>
        <dd>{o.contextWindow ?? "Unknown"}</dd>
      </dl>
      <p>
        {o.sourceName ?? "Source unknown"}{" "}
        {safeUrl(o.citationUrl) && (
          <a href={safeUrl(o.citationUrl)} target="_blank" rel="noreferrer">
            Cited result ↗
          </a>
        )}{" "}
        {safeUrl(o.sourceUrl) && (
          <a href={safeUrl(o.sourceUrl)} target="_blank" rel="noreferrer">
            Snapshot artifact ↗
          </a>
        )}
      </p>
      {o.sourceContentHash && (
        <p className="hash">Snapshot artifact SHA-256: {o.sourceContentHash}</p>
      )}
      <p className="text-muted">
        Unknown dates and settings are not inferred. The snapshot hash
        identifies the imported artifact, which may be a reviewed manifest.
      </p>
      <details>
        <summary>Exact protocol settings</summary>
        <pre>{JSON.stringify(o.protocolConfiguration, null, 2)}</pre>
      </details>
      {o.metrics.map((m) => (
        <MetricDetails
          key={
            m.metricId + ":" + m.category + ":" + m.subset + ":" + m.aggregation
          }
          metric={m}
        />
      ))}
    </details>
  );
}
export function EvidenceTable({
  rows,
  benchmarks,
  add,
  choices,
}: {
  rows: Observation[];
  benchmarks: Benchmark[];
  add: (choice: string) => void;
  choices: string[];
}) {
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      aria-label="Benchmark evidence table"
    >
      <table className="catalog-table">
        <thead>
          <tr>
            <th>Model / configuration</th>
            <th>Benchmark</th>
            <th>Reported measurements</th>
            <th>Compare</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const b = benchmarks.find((b) => b.id === o.benchmarkId);
            const choice = o.modelId == null ? `o${o.id}` : `m${o.modelId}`;
            return (
              <tr key={o.id}>
                <td>
                  {o.modelId == null ? (
                    <strong>{o.sourceModelLabel}</strong>
                  ) : (
                    <Link href={`/models/${o.modelId}`}>{o.modelName}</Link>
                  )}
                  <small>
                    {o.modelId == null
                      ? "Unresolved source label"
                      : o.sourceModelLabel}
                  </small>
                  <EvidenceDetails observation={o} />
                  {o.modelId != null && (
                    <Link
                      href={setupHref(
                        o.modelId,
                        o.id,
                        new URLSearchParams(window.location.search).get(
                          "setupReturn",
                        ),
                      )}
                    >
                      Use this evidence in CI
                    </Link>
                  )}
                </td>
                <td>
                  {b ? (
                    <BenchmarkName benchmark={b} />
                  ) : (
                    <span>{o.benchmarkName} · Explanation unavailable</span>
                  )}
                  <small>
                    {o.version ?? "Version unknown"} ·{" "}
                    {o.protocol ?? "Protocol unknown"}
                  </small>
                </td>
                <td>
                  {o.metrics.length
                    ? o.metrics.map((m) => (
                        <p
                          key={
                            m.metricId +
                            ":" +
                            m.category +
                            ":" +
                            m.subset +
                            ":" +
                            m.aggregation
                          }
                        >
                          {m.name}:{" "}
                          <strong className="num">{formatMetric(m)}</strong>
                          {m.value == null && (
                            <small>
                              {m.missingReason ?? "Measurement absent"}
                            </small>
                          )}
                        </p>
                      ))
                    : "No measurements reported"}
                </td>
                <td>
                  <button
                    className="secondary-action"
                    onClick={() => add(choice)}
                    disabled={choices.includes(choice) || choices.length >= 4}
                  >
                    {choices.includes(choice) ? "Added" : "Add to compare"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
