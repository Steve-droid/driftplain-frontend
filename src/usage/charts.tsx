import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColors } from "../lib/colors";
import { formatTokens, formatUSDAxis } from "../lib/format";
import {
  ChartCard,
  LegendSwatch,
  TooltipBox,
  axisProps,
  chartMargin,
} from "../components/chart-bits";
import type { UsageRun } from "./types";
import {
  costSeries,
  feedbackSeries,
  formatTokensAxis,
  tokenCategories,
  tokenSeries,
  type CostPoint,
  type FeedbackPoint,
  type RunPoint,
} from "./chartData";

const words = (s: string) => s.replaceAll("_", " ");

// Billing coverage colours: a complete estimate is the accent blue, partial known charges
// are amber (something is missing). Unavailable runs have no bar at all.
const COVERAGE = {
  complete: chartColors.actual,
  partial: chartColors.unrated,
  unavailable: "transparent",
} as const;

// Priced categories: input blue, output green, cache reads amber, anything else neutral.
const CATEGORY_COLOR: Record<string, string> = {
  input: chartColors.actual,
  output: chartColors.banked,
  cache_read: chartColors.unrated,
};
const categoryColor = (c: string) => CATEGORY_COLOR[c] ?? chartColors.baselineLine;

const HEIGHT = 240;
const GRID = <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />;

export function CostPerRunChart({ runs }: { runs: UsageRun[] }) {
  const data = costSeries(runs);
  const partial = data.some((d) => d.status === "partial" && d.cost != null);
  return (
    <ChartCard
      title="Cost per run"
      hint="by build · current page · unavailable and legacy costs omitted"
      ariaLabel="Selected-model cost chart"
      legend={
        <>
          <LegendSwatch color={COVERAGE.complete}>Complete estimate</LegendSwatch>
          {partial && <LegendSwatch color={COVERAGE.partial}>Partial charges</LegendSwatch>}
        </>
      }
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <BarChart data={data} margin={chartMargin} maxBarSize={36}>
          {GRID}
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} width={64} tickFormatter={formatUSDAxis} />
          <Tooltip cursor={{ fill: "#ffffff08" }} content={<CostTooltip />} />
          <Bar dataKey="cost" radius={[4, 4, 0, 0]} fillOpacity={0.85} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.id} fill={COVERAGE[d.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function CostTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CostPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TooltipBox>
      <Heading d={d} />
      <Row color={COVERAGE[d.status]} label={`${words(d.status)} · ${words(d.basis)}`} value={d.costText == null ? "Unavailable" : `$${d.costText}`} />
    </TooltipBox>
  );
}

export function TokensPerRunChart({ runs }: { runs: UsageRun[] }) {
  const categories = tokenCategories(runs);
  const data = tokenSeries(runs);
  return (
    <ChartCard
      title="Tokens per run"
      hint="priced billing categories · unknown counts omitted"
      legend={categories.map((c) => (
        <LegendSwatch key={c} color={categoryColor(c)}>{words(c)}</LegendSwatch>
      ))}
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <BarChart data={data} margin={chartMargin} maxBarSize={36} barGap={2}>
          {GRID}
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} width={48} tickFormatter={formatTokensAxis} />
          <Tooltip cursor={{ fill: "#ffffff08" }} content={<SeriesTooltip format={formatTokens} />} />
          {categories.map((c) => (
            <Bar key={c} dataKey={c} name={words(c)} fill={categoryColor(c)} fillOpacity={0.85} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function FeedbackPerRunChart({ runs }: { runs: UsageRun[] }) {
  const data = feedbackSeries(runs);
  return (
    <ChartCard
      title="Findings feedback"
      hint="per run · verdicts never change incurred cost"
      legend={
        <>
          <LegendSwatch color={chartColors.banked}>Accepted</LegendSwatch>
          <LegendSwatch color={chartColors.risk}>Rejected</LegendSwatch>
          <LegendSwatch color={chartColors.unrated}>Unrated</LegendSwatch>
        </>
      }
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <BarChart data={data} margin={chartMargin} maxBarSize={36}>
          {GRID}
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} width={40} allowDecimals={false} />
          <Tooltip cursor={{ fill: "#ffffff08" }} content={<SeriesTooltip format={String} />} />
          <Bar dataKey="accepted" name="Accepted" stackId="f" fill={chartColors.banked} fillOpacity={0.85} isAnimationActive={false} />
          <Bar dataKey="rejected" name="Rejected" stackId="f" fill={chartColors.risk} fillOpacity={0.85} isAnimationActive={false} />
          <Bar dataKey="unrated" name="Unrated" stackId="f" fill={chartColors.unrated} fillOpacity={0.85} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// One row per plotted series, in the chart's own colours.
function SeriesTooltip({
  active,
  payload,
  format,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; payload: RunPoint | FeedbackPoint }>;
  format: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <TooltipBox>
      <Heading d={payload[0].payload} />
      {payload.map((p) => (
        <Row key={p.name} color={p.color ?? chartColors.baselineLine} label={p.name} value={format(p.value)} />
      ))}
    </TooltipBox>
  );
}

function Heading({ d }: { d: RunPoint }) {
  return (
    <div className="mb-1 text-faint">
      {d.fullDate} · {d.label}
      {d.model ? ` · ${d.model}` : ""}
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted">
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
        {label}
      </span>
      <span className="num text-fg">{value}</span>
    </div>
  );
}
