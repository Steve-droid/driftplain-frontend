import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { allPages, catalog, query } from "./api";
import type { Benchmark, Metric, ModelDetail, Observation } from "./types";
import { comparisonKey, collectionName, formatMetric } from "./evidence";
import { BenchmarkName } from "./BenchmarkName";
import { EvidenceDetails } from "./EvidenceView";
import { updateParams } from "./navigation";
interface Column {
  choice: string;
  name: string;
  rows: Observation[];
}
interface Entry {
  observation: Observation;
  metric: Metric;
}
interface Group {
  key: string;
  observation: Observation;
  metric: Metric;
  cells: Entry[][];
}
export function Compare({
  choices,
  benchmarks,
  params,
}: {
  choices: string[];
  benchmarks: Benchmark[];
  params: URLSearchParams;
}) {
  const [result, setResult] = useState<{
    key: string;
    columns?: Column[];
    error?: string;
  }>();
  const view = params.get("view") === "history" ? "history" : "active";
  const benchmarkId = params.get("benchmarkId");
  const requestKey = JSON.stringify([choices, view, benchmarkId]);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const [selected, selectedView, selectedBenchmark] = JSON.parse(
      requestKey,
    ) as [string[], string, string | null];
    if (selected.length < 2) return;
    const controller = new AbortController();
    let live = true;
    Promise.all(
      selected.map(async (choice) => {
        const id = Number(choice.slice(1));
        if (choice[0] === "o") {
          const o = await catalog<Observation>(
            `observations/${id}`,
            controller.signal,
          );
          return {
            choice,
            name: `${o.sourceModelLabel} (source row #${o.id})`,
            rows:
              selectedBenchmark && o.benchmarkId !== Number(selectedBenchmark)
                ? []
                : [o],
          };
        }
        const [model, rows] = await Promise.all([
          catalog<ModelDetail>(`models/${id}`, controller.signal),
          allPages<Observation>(
            `observations?${query({ modelId: id, view: selectedView, benchmarkId: selectedBenchmark })}`,
            controller.signal,
          ),
        ]);
        return { choice, name: model.name, rows };
      }),
    )
      .then((columns) => {
        if (live) setResult({ key: requestKey, columns });
      })
      .catch((e: unknown) => {
        if (live)
          setResult({
            key: requestKey,
            error: e instanceof Error ? e.message : "Comparison unavailable.",
          });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [requestKey, retry]);
  const columns = result?.key === requestKey ? result.columns : undefined;
  const groups = new Map<string, Group>();
  columns?.forEach((column, i) =>
    column.rows.forEach((o) =>
      o.metrics.forEach((m) => {
        const key = comparisonKey(o, m);
        if (!groups.has(key))
          groups.set(key, {
            key,
            observation: o,
            metric: m,
            cells: columns.map(() => []),
          });
        groups.get(key)!.cells[i].push({ observation: o, metric: m });
      }),
    ),
  );
  const selected = new Set(
    (params.get("observations") ?? "").split(",").map(Number),
  );
  const chosen = (entries: Entry[]) =>
    entries.length === 1
      ? entries[0]
      : entries.find((e) => selected.has(e.observation.id));
  const select = (entries: Entry[], id: string) => {
    const next = new Set(selected);
    entries.forEach((e) => next.delete(e.observation.id));
    if (id) next.add(Number(id));
    next.delete(0);
    updateParams({ observations: [...next].join(",") });
  };
  const chart = groups.get(params.get("chart") ?? "");
  const chartRows =
    chart?.cells.flatMap((entries, i) => {
      const e = chosen(entries);
      return e?.metric.value != null && Number.isFinite(Number(e.metric.value))
        ? [{ name: columns![i].name, value: Number(e.metric.value) }]
        : [];
    }) ?? [];
  const byCollection = new Map<string, Group[]>();
  for (const g of groups.values()) {
    const category = collectionName(
      benchmarks.find((b) => b.id === g.observation.benchmarkId)?.collection ??
        null,
    );
    byCollection.set(category, [...(byCollection.get(category) ?? []), g]);
  }
  return (
    <section>
      <h1>Compare evidence</h1>
      <p>
        Choose 2–4 models or exact unresolved source rows. Each row preserves
        one dataset, protocol, evaluator, snapshot and metric scope. No combined
        score.
      </p>
      <div className="catalog-filters">
        <label>
          Benchmark
          <select
            value={benchmarkId ?? ""}
            onChange={(e) =>
              updateParams({ benchmarkId: e.target.value, chart: null })
            }
          >
            <option value="">All benchmarks</option>
            {benchmarks.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Evidence view
          <select
            value={view}
            onChange={(e) =>
              updateParams({ view: e.target.value, chart: null })
            }
          >
            <option value="active">Active snapshots</option>
            <option value="history">All history</option>
          </select>
        </label>
      </div>
      {choices.some((c) => c[0] === "o") && (
        <p className="catalog-notice">
          Source-row choices pin exact observations, including historical ones.
          They do not resolve a model identity or imply that differently named
          rows are the same model.
        </p>
      )}
      {choices.length < 2 ? (
        <p role="status">
          Add at least two choices from Models or benchmark evidence.
        </p>
      ) : result?.key === requestKey && result.error ? (
        <div role="alert">
          {result.error}{" "}
          <button onClick={() => setRetry((n) => n + 1)}>
            Retry comparison
          </button>
        </div>
      ) : !columns ? (
        <p role="status">Loading comparison…</p>
      ) : (
        <>
          {!groups.size && (
            <p>
              No evidence in this view. Try all history or a different
              benchmark.
            </p>
          )}
          {chart && (
            <section
              className="card comparison-chart"
              aria-label="Comparable measurement chart"
            >
              <h2>
                {benchmarks.find(
                  (b) => b.id === chart.observation.benchmarkId,
                ) && (
                  <BenchmarkName
                    benchmark={
                      benchmarks.find(
                        (b) => b.id === chart.observation.benchmarkId,
                      )!
                    }
                  />
                )}{" "}
                · {chart.metric.name}
              </h2>
              <p>
                {chart.metric.unit ?? "Unit unknown"} ·{" "}
                {chart.metric.direction === "higher"
                  ? "Higher is better"
                  : chart.metric.direction === "lower"
                    ? "Lower is better"
                    : "Not ranked"}{" "}
                · {chart.observation.version}
              </p>
              {chartRows.length < 2 ? (
                <p>
                  Select at least two reported, comparable measurements to draw
                  this chart. Missing values are omitted.
                </p>
              ) : (
                <>
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(200, chartRows.length * 65)}
                  >
                    <BarChart
                      data={chartRows}
                      layout="vertical"
                      margin={{ left: 10, right: 30 }}
                    >
                      <XAxis
                        type="number"
                        domain={
                          chart.metric.unit === "percent"
                            ? [0, 100]
                            : chart.metric.unit === "ratio"
                              ? [0, 1]
                              : [0, "auto"]
                        }
                      />
                      <YAxis dataKey="name" type="category" width={170} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="#5794f2"
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <p>
                    Values are also available in the table below; no missing
                    measurement is plotted as zero.
                  </p>
                </>
              )}
            </section>
          )}
          {[...byCollection].map(([category, entries]) => (
            <section key={category}>
              <h2>{category}</h2>
              <div
                className="table-scroll"
                tabIndex={0}
                aria-label={`${category} comparison table`}
              >
                <table className="catalog-table comparison-table">
                  <thead>
                    <tr>
                      <th>Benchmark / scope</th>
                      {columns.map((c) => (
                        <th key={c.choice}>{c.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((g) => {
                      const b = benchmarks.find(
                        (b) => b.id === g.observation.benchmarkId,
                      );
                      return (
                        <tr key={g.key}>
                          <th>
                            {b ? (
                              <BenchmarkName benchmark={b} />
                            ) : (
                              g.observation.benchmarkName
                            )}
                            <small>
                              {g.metric.name} ·{" "}
                              {g.metric.unit ?? "Unit unknown"} ·{" "}
                              {g.observation.version ?? "Version unknown"}
                              {g.metric.category && ` · ${g.metric.category}`}
                              {g.metric.subset && ` · ${g.metric.subset}`}
                            </small>
                            <small>
                              {g.observation.protocol ?? "Protocol unknown"} ·
                              Snapshot #
                              {g.observation.sourceSnapshotId ?? "Unknown"}
                            </small>
                            <button
                              className="text-accent"
                              onClick={() => updateParams({ chart: g.key })}
                            >
                              Chart this scope
                            </button>
                          </th>
                          {g.cells.map((cell, i) => {
                            const e = chosen(cell);
                            return (
                              <td key={columns[i].choice}>
                                {!cell.length ? (
                                  <span>Not reported in this scope</span>
                                ) : (
                                  <>
                                    {cell.length > 1 && (
                                      <label>
                                        Source/configuration
                                        <select
                                          aria-label={`Observation for ${columns[i].name}, ${g.metric.name}`}
                                          value={e?.observation.id ?? ""}
                                          onChange={(event) =>
                                            select(cell, event.target.value)
                                          }
                                        >
                                          <option value="">
                                            Choose one ({cell.length}{" "}
                                            observations)
                                          </option>
                                          {cell.map((entry) => (
                                            <option
                                              value={entry.observation.id}
                                              key={entry.observation.id}
                                            >
                                              #{entry.observation.id} ·{" "}
                                              {
                                                entry.observation
                                                  .sourceModelLabel
                                              }{" "}
                                              · {formatMetric(entry.metric)}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                    )}
                                    {e && (
                                      <>
                                        <strong className="num">
                                          {formatMetric(e.metric)}
                                        </strong>
                                        {e.metric.value == null && (
                                          <p>
                                            {e.metric.missingReason ??
                                              "Measurement absent"}
                                          </p>
                                        )}
                                        <EvidenceDetails
                                          observation={e.observation}
                                        />
                                      </>
                                    )}
                                  </>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </section>
  );
}
