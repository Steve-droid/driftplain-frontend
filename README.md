# Driftplain frontend

[Project overview](https://github.com/Steve-droid/driftplain) · [Open the app](https://driftplain.dev) · [Backend](https://github.com/Steve-droid/driftplain-backend) · [Infrastructure](https://github.com/Steve-droid/driftplain-infra) · [GitOps](https://github.com/Steve-droid/driftplain-gitops)

This repo contains Driftplain's web app. It lets users configure an AI code review or security
agent for Jenkins, then view the agent's findings, token usage and cost calculations.

It uses React 19, TypeScript, Vite, Tailwind CSS and Recharts. The app calls the FastAPI backend
over HTTP. In production, nginx serves the built static files.

## Main pages

| Page | What users do |
|---|---|
| Home | Switch between projects or start configuring a new agent. |
| Agent setup | Choose a task and model, set review preferences and copy a generated Jenkins stage. The project is saved at the final step. |
| Dashboard | Inspect runs and findings, give feedback, and view token usage and cost charts. New accounts include labeled example projects. |
| Login and registration | Sign in with a password or Google. Google sign-in appears when the backend enables it. |

The dashboard also includes a chat panel for questions about usage. The hosted deployment has
the assistant disabled, and the panel reports that it is offline.

The current dashboard compares a run's cost with the same token usage priced at a baseline
model's rates. It does not run the baseline model, so the displayed difference is an estimate
rather than measured savings.

Model API keys stay in the user's Jenkins credentials store. Setup produces a separate
project CI token that the agent uses to fetch its configuration and submit results.

## Where to look

| Path | Purpose |
|---|---|
| [src/pages](src/pages/) | Home, setup, dashboard and authentication pages. |
| [src/components](src/components/) | Forms, charts, the runs table, project controls and chat panel. |
| [src/api](src/api/) | Typed requests to the backend, grouped by feature. |
| [src/config.ts](src/config.ts) | Chooses the backend URL for local development or the running container. |
| [e2e](e2e/) | Playwright browser tests and mocked API responses. |
| [public](public/) | Static assets, runtime configuration and the privacy policy. |
| [docker-entrypoint.d](docker-entrypoint.d/) | Writes the container's API URL into `config.js` when nginx starts. |

## Run locally

Install Node.js 22.20 or newer and start the backend using its
[setup guide](https://github.com/Steve-droid/driftplain-backend#run-locally).
Then, from this repo:

```bash
cp .env.example .env
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). The default API address is
`http://localhost:8000`.

| Setting | Where to set it | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `.env` | API URL for local development and Vite builds. |
| `API_BASE_URL` | Container environment | API URL written to `/config.js` at startup. It must be reachable by the user's browser. |

### Run the full stack in Docker

Clone the backend next to this repo as `../driftplain-backend`. Add a random `JWT_SECRET`
of at least 32 characters to this repo's `.env`, then build and start the images:

```bash
docker build -t driftplain-frontend:latest .
docker build -t driftplain-backend:latest ../driftplain-backend
docker compose up -d
```

Compose starts PostgreSQL, runs a one-off migration and catalog seed, then starts the API and
frontend. Open [localhost:8080](http://localhost:8080). This stack uses fake model responses.

## Checks and tests

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run test:integration
npx playwright install chromium
npm run e2e
npm run e2e:google
```

Vitest covers units and components. Integration tests use Testing Library and mocked HTTP
responses. Playwright covers sign-in, agent setup, example projects, the dashboard and chat.
These tests make no paid model calls.

`npm run e2e:all` also includes a smoke test against a local backend. That test skips when
the backend is unavailable on port 8000.

## Releases and deployment

A `vX.Y.Z` tag triggers the [image release workflow](.github/workflows/release-image.yml),
which publishes `ghcr.io/steve-droid/driftplain-frontend:X.Y.Z` for Linux amd64.
Existing `modelmatch-frontend` images remain
available, and version numbers continue from the previous package. See the
[image naming policy](https://github.com/Steve-droid/driftplain/blob/main/IMAGE-NAMING.md).

The [GitOps repo](https://github.com/Steve-droid/driftplain-gitops) pins the image digest and
deploys it through ArgoCD to the home K3s cluster. Publishing an image does not deploy it.
The `Jenkinsfile` retains the build and test pipeline used by the former AWS Jenkins controller.

### Public benchmark explorer (B5 — September 24, 2026)

Anonymous `/benchmarks`, `/benchmarks/:id`, `/models`, `/models/:id`, `/evidence` and
`/compare` routes use `/catalog/v1` on the configured API base. Public requests omit both
JWT headers and browser credentials; they never probe projects. The root authentication
and existing CI/project flows remain compatible. `/setup` and `/projects` enter those flows.

The explorer requires the B5 public metadata contract (backend 1.4.0+). All active evidence
is browseable independent of CI support. Historical/legacy rows remain available using
`view=history`. Unresolved labels are searchable without creating canonical model identities.
Runtime support cannot be inferred from catalog deployments; B6 owns that separate contract.

URL parameters preserve filters, opaque cursors, up to four `compare` choices (`m<ID>` for a
canonical model, `o<ID>` for an exact source observation), explicit observation choices and
chart scope. Source-row choices always pin the exact observation, including history.
Comparisons require matching version, protocol, evaluator, snapshot, metric and coverage.
Unknown provenance isolates rows. Values are not averaged across benchmarks or maximized
across configurations; missing values are never zero. Charts share the table's values/units.

Run `npm test`, `npm run test:integration`, `npm run typecheck`, `npm run lint`, `npm run build`,
then `npx playwright test --config playwright.config.catalog.ts` (desktop + mobile mocks) and
`npx playwright test --config playwright.config.public-access.ts` (existing public/auth flows).
All are local/fake. Publication does not deploy the explorer or import production data.

### Usage and task results (B15)

The dashboard shows selected-model estimates with separate complete, partial, unavailable
and legacy coverage, plus accepted/rejected and rated/total feedback. Run cards retain the
executed revision and distinguish reports, proposed patches, generated-test evidence and
diagnosis from findings. Historical input/output amounts remain explicitly limited and
outside new totals. See [the dashboard contract](src/usage/CONTRACT.md).
