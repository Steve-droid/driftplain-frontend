import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Benchmark, Metric, Observation, Page } from "./types";
import { query } from "./api";
import { useCatalogPages } from "./useCatalog";
import { Link, updateParams } from "./navigation";
import {
  directionLabel,
  isComparable,
  metricLabel,
  metricMeaning,
  runSettings,
  shortValue,
} from "./evidence";
import {
  numeric,
  orderTables,
  resultTables,
  type ResultTable,
  type ScoreBar,
} from "./chartData";

function barsFor(table: ResultTable): ScoreBar[] {
  const settings = runSettings(table.rows.map((r) => r.observation));
  const bars = table.rows.flatMap(({ observation: o, metric: m }) => {
    const value = numeric(m);
    return value == null
      ? []
      : [
          {
            id: String(o.id),
            label: o.modelName ?? o.sourceModelLabel,
            detail: settings.get(o.id),
            title: `${o.sourceModelLabel} · ${o.protocol ?? "Protocol unknown"}`,
            value,
          },
        ];
  });
  const names = bars.map((b) => `${b.label}|${b.detail}`);
  return bars.map((b, i) =>
    names.indexOf(names[i]) === names.lastIndexOf(names[i])
      ? b
      : { ...b, detail: [b.detail, `row #${b.id}`].filter(Boolean).join(" · ") },
  );
}

function ranked(bars: ScoreBar[], metric: Metric) {
  return [...bars].sort((a, b) =>
    metric.direction === "higher"
      ? b.value - a.value
      : metric.direction === "lower"
        ? a.value - b.value
        : 0,
  );
}
/**
 * Model scores for one published table: columns when few, rows when many or narrow.
 * Bar length is relative to the largest shown value, so close low scores stay readable.
 */
