# CLAUDE.md — driftplain-frontend

## Claude Code continuation — HM3 scope — September 15, 2026

Read [the HM3 handoff](../docs/session-handoffs/E21-home-hosting/2026-09-15-hm3-backup-restore.md)
first and [umbrella instructions](../CLAUDE.md). HM2 is complete; HM3 is the encrypted
production-backup/private-CNPG-restore slice. Current requirements are in
[02-showcase-backlog.md](../docs/planning/02-showcase-backlog.md) and
[HLD](../docs/planning/hld.md), replacing the removed architecture paths below.

No frontend feature, runtime URL, OAuth, image release or public routing change is expected
in HM3. FE/BE remains 1.0.24. Preserve existing identities/data/CI-token behavior and leave
AWS production serving driftplain.dev/api.driftplain.dev. Home app validation is HM4;
maintained-service/privacy wording is HM6; actual cutover is HM7. Do not claim home is live
or rewrite the product/privacy text before the deployment supports it.

Jenkins setup captures metadata and generates integration instructions; provider keys and
CI tokens stay in the user's Jenkins, not backend-stored BYOK refs. Public GHCR for both
agents and Cloudflare full-DNS Tunnel are selected but not implemented here. Use focused
fake tests only if this repo needs an actual relevant change. No paid LLM calls.

**Current working preference (Steve, September 15):** keep progressing and pause only
for critical architectural decisions. Plan, use focused tests for new behavior, verify and
self-review before routine commits/PRs; do not reintroduce the generic approval loops or
full-suite repetition below for unchanged work. This supersedes those older instructions
for this continuation. No paid LLM calls, public cutover, production teardown or destructive
source changes without explicit scope. No subagents/review agents, unsolicited diagrams
or additional tasks. Keep answers concise.

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
