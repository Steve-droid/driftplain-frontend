export interface Feedback {
  accepted: number;
  rejected: number;
  rated: number;
  total: number;
}
export interface Billing {
  version: number;
  basis: string;
  status: "complete" | "partial" | "unavailable";
  knownCost: string | null;
  currency: string;
  reasons: string[];
  categories: {
    category: string;
    tokens: number | null;
    ratePerMillion: string | null;
    cost: string | null;
  }[];
  rateSnapshot: {
    rateVersion: string;
    source: string;
    observedAt: string;
    effectiveAt: string;
    validUntil: string;
    pinnedAt: string;
    serviceTier: string;
  } | null;
}
export interface TaskResult {
  kind: "findings" | "report" | "patch";
  executionStatus: string;
  executionReason?: string | null;
  validationStatus: string;
  baseCommit: string | null;
  report: {
    summary: string;
    uncertainty: string | null;
    nextSteps: string[];
    cause?: string;
    noPatchReason?: string;
    evidenceArtifactIds: string[];
  } | null;
  patch: {
    sha256: string;
    artifactId: string;
    files: { path: string; operation: string }[];
  } | null;
  artifacts: {
    id: string;
    kind: string;
    path: string;
    sha256: string;
    sizeBytes: number;
  }[];
  validations: {
    commandId: string;
    status: string;
    executionRevisionId: number;
    baseCommit: string;
    patchSha256: string | null;
    exitCode: number | null;
    generatedTestsDiscovered: number | null;
    generatedTestsExecuted: number | null;
    testEvidence?: Record<string, unknown>;
    reason: string | null;
  }[];
  failure?: {
    stage: string;
    originalStatus: string;
    exitStatus: number | null;
    commit: string;
    buildId: string;
  };
}
export interface UsageRun {
  id: number;
  jenkinsBuildId: string | null;
  createdAt: string | null;
  model: string | null;
  provider: string | null;
  runtimeId: number | null;
  runtimeVersion: string | null;
  deploymentId: number | null;
  executionRevisionId: number | null;
  task: string;
  mode: string | null;
  gate: string | null;
  gateReason: string | null;
  usageStatus: "complete" | "partial" | "unavailable";
  billing: Billing;
  legacyCost: string | null;
  usage: Record<string, string | number | boolean | null> | null;
  legacyUsage: Record<string, number | null> | null;
  taskResult: TaskResult | null;
  feedback: Feedback;
}
export interface UsageResponse {
  version: number;
  projectId: number;
  isExample: boolean;
  range: string;
  totals: {
    completeCost: string | null;
    partialCost: string | null;
    completeRuns: number;
    partialRuns: number;
    unavailableRuns: number;
    legacyRuns: number;
    reportedRuns: number;
  };
  feedback: Feedback;
  runs: UsageRun[];
  offset: number;
  limit: number;
  total: number;
  limitations: string[];
}
