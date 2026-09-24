// Mirrors the backend's ProjectOut DTO (app/schemas/project.py; camelCase out). Used
// by the project switcher to list the signed-in user's projects.

export interface Project {
  id: number;
  name: string;
  userId: number;
  selectedOptionId: number | null;
  selectedOptionModel: string; // the recommended model behind the selected option
  baselineModelId: number | null;
  baselineModel: string;
  baselineVendor: string;
  // E20: the ONE task this project's agent runs (catalog vocabulary: "ci_review" |
  // "security_analysis") + the review preferences the review agent appends to its
  // prompt (null when none; ignored for security projects).
  taskType: string;
  reviewPreferences: string | null;
  // Fully onboarded = a Jenkins connection exists AND its CI ingest token was minted.
  // false → the dashboard badges the project "setup incomplete" with an edit path.
  setupComplete: boolean;
  // Optional for compatibility while the backend rolls out this capability.
  isExample?: boolean;
  executionRevisionId?: number | null;
}
