# Selected-run dashboard — B15, September 24, 2026

Dashboard uses the additive owner-scoped `/projects/{id}/usage/v1` read. It shows the
executed model/revision/task/mode, never the project's replacement model. Cost strings
remain exact outside chart rendering. Full-period complete estimates, partial known
charges and unavailable/legacy coverage stay separate. No hypothetical comparison or
feedback-gated money appears in dashboard headings, charts or run cards.

Layout (restored September 24, 2026): a KPI strip (complete estimates, partial known
charges, cost coverage, feedback coverage), a cost-per-run bar chart, tokens-per-run and
findings-feedback breakdown charts, then a runs table whose rows expand into the run detail.
Charts plot the current page in chronological order. A bar exists only for a known cost or
count; unavailable and legacy costs, unknown token categories and runs without findings are
omitted, never drawn as zero. Bar colour encodes billing coverage (complete blue, partial
amber); tooltips show the exact cost string. Charts are hidden when nothing is plottable.

`UsagePanel` renders report text as escaped literal text, patch and base identities,
artifact metadata, named-test evidence and diagnosis/original-failure summaries separately
from findings. Execution completion, validation and CI gate are distinct. Findings retain
owner feedback controls and coverage; failure to load is an error, never an empty success.
Rates/usage disclosure preserves zero versus unknown, native subsets versus normalized
counters, dated rate provenance and reasons why estimates are partial or unavailable.

Legacy stored input/output amounts remain available per run, explicitly limited and
excluded from new totals. Projects explicitly marked `isExample` by the owner-scoped project
list use `examples.ts`: 30 review or 20 security runs, fictional models/rates, complete mock
costs, relative dates, period-filtered totals and read-only sample findings. Example dashboards
make no usage/findings/feedback/chat requests and do not modify stored run history. Real projects
always use the backend; API errors never fall back to samples. `fixtures.ts` remains test-only.
There is no fallback to fixture rates or fake activated runtimes for real CI work. Backend JSONB/migration and provider tier semantics are specified in backend
`app/billing/CONTRACT.md`; rollout needs the compatible backend before this frontend.

Pagination is 100 rows per page; totals cover the full chosen all/7d/30d range. Project/range
changes reset pagination and clear stale project data. Owner errors stay visible. Chat's
existing capability gate remains unchanged for B17's product consistency audit.

Checks: complete unit/integration/type/lint/build plus `playwright.config.usage.ts` for
reports, partial costs, zero/unknown counts, feedback, test patches, diagnosis and 403s on
desktop/mobile. Existing execution/catalog/public-access browser configurations remain valid.
