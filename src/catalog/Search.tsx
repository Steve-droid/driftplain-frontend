import { useEffect, useId, useState } from "react";
import { catalog, query } from "./api";
import type { Page, SearchItem } from "./types";
import { Link, navigate, withChoices } from "./navigation";
export function Search() {
  const id = useId();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<{
    query: string;
    items: SearchItem[];
    error?: boolean;
  }>();
  const q = value.trim();
  const items = result?.query === q ? result.items : [];
  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    let live = true;
    const timer = window.setTimeout(() => {
      Promise.all(
        ["model", "benchmark"].map((type) =>
          catalog<Page<SearchItem>>(
            `search?${query({ type, q, limit: 6 })}`,
            controller.signal,
          ),
        ),
      )
        .then((pages) => {
          if (live)
            setResult({ query: q, items: pages.flatMap((p) => p.items) });
        })
        .catch(() => {
          if (live) setResult({ query: q, items: [], error: true });
        });
    }, 200);
    return () => {
      live = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [q]);
  const choose = (item: SearchItem) => {
    navigate(
      withChoices(
        `/${item.type === "model" ? "models" : "benchmarks"}/${item.id}`,
      ),
    );
    setOpen(false);
  };
  return (
    <div
      className="catalog-search"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>Search models or benchmarks</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && !!q}
        aria-controls={`${id}-results`}
        aria-activedescendant={
          open && active >= 0 && items[active] ? `${id}-${active}` : undefined
        }
        maxLength={200}
        placeholder="Model, alias, provider or benchmark acronym…"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setValue(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              items.length
                ? (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length
                : -1,
            );
          }
          if (e.key === "Enter" && open && items[active]) {
            e.preventDefault();
            choose(items[active]);
          }
        }}
      />
      {open && q && (
        <div className="search-popup">
          <div
            id={`${id}-results`}
            role="listbox"
            aria-label="Catalog search results"
          >
            {["model", "benchmark"].map((type) => (
              <div
                role="group"
                aria-label={type === "model" ? "Models" : "Benchmarks"}
                key={type}
              >
                <p className="eyebrow">
                  {type === "model" ? "Models" : "Benchmarks"}
                </p>
                {items.map(
                  (item, index) =>
                    item.type === type && (
                      <button
                        type="button"
                        role="option"
                        id={`${id}-${index}`}
                        aria-selected={active === index}
                        key={`${type}-${item.id}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(item)}
                      >
                        {item.name}
                        <small>{item.subtitle}</small>
                      </button>
                    ),
                )}
              </div>
            ))}
          </div>
          <p role="status">
            {result?.query !== q
              ? "Searching the catalog…"
              : result.error
                ? "Search unavailable. Try again."
                : !items.length
                  ? "No matching models or benchmarks."
                  : ""}
          </p>
          <div className="catalog-links">
            <Link
              href={`/models?${query({ q })}`}
              onClick={() => setOpen(false)}
            >
              All model matches
            </Link>
            <Link
              href={`/benchmarks?${query({ q })}`}
              onClick={() => setOpen(false)}
            >
              All benchmark matches
            </Link>
            <Link
              href={`/evidence?${query({ q })}`}
              onClick={() => setOpen(false)}
            >
              Search exact source labels
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
