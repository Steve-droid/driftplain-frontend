import { useEffect, useState } from "react";
import { allPages, catalog, query } from "./api";
import type { Benchmark, Metric, ModelDetail, Observation } from "./types";
import {
  comparisonKey,
  collectionName,
  formatMetric,
  isComparable,
  metricLabel,
  runSettings,
} from "./evidence";
import { BenchmarkName } from "./BenchmarkName";
import { EvidenceDetails } from "./EvidenceView";
import { Link, updateParams } from "./navigation";
import {
  BenchmarkStrip,
  ChartCaption,
  MetricNote,
  ScoreBars,
  TablePicker,
} from "./ScoreChart";
import { numeric, type ResultTable, type ScoreBar } from "./chartData";
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
const asTable = (g: Group): ResultTable => ({
  key: g.key,
  metric: g.metric,
  observation: g.observation,
  rows: g.cells.flat(),
});
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
  const settingsFor = (entries: Entry[]) => runSettings(entries.map((e) => e.observation));
  const select = (entries: Entry[], id: string) => {
    const next = new Set(selected);
    entries.forEach((e) => next.delete(e.observation.id));
    if (id) next.add(Number(id));
    next.delete(0);
    updateParams({ observations: [...next].join(",") });
  };
  // Chartable scopes: one published source table with a reported value for at least one choice.
  const chartable = [...groups.values()].filter(
    (g) =>
      isComparable(g.observation, g.metric) &&
      g.cells.some((cell) => cell.some((e) => numeric(e.metric) != null)),
  );
  const benchmarkName = (id: number, fallback: string) =>
    benchmarks.find((b) => b.id === id)?.name ?? fallback;
  const chart =
    chartable.find((g) => g.key === params.get("chart")) ??
    [...chartable].sort(
      (a, b) =>
        b.cells.filter((c) => c.length).length -
        a.cells.filter((c) => c.length).length,
    )[0];
  const stripItems = [
    ...new Map(
      chartable.map((g) => [
        g.observation.benchmarkId,
        {
          id: g.observation.benchmarkId,
          name: benchmarkName(g.observation.benchmarkId, g.observation.benchmarkName),
        },
      ]),
    ).values(),
  ];
  const chartTables = chart
    ? chartable.filter((g) => g.observation.benchmarkId === chart.observation.benchmarkId)
    : [];
  const bars: ScoreBar[] = [];
  const unchosen: string[] = [];
  const unreported: string[] = [];
  const chartSettings = runSettings(chart?.cells.flat().map((e) => e.observation) ?? []);
  chart?.cells.forEach((cell, i) => {
    const e = chosen(cell);
    const value = e ? numeric(e.metric) : null;
    if (cell.length > 1 && !e) unchosen.push(columns![i].name);
    else if (!e || value == null) unreported.push(columns![i].name);
    else
      bars.push({
        id: columns![i].choice,
        label: columns![i].name,
        detail: chartSettings.get(e.observation.id),
        title: `${e.observation.sourceModelLabel} · ${e.observation.protocol ?? "Protocol unknown"}`,
        value,
      });
  });
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
      <p className="catalog-lede">
        Choose 2–4 models or exact unresolved source rows. Scores are compared only
        inside one published source table. No combined score.
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
      {view === "history" &&
        columns?.some((column) =>
          column.rows.some((row) => row.origin === "legacy_backfill"),
        ) && (
          <p className="catalog-notice">
            Historical legacy rows have incomplete provenance. They remain
            separate and do not establish a direct model-to-model comparison.
          </p>
        )}
      {choices.length < 2 ? (
        <p role="status" className="catalog-empty">
          Add at least two choices from Models or benchmark evidence.
        </p>
      ) : result?.key === requestKey && result.error ? (
        <div role="alert" className="catalog-notice">
          {result.error}{" "}
          <button className="compact-action" onClick={() => setRetry((n) => n + 1)}>
            Retry comparison
          </button>
        </div>
      ) : !columns ? (
        <p role="status" className="catalog-empty">
          Loading comparison…
        </p>
      ) : (
        <>
          {!groups.size &&
            (view === "active" ? (
              <div className="catalog-notice" role="status">
                <p>No active evidence for these choices.</p>
                <button
                  className="secondary-action"
                  onClick={() => updateParams({ view: "history", chart: null })}
                >
                  Show historical evidence
                </button>
                <Link className="secondary-action" href="/evidence">
                  Find source rows to compare
                </Link>
              </div>
            ) : (
              <p className="catalog-empty">
                No evidence for these choices in this view. Try another
                benchmark or exact source rows.
              </p>
            ))}
          {chart && (
            <section
              className="chart-card"
              aria-label="Comparable measurement chart"
            >
              {stripItems.length > 1 && (
                <BenchmarkStrip
                  items={stripItems}
                  selected={chart.observation.benchmarkId}
                  onSelect={(id) =>
                    updateParams(
                      { chart: chartable.find((g) => g.observation.benchmarkId === id)?.key ?? null },
                      true,
                    )
                  }
                />
              )}
              <div className="chart-head">
                <div>
                  <h2 className="section-title">
                    {benchmarkName(chart.observation.benchmarkId, chart.observation.benchmarkName)}
                    <span> · {metricLabel(chart.metric)}</span>
                  </h2>
                </div>
              </div>
              <TablePicker
                tables={chartTables.map(asTable)}
                selected={chart.key}
                onSelect={(key) => updateParams({ chart: key }, true)}
              />
              <MetricNote table={asTable(chart)} />
              {bars.length ? (
                <ScoreBars bars={bars} metric={chart.metric} />
              ) : (
                <p className="chart-empty">
                  Choose a source row in the table below to draw this chart.
                </p>
              )}
              <ChartCaption table={asTable(chart)}>
                {unreported.length > 0 && <p>No reported value: {unreported.join(", ")}.</p>}
                {unchosen.length > 0 && (
                  <p>
                    Several rows match {unchosen.join(", ")}; choose one in the table
                    below. The highest value is never picked for you.
                  </p>
                )}
              </ChartCaption>
            </section>
          )}
          {[...byCollection].map(([category, entries]) => (
            <section key={category} className="catalog-section">
              <h2 style={{ marginBottom: 12 }}>{category}</h2>
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
                            <span className="row-title">
                              {b ? (
                                <BenchmarkName benchmark={b} />
                              ) : (
                                g.observation.benchmarkName
                              )}
                            </span>
                            <small>
                              {g.metric.name} ·{" "}
                              {g.metric.unit ?? "Unit unknown"} ·{" "}
                              {g.observation.version ?? "Version unknown"}
                              {g.metric.category && ` · ${g.metric.category}`}
                              {g.metric.subset && ` · ${g.metric.subset}`}
                            </small>
                            <small>
                              {g.observation.evaluator ?? "Evaluator unknown"} ·
                              Snapshot #
                              {g.observation.sourceSnapshotId ?? "Unknown"}
                            </small>
                            {chartable.includes(g) && (
                              <button
                                className="text-button"
                                aria-pressed={g === chart}
                                onClick={() => {
                                  updateParams({ chart: g.key });
                                  document.documentElement.scrollTop = 0;
                                }}
                              >
                                Chart this scope
                              </button>
                            )}
                          </th>
                          {g.cells.map((cell, i) => {
                            const e = chosen(cell);
                            return (
                              <td key={columns[i].choice}>
                                {!cell.length ? (
                                  <span className="cell-muted">Not reported in this scope</span>
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
                                              {entry.observation.sourceModelLabel}
                                              {settingsFor(cell).get(entry.observation.id) &&
                                                ` (${settingsFor(cell).get(entry.observation.id)})`}{" "}
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
                                          <small>
                                            {e.metric.missingReason ??
                                              "Measurement absent"}
                                          </small>
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
