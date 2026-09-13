# CLAUDE.md — driftplain-frontend

> Driftplain was previously Modicum / ModelMatch. The four public repositories use `driftplain-*`; existing infrastructure, images, database names, metrics and CI credential/environment identifiers retain `modelmatch` for compatibility.

**Status: ACTIVE.** React SPA for Driftplain. See the umbrella `../CLAUDE.md` and the spec in
`../docs/planning/` (esp. `architecture.md` §4.1 dashboard + §4.2 chat, and §10 pages).

## Responsibilities

- **Recommender form** (task-type checkboxes, quality↔cost slider, latency; optional free-text that
  keyword-pre-fills) → pick result.
- **Project + Jenkins setup** screen (connect BYOK, show the Jenkins stage snippet).
- **Savings dashboard** (centerpiece): KPI cards + sparklines, actual-vs-baseline area chart (shaded
  gap = savings), cost/run bars colored by quality, tokens, quality trend, runs table; **dark-mode**,
  monospace numbers.
- **Grounded chat panel (#4):** opening message = auto "explain my spend"; user asks follow-ups;
  answers render with a **visible retrieval trace**; out-of-scope → honest refusal.
- **Login.**

## Stack & rules

- React 19 + TS + Vite 6; **Recharts** + Tailwind.
- Talks to the backend via **HTTPS/JSON only** — never served from the backend's `/static` (nginx
  serves the FE).
- API base URL + config from **env** (templated `/config.js` / `import.meta.env`); no hardcoded URLs.
- Multi-stage non-root Dockerfile from day 1. Tests: Vitest + one Playwright happy path (form → pick →
  project → dashboard + chat with a mocked run).
- Branching: `feature/<story-id>-<desc>`; never commit to `main`.

## Build order touching this repo

S1 scaffold · S14 dashboard · **S14b/S15 chat panel** · S15 recommender/project flows · S17 e2e ·
S20 alerts UI (if the advisor ships).
