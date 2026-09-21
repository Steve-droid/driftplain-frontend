# Driftplain frontend

[driftplain.dev](https://driftplain.dev) · **Frontend** · [Backend](https://github.com/Steve-droid/driftplain-backend) · [Infra](https://github.com/Steve-droid/driftplain-infra) · [GitOps](https://github.com/Steve-droid/driftplain-gitops)

Driftplain picks a cheaper LLM for code review from benchmark data, runs it as a review agent in
the user's CI on the user's own API key, and shows the money saved while review quality holds.
This repo is the React SPA. It talks to the backend over HTTPS/JSON and is served as static
files by nginx.

## Pages

**Home.** Signed-in landing page with the project switcher and the entry point to a new agent.

**Onboarding.** The recommender form (task, budget, agent speed) shows the pick and shortlist the
backend returns. The Jenkins step takes a base URL and job name only; keys and CI tokens stay in
the user's own Jenkins credentials. The last step shows the generated pipeline stage with a
one-time CI token. The project is created only on commit, so abandoning the wizard leaves nothing
behind.

**Dashboard.** KPI cards with sparklines, an actual-versus-baseline area chart where the shaded
gap is the savings, cost per run colored by quality, token usage, a quality trend and a runs
table. Savings count only while the quality gate holds.

**Chat panel.** Opens with an automatic "explain my spend" summary and answers follow-ups with a
visible retrieval trace. At home the backend runs without an LLM, so the panel says the assistant
is offline.

**Login and registration.** Password login and Google sign-in. Google availability comes from the
backend's `/auth/google/config`; the page loads the GIS script only when it is enabled and keeps
the password form usable if it fails. The privacy policy is the static `/privacy.html`.

## Run it

```bash
cp .env.example .env       # VITE_API_BASE_URL, defaults to http://localhost:8000
npm ci
npm run dev                # Vite on :5173
npm run build              # tsc && vite build
npm run lint
npm run typecheck
```

Start the backend from its own README, or bring the whole stack up from images:

```bash
docker build -t modelmatch-frontend:latest .
docker build -t modelmatch-backend:latest ../driftplain-backend
JWT_SECRET=$(openssl rand -hex 32) docker compose up -d   # frontend :8080, backend :8000, db
```

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `.env` in development | backend URL baked into local builds |
| `API_BASE_URL` | container environment | written into `/config.js` by the nginx entrypoint at start. This is the public API host the browser calls, not the in-cluster Service name. |

Nothing else is configured on the frontend. Google sign-in needs only the backend's
`GOOGLE_CLIENT_ID`, with this origin registered at Google and in the backend's CORS list.

## Tests

```bash
npm test                    # Vitest unit and component tests
npm run test:integration    # Vitest + Testing Library + MSW, no containers
npm run e2e                 # Playwright happy path against a mocked backend (starts the dev server)
npm run e2e:google          # offline Google sign-in checks
npm run e2e:all             # also the real-stack smoke; it skips itself when no backend is on :8000
```

The happy path drives login, a new agent through the wizard, the dashboard and the chat with a
mocked CI run. No test calls an LLM. First time: `npx playwright install chromium`.

## Releasing

Merge, then push an annotated `vX.Y.Z` tag.
[`release-image.yml`](.github/workflows/release-image.yml) builds `linux/amd64` and pushes
`ghcr.io/steve-droid/modelmatch-frontend:X.Y.Z` to public GHCR (image names keep the project's
old `modelmatch` name). A published tag is never overwritten. The job summary prints the digest
to pin in the [gitops](https://github.com/Steve-droid/driftplain-gitops) home profile. The
`Jenkinsfile` ran on the AWS controller until September 21, 2026 and is kept for reference.

## Layout

```
src/pages         Home, Onboarding, Dashboard, Login, Register
src/components    dashboard charts and tables, chat panel, onboarding forms, auth layout
src/api           one module per backend area (auth, google, recommend, projects, jenkins, ci, savings, chat)
src/config.ts     runtime config (window.__APP_CONFIG__ in production, Vite env in development)
e2e/              Playwright specs and the mock backend
public/           config.js, favicons, privacy.html, the Google ownership file
docker-entrypoint.d/40-config-js.sh   writes /config.js from API_BASE_URL
```

Steve Levit, stevelevit230@gmail.com
