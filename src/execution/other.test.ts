import { describe, expect, it } from "vitest";
import { configFor, defaultFields, fieldsFrom, profileFor } from "./draft";
import { otherConfig } from "./other";
const fields = () => ({
  ...defaultFields(),
  label: "Release notes",
  systemPrompt: " Literal ${BUILD_TAG}\n",
  instructions: " $(whoami)\n",
  diff: "false",
  files: "README.md",
  artifacts: "build.log",
});
describe("Other authoring contract", () => {
  it("uses the explicit mode and preserves literal prompts without granting writes", () => {
    expect(profileFor("other", "python", true, "single_call")).toEqual({
      task: "other",
      mode: "single_call",
      language: null,
      proposeFix: false,
    });
    const c = configFor(
      profileFor("other", "python", false, "single_call"),
      fields(),
    );
    expect(c.systemPrompt).toBe(" Literal ${BUILD_TAG}\n");
    expect(c.instructions).toBe(" $(whoami)\n");
    expect(c.inputs).toMatchObject({
      diff: false,
      files: ["README.md"],
      artifacts: ["build.log"],
    });
    expect(c.writePaths).toEqual([]);
    expect(c.validationCommands).toEqual([]);
    expect(c.resources).toMatchObject({ maxIterations: 1, maxAttempts: 1 });
  });
  it("round trips all custom commands, limits and exact prompts", () => {
    const f = {
      ...fields(),
      writePaths: "docs",
      validationCommands: JSON.stringify([
        {
          id: "docs",
          argv: ["python", "check.py"],
          environmentImage: "checks@sha256:" + "a".repeat(64),
          required: true,
          maxSeconds: 32,
        },
      ]),
      maxBytes: "1234",
      maxTokens: "2345",
    };
    const c = otherConfig("opencode", f);
    expect(otherConfig("opencode", fieldsFrom(c, null))).toEqual(c);
    expect(c.resources?.maxTokens).toBe(2345);
  });
  it.each(["../file", "/tmp/file", "src/*", "src//a", "./a"])(
    "rejects nonliteral path %s",
    (files) => {
      expect(() => otherConfig("single_call", { ...fields(), files })).toThrow(
        /path/i,
      );
    },
  );
  it("requires bounded prompts, explicit write paths and unique validators", () => {
    expect(() =>
      otherConfig("single_call", {
        ...fields(),
        systemPrompt: "x".repeat(8001),
      }),
    ).toThrow();
    expect(() =>
      otherConfig("opencode", { ...fields(), writePaths: "" }),
    ).toThrow();
    expect(() =>
      otherConfig("single_call", { ...fields(), maxBytes: "1048577" }),
    ).toThrow();
    const command = {
      id: "same",
      argv: ["true"],
      environmentImage: "checks@sha256:" + "a".repeat(64),
      required: true,
      maxSeconds: 5,
    };
    expect(() =>
      otherConfig("opencode", {
        ...fields(),
        validationCommands: JSON.stringify([command, command]),
      }),
    ).toThrow(/unique/i);
  });
});
