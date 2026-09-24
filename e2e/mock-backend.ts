import { usageFixture } from "../src/usage/fixtures";
import type { Page, Route } from "@playwright/test";

// A tiny stateful mock of the Driftplain backend for the hermetic happy path. It
// intercepts every call to the API origin (config.apiBaseUrl, default
// http://localhost:8000) and answers with fixtures shaped exactly like the real API
// (see src/api/* + src/types/*). It is deliberately minimal: just the endpoints the
// happy path touches, plus enough state that POST /projects → the created agent then
// shows up in the dashboard's GET /projects.
//
// The "mocked CI run" the slice calls for is the savings fixture below: one banked run
// + series so the dashboard KPIs/charts/runs-table render non-empty without a real
// pipeline.

const API_ORIGIN = /^https?:\/\/localhost:8000\//;

// ci_review + budgetSensitivity:"high" → Nova suggested, Haiku runner-up, Sonnet
// baseline (the deterministic recommender's documented headline case).


const SAVINGS = {
  range: "all",
  selectedModel: "Nova 2 Lite",
  baselineModel: "Claude Sonnet 4.5",
  taskType: "ci_review",
  kpis: {
    cumulativeSaved: "0.045000",
    savedPct: 64.3,
    baselineTotal: "0.070000",
    spendThisPeriod: "0.025000",
    qualityRisk: "0.009000",
    projectedMonthlySpend: "0.250000",
    projectedMonthlySavings: "0.450000",
    acceptanceRate: 0.86,
    qualityStatus: "banking",
    threshold: 0.8,
    runsCount: 3,
    bankedRuns: 1,
    qualityRiskRuns: 1,
    unratedRuns: 1,
  },
  series: [
    {
      date: "2026-06-02T10:00:00Z",
      jenkinsBuildId: "101",
      actual: "0.010000",
      baseline: "0.030000",
      savings: "0.020000",
      qualityOk: true,
      acceptanceRate: 1.0,
    },
    {
      date: "2026-06-04T10:00:00Z",
      jenkinsBuildId: "102",
      actual: "0.015000",
      baseline: "0.040000",
      savings: "0.025000",
      qualityOk: true,
      acceptanceRate: 0.9,
    },
  ],
  runs: [
    {
      id: 1,
      jenkinsBuildId: "101",
      createdAt: "2026-06-02T10:00:00Z",
      model: "Nova 2 Lite",
      tokensIn: 1200,
      tokensOut: 340,
      cacheReadTokens: null,
      actualCost: "0.010000",
      baselineCost: "0.030000",
      savings: "0.020000",
      qualityOk: true,
      acceptanceRate: 1.0,
      gate: "pass",
      findingsCount: 2,
      cwes: [],
    },
  ],
};

// Server-seeded "explain my spend" opener (no LLM) + a grounded follow-up answer.
const CHAT_HISTORY = {
  messages: [
    {
      id: 1,
      role: "assistant",
      text:
        "You've saved $0.045 vs your Sonnet 4.5 baseline across 3 CI runs — about 64% " +
        "saved. Quality is holding at 86% acceptance.",
      createdAt: "2026-06-06T10:05:00Z",
      retrievalTrace: [
        { kind: "savings", ref: "savings:project", snippet: "cumulative saved $0.045 · acceptance 86%" },
      ],
    },
  ],
};

const CHAT_ANSWER = {
  answer:
    "You're running Nova 2 Lite at about $0.85/Mtok; Sonnet 4.5 — your baseline — would " +
    "cost roughly 7× more for the same review.",
  ok: true,
  refused: false,
  retrievalTrace: [
    { kind: "benchmark_result", ref: "chat_catalog:7", snippet: "Nova 2 Lite · review_score 0.68 · $0.85/Mtok" },
    { kind: "savings", ref: "savings:project", snippet: "actual $0.010/run vs baseline $0.030/run" },
  ],
  debug: null,
};

function project(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: "acme-api",
    userId: 1,
    selectedOptionId: 11,
    selectedOptionModel: "Nova 2 Lite",
    baselineModelId: 9,
    baselineModel: "Claude Sonnet 4.5",
    baselineVendor: "Anthropic",
    taskType: "ci_review",
    reviewPreferences: "Flag any use of eval().",
    setupComplete: true,
    ...over,
  };
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

// What mockBackend hands back: a live `errors` array the test asserts is EMPTY at the
// end. The mock is fail-closed — an unexpected call or a wrong request payload pushes a
// message here AND returns a 500/422 (so the UI also breaks visibly). This stops a wrong
// payload or an accidental extra request from silently "passing".
export interface MockHandle {
  errors: string[];
}