export function ScoreBars({ bars, metric }: { bars: ScoreBar[]; metric: Metric }) {
  const sorted = ranked(bars, metric);
  const max = Math.max(0, ...bars.map((b) => b.value)) || 1;
  const best = metric.direction === "non_ranking" ? null : sorted[0]?.value;
  return (
    <ol
      className={`score-bars ${sorted.length <= 8 ? "columns" : "rows"}`}
      aria-label={`${metricLabel(metric)} by model · ${directionLabel(metric)}`}
    >
      {sorted.map((b) => (
        <li
          key={b.id}
          className={b.value === best ? "is-best" : undefined}
          style={{ "--pct": Math.max(0, (b.value / max) * 100) } as CSSProperties}
          title={b.title}
        >
          <span className="score-bar-label">
            {b.label}
            {b.detail && <small>{b.detail}</small>}
          </span>
          <span className="score-bar-track" aria-hidden>
            <span className="score-bar-fill" />
            <span className="score-bar-value">{shortValue(b.value, metric.unit)}</span>
          </span>
          <span className="sr-only">{shortValue(b.value, metric.unit)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Horizontal, scrollable pill strip used to switch benchmarks above a chart. */
export function BenchmarkStrip({
  items,
  selected,
  onSelect,
}: {
  items: { id: number; name: string }[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const scroll = (dx: number) => strip.current?.scrollBy({ left: dx, behavior: "smooth" });
  useEffect(() => {
    const el = strip.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !tab) return;
    const [box, pill] = [el.getBoundingClientRect(), tab.getBoundingClientRect()];
    el.scrollLeft += pill.left - box.left - (box.width - pill.width) / 2;
  }, [selected]);
  return (
    <div className="benchmark-strip">
      <button type="button" aria-label="Scroll benchmarks left" onClick={() => scroll(-280)}>
        <ChevronLeft size={16} />
      </button>
      <div ref={strip} role="tablist" aria-label="Benchmark">
        {items.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={b.id === selected}
            onClick={(e) => {
              onSelect(b.id);
              e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
            }}
          >
            {b.name}
          </button>
        ))}
      </div>
      <button type="button" aria-label="Scroll benchmarks right" onClick={() => scroll(280)}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/** Metric/scope chips for the tables of the selected benchmark; a list when there are many. */
export function TablePicker({
  tables,
  selected,
  onSelect,
}: {
  tables: ResultTable[];
  selected: string | undefined;
  onSelect: (key: string) => void;
}) {
  if (tables.length < 2) return null;
  const entries = orderTables(tables);
  if (entries.length > 6)
    return (
      <label className="chart-select">
        <span>Result</span>
        <select value={selected} onChange={(e) => onSelect(e.target.value)}>
          {entries.map(({ table, label }) => (
            <option key={table.key} value={table.key}>
              {label}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <div className="segmented" role="group" aria-label="Measurement">
      {entries.map(({ table, label }) => (
        <button
          key={table.key}
          type="button"
          aria-pressed={table.key === selected}
          onClick={() => onSelect(table.key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** What the plotted number means, how it is aggregated and which direction wins. */
export function MetricNote({ table }: { table: ResultTable }) {
  const aggregation = table.observation.protocolConfiguration?.aggregation;
  return (
    <p className="chart-metric">
      <strong>{metricLabel(table.metric)}:</strong> {metricMeaning(table.metric)}
      {typeof aggregation === "string" && <> Aggregation: {aggregation}.</>}{" "}
      <span className="chart-direction">{directionLabel(table.metric)}.</span>
    </p>
  );
}

const DEFAULT_MODELS = 10;
/** Checklist of the table's bars; the top ten are shown until the viewer chooses. */
function ModelFilter({
  bars,
  shown,
  onChange,
}: {
  bars: ScoreBar[];
  shown: Set<string>;
  onChange: (ids: Set<string>) => void;
}) {
  const box = useRef<HTMLDetailsElement>(null);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current?.open && !box.current.contains(e.target as Node)) box.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const needle = filter.trim().toLowerCase();
  const visible = bars.filter((b) =>
    `${b.label} ${b.detail ?? ""}`.toLowerCase().includes(needle),
  );
  const toggle = (id: string) => {
    const next = new Set(shown);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  return (
    <details className="model-filter" ref={box}>
      <summary>
        Models · {shown.size} of {bars.length}
        <ChevronDown size={14} aria-hidden />
      </summary>
      <div className="model-filter-panel">
        {bars.length > DEFAULT_MODELS && (
          <input
            type="search"
            placeholder="Filter models"
            aria-label="Filter models"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
        <div className="model-filter-actions">
          <button type="button" className="text-button" onClick={() => onChange(new Set(bars.map((b) => b.id)))}>
            All
          </button>
          {bars.length > DEFAULT_MODELS && (
            <button
              type="button"
              className="text-button"
              onClick={() => onChange(new Set(bars.slice(0, DEFAULT_MODELS).map((b) => b.id)))}
            >
              Top {DEFAULT_MODELS}
            </button>
          )}
          <button type="button" className="text-button" onClick={() => onChange(new Set())}>
            None
          </button>
        </div>
        <ul>
          {visible.map((b) => (
            <li key={b.id}>
              <label>
                <input type="checkbox" checked={shown.has(b.id)} onChange={() => toggle(b.id)} />
                <span>
                  {b.label}
                  {b.detail && <small>{b.detail}</small>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** A table's bars with the viewer's model choice; resets when the table changes (keyed). */
function FilteredBars({ table }: { table: ResultTable }) {
  const bars = ranked(barsFor(table), table.metric);
  const [shown, setShown] = useState(
    () => new Set(bars.slice(0, DEFAULT_MODELS).map((b) => b.id)),
  );
  const chosen = bars.filter((b) => shown.has(b.id));
  return (
    <>
      <div className="chart-controls">
        <ModelFilter bars={bars} shown={shown} onChange={setShown} />
      </div>
      {chosen.length ? (
        <ScoreBars bars={chosen} metric={table.metric} />
      ) : (
        <p className="chart-empty" role="status">
          No models selected. Choose models to compare.
        </p>
      )}
    </>
  );
}

export function ChartCaption({ table, children }: { table: ResultTable; children?: ReactNode }) {
  const o = table.observation;
  return (
    <div className="chart-caption">
      <p>
        <strong>{directionLabel(table.metric)}</strong> · {o.version ?? "Version unknown"} ·{" "}
        {o.evaluator ?? "Evaluator unknown"} · {o.sourceName ?? "Source unknown"} snapshot #
        {o.sourceSnapshotId}
      </p>
      <p>
        Each bar is one published configuration from this source table; run settings such as
        effort appear under the name. Bar lengths are relative to the highest shown value.
        Missing values are never drawn as zero.
      </p>
      {children}
    </div>
  );
}

/** One benchmark's published results as a chart, with an optional benchmark strip. */
export function Leaderboard({
  benchmarks,
  fixedId,
}: {
  benchmarks: Benchmark[];
  fixedId?: number;
}) {
  const params = new URLSearchParams(window.location.search);
  const charted = benchmarks.filter((b) => b.sources?.length);
  const requested = Number(params.get("leaderboard"));
  const id =
    fixedId ??
    (charted.some((b) => b.id === requested) ? requested : (charted[0]?.id ?? null));
  const request = useCatalogPages<Observation>(
    id == null ? "" : `observations?${query({ benchmarkId: id, view: "active" })}`,
  );
  const [picked, setPicked] = useState<{ id: number | null; key?: string }>({ id });
  const benchmark = benchmarks.find((b) => b.id === id);
  if (id == null) return null;
  return (
    <section className="chart-card" aria-label="Benchmark results chart">
      {fixedId == null && (
        <BenchmarkStrip
          items={charted}
          selected={id}
          onSelect={(next) => {
            setPicked({ id: next });
            updateParams({ leaderboard: String(next) }, true);
          }}
        />
      )}
      <LeaderboardBody
        request={request}
        benchmark={benchmark}
        linkProfile={fixedId == null}
        selected={picked.id === id ? picked.key : undefined}
        onSelect={(key) => setPicked({ id, key })}
      />
    </section>
  );
}
function LeaderboardBody({
  request,
  benchmark,
  linkProfile,
  selected,
  onSelect,
}: {
  request: { loading: boolean; error?: string; data?: Page<Observation>; retry: () => void };
  benchmark?: Benchmark;
  linkProfile: boolean;
  selected?: string;
  onSelect: (key: string) => void;
}) {
  if (request.loading) return <p className="chart-empty" role="status">Loading results…</p>;
  if (request.error)
    return (
      <p className="chart-empty" role="alert">
        {request.error}{" "}
        <button className="text-link" onClick={request.retry}>
          Retry
        </button>
      </p>
    );
  const rows = request.data?.items ?? [];
  const tables = resultTables(rows);
  const table = tables.find((t) => t.key === selected) ?? orderTables(tables)[0]?.table;
  const uncharted = rows.filter((o) => o.metrics.every((m) => !isComparable(o, m))).length;
  return (
    <>
      <div className="chart-head">
        <div>
          <h2 className="section-title">
            {benchmark?.name ?? "Benchmark"}
            {table && <span> · {metricLabel(table.metric)}</span>}
          </h2>
          {benchmark?.tooltip && <p className="chart-sub">{benchmark.tooltip}</p>}
        </div>
        {linkProfile && benchmark && (
          <Link className="compact-action" href={`/benchmarks/${benchmark.id}`}>
            All results →
          </Link>
        )}
      </div>
      <TablePicker tables={tables} selected={table?.key} onSelect={onSelect} />
      {table && <MetricNote table={table} />}
      {!table ? (
        <p className="chart-empty" role="status">
          No active, comparable results to chart for this benchmark yet. Missing evidence is not a
          zero score.
        </p>
      ) : (
        <>
          <FilteredBars key={table.key} table={table} />
          <ChartCaption table={table}>
            {uncharted > 0 && (
              <p>
                {uncharted} row{uncharted === 1 ? "" : "s"} with incomplete provenance stay in the
                results table and are not charted.
              </p>
            )}
          </ChartCaption>
        </>
      )}
    </>
  );
}
