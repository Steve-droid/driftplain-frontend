# CLAUDE.md — driftplain-frontend

## HM8 done — September 22, 2026

Follow the [umbrella instructions](../CLAUDE.md). The home cluster is the only runtime and
serves driftplain.dev through the Cloudflare tunnel (HM7). Home runs frontend 1.0.26 by digest
from public GHCR. Requirements are in
[02-showcase-backlog.md](../docs/planning/02-showcase-backlog.md) and the
[HLD](../docs/planning/hld.md). HM6 is done: 1.0.25 removed the temporary-demo notice and 1.0.26
rewrote `public/privacy.html` for the maintained home deployment. Next: P39.

ECR was deleted at HM8. A `vX.Y.Z` tag runs
[`release-image.yml`](.github/workflows/release-image.yml), which pushes
`ghcr.io/steve-droid/modelmatch-frontend:X.Y.Z`, refuses to overwrite a published tag and prints
the digest to pin in the gitops home profile. The `Jenkinsfile` is kept for reference only.

Jenkins setup captures metadata and generates integration instructions; provider keys and CI
tokens stay in the user's Jenkins. Preserve existing identities, data and CI-token behavior. Use
focused fake tests for any real change. No paid LLM calls.

**Current working preference (Steve, September 15):** keep progressing and pause only
for critical architectural decisions. Plan, use focused tests for new behavior, verify and
self-review before routine commits/PRs; do not reintroduce the generic approval loops or
full-suite repetition below for unchanged work. This supersedes those older instructions
for this continuation. No paid LLM calls, public cutover, production teardown or destructive
source changes without explicit scope. No subagents/review agents, unsolicited diagrams
or additional tasks. Keep answers concise.

> Driftplain was previously Modicum / ModelMatch. The four public repositories use `driftplain-*`; existing infrastructure, images, database names, metrics and CI credential/environment identifiers retain `modelmatch` for compatibility.

**Status: ACTIVE.** React SPA for Driftplain. See the umbrella `../CLAUDE.md` and the design in
`../docs/planning/hld.md`.

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
