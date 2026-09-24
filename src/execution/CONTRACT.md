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

## B14 — Other authoring

Other is the fifth task with an explicit `single_call` or `opencode` mode. The shared
picker searches only exact eligible source-backed choices; Other has no recommendation
policy. Full Explorer remains anonymous and unconstrained by runtime support. Mode changes
clear selection eligibility while preserving the previous label and custom authoring fields;
a fresh explicit choice is required even if a provider supports both modes. Restore and save
revalidate exact runtime/observation identity. Legacy transitions use the same versioned API.

`OtherFields` and `other.ts` keep custom authoring separate from named runner settings.
Templates replace only label/system/task text after an explicit button press. Prompts remain
literal, including whitespace, CI variables and shell-like text. Preview shows exact text,
report-only versus disposable-edit authority, and missing validation as not run/unverified.
Inputs are bounded literal file paths/named artifacts; UI and API independently reject invalid
shape/limits. The executor enforces bytes, actual file types and symlink containment.
Maintainer validators are up to five unique JSON argv/digest-pinned-image configurations;
no named-test coverage is inferred from a custom command exit. Single-call config emits no
write paths/validators and pins one generation/attempt. All supported input/resource ceilings
round-trip through custom edits; no extra executable authority is sent from the client.

Drafts retain the v1 namespace and restore pre-B14 named fields with new defaults. Storage
uses a 64,000 UTF-8-byte bound, removes stale drafts on overflow, and warns visibly before
navigation. Dirty custom drafts omit the duplicate original configuration because their
fields represent all supported settings. Provider keys and CI tokens remain absent.
Backend Other setup supplies a dedicated failure-preserving Custom task Jenkins stage.
Tests use synthetic verified fixtures; the six actual Other integrations remain pending.

B15 replaces the authenticated dashboard with [selected-run usage/results](../usage/CONTRACT.md).
Setup routes and literal custom-task authoring retain their existing contracts.
