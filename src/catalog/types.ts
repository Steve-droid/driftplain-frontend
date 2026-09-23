export interface Page<T> {
  items: T[];
  pageInfo: { limit: number; nextCursor: string | null; hasMore: boolean };
}
export interface Model {
  id: number;
  slug: string;
  name: string;
  organization: string | null;
}
export interface ModelDetail extends Model {
  description: string | null;
  aliases: string[];
  deployments: {
    id: number;
    providerId: number;
    providerName: string;
    deploymentKey: string;
    name: string;
    variant: string | null;
  }[];
}
export interface Source {
  id: number;
  slug: string;
  name: string;
  resultUrl: string | null;
  attribution: string | null;
  licenseText: string | null;
  snapshotId: number | null;
  fetchedAt: string | null;
  publicationDate: string | null;
  refreshStatus: "ok" | "failed" | "unknown";
  checkedAt: string | null;
}
export interface Benchmark {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  tooltip: string | null;
  methodologyUrl: string | null;
  limitations: string | null;
  collection: string | null;
  sources: Source[];
  versionLabels: string[];
  metricUnits: string[];
}
export interface BenchmarkDetail extends Benchmark {
  versions: {
    id: number;
    version: string;
    releaseDate: string | null;
    description: string | null;
    methodology: string | null;
    methodologyUrl: string | null;
    protocols: {
      id: number;
      name: string;
      runner: string | null;
      runnerVersion: string | null;
      configuration: Record<string, unknown>;
    }[];
  }[];
  taskTypes: string[];
}
export interface Metric {
  metricId: number;
  key: string;
  name: string;
  description: string | null;
  unit: string | null;
  direction: "higher" | "lower" | "non_ranking" | null;
  value: string | null;
  reportedValue: string | null;
  missingReason: string | null;
  category: string | null;
  subset: string | null;
  aggregation: string | null;
  confidenceLow: string | null;
  confidenceHigh: string | null;
  confidenceLevel: string | null;
  uncertaintyType: string | null;
  sampleSize: number | null;
  denominator: number | null;
  attempts: number | null;
}
export interface Observation {
  id: number;
  benchmarkId: number;
  benchmarkName: string;
  versionId: number | null;
  version: string | null;
  protocolId: number | null;
  protocol: string | null;
  evaluatorId: number | null;
  evaluator: string | null;
  sourceSnapshotId: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceContentHash: string | null;
  sourceFetchedAt: string | null;
  sourcePublicationDate: string | null;
  snapshotStatus: "active" | "historical" | "unknown";
  citationUrl: string | null;
  coverageNote: string | null;
  runner: string | null;
  runnerVersion: string | null;
  protocolConfiguration: Record<string, unknown>;
  sourceModelLabel: string;
  modelId: number | null;
  modelName: string | null;
  providerId: number | null;
  providerName: string | null;
  origin: "source" | "legacy_backfill";
  provenanceStatus: "complete" | "incomplete";
  contextWindow: number | null;
  observedAt: string | null;
  metrics: Metric[];
}
export interface SearchItem {
  type: "model" | "benchmark" | "provider";
  id: number;
  name: string;
  subtitle: string | null;
}
