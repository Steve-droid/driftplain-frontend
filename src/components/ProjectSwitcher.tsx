import { ChevronDown, FolderGit2 } from "lucide-react";
import type { Project } from "../types/project";

// Dark-styled native select for choosing the active project. Replaces the ?project=
// query param used through S14. One project → a static label (no pointless dropdown).
export function ProjectSwitcher({
  projects,
  value,
  onChange,
}: {
  projects: Project[];
  value: number;
  onChange: (id: number) => void;
}) {
  if (projects.length === 0) return null;

  const active = projects.find((p) => p.id === value);

  if (projects.length === 1) {
    return (
      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-2 text-xs font-medium text-muted">
        <FolderGit2 size={13} className="text-faint" />
        <span className="truncate">{active?.name ?? `CI-Agent #${value}`}</span>
      </span>
    );
  }

  return (
    <div className="relative inline-flex min-w-0 max-w-[9rem] items-center sm:max-w-[16rem]">
      <FolderGit2
        size={13}
        className="pointer-events-none absolute left-2.5 text-faint"
      />
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Select CI-Agent"
        className="max-w-full truncate appearance-none rounded-lg border border-border bg-panel py-2 pl-8 pr-8 text-xs font-medium text-fg focus:border-accent focus:outline-none"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2 text-faint"
      />
    </div>
  );
}
