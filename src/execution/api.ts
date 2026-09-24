import { apiGet, apiPost, apiPatch } from "../api/client";
export type Task =
  | "ci_review"
  | "security_analysis"
  | "test_generation"
  | "ci_failure_diagnosis";
export interface Profile {
  task: Task;
  mode: "single_call" | "opencode";
  language: "python" | "node" | null;
  proposeFix: boolean;
}
export interface Policy extends Profile {
  version: string;
  benchmark: string | null;
  benchmarkVersion: string | null;
  metric: string | null;
  direction: "higher" | "lower" | null;
}
export interface Candidate {
  runtimeId: number;
  catalogModelId: number;
  model: string;
  provider: string;
  providerModelId: string;
  deploymentId: number;
  observationId: number;
  snapshotId: number;
  method: "benchmark_ranked" | "supported_unranked";
  group: string | null;
  score: string | null;
  reportedValue: string | null;
  sourceRank: number | null;
  sourceGroupRank: number | null;
  benchmarkRunner: string | null;
  executionMode: string;
  runtimeVersion: string;
  rank: number | null;
  position: number | null;
}
export interface Candidates {
  policy: Policy;
  groups: { id: string; totalResults: number; supportedResults: number }[];
  items: Candidate[];
  total: number;
  offset: number;
}
export interface Selection extends Profile {
  runtimeId: number;
  observationId: number;
  method: Candidate["method"];
  group: string | null;
}
export interface TaskConfiguration {
  instructions?: string | null;
  inputs?: {
    diff: boolean;
    files: string[];
    artifacts: string[];
    maxBytes?: number;
    maxFileBytes?: number;
    maxContextTokens?: number;
  };
  resources?: Record<string, number>;
  writePaths?: string[];
  validationCommands?: {
    id: string;
    argv: string[];
    environmentImage: string;
    required: boolean;
    maxSeconds: number;
  }[];
  testEnvironment?: {
    profile: "pytest-v1" | "node-test-v1";
    dependencyLock: string;
    dependencySha256: string;
  };
  diagnosis?: { stage: string; logArtifact: string };
}
export interface ExecutionProject {
  id: number;
  name: string;
  executionRevisionId: number;
  selectionMethod: Candidate["method"];
  observationId: number;
  snapshotId: number;
  policyResult: { group?: string } | null;
  configuration: {
    taskType: Task;
    executionMode: Profile["mode"];
    runtimeId: number;
    catalogModelId: number;
    deploymentId: number;
    policy: Policy;
    model: {
      name: string;
      provider: string;
      providerModelId: string;
      credentialEnvVar: string;
    };
    taskConfiguration?: TaskConfiguration;
    reviewPreferences: string | null;
  };
}
export interface ProjectInput {
  name: string;
  selection: Selection;
  taskConfiguration: TaskConfiguration;
  reviewPreferences: string | null;
}
export interface Command {
  executionRevisionId: number;
  executionMode: string;
  command: string;
  jenkinsStage?: string;
  launcherImage: string;
  editorImage: string | null;
}
export function candidates(
  profile: Profile,
  q = "",
  group: string | null = null,
  offset = 0,
  exact?: { model: number | null; evidence: number | null },
): Promise<Candidates> {
  const params = new URLSearchParams({
    task: profile.task,
    mode: profile.mode,
    proposeFix: String(profile.proposeFix),
    q,
    offset: String(offset),
    limit: "50",
  });
  if (exact?.model) params.set("catalogModelId", String(exact.model));
  if (exact?.evidence) params.set("observationId", String(exact.evidence));
  if (profile.language) params.set("language", profile.language);
  if (group) params.set("group", group);
  return apiGet(`/execution/v1/candidates?${params}`);
}
/** Re-fetch the exact choice, including its recommendation group. Never substitute a model. */
export async function revalidate(selection: Selection): Promise<Candidate> {
  for (let offset = 0; offset < 100000; offset += 50) {
    const page = await candidates(selection, "", selection.group, offset, {
      model: null,
      evidence: selection.observationId,
    });
    const exact = page.items.find(
      (i) =>
        i.runtimeId === selection.runtimeId &&
        i.observationId === selection.observationId &&
        i.method === selection.method,
    );
    if (exact) return exact;
    if (offset + 50 >= page.total) break;
  }
  throw new Error(
    "This exact model, deployment or evidence is no longer eligible. Pick again.",
  );
}
export const getExecutionProject = (id: number) =>
  apiGet<ExecutionProject>(`/execution/v1/projects/${id}`);
export const createExecutionProject = (input: ProjectInput) =>
  apiPost<ExecutionProject>("/execution/v1/projects", input);
export const updateExecutionProject = (id: number, input: ProjectInput) =>
  apiPatch<ExecutionProject>(`/execution/v1/projects/${id}`, input);
export const getCommand = (id: number) =>
  apiGet<Command>(`/execution/v1/projects/${id}/ci-command`);
export const issueToken = (id: number, rotate = false) =>
  apiPost<{ token: string | null }>(
    `/execution/v1/projects/${id}/ci-token${rotate ? "/rotate" : ""}`,
    {},
  );
