import { useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import type { Benchmark } from "./types";
import { safeUrl } from "./evidence";
import { Link } from "./navigation";
export function BenchmarkName({
  benchmark,
  linked = true,
}: {
  benchmark: Benchmark;
  linked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const url = safeUrl(benchmark.methodologyUrl);
  return (
    <span
      className="benchmark-name"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!document.activeElement?.closest(`[data-info="${id}"]`))
          setOpen(false);
      }}
      data-info={id}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          button.current?.focus();
          setOpen(false);
        }
      }}
    >
      {linked ? (
        <Link href={`/benchmarks/${benchmark.id}`}>{benchmark.name}</Link>
      ) : (
        <span>{benchmark.name}</span>
      )}
      <button
        ref={button}
        type="button"
        className="info-button"
        aria-label={`What does ${benchmark.name} test?`}
        aria-expanded={open}
        aria-controls={id}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
      >
        <Info size={16} />
      </button>
      {open && (
        <span
          id={id}
          role="region"
          aria-label={`About ${benchmark.name}`}
          className="benchmark-popover"
        >
          <span>
            {benchmark.tooltip ??
              benchmark.description ??
              "No explanation has been published for this benchmark."}
          </span>
          {url && (
            <a href={url} target="_blank" rel="noreferrer">
              Methodology ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              button.current?.focus();
              setOpen(false);
            }}
          >
            Close explanation
          </button>
        </span>
      )}
    </span>
  );
}
