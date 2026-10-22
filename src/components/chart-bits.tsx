import type { ReactNode } from "react";

// Shared chart surfaces keep titles and legends consistent across the dashboard.

export function ChartCard({
  title,
  hint,
  legend,
  ariaLabel,
  children,
}: {
  title: string;
  hint?: string;
  legend?: ReactNode;
  /** Names the card as a landmark region (tests and screen readers find it by name). */
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="card" aria-label={ariaLabel}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-gray-200">{title}</h2>
        {hint && <span className="text-xs text-faint">{hint}</span>}
      </div>
      {legend && <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">{legend}</div>}
      {!legend && <div className="mb-3" />}
      {children}
    </section>
  );
}

// A coloured-dot + label, for the always-visible chart legend.
export function LegendSwatch({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      {children}
    </span>
  );
}

// The dark surface custom tooltips render into.
export function TooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-panel-2 px-3 py-2 text-xs">
      {children}
    </div>
  );
}

// Fixed margins — a real left margin so Y-axis tick labels never clip.
export const chartMargin = { top: 8, right: 12, left: 8, bottom: 0 } as const;

// Recharts axis styling (faint, no heavy lines) — spread onto <XAxis>/<YAxis>.
export const axisProps = {
  stroke: "#6e7680",
  tick: { fill: "#9aa3af", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "#252a31" },
} as const;
