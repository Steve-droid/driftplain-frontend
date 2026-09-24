import { navigate } from "../catalog/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Pencil,
  Plug,
  Settings2,
  Terminal,
  Trash2,
} from "lucide-react";
import type { Project } from "../types/project";
import { deleteProject } from "../api/projects";
import { connectJenkins, getJenkins } from "../api/jenkins";
import { ApiError } from "../api/client";
import { Modal } from "./Modal";
import { JenkinsConnectForm } from "./onboarding/JenkinsConnectForm";
import { CiSetupView } from "./onboarding/CiSetupView";
import { runtimeHintFromProjectModel } from "./onboarding/jenkinsRuntime";

type View = "menu" | "editJenkins" | "cisetup" | "repick" | "delete";

// Per-project actions on the dashboard (S15d): edit the Jenkins connection, re-pick the
// model via explicit setup, or delete the project (confirm → cascade).
// onChanged refreshes the dashboard after an edit; onDeleted hands control back so the
// parent can re-select/empty-state.
export function ProjectActions({
  project,
  onChanged,
  onDeleted,
  onUnauthorized,
}: {
  project: Project;
  onChanged: () => void;
  onDeleted: (deletedId: number) => void;
  onUnauthorized?: () => void;
}) {
  const [view, setView] = useState<View>("menu");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function open(v: View) {
    setMenuOpen(false);
    if (v === "repick" || (project.executionRevisionId && (v === "cisetup" || v === "editJenkins"))) { navigate(`/setup?project=${project.id}`); return; }
    setView(v);
  }
  function close() {
    setView("menu");
  }

  return (
    <div className="relative inline-flex" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="CI-Agent actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="compact-action"
      >
        <Settings2 size={13} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-panel-2 py-1"
        >
          {!project.isExample && <>
          <MenuItem icon={<Plug size={13} />} label="Edit Jenkins" onClick={() => open("editJenkins")} />
          <MenuItem icon={<Terminal size={13} />} label="CI setup & token" onClick={() => open("cisetup")} />
          <MenuItem icon={<Pencil size={13} />} label="Re-pick model" onClick={() => open("repick")} />
          {!project.executionRevisionId && <MenuItem icon={<Pencil size={13} />} label="Use named-task setup" onClick={() => navigate(`/setup?project=${project.id}`)} />}
          </>}
          <MenuItem
            icon={<Trash2 size={13} />}
            label="Delete CI-Agent"
            danger
            onClick={() => open("delete")}
          />
        </div>
      )}

      {view === "editJenkins" && (
        <Modal title={`Edit Jenkins: ${project.name}`} onClose={close}>
          <EditJenkins
            project={project}
            onUnauthorized={onUnauthorized}
            onSaved={() => {
              onChanged();
              close();
            }}
          />
        </Modal>
      )}

      {view === "cisetup" && (
        <Modal title={`CI setup: ${project.name}`} onClose={close}>
          <CiSetupView
            projectId={project.id}
            onUnauthorized={onUnauthorized}
            onDone={() => {
              onChanged(); // a first mint here flips setupComplete
              close();
            }}
          />
        </Modal>
      )}

      {view === "delete" && (
        <Modal title={`Delete ${project.name}?`} onClose={close}>
          <DeleteConfirm
            project={project}
            onCancel={close}
            onUnauthorized={onUnauthorized}
            onDeleted={() => onDeleted(project.id)}
          />
        </Modal>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-panel ${
        danger ? "text-risk hover:text-risk" : "text-fg hover:text-fg"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// Edit-Jenkins flow: load the current metadata (404 = never connected → blank), then
// reuse JenkinsConnectForm to PUT the new values. For a setup-INCOMPLETE project the
// PUT alone isn't enough (no CI token yet), so after saving we continue into
// CiSetupView to mint the token + show the snippet — the same jenkins→cisetup sequence
// as onboarding. A complete project just saves and closes.
function EditJenkins({
  project,
  onSaved,
  onUnauthorized,
}: {
  project: Project;
  onSaved: () => void;
  onUnauthorized?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [initial, setInitial] = useState({ baseUrl: "", jobName: "" });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCiSetup, setShowCiSetup] = useState(false);

  useEffect(() => {
    let live = true;
    getJenkins(project.id)
      .then((c) => live && setInitial({ baseUrl: c.baseUrl, jobName: c.jobName }))
      .catch((e: unknown) => {
        if (!live) return;
        // Only a 404 means "no connection yet" (setup-incomplete) → start blank. A
        // 401 logs out; anything else is a real failure we must surface, not silently
        // present an empty form as if there were no connection.
        if (e instanceof ApiError && e.status === 404) return;
        if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
        else if (e instanceof ApiError) setLoadError(e.message);
        else setLoadError("Could not load the current Jenkins settings.");
      })
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [project.id, onUnauthorized]);

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={14} className="animate-spin" />
        Loading connection…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded border border-risk/40 bg-risk/10 px-3 py-2 text-sm text-risk">
        {loadError}
      </div>
    );
  }

  // Finish setup: mint the CI token + show the stage snippet, then close + refresh.
  if (showCiSetup) {
    return (
      <CiSetupView projectId={project.id} onDone={onSaved} onUnauthorized={onUnauthorized} />
    );
  }

  return (
    <JenkinsConnectForm
      initialBaseUrl={initial.baseUrl}
      initialJobName={initial.jobName}
      submitLabel="Save changes"
      onUnauthorized={onUnauthorized}
      runtimeHint={runtimeHintFromProjectModel(project.selectedOptionModel)}
      onSubmit={async (input) => {
        await connectJenkins(project.id, input);
        // Incomplete project → continue to CI setup (the missing token); else done.
        if (project.setupComplete) onSaved();
        else setShowCiSetup(true);
      }}
    />
  );
}

function DeleteConfirm({
  project,
  onCancel,
  onDeleted,
  onUnauthorized,
}: {
  project: Project;
  onCancel: () => void;
  onDeleted: () => void;
  onUnauthorized?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteProject(project.id);
      onDeleted();
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
      else if (e instanceof ApiError) setError(e.message);
      else setError("Could not reach the backend.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        This permanently removes <span className="font-medium text-fg">{project.name}</span>{" "}
        and all of its data: CI runs, savings, findings, the Jenkins connection and chat
        history. This can't be undone.
      </p>
      {error && (
        <div className="rounded border border-risk/40 bg-risk/10 px-3 py-2 text-sm text-risk">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={deleting}
          className="rounded border border-border bg-panel-2 px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-fg disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-2 rounded bg-risk px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Delete CI-Agent
        </button>
      </div>
    </div>
  );
}
