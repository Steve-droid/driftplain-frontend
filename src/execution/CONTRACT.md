# Named CI setup — B13, September 24, 2026

`/setup` creates an explicit named-task project. `/setup?project=<id>` edits or re-picks
an existing project, including an explicit transition of a legacy project. The old history,
legacy edit menus and `/legacy-setup` compatibility route remain available. New projects
have no weighted ranking, budget/speed slider or comparison baseline. Other authoring is B14.

`api.ts` calls authenticated `/execution/v1`; public source evidence remains in `/catalog/v1`.
`EligibleModelPicker` renders the server's order unchanged. A user must choose a comparable
group before any score carries a recommendation; supported unranked choices stay separate.
Decimal strings, source versions/dates, snapshot and observation IDs are preserved. Different
hosting deployments and observations remain explicit choices. Pending rows are never fixtures
in production and cannot enter the eligible set. An empty eligible set is expected until exact
live verification and separately authorized activation exist.

Explorer links carry canonical `model` and optional `evidence` IDs. `setupReturn` is restricted
to the local `/setup` route; model choices replace the model/evidence constraint while retaining
the project edit target. The task is chosen explicitly, followed by a specific provider/runtime
choice. Direct search needs no benchmark visit. Filters never substitute related variants.

Tab-scoped drafts are bounded to 64 KiB, scoped to the JWT subject and project/new-project key,
and contain only task/configuration and selection data. The subject is a UI storage namespace,
not authorization; every API call still enforces ownership. Credentials and one-time CI tokens
are never saved in drafts or URLs. Project ID is recorded immediately after create so a failed
Jenkins metadata save retries the existing project. A browser reload, sign-in or Explorer return
re-fetches the exact selection and source observation. Every profile change visibly invalidates
the previous pick. Saves revalidate and the backend independently rejects stale/forged selections.

Named tests collect the reviewed Python/Node runner, literal full-suite paths, lock path/hash,
new-test directories and pinned environment image. Diagnosis collects the upstream stage/log;
repair requires exact permitted existing production files and optionally a maintainer-supplied
JSON argv/pinned image. No benchmark runner settings are copied into executable configuration.
Whole-object configuration replacement follows B7; unchanged existing configuration is preserved
on same-profile re-picks, including resource limits. Profile changes start a fresh configuration.

`ExecutionCommand` fetches owner-scoped versioned commands and explicitly issues or rotates a
CI token. Provider credentials stay in Jenkins. Missing operator pins/disabled runtime errors
remain visible. Publishing this UI does not configure Jenkins, activate profiles or deploy anything.

Checks: `npm test`, `npm run test:integration`, `npm run typecheck`, `npm run lint`, `npm run build`,
`npx playwright test --config playwright.config.execution.ts` and `playwright.config.catalog.ts`.
Browser tests use synthetic API routes for all four tasks on desktop/mobile, exact evidence and
anonymous sign-in return, profile changes, disabled picks, edits and partial-save retries.
