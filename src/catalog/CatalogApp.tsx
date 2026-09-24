import { setupHref } from "../execution/draft";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  Benchmark,
  BenchmarkDetail,
  Model,
  ModelDetail,
  Observation,
  Page,
} from "./types";
import { query } from "./api";
import { useCatalog, useCatalogPages } from "./useCatalog";
import { Link, updateParams } from "./navigation";
import { collectionName, collections, parseChoices, safeUrl } from "./evidence";
import { Search } from "./Search";
import { BenchmarkName } from "./BenchmarkName";
import { EvidenceTable, SourceStatus } from "./EvidenceView";
import { Compare } from "./Compare";
import "./catalog.css";

export function CatalogNav() {
  return (
    <nav className="catalog-nav" aria-label="Main navigation">
      <Link href="/benchmarks" className="catalog-brand">
        Driftplain<span>Benchmark explorer</span>
      </Link>
      <div>
        <Link href="/benchmarks">Explore Benchmarks</Link>
        <Link
          href={
            new URLSearchParams(window.location.search)
              .get("setupReturn")
              ?.match(/^\/setup(?:\?|$)/)
              ? new URLSearchParams(window.location.search).get("setupReturn")!
              : "/setup"
          }
        >
          {new URLSearchParams(window.location.search).has("setupReturn")
            ? "Return to CI setup"
            : "Set Up CI"}
        </Link>
        <Link href="/projects">My Projects</Link>
      </div>
    </nav>
  );
}
function State({
  request,
  children,
}: {
  request: { loading: boolean; error?: string; retry: () => void };
  children: ReactNode;
}) {
  if (request.loading) return <p role="status">Loading catalog…</p>;
  if (request.error)
    return (
      <div role="alert" className="catalog-notice">
        {request.error} <button onClick={request.retry}>Retry</button>
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
      {params.has("cursor") && (
        <button onClick={() => updateParams({ cursor: null })}>
          First page
        </button>
      )}
      {page?.pageInfo.hasMore && (
        <button
          className="secondary-action"
          onClick={() => updateParams({ cursor: page.pageInfo.nextCursor })}
        >
          Next page
        </button>
      )}
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
interface ViewProps {
  params: URLSearchParams;
  choices: string[];
  add: (choice: string) => void;
  benchmarks: Benchmark[];
}
function Benchmarks({ params }: ViewProps) {
  const collection = params.get("collection");
  const request = useCatalog<Page<Benchmark>>(
    `benchmarks?${query({ limit: 24, q: params.get("q"), collection, cursor: params.get("cursor") })}`,
  );
  return (
    <section>
      <p className="eyebrow">Public evidence · no account needed</p>
      <h1>Explore benchmarks</h1>
      <p className="catalog-intro">
        Understand what a test measures. Inspect the source. Compare matching
        evidence.
      </p>
      <div className="capability-tabs" aria-label="Capability filters">
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
      <Filter
        key={params.get("q") ?? ""}
        value={params.get("q") ?? ""}
        label="Find a benchmark"
      />
      <State request={request}>
        {!request.data?.items.length && (
          <p>No matching benchmarks. Try another name or capability.</p>
        )}
        <div className="benchmark-grid">
          {request.data?.items.map((b) => (
            <article className="card" key={b.id}>
              <p className="eyebrow">{collectionName(b.collection)}</p>
              <h2>
                <BenchmarkName benchmark={b} />
              </h2>
              <p>
                {b.tooltip ?? b.description ?? "Explanation not yet available."}
              </p>
              <p className="text-muted">
                Versions: {b.versionLabels?.join(" · ") || "Unknown"}
                <br />
                Units:{" "}
                {b.metricUnits?.join(" · ") || "No measured units reported"}
              </p>
              {b.sources?.length ? (
                b.sources.map((s) => <SourceStatus key={s.id} source={s} />)
              ) : (
                <p className="text-muted">
                  Source freshness unavailable. Inspect evidence for known
                  provenance.
                </p>
              )}
              <Link className="catalog-card-link" href={`/benchmarks/${b.id}`}>
                View results & versions →
              </Link>
            </article>
          ))}
        </div>
        <Pager page={request.data} params={params} />
      </State>
    </section>
  );
}
function Models({ params, choices, add }: ViewProps) {
  const request = useCatalog<Page<Model>>(
    `models?${query({ limit: 25, q: params.get("q"), cursor: params.get("cursor") })}`,
  );
  return (
    <section>
      <h1>Models</h1>
      <p>
        Canonical identities and reviewed aliases. Source labels awaiting
        identity review remain visible in benchmark evidence.
      </p>
      <Filter
        key={params.get("q") ?? ""}
        value={params.get("q") ?? ""}
        label="Find a model, alias or provider"
      />
      <State request={request}>
        {!request.data?.items.length && (
          <p>
            No matching canonical models.{" "}
            <Link href={`/evidence?${query({ q: params.get("q") })}`}>
              Search source labels
            </Link>
            .
          </p>
        )}
        <div className="model-grid">
          {request.data?.items.map((m) => (
            <article className="card" key={m.id}>
              <p className="eyebrow">
                {m.organization ?? "Organization unknown"}
              </p>
              <h2>
                <Link href={`/models/${m.id}`}>{m.name}</Link>
              </h2>
              <button
                className="secondary-action"
                disabled={choices.includes(`m${m.id}`) || choices.length >= 4}
                onClick={() => add(`m${m.id}`)}
              >
                {choices.includes(`m${m.id}`) ? "Added" : "Add to compare"}
              </button>
            </article>
          ))}
        </div>
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
            onChange={(e) =>
              updateParams({ view: e.target.value, cursor: null })
            }
          >
            <option value="active">Active snapshots</option>
            <option value="history">All history (including legacy)</option>
          </select>
        </label>
      </div>
      <p className="text-muted">
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
          <p role="status">
            No evidence in this view. A definition may have no reported results;
            try all history or adjust the filters. Missing evidence is not a
            zero score.
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
          <p className="eyebrow">{m.organization ?? "Organization unknown"}</p>
          <h1>{m.name}</h1>
          <p>{m.description}</p>
          <p>Reviewed aliases: {m.aliases.join(", ") || "None published"}</p>
          <button
            className="secondary-action"
            disabled={
              props.choices.includes(`m${id}`) || props.choices.length >= 4
            }
            onClick={() => props.add(`m${id}`)}
          >
            Add to compare
          </button>
          <div className="catalog-notice">
            <Link
              className="secondary-action"
              href={setupHref(
                id,
                null,
                new URLSearchParams(window.location.search).get("setupReturn"),
              )}
            >
              Use in CI
            </Link>
            <p>
              CI support is not established by catalog evidence. Check Set Up CI
              for available configurations.
            </p>
          </div>
          <h2>Provider deployments</h2>
          {m.deployments.length ? (
            <ul>
              {m.deployments.map((d) => (
                <li key={d.id}>
                  {d.providerName} · {d.name} · <code>{d.deploymentKey}</code>{" "}
                  {d.variant}
                </li>
              ))}
            </ul>
          ) : (
            <p>No reviewed provider deployments listed.</p>
          )}
          <h2>Benchmark evidence</h2>
          <EvidenceList {...props} modelId={id} />
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
          <p className="eyebrow">{collectionName(b.collection)}</p>
          <h1>
            <BenchmarkName benchmark={b} linked={false} />
          </h1>
          <p>{b.tooltip ?? b.description}</p>
          <p className="text-muted">{b.limitations}</p>
          {(b.sources ?? []).map((s) => (
            <SourceStatus key={s.id} source={s} />
          ))}
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
            <p>
              {version.methodology}
              {safeUrl(version.methodologyUrl) && (
                <a
                  href={safeUrl(version.methodologyUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
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
      <main className="catalog-main" ref={heading} tabIndex={-1}>
        <div className="catalog-subnav">
          <Link href={`/benchmarks?${query({ compare: choices.join(",") })}`}>
            Benchmarks
          </Link>
          <Link href={`/models?${query({ compare: choices.join(",") })}`}>
            Models
          </Link>
          <Link href={compareUrl}>Compare</Link>
          <Link href={`/evidence?${query({ compare: choices.join(",") })}`}>
            Source labels
          </Link>
        </div>
        <Search />
        {path === "/benchmarks" ? (
          <Benchmarks {...props} />
        ) : path === "/models" ? (
          <Models {...props} />
        ) : /^\/models\/[1-9]\d*$/.test(path) ? (
          <ModelProfile key={path} {...props} id={Number(path.split("/")[2])} />
        ) : /^\/benchmarks\/[1-9]\d*$/.test(path) ? (
          <BenchmarkProfile
            key={path}
            {...props}
            id={Number(path.split("/")[2])}
          />
        ) : path === "/compare" ? (
          <State request={request}>
            <Compare {...props} />
          </State>
        ) : path === "/evidence" ? (
          <>
            <h1>Source-label evidence</h1>
            <p>
              Search labels exactly as reported, including unresolved
              identities. Similar names are never merged automatically.
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
            <span className="text-muted">
              {" "}
              Choose 2–4 models or source rows
            </span>
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
