/** @type {import('tailwindcss').Config} */
// Driftplain theme: one neutral dark surface scale, one blue accent, a steel-cyan brand
// signal and a desaturated status trio, applied app-wide. Monospace for money, tokens, ids.
//
// src/index.css mirrors these values as CSS variables for plain-CSS modules and holds
// the shared primitives (buttons, fields, cards, tables, tabs).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0b0d10", // page background
        panel: "#121418", // card / panel surface
        "panel-2": "#191c21", // raised or inset surface (inputs, table heads) — no nested cards
        border: "#252a31",
        "border-strong": "#343a43", // hover / focus-adjacent borders
        fg: "#d9dde4", // primary text
        muted: "#9aa3af", // secondary text
        faint: "#6c7580", // tertiary / axis text
        banked: "#4cc38a", // green  — passing / accepted
        unrated: "#f5a524", // amber  — unrated / pending review
        risk: "#f0555f", // red    — failed / risk
        accent: "#4f8ff7", // the single primary action accent
        signal: "#5fb4cc", // steel-cyan — brand signal (eyebrows, CI motifs)
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
