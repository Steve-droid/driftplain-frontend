import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import { listProjects } from "../api/projects";
import { connectJenkins, getJenkins } from "../api/jenkins";
import { AppHeader } from "../components/AppHeader";
import { catalog } from "../catalog/api";
import type { ModelDetail, Observation } from "../catalog/types";
import { Link, navigate, updateParams } from "../catalog/navigation";
import { JenkinsConnectForm } from "../components/onboarding/JenkinsConnectForm";
import {
  createExecutionProject,
  getExecutionProject,
  revalidate,
  updateExecutionProject,
  type Candidate,
  type ExecutionProject,
  type Task,
} from "./api";
import {
  clearDraft,
  configFor,
  defaultFields,
  draftTooLarge,
  fieldsFrom,
  loadDraft,
  profileFor,
  readIntent,
  saveDraft,
  selectionFor,
  type Draft,
} from "./draft";
import { CandidateEvidence, EligibleModelPicker } from "./EligibleModelPicker";
import { OtherFields } from "./OtherFields";
import { TaskFields } from "./TaskFields";
import { TaskPicker } from "./TaskPicker";
import { SetupSteps } from "./SetupSteps";
import { ExecutionCommand } from "./ExecutionCommand";
import "./execution.css";

export function ExecutionSetup({
  onUnauthorized,
}: {
  onUnauthorized?: () => void;
}) {
  const intent = readIntent(window.location.search);
  const [draft, setDraft] = useState<Draft>(
    () =>
      loadDraft(intent.project) ?? {
        task: null,
        language: "python",
        fix: false,
        name: "",
        fields: defaultFields(),
        selection: null,
        label: "",
        projectId: intent.project,
      },
  );
  const [loaded, setLoaded] = useState(!intent.project);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState<{
    key: string;
    item: Candidate;
  } | null>(null);
  const [step, setStep] = useState<"pick" | "jenkins" | "command">("pick");
  const [project, setProject] = useState<ExecutionProject | null>(null);
  const [jenkins, setJenkins] = useState({ baseUrl: "", jobName: "" });
  const [origin, setOrigin] = useState<{
    key: string;
    name: string;
    error?: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [pickVersion, setPickVersion] = useState(0);
  const selectionPanel = useRef<HTMLElement>(null);
  const profile = draft.task
    ? profileFor(draft.task, draft.language, draft.fix, draft.mode)
    : null;
  const selectionKey = JSON.stringify(draft.selection);
  const originKey = JSON.stringify([intent.model, intent.evidence]);
  function failure(e: unknown) {
    if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
    setError(e instanceof Error ? e.message : "Could not reach the backend.");
  }
  useEffect(() => {
    saveDraft(intent.project, draft);
  }, [draft, intent.project]);
  useEffect(() => {
    if (!intent.project) return;
    let live = true;
    getExecutionProject(intent.project)
      .then((p) => {
        if (!live) return;
        setProject(p);
        if (!loadDraft(intent.project)?.task) {
          const c = p.configuration;
          setDraft({
            task: c.taskType,
            mode: c.executionMode,
            language: c.policy.language ?? "python",
            fix: c.policy.proposeFix,
            name: p.name,
            fields: fieldsFrom(c.taskConfiguration ?? {}, c.reviewPreferences),
            selection: {
              ...profileFor(
                c.taskType,
                c.policy.language ?? "python",
                c.policy.proposeFix,
                c.executionMode,
              ),
              runtimeId: c.runtimeId,
              observationId: p.observationId,
              method: p.selectionMethod,
              group:
                p.selectionMethod === "benchmark_ranked"
                  ? (p.policyResult?.group ?? null)
                  : null,
            },
            label: `${c.model.name} · ${c.model.providerModelId}`,
            projectId: p.id,
            configuration: c.taskConfiguration,
            dirtyConfig: false,
          });
        }
      })
      .catch(async (e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 422) {
          try {
            const p = (await listProjects()).find(
              (p) => p.id === intent.project,
            );
            if (!p) throw new Error("Project not found.");
            if (live) setDraft((d) => ({ ...d, name: d.name || p.name }));
          } catch (err) {
            if (live) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not load legacy project.",
              );
            }
          }
        } else {
          if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
          setError(e instanceof Error ? e.message : "Could not load project.");
        }
      })
      .finally(() => {
        if (live) setLoaded(true);
      });
    getJenkins(intent.project)
      .then((j) => {
        if (live) setJenkins(j);
      })
      .catch(() => {
        /* connection may not exist; save still validates */
      });
    return () => {
      live = false;
    };
  }, [intent.project, onUnauthorized]);
  useEffect(() => {
    const selection = JSON.parse(selectionKey) as Draft["selection"];
    if (!selection) return;
    let live = true;
    revalidate(selection)
      .then(async (item) => {
        const o = await catalog<Observation>(
          `observations/${item.observationId}`,
        );
        if (
          o.id !== item.observationId ||
          o.modelId !== item.catalogModelId ||
          o.sourceSnapshotId !== item.snapshotId
        )
          throw new Error("Evidence identity mismatch. Pick again.");
        if (live) setVerified({ key: selectionKey, item });
      })
      .catch((e: unknown) => {
        if (live) {
          setVerified(null);
          if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
          setError(
            e instanceof Error
              ? e.message
              : "Selection could not be revalidated.",
          );
        }
      });
    return () => {
      live = false;
    };
  }, [selectionKey, pickVersion, onUnauthorized]);
  useEffect(() => {
    const [model, evidence] = JSON.parse(originKey) as [
      number | null,
      number | null,
    ];
    if (!model) return;
    let live = true;
    Promise.all([
      catalog<ModelDetail>(`models/${model}`),
      evidence
        ? catalog<Observation>(`observations/${evidence}`)
        : Promise.resolve(null),
    ])
      .then(([m, o]) => {
        if (o && o.modelId !== model)
          throw new Error(
            "The requested evidence does not identify this exact model.",
          );
        if (live) setOrigin({ key: originKey, name: m.name });
      })
      .catch((e: unknown) => {
        if (live)
          setOrigin({
            key: originKey,
            name: `Model #${model}`,
            error:
              e instanceof Error
                ? e.message
                : "Requested evidence unavailable.",
          });
      });
    return () => {
      live = false;
    };
  }, [originKey]);
  function changeProfile(
    task: Task | null,
    language = draft.language,
    fix = draft.fix,
    mode = draft.mode ?? "single_call",
  ) {
    setDraft((d) => ({
      ...d,
      task,
      language,
      fix,
      mode,
      selection: null,
      configuration: undefined,
      dirtyConfig: true,
      fields: {
        ...defaultFields(),
        ...(task === "other" && d.task === "other" ? d.fields : {}),
        instructions: d.fields.instructions,
        lockPath:
          language === "node" ? "package-lock.json" : "requirements.lock",
        writePaths:
          task === "other"
            ? d.task === "other"
              ? d.fields.writePaths
              : ""
            : task === "ci_failure_diagnosis"
              ? ""
              : "tests",
      },
    }));
    setVerified(null);
    setError("");
  }
  function pick(item: Candidate) {
    if (!profile) return;
    setError("");
    setVerified(null);
    setPickVersion((n) => n + 1);
    setDraft((d) => ({
      ...d,
      selection: selectionFor(profile, item),
      label: `${item.model} · ${item.provider} · deployment #${item.deploymentId} · evidence #${item.observationId}`,
    }));
    // The confirmation renders below the model list; bring it into view.
    selectionPanel.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });
  }
  const valid =
    !!profile &&
    !!draft.selection &&
    JSON.stringify(profile) ===
      JSON.stringify(
        profileFor(
          draft.selection.task,
          draft.selection.language ?? "python",
          draft.selection.proposeFix,
          draft.selection.mode,
        ),
      ) &&
    verified?.key === selectionKey &&
    (!intent.model ||
      (verified.item.catalogModelId === intent.model &&
        (!intent.evidence || verified.item.observationId === intent.evidence) &&
        origin?.key === originKey &&
        !origin.error));
  function configuration() {
    if (!profile) throw new Error("Choose a task.");
    if (draft.configuration && !draft.dirtyConfig) return draft.configuration;
    const next = configFor(profile, draft.fields);
    return {
      ...draft.configuration,
      ...next,
      inputs: { ...draft.configuration?.inputs, ...next.inputs! },
    };
  }
  async function continueSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !draft.selection) return;
    setChecking(true);
    setError("");
    try {
      configuration();
      await revalidate(draft.selection);
      setStep("jenkins");
    } catch (e) {
      setVerified(null);
      failure(e);
    } finally {
      setChecking(false);
    }
  }
  async function connect(input: { baseUrl: string; jobName: string }) {
    if (!draft.selection || !valid)
      throw new Error("Revalidate your model selection first.");
    setChecking(true);
    try {
      await revalidate(draft.selection);
      const payload = {
        name: draft.name.trim(),
        selection: draft.selection,
        taskConfiguration: configuration(),
        reviewPreferences:
          draft.task === "ci_review"
            ? draft.fields.preferences.trim() || null
            : null,
      };
      const p = draft.projectId
        ? await updateExecutionProject(draft.projectId, payload)
        : await createExecutionProject(payload);
      const next = { ...draft, projectId: p.id };
      saveDraft(intent.project, next);
      setDraft(next);
      setProject(p);
      await connectJenkins(p.id, input);
      setJenkins(input);
      setStep("command");
    } catch (e) {
      if (e instanceof ApiError && [409, 422].includes(e.status)) {
        setVerified(null);
        setStep("pick");
      }
      throw e;
    } finally {
      setChecking(false);
    }
  }
  const stepNumber =
    step === "jenkins" ? 4 : step === "command" ? 5 : !draft.task ? 1 : valid ? 3 : 2;
  return (
    <>
      <AppHeader current="setup" />
      <main className="ci-setup">
        <p className="eyebrow">
          {intent.project ? "Edit CI agent" : "New CI agent"}
        </p>
        <h1>{intent.project ? "Edit your CI agent" : "Set up a CI agent"}</h1>
        <p>
          Pick a task, choose a model backed by real benchmark results, then
          paste the generated stage into Jenkins. Your API key never leaves
          Jenkins.
        </p>
        <SetupSteps current={stepNumber} />
        <div className="ci-actions">
          <Link href="/projects">Back to projects</Link>
          {step !== "pick" && (
            <button disabled={checking} onClick={() => setStep("pick")}>
              Edit task and model
            </button>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
        {draftTooLarge(draft) && (
          <p role="alert">
            This draft exceeds the 64,000-byte navigation limit. Shorten its
            inputs or prompts before leaving this page; it cannot be restored
            after navigation or reload.
          </p>
        )}
        <fieldset disabled={checking}>
          {!loaded ? (
            <p role="status">Loading project…</p>
          ) : step === "pick" ? (
            <>
              {intent.model && (
                <aside className="ci-panel ci-origin">
                  <p>
                    <strong>From Explorer:</strong>{" "}
                    {origin?.key === originKey
                      ? origin.name
                      : `Model #${intent.model}`}{" "}
                    {intent.evidence && `· exact evidence #${intent.evidence}`}
                  </p>
                  {origin?.error && <p role="alert">{origin.error}</p>}
                  <p className="ci-hint">
                    Choose a task, then pick this model's hosting deployment.
                    Related variants are never substituted.
                  </p>
                  <button
                    onClick={() =>
                      updateParams({ model: null, evidence: null })
                    }
                  >
                    Clear Explorer constraint
                  </button>
                </aside>
              )}
              <section className="ci-panel">
                <h2>What should the agent do?</h2>
                <p className="ci-hint">Hover a task for a one-line description.</p>
                <TaskPicker
                  value={draft.task}
                  onChange={(task: Task) => changeProfile(task)}
                />
                <div className="ci-options">
                {draft.task === "other" && (
                  <label>
                    Execution mode
                    <select
                      aria-label="Execution mode"
                      value={draft.mode ?? "single_call"}
                      onChange={(e) =>
                        changeProfile(
                          "other",
                          draft.language,
                          false,
                          e.target.value as "single_call" | "opencode",
                        )
                      }
                    >
                      <option value="single_call">
                        Single API call — report only
                      </option>
                      <option value="opencode">
                        OpenCode — disposable edits
                      </option>
                    </select>
                  </label>
                )}
                {draft.task === "test_generation" && (
                  <label>
                    Test language
                    <select
                      aria-label="Test language"
                      value={draft.language}
                      onChange={(e) =>
                        changeProfile(
                          draft.task,
                          e.target.value as "python" | "node",
                        )
                      }
                    >
                      <option value="python">Python / pytest</option>
                      <option value="node">Node.js / node:test</option>
                    </select>
                  </label>
                )}
                {draft.task === "ci_failure_diagnosis" && (
                  <label className="ci-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.fix}
                      onChange={(e) =>
                        changeProfile(
                          draft.task,
                          draft.language,
                          e.target.checked,
                        )
                      }
                    />
                    Propose a fix
                  </label>
                )}
                </div>
              </section>
              {profile && (
                <EligibleModelPicker
                  key={JSON.stringify(profile)}
                  profile={profile}
                  onPick={pick}
                  onUnauthorized={onUnauthorized}
                  exact={{ model: intent.model, evidence: intent.evidence }}
                  selected={draft.selection}
                />
              )}
              <form onSubmit={continueSetup}>
                <section className="ci-panel" ref={selectionPanel}>
                  <h2>Your selection</h2>
                  {draft.label ? (
                    <p className={valid ? "ci-selected" : "ci-stale"}>
                      {valid ? "Selected: " : "Previous pick: "}
                      {draft.label}
                      {!valid && " — pick a model again for this task."}
                    </p>
                  ) : (
                    <p className="ci-hint">
                      No model selected yet. Choose one from the list above.
                    </p>
                  )}
                  {valid && verified && (
                    <>
                      <p className="ci-hint">
                        {verified.item.method === "benchmark_ranked"
                          ? `Benchmark-ranked · rank ${verified.item.rank} · score ${verified.item.score} · group ${verified.item.group}`
                          : "Supported, unranked — no recommendation claim."}
                      </p>
                      <details className="ci-details">
                        <summary>Source evidence</summary>
                        <CandidateEvidence item={verified.item} />
                      </details>
                    </>
                  )}
                  <label>
                    Project name
                    <input
                      required
                      maxLength={200}
                      value={draft.name}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, name: e.target.value }))
                      }
                    />
                  </label>
                </section>
                {profile &&
                  (profile.task === "other" ? (
                    <OtherFields
                      profile={profile}
                      fields={draft.fields}
                      onChange={(fields) =>
                        setDraft((d) => ({ ...d, fields, dirtyConfig: true }))
                      }
                    />
                  ) : (
                    <TaskFields
                      profile={profile}
                      fields={draft.fields}
                      onChange={(fields) =>
                        setDraft((d) => ({ ...d, fields, dirtyConfig: true }))
                      }
                    />
                  ))}
                <button
                  className="primary-action"
                  disabled={!valid || !draft.name.trim() || checking}
                >
                  Continue to Jenkins
                </button>
              </form>
            </>
          ) : step === "jenkins" ? (
            <>
              <h2>Connect Jenkins</h2>
              <p className="ci-hint">
                Tell Driftplain where the job lives. Your provider key stays in
                Jenkins; the configuration is saved when you continue.
              </p>
              <JenkinsConnectForm
                initialBaseUrl={jenkins.baseUrl}
                initialJobName={jenkins.jobName}
                onSubmit={connect}
                onUnauthorized={onUnauthorized}
              />
            </>
          ) : (
            project && (
              <>
                <ExecutionCommand
                  project={project}
                  onUnauthorized={onUnauthorized}
                />
                <button
                  className="primary-action"
                  onClick={() => {
                    clearDraft(intent.project);
                    navigate("/projects");
                  }}
                >
                  Done — view my CI agents
                </button>
              </>
            )
          )}
        </fieldset>
      </main>
    </>
  );
}
