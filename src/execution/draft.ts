import { getToken } from "../api/client";
import type {
  Candidate,
  Profile,
  Selection,
  Task,
  TaskConfiguration,
} from "./api";
export const taskNames: Record<Task, string> = {
  ci_review: "PR review",
  security_analysis: "Security analysis",
  test_generation: "Test generation",
  ci_failure_diagnosis: "CI failure diagnosis",
};
export function profileFor(
  task: Task,
  language: "python" | "node" = "python",
  fix = false,
): Profile {
  return {
    task,
    mode: task === "ci_review" ? "single_call" : "opencode",
    language: task === "test_generation" ? language : null,
    proposeFix: task === "ci_failure_diagnosis" && fix,
  };
}
export function selectionFor(
  profile: Profile,
  item: Pick<Candidate, "runtimeId" | "observationId" | "method" | "group">,
): Selection {
  return {
    ...profile,
    runtimeId: item.runtimeId,
    observationId: item.observationId,
    method: item.method,
    group: item.method === "benchmark_ranked" ? item.group : null,
  };
}
function id(value: string | null) {
  return value && /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null;
}
export function readIntent(search: string) {
  const p = new URLSearchParams(search);
  return {
    model: id(p.get("model")),
    evidence: id(p.get("evidence")),
    project: id(p.get("project")),
  };
}
export function setupHref(
  model: number,
  evidence: number | null = null,
  returnTo: string | null = null,
) {
  const p = new URLSearchParams();
  if (returnTo && /^\/setup(?:\?|$)/.test(returnTo)) {
    const project = readIntent(returnTo.split("?")[1] ?? "").project;
    if (project) p.set("project", String(project));
  }
  p.set("model", String(model));
  if (evidence) p.set("evidence", String(evidence));
  return "/setup?" + p;
}
export function defaultFields() {
  return {
    instructions: "",
    files: "",
    writePaths: "tests",
    suitePaths: "tests",
    image: "",
    lockPath: "requirements.lock",
    lockHash: "",
    stage: "",
    logArtifact: "upstream.log",
    validationArgv: "",
    preferences: "",
  };
}
export type Fields = ReturnType<typeof defaultFields>;
export const lines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
export function configFor(p: Profile, f: Fields): TaskConfiguration {
  const config: TaskConfiguration = {
    instructions: f.instructions.trim() || null,
    inputs: {
      diff: p.task === "ci_review" || p.task === "test_generation",
      files:
        p.task === "test_generation" || p.task === "ci_failure_diagnosis"
          ? lines(f.files)
          : [],
      artifacts: [],
    },
  };
  if (p.task === "test_generation") {
    config.writePaths = lines(f.writePaths);
    config.testEnvironment = {
      profile: p.language === "python" ? "pytest-v1" : "node-test-v1",
      dependencyLock: f.lockPath,
      dependencySha256: f.lockHash,
    };
    config.validationCommands = [
      {
        id: "suite",
        argv: [
          ...(p.language === "python"
            ? ["python", "-m", "pytest"]
            : ["node", "--test"]),
          ...lines(f.suitePaths),
        ],
        environmentImage: f.image,
        required: true,
        maxSeconds: 120,
      },
    ];
  }
  if (p.task === "ci_failure_diagnosis") {
    config.diagnosis = { stage: f.stage, logArtifact: f.logArtifact };
    if (p.proposeFix) {
      config.writePaths = lines(f.writePaths);
      if (f.validationArgv.trim()) {
        const argv: unknown = JSON.parse(f.validationArgv);
        if (
          !Array.isArray(argv) ||
          !argv.length ||
          argv.some((a) => typeof a !== "string")
        )
          throw new Error(
            "Validation argv must be a nonempty JSON array of strings.",
          );
        config.validationCommands = [
          {
            id: "validate",
            argv,
            environmentImage: f.image,
            required: true,
            maxSeconds: 120,
          },
        ];
      }
    }
  }
  return config;
}
export function fieldsFrom(
  config: TaskConfiguration,
  preferences: string | null,
): Fields {
  const c = config.validationCommands?.[0];
  return {
    ...defaultFields(),
    instructions: config.instructions ?? "",
    files: config.inputs?.files.join("\n") ?? "",
    writePaths: config.writePaths?.join("\n") ?? "",
    suitePaths:
      c?.argv
        .slice(config.testEnvironment?.profile === "pytest-v1" ? 3 : 2)
        .join("\n") ?? "tests",
    image: c?.environmentImage ?? "",
    lockPath: config.testEnvironment?.dependencyLock ?? "requirements.lock",
    lockHash: config.testEnvironment?.dependencySha256 ?? "",
    stage: config.diagnosis?.stage ?? "",
    logArtifact: config.diagnosis?.logArtifact ?? "upstream.log",
    validationArgv: config.diagnosis && c ? JSON.stringify(c.argv) : "",
    preferences: preferences ?? "",
  };
}
export interface Draft {
  task: Task | null;
  language: "python" | "node";
  fix: boolean;
  name: string;
  fields: Fields;
  selection: Selection | null;
  label: string;
  projectId: number | null;
  configuration?: TaskConfiguration;
  dirtyConfig?: boolean;
}
function ownerScope() {
  try {
    const payload = JSON.parse(
      atob(getToken()!.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return String(payload.sub ?? "anonymous");
  } catch {
    return "anonymous";
  }
}
const key = (project: number | null) =>
  `driftplain-ci-draft-v1:${ownerScope()}:${project ?? "new"}`;
export function loadDraft(project: number | null): Draft | null {
  try {
    const raw = sessionStorage.getItem(key(project));
    if (!raw || raw.length > 64000) return null;
    const d = JSON.parse(raw) as Draft;
    if (
      (d.task !== null && !Object.hasOwn(taskNames, d.task)) ||
      !["python", "node"].includes(d.language) ||
      typeof d.fix !== "boolean" ||
      typeof d.name !== "string" ||
      !d.fields ||
      Object.keys(defaultFields()).some(
        (k) =>
          typeof d.fields[k as keyof Fields] !== "string" ||
          d.fields[k as keyof Fields].length > 16000,
      )
    )
      return null;
    return d;
  } catch {
    return null;
  }
}
export function saveDraft(project: number | null, d: Draft) {
  try {
    const raw = JSON.stringify(d);
    if (raw.length <= 64000) sessionStorage.setItem(key(project), raw);
  } catch {
    /* browser storage may be disabled */
  }
}
export function clearDraft(project: number | null) {
  try {
    sessionStorage.removeItem(key(project));
  } catch {
    /* optional storage */
  }
}