// Install the mock on a page. The closure holds the create state so the dashboard's
// project list reflects the just-created agent, plus the fail-closed error log.
export async function mockBackend(page: Page): Promise<MockHandle> {
  const created = false; // flips on POST /projects so GET /projects then lists it
  const errors: string[] = [];
  const bad = (msg: string) => errors.push(msg);

  // Pin the mock API origin even when the reused dev server points at an isolated BE.
  await page.route("**/config.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: 'window.__APP_CONFIG__ = { apiBaseUrl: "http://localhost:8000" };',
  }));

  await page.route(API_ORIGIN, async (route) => {
    const req = route.request();
    const method = req.method();
    const path = new URL(req.url()).pathname;
    const body = () => {
      try {
        return req.postDataJSON();
      } catch {
        return undefined;
      }
    };

    // Existing chat acceptance flows use an explicitly privileged fixture.
    if (path === "/auth/me" && method === "GET") {
      return json(route, { id: 1, email: "operator@example.com", chatEnabled: true });
    }
    if (/^\/projects\/\d+\/usage\/v1$/.test(path) && method === "GET") return json(route, usageFixture);
    // --- auth ---
    if (path === "/auth/google/config" && method === "GET") {
      return json(route, { enabled: false });
    }

    if (path === "/auth/login" && method === "POST") {
      const b = body();
      if (!b?.email || !b?.password) bad(`POST /auth/login bad body: ${req.postData()}`);
      return json(route, { accessToken: "e2e-jwt-token", tokenType: "bearer" });
    }

    // B17: retired public actions must never succeed, even in browser fixtures.
    if (path.startsWith("/recommendations") && method === "POST") {
      bad("Attempted retired recommendation action");
      return json(route, { detail: "Use /execution/v1" }, 410);
    }

    // --- projects: list (GET) vs create (POST) share the path ---
    if (path === "/projects" && method === "GET")
      return json(route, created ? [project()] : []);
    if (path === "/projects" && method === "POST") {
      bad("Attempted retired legacy project creation");
      return json(route, { detail: "Use /execution/v1/projects" }, 410);
    }

    // --- Jenkins connect (defer-create's second half) ---
    if (/^\/projects\/\d+\/jenkins$/.test(path) && method === "PUT") {
      const b = body();
      if (!b?.baseUrl) bad("PUT /jenkins missing baseUrl");
      if (!b?.jobName) bad("PUT /jenkins missing jobName");
      return json(route, {
        projectId: 7,
        baseUrl: b?.baseUrl ?? "https://jenkins.example.com",
        jobName: b?.jobName ?? "acme-api/main",
        status: "configured",
      });
    }

    // --- CI setup (mint-once token present on this first/only fetch) ---
    if (/^\/projects\/\d+\/ci-setup$/.test(path) && method === "GET")
      return json(route, {
        snippet:
          "stage('Driftplain') {\n  steps {\n    sh 'docker run --rm -e MODELMATCH_CI_TOKEN " +
          "832285994273.dkr.ecr.ap-south-1.amazonaws.com/modelmatch-agent:1.0.0'\n  }\n}",
        imageRef: "832285994273.dkr.ecr.ap-south-1.amazonaws.com/modelmatch-agent:1.0.0",
        ciRunsUrl: "http://localhost:8000/projects/7/ci-runs",
        token: "mmci_e2e_one_time_token",
        taskType: "ci_review",
        task: "review",
      });

    // --- savings (the mocked CI run that seeds the panels) ---
    if (/^\/projects\/\d+\/savings$/.test(path) && method === "GET")
      return json(route, SAVINGS);

    // --- grounded chat: history (GET, seeded opener) vs ask (POST) ---
    if (/^\/projects\/\d+\/chat$/.test(path) && method === "GET")
      return json(route, CHAT_HISTORY);
    if (/^\/projects\/\d+\/chat$/.test(path) && method === "POST") {
      const b = body();
      if (!b?.question) bad("POST /chat missing question");
      return json(route, CHAT_ANSWER);
    }

    // FAIL CLOSED: any call the happy path doesn't expect is a bug (wrong URL, an
    // accidental extra request). Record it + return 500 so the UI breaks visibly too.
    bad(`UNEXPECTED ${method} ${path}`);
    return json(route, { detail: `unmocked ${method} ${path}` }, 500);
  });

  return { errors };
}
