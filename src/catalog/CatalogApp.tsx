import { setupHref } from "../execution/draft";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  Benchmark,
  BenchmarkDetail,
  Model,
  ModelDetail,
  Observation,
  Page,
  Source,
} from "./types";
import { query } from "./api";
import { useCatalog, useCatalogPages } from "./useCatalog";
import { Link, updateParams } from "./navigation";
import { collectionName, collections, parseChoices, safeUrl } from "./evidence";
import { Search } from "./Search";
import { BenchmarkName } from "./BenchmarkName";
import { EvidenceTable, SourceStatus } from "./EvidenceView";
import { Compare } from "./Compare";
import { Leaderboard } from "./ScoreChart";
import { AppHeader } from "../components/AppHeader";
import "./catalog.css";

function State({
  request,
  children,
}: {
  request: { loading: boolean; error?: string; retry: () => void };
  children: ReactNode;
}) {
  if (request.loading)
    return (
      <p role="status" className="catalog-empty">
        Loading catalog…
      </p>
    );
  if (request.error)
    return (
      <div role="alert" className="catalog-notice">
        {request.error}{" "}
        <button className="compact-action" onClick={request.retry}>
          Retry
        </button>
      </div>
    );
  return <>{children}</>;
}
function Pager({
  page,
  params,
}: {
  page?: Page<unknown>;
  params: URLSearchParams;
}) {
  return (
    <div className="catalog-pagination">
      <span>
        Stable catalog order · {page?.items.length ?? 0} entries on this page
      </span>
      <div>
        {params.has("cursor") && (
          <button
            className="compact-action"
            onClick={() => updateParams({ cursor: null })}
          >
            First page
          </button>
        )}
        {page?.pageInfo.hasMore && (
          <button
            className="compact-action"
            onClick={() => updateParams({ cursor: page.pageInfo.nextCursor })}
          >
            Next page
          </button>
        )}
      </div>
    </div>
  );
}
function Filter({
  value,
  label = "Filter catalog",
}: {
  value: string;
  label?: string;
}) {
  const [input, setInput] = useState(value);
  return (
    <form
      className="catalog-filter-search"
      onSubmit={(e) => {
        e.preventDefault();
        updateParams({ q: input.trim(), cursor: null });
      }}
    >
      <label>
        {label}
        <input
          maxLength={200}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </label>
      <button className="secondary-action">Search</button>
    </form>
  );
}
function AddButton({
  choice,
  choices,
  add,
}: {
  choice: string;
  choices: string[];
  add: (choice: string) => void;
}) {
  return (
    <button
      className="compact-action"
      disabled={choices.includes(choice) || choices.length >= 4}
      onClick={() => add(choice)}
    >
      {choices.includes(choice) ? "Added" : "Add to compare"}
    </button>
  );
}
/** One-line source freshness for a table cell; the full status lives on the profile. */
function SourceCell({ sources }: { sources: Source[] }) {
  if (!sources.length)
    return <span className="cell-muted">Freshness unavailable</span>;
  return (
    <>
      {sources.map((s) => (
        <span key={s.id} className="metric-line">
          <span className="tag" title={s.name}>
            <span
              className={`dot${s.snapshotId == null ? " is-off" : s.refreshStatus === "ok" ? "" : " is-warn"}`}
            />
            {s.name}
          </span>
          <span className="cell-muted">
            {s.snapshotId == null
              ? "No validated snapshot"
              : `Retrieved ${s.fetchedAt?.slice(0, 10) ?? "unknown"}`}
          </span>
        </span>
      ))}
    </>
  );
}
interface ViewProps {
  params: URLSearchParams;
  choices: string[];
  add: (choice: string) => void;
  benchmarks: Benchmark[];
}
function Benchmarks({ params, benchmarks }: ViewProps) {
  const collection = params.get("collection");
  const request = useCatalog<Page<Benchmark>>(
    `benchmarks?${query({ limit: 24, q: params.get("q"), collection, cursor: params.get("cursor") })}`,
  );
  return (
    <section>
      <p className="eyebrow">Public evidence · no account needed</p>
      <h1>Explore benchmarks</h1>
      <p className="catalog-intro">
        Pick a benchmark to see how models score on it. Every bar comes from one
        published source table.
      </p>
      <Leaderboard benchmarks={benchmarks} />
      <section className="catalog-section" aria-labelledby="all-benchmarks">
        <div className="section-head">
          <div>
            <h2 id="all-benchmarks">All benchmarks</h2>
            <p>What each test measures, its versions and source freshness.</p>
          </div>
          <Filter
            key={params.get("q") ?? ""}
            value={params.get("q") ?? ""}
            label="Find a benchmark"
          />
        </div>
        <div className="segmented capability-filters" aria-label="Capability filters" role="group">
          <button
            aria-pressed={!collection}
            onClick={() => updateParams({ collection: null, cursor: null })}
          >
            All capabilities
          </button>
          {Object.entries(collections).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={collection === value}
              onClick={() => updateParams({ collection: value, cursor: null })}
            >
              {label}
            </button>
          ))}
        </div>
        <State request={request}>
          {request.data?.items.length ? (
            <div className="table-scroll" tabIndex={0} aria-label="Benchmarks table">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <th>Benchmark</th>
                    <th className="hide-sm">Capability</th>
                    <th className="hide-sm">Versions · units</th>
                    <th>Source</th>
                    <th>
                      <span className="sr-only">Results</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {request.data.items.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <span className="row-title">
                          <BenchmarkName benchmark={b} />
                        </span>
                        <small className="clamp">
                          {b.tooltip ?? b.description ?? "Explanation not yet available."}
                        </small>
                      </td>
                      <td className="hide-sm cell-muted">{collectionName(b.collection)}</td>
                      <td className="hide-sm">
                        {b.versionLabels?.join(" · ") || "Version unknown"}
                        <small>{b.metricUnits?.join(" · ") || "No measured units reported"}</small>
                      </td>
                      <td>
                        <SourceCell sources={b.sources ?? []} />
                      </td>
                      <td className="cell-action">
                        <Link className="compact-action" href={`/benchmarks/${b.id}`}>
                          Results →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="catalog-empty">No matching benchmarks. Try another name or capability.</p>
          )}
          <Pager page={request.data} params={params} />
        </State>
      </section>
    </section>
  );
}
function Models({ params, choices, add }: ViewProps) {
  const request = useCatalog<Page<Model>>(
    `models?${query({ limit: 25, q: params.get("q"), cursor: params.get("cursor") })}`,
  );
  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Models</h1>
          <p className="catalog-lede">
            Canonical identities and reviewed aliases. Source labels awaiting identity
            review remain visible in benchmark evidence.
          </p>
        </div>
        <Filter
          key={params.get("q") ?? ""}
          value={params.get("q") ?? ""}
          label="Find a model, alias or provider"
        />
      </div>
      <State request={request}>
        {request.data?.items.length ? (
          <div className="table-scroll" tabIndex={0} aria-label="Models table">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Organization</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {request.data.items.map((m) => (
                  <tr key={m.id}>
                    <td className="row-title">
                      <Link href={`/models/${m.id}`}>{m.name}</Link>
                    </td>
                    <td className="cell-muted">{m.organization ?? "Organization unknown"}</td>
                    <td className="cell-action">
                      <AddButton choice={`m${m.id}`} choices={choices} add={add} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="catalog-empty">
            No matching canonical models.{" "}
            <Link href={`/evidence?${query({ q: params.get("q") })}`}>Search source labels</Link>.
          </p>
        )}
        <Pager page={request.data} params={params} />
      </State>
    </section>
  );
}
function EvidenceList({
  params,
  benchmarks,
  choices,
  add,
  modelId,
  benchmarkId,
}: ViewProps & { modelId?: number; benchmarkId?: number }) {
  const view = params.get("view") === "history" ? "history" : "active";
  const request = useCatalog<Page<Observation>>(
    `observations?${query({ limit: 25, modelId, benchmarkId, q: params.get("q"), cursor: params.get("cursor"), versionId: params.get("versionId"), protocolId: params.get("protocolId"), snapshotId: params.get("snapshotId"), view })}`,
  );
  return (
    <section>
      <div className="catalog-filters">
        <Filter
          key={params.get("q") ?? ""}
          value={params.get("q") ?? ""}
          label="Find an exact source-label substring"
        />
        <label>
          Evidence view
          <select
            value={view}
            onChange={(e) => updateParams({ view: e.target.value, cursor: null })}
          >
            <option value="active">Active snapshots</option>
            <option value="history">All history (including legacy)</option>
          </select>
        </label>
      </div>
      <p className="profile-note">
        {view === "active"
          ? "Showing currently active, validated snapshots. A refresh may retain scoped or incomplete rows; inspect coverage."
          : "Showing immutable history. Earlier versions and unknown legacy settings stay separate."}
      </p>
      <State request={request}>
        {request.data?.items.length ? (
          <EvidenceTable
            rows={request.data.items}
            benchmarks={benchmarks}
            choices={choices}
            add={add}
          />
        ) : (
          <p role="status" className="catalog-empty">
            No evidence in this view. A definition may have no reported results; try all
            history or adjust the filters. Missing evidence is not a zero score.
          </p>
        )}
        <Pager page={request.data} params={params} />
      </State>
    </section>
  );
}
function ModelProfile({ id, ...props }: ViewProps & { id: number }) {
  const request = useCatalog<ModelDetail>(`models/${id}`);
  const m = request.data;
  return (
    <State request={request}>
      {m && (
        <>
          <Link className="back-link" href="/models">
            ← Models
          </Link>
          <div className="profile-head">
            <div>
              <p className="eyebrow">{m.organization ?? "Organization unknown"}</p>
              <h1>{m.name}</h1>
              {m.description && <p className="catalog-lede">{m.description}</p>}
              <div className="profile-meta">
                {m.aliases.length ? (
                  m.aliases.map((a) => (
                    <span className="tag" key={a}>
                      {a}
                    </span>
                  ))
                ) : (
                  <span className="tag">No reviewed aliases published</span>
                )}
              </div>
            </div>
            <div className="profile-actions">
              <AddButton choice={`m${id}`} choices={props.choices} add={props.add} />
              <Link
                className="primary-action"
                href={setupHref(
                  id,
                  null,
                  new URLSearchParams(window.location.search).get("setupReturn"),
                )}
              >
                Use in CI
              </Link>
            </div>
          </div>
          <p className="profile-note">
            CI support is not established by catalog evidence. Check Set Up CI for
            available configurations.
          </p>
          <section className="catalog-section">
            <h2>Provider deployments</h2>
            {m.deployments.length ? (
              <div className="table-scroll" style={{ marginTop: 12 }}>
                <table className="catalog-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Deployment</th>
                      <th>Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.deployments.map((d) => (
                      <tr key={d.id}>
                        <td className="row-title">{d.providerName}</td>
                        <td>
                          {d.name}
                          {d.variant && <small>{d.variant}</small>}
                        </td>
                        <td>
                          <code>{d.deploymentKey}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="profile-note">No reviewed provider deployments listed.</p>
            )}
          </section>
          <section className="catalog-section">
            <h2 style={{ marginBottom: 12 }}>Benchmark evidence</h2>
            <EvidenceList {...props} modelId={id} />
          </section>
        </>
      )}
    </State>
  );
}
function BenchmarkProfile({ id, ...props }: ViewProps & { id: number }) {
  const request = useCatalog<BenchmarkDetail>(`benchmarks/${id}`);
  const b = request.data;
  const version = b?.versions.find(
    (v) => String(v.id) === props.params.get("versionId"),
  );
  return (
    <State request={request}>
      {b && (
        <>
          <Link className="back-link" href="/benchmarks">
            ← Benchmarks
          </Link>
          <div className="profile-head">
            <div>
              <p className="eyebrow">{collectionName(b.collection)}</p>
              <h1>
                <BenchmarkName benchmark={b} linked={false} />
              </h1>
              <p className="catalog-lede">{b.tooltip ?? b.description}</p>
              {b.limitations && <p className="profile-note">{b.limitations}</p>}
            </div>
          </div>
          <Leaderboard benchmarks={[b]} fixedId={b.id} />
          {(b.sources ?? []).length > 0 && (
            <div className="source-list">
              {b.sources.map((s) => (
                <SourceStatus key={s.id} source={s} />
              ))}
            </div>
          )}
          <section className="catalog-section">
            <div className="section-head">
              <div>
                <h2>All results</h2>
                <p>Every row, including unresolved labels and incomplete provenance.</p>
              </div>
            </div>
            <div className="catalog-filters">
              <label>
                Dataset version
                <select
                  value={props.params.get("versionId") ?? ""}
                  onChange={(e) =>
                    updateParams({
                      versionId: e.target.value,
                      protocolId: null,
                      cursor: null,
                    })
                  }
                >
                  <option value="">All versions (kept separate)</option>
                  {b.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Protocol
                <select
                  value={props.params.get("protocolId") ?? ""}
                  onChange={(e) =>
                    updateParams({ protocolId: e.target.value, cursor: null })
                  }
                >
                  <option value="">All protocols (kept separate)</option>
                  {(version ? [version] : b.versions)
                    .flatMap((v) => v.protocols)
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {version && (
              <p className="profile-note">
                {version.methodology}
                {safeUrl(version.methodologyUrl) && (
                  <a href={safeUrl(version.methodologyUrl)} target="_blank" rel="noreferrer">
                    {" "}
                    Version methodology ↗
                  </a>
                )}
              </p>
            )}
            <EvidenceList
              {...props}
              benchmarks={[b, ...props.benchmarks.filter((x) => x.id !== id)]}
              benchmarkId={id}
            />
          </section>
        </>
      )}
    </State>
  );
}
function TrayChoice({
  choice,
  remove,
}: {
  choice: string;
  remove: () => void;
}) {
  const request = useCatalog<ModelDetail | Observation>(
    `${choice[0] === "m" ? "models" : "observations"}/${choice.slice(1)}`,
  );
  const name = request.data
    ? "name" in request.data
      ? request.data.name
      : `${request.data.sourceModelLabel} · row #${request.data.id}`
    : request.error
      ? `Unavailable choice ${choice}`
      : `Loading ${choice}…`;
  return (
    <span className="tray-choice">
      {name}
      <button aria-label={`Remove ${name}`} onClick={remove}>
        ×
      </button>
    </span>
  );
}
const sections = [
  { href: "/benchmarks", label: "Benchmarks", match: /^\/benchmarks/ },
  { href: "/models", label: "Models", match: /^\/models/ },
  { href: "/compare", label: "Compare", match: /^\/compare/ },
  { href: "/evidence", label: "Source labels", match: /^\/evidence/ },
];
export function CatalogApp({ location }: { location: string }) {
  const [path, search = ""] = location.split("?");
  const params = new URLSearchParams(search);
  const choices = parseChoices(params.get("compare"));
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = "Benchmark explorer · Driftplain";
    heading.current?.focus({ preventScroll: true });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [path]);
  const request = useCatalogPages<Benchmark>("benchmarks");
  const props: ViewProps = {
    params,
    choices,
    benchmarks: request.data?.items ?? [],
    add: (choice) => {
      if (choices.length < 4)
        updateParams({ compare: [...new Set([...choices, choice])].join(",") });
    },
  };
  const compareUrl = `/compare?${query({ compare: choices.join(",") })}`;
  return (
    <div className="catalog-shell">
      <AppHeader current="benchmarks" />
      <main className="catalog-main" ref={heading} tabIndex={-1}>
        <div className="catalog-bar">
          <nav className="segmented" aria-label="Explorer sections">
            {sections.map((s) => (
              <Link
                key={s.href}
                href={s.href === "/compare" ? compareUrl : `${s.href}?${query({ compare: choices.join(",") })}`}
                aria-current={s.match.test(path) ? "page" : undefined}
              >
                {s.label}
                {s.href === "/compare" && choices.length > 0 && (
                  <span className="tab-count">{choices.length}</span>
                )}
              </Link>
            ))}
          </nav>
          <Search />
        </div>
        {path === "/benchmarks" ? (
          <Benchmarks {...props} />
        ) : path === "/models" ? (
          <Models {...props} />
        ) : /^\/models\/[1-9]\d*$/.test(path) ? (
          <ModelProfile key={path} {...props} id={Number(path.split("/")[2])} />
        ) : /^\/benchmarks\/[1-9]\d*$/.test(path) ? (
          <BenchmarkProfile key={path} {...props} id={Number(path.split("/")[2])} />
        ) : path === "/compare" ? (
          <State request={request}>
            <Compare {...props} />
          </State>
        ) : path === "/evidence" ? (
          <>
            <h1>Source-label evidence</h1>
            <p className="catalog-lede">
              Search labels exactly as reported, including unresolved identities. Similar
              names are never merged automatically.
            </p>
            <EvidenceList {...props} />
          </>
        ) : (
          <>
            <h1>Catalog page not found</h1>
            <Link href="/benchmarks">Explore benchmarks</Link>
          </>
        )}
        <aside aria-label="Comparison tray" className="comparison-tray">
          <div>
            <strong>Compare · {choices.length}/4</strong>
            <span> Choose 2–4 models or source rows</span>
          </div>
          <div className="tray-choices">
            {choices.map((choice) => (
              <TrayChoice
                key={choice}
                choice={choice}
                remove={() =>
                  updateParams({
                    compare: choices.filter((c) => c !== choice).join(","),
                    observations: null,
                    chart: null,
                  })
                }
              />
            ))}
          </div>
          {choices.length >= 2 && path === "/compare" ? (
            <button className="primary-action" disabled>
              Viewing comparison
            </button>
          ) : choices.length >= 2 ? (
            <Link className="primary-action" href={compareUrl}>
              Compare choices →
            </Link>
          ) : (
            <button className="primary-action" disabled>
              Compare choices →
            </button>
          )}
        </aside>
      </main>
    </div>
  );
}
