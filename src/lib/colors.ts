// Chart colours in one place. Recharts needs literal hex (it can't read Tailwind
// classes), so the canonical values live here and the Tailwind theme mirrors them.
// Series palette (mirrors tailwind.config.js): blue (the recommended model), green (savings /
// banked), orange (unrated / threshold), red (quality risk / overspend). The four stay
// distinguishable on the dark canvas (bars + quality trend), incl. for deuteranopia
// (blue vs orange carry the contrast; green/red never sit alone).
export const chartColors = {
  actual: "#4f8ff7", // blue — the recommended model's actual cost (= the app accent)
  savings: "#4cc38a", // green — savings band (top edge = baseline)
  risk: "#f0555f", // red — quality risk / overspend
  unrated: "#f5a524", // orange — unrated / threshold line
  banked: "#4cc38a",
  baselineLine: "#9aa3af", // neutral gray — the baseline reference line (+ its tooltip dot)
  grid: "#252a31",
  axisLabel: "#9aa3af",
} as const;
