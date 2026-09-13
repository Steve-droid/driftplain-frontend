/** @type {import('tailwindcss').Config} */
// Driftplain theme (P38): the Grafana-style palette — desaturated status trio, one
// blue accent, flat dark surfaces — applied app-wide. Monospace for money, tokens, ids.
//
// Shared workspace surfaces and card geometry live in src/index.css.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#111217", // page background
        panel: "#181b1f", // panel surface
        "panel-2": "#22252b", // inset surface (inputs, insets) — no nested cards
        border: "#2c3235",
        fg: "#ccccdc", // primary text
        muted: "#9fa7b3", // secondary text
        faint: "#6e7680", // tertiary / axis text
        banked: "#73bf69", // green  — banked savings / passing quality
        unrated: "#ff9830", // orange — unrated / pending review
        risk: "#f2495c", // red    — quality risk / failed gate
        accent: "#5794f2", // Grafana blue — the primary action accent
        signal: "#5b93a8", // steel-cyan — model / CI motifs on the home hub only
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
