import { describe, expect, it } from "vitest";
import {
  profileFor,
  selectionFor,
  setupHref,
  readIntent,
  configFor,
  defaultFields,
} from "./draft";

describe("explicit CI draft contracts", () => {
  it("derives independent named profiles before eligibility", () => {
    expect(profileFor("ci_review", "node", true)).toEqual({
      task: "ci_review",
      mode: "single_call",
      language: null,
      proposeFix: false,
    });
    expect(profileFor("ci_failure_diagnosis", "python", true).proposeFix).toBe(
      true,
    );
    expect(profileFor("test_generation", "node", false).language).toBe("node");
  });
  it("carries exact IDs and only a bounded local setup return", () => {
    const href = setupHref(12, 34, "/setup?project=7");
    expect(readIntent(href.split("?")[1])).toMatchObject({
      model: 12,
      evidence: 34,
      project: 7,
    });
    expect(setupHref(12, null, "https://evil.test")).toBe("/setup?model=12");
    expect(readIntent("model=-1&evidence=abc&project=0")).toMatchObject({
      model: null,
      evidence: null,
      project: null,
    });
  });
  it("does not forge ranking from an unranked candidate with a score", () => {
    expect(
      selectionFor(profileFor("ci_review"), {
        runtimeId: 8,
        observationId: 9,
        method: "supported_unranked",
        group: "abc",
      }),
    ).toMatchObject({
      runtimeId: 8,
      observationId: 9,
      method: "supported_unranked",
      group: null,
    });
  });
  it("builds named configuration without borrowing benchmark commands", () => {
    const fields = {
      ...defaultFields(),
      files: "src/a.py\nsrc/b.py",
      suitePaths: "tests\nintegration",
      image: "tests@sha256:" + "a".repeat(64),
      lockHash: "b".repeat(64),
    };
    expect(
      configFor(profileFor("test_generation"), fields).validationCommands?.[0]
        .argv,
    ).toEqual(["python", "-m", "pytest", "tests", "integration"]);
    expect(configFor(profileFor("security_analysis"), fields).inputs).toEqual({
      diff: false,
      files: [],
      artifacts: [],
    });
    expect(
      configFor(profileFor("ci_failure_diagnosis"), fields).inputs?.diff,
    ).toBe(false);
  });
});

it("scopes stored drafts to the signed-in identity and rejects damaged fields", async () => {
  const { setToken } = await import("../api/client");
  const { saveDraft, loadDraft } = await import("./draft");
  const draft = {
    task: "ci_review" as const,
    language: "python" as const,
    fix: false,
    name: "Private draft",
    fields: defaultFields(),
    selection: null,
    label: "",
    projectId: null,
  };
  setToken("header." + btoa(JSON.stringify({ sub: "user-a" })) + ".signature");
  saveDraft(null, draft);
  setToken("header." + btoa(JSON.stringify({ sub: "user-b" })) + ".signature");
  expect(loadDraft(null)).toBeNull();
  setToken("header." + btoa(JSON.stringify({ sub: "user-a" })) + ".signature");
  expect(loadDraft(null)?.name).toBe("Private draft");
  sessionStorage.setItem(
    "driftplain-ci-draft-v1:user-a:new",
    JSON.stringify({ ...draft, fields: {} }),
  );
  expect(loadDraft(null)).toBeNull();
  localStorage.clear();
  sessionStorage.clear();
});

it("retains valid pre-B14 named drafts and removes oversized stale drafts", async () => {
  const { loadDraft, saveDraft } = await import("./draft");
  const { otherDefaults } = await import("./other");
  const fields = Object.fromEntries(
    Object.entries(defaultFields()).filter(
      ([k]) => !Object.hasOwn(otherDefaults(), k),
    ),
  );
  const old = {
    task: "ci_review",
    language: "python",
    fix: false,
    name: "Legacy draft",
    fields,
    selection: null,
    label: "",
    projectId: null,
  };
  sessionStorage.setItem(
    "driftplain-ci-draft-v1:anonymous:new",
    JSON.stringify(old),
  );
  expect(loadDraft(null)?.name).toBe("Legacy draft");
  expect(
    saveDraft(null, {
      ...old,
      task: "other",
      mode: "single_call",
      language: "python",
      fields: {
        ...defaultFields(),
        instructions: "字".repeat(16000),
        systemPrompt: "字".repeat(8000),
      },
    }),
  ).toBe(false);
  expect(loadDraft(null)).toBeNull();
  sessionStorage.clear();
});

it("restores bounded existing configuration fields beyond the new-authoring field limit", async () => {
  const { saveDraft, loadDraft } = await import("./draft");
  const d = {
    task: "other" as const,
    mode: "opencode" as const,
    language: "python" as const,
    fix: false,
    name: "Existing",
    fields: {
      ...defaultFields(),
      validationCommands: " ".repeat(17000) + "[]",
    },
    selection: null,
    label: "",
    projectId: 7,
  };
  expect(saveDraft(7, d)).toBe(true);
  expect(loadDraft(7)?.fields.validationCommands).toBe(
    d.fields.validationCommands,
  );
  sessionStorage.clear();
});
