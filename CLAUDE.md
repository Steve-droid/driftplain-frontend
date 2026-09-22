# CLAUDE.md — driftplain-frontend

## Release versioning (September 22, 2026)

Follow [SemVer 2.0.0](https://semver.org/) and the
[release policy](https://github.com/Steve-droid/driftplain/blob/main/RELEASE-POLICY.md).
These rules replace older per-slice tagging rules and fixed next-version suggestions.

- **PATCH:** compatible bug fixes or dependency/security/packaging fixes needing a new artifact.
- **MINOR:** new backward-compatible functionality or deprecation with continued compatibility.
- **MAJOR:** a breaking supported API, CLI, configuration, user workflow or operational upgrade contract.
- **No release:** documentation, comments, tests or internal tooling/refactoring alone, unless a
  changed distributable is needed. Compatible internal/build changes that require an image get a patch.
- Evaluate all relevant changes since the last release of that component. Use the highest bump;
  reset patch for a minor, and minor/patch for a major. Commit prefixes and task numbers do not
  choose the version. Record `previous -> next`, category and compatibility reason in the PR or release.
- Fetch fresh tags and check published versions before choosing a number. Backend, frontend,
  agents, infrastructure and GitOps have independent sequences. Both agents share one
  `agent-vX.Y.Z` sequence; other component repos use `vX.Y.Z`. Keep existing 1.x sequences.
- A completed task does not automatically need a tag. For an intentional release, tag the
  reviewed main commit and create a GitHub Release even for patch/minor versions. Check for
  concurrent releases before tagging. Publication and deployment are separate actions.
- Never move, delete or overwrite a published tag/image to fix an incorrect bump. Backend
  `1.1.1` remains published; its added public APIs warranted a minor. The next backend release
  must be at least `1.2.0`, adjusted for any newer releases or breaking changes.
- Continue versions across the image rename. Preserve old packages, current deployment pins
  and all operational approval requirements. This policy itself requires no release tag.

Frontend compatibility covers supported user workflows, routes and configuration. New
compatible pages/workflows are minor; correcting existing behavior is patch; removing a
supported workflow or required configuration compatibility is major.

## Application image names (September 22, 2026)

New releases use `ghcr.io/steve-droid/driftplain-backend`, `driftplain-frontend`,
`driftplain-agent` and `driftplain-agent-security`. Follow the
[image naming policy](https://github.com/Steve-droid/driftplain/blob/main/IMAGE-NAMING.md).
Continue each existing version sequence; do not reset versions, reuse published tags or
delete old `modelmatch-*` packages. The verified starting points are backend 1.1.1,
frontend 1.1.0 and agents 1.1.3; check fresh tags before choosing the next version.

Keep existing production image pins until the new packages are published, public and
verified by an anonymous pull. Update both repository and digest for the first deployment
under a new name. Preserve Kubernetes, database, volume and CI credential/environment names.
This policy overrides older image-naming statements below; it does not authorize a deployment.

## HM8 done — September 22, 2026

Follow the [umbrella instructions](../CLAUDE.md). The home cluster is the only runtime and
serves driftplain.dev through the Cloudflare tunnel (HM7). Home runs frontend 1.0.26 by digest
from public GHCR. Requirements are in
[02-showcase-backlog.md](../docs/planning/02-showcase-backlog.md) and the
[HLD](../docs/planning/hld.md). HM6 is done: 1.0.25 removed the temporary-demo notice and 1.0.26
rewrote `public/privacy.html` for the maintained home deployment. Next: P39.

ECR was deleted at HM8. A `vX.Y.Z` tag runs
[`release-image.yml`](.github/workflows/release-image.yml), which pushes
`ghcr.io/steve-droid/driftplain-frontend:X.Y.Z`, refuses to overwrite a published tag and prints
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

> Driftplain was previously Modicum / ModelMatch. The four public repositories use `driftplain-*`; existing infrastructure, database names, metrics and CI credential/environment identifiers retain `modelmatch` for compatibility. New image releases follow the policy above.

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
