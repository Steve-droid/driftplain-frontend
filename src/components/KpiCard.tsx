import type { ReactNode } from "react";

// Dashboard stat primitives. Numbers render final — no count-up motion (P38: calm,
// Grafana-like). Two shapes:
//   • SavingsHero — the one big number the product is about (cumulative saved), with
//     the "% vs baseline" line and the banked / quality-risk / unrated split under it.
//   • KpiCard — a compact stat in the single-row strip beside it (no icons, no
//     sparklines; the label is a small uppercase Grafana-style panel title).

export function SavingsHero({
  label,
  value,
  accent = "text-banked",
  vsBaseline,
  split,
}: {
  label: string;
  value: string;
  accent?: string;
  vsBaseline: ReactNode;
  split: ReactNode;
}) {
  return (
    <div className="card savings-hero flex flex-col gap-3 p-6">
      <span className="text-xs font-medium tracking-wide text-muted">
        {label}
      </span>
      <div className={`num text-5xl font-semibold leading-none ${accent}`}>
        {value}
      </div>
      <div className="text-sm text-fg">{vsBaseline}</div>
      <div className="text-xs text-muted">{split}</div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value?: string;
  countTo?: number;
  format?: (n: number) => string;
  sub?: ReactNode;
  accent?: string; // tailwind text-* colour for the figure
}

export function KpiCard({
  label,
  value,
  countTo,
  format,
  sub,
  accent = "text-fg",
}: KpiCardProps) {
  const display =
    countTo !== undefined && format ? format(countTo) : (value ?? "—");

  return (
    <div className="card flex flex-col justify-between gap-4 p-6">
      <span className="text-xs font-medium tracking-wide text-muted">
        {label}
      </span>
      <div className={`num text-2xl font-semibold leading-none ${accent}`}>
        {display}
      </div>
      {sub && <div className="text-xs leading-relaxed text-muted">{sub}</div>}
    </div>
  );
}
