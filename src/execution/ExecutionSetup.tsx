import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { listProjects } from "../api/projects";
import { connectJenkins, getJenkins } from "../api/jenkins";
import { CatalogNav } from "../catalog/CatalogApp";
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
  fieldsFrom,
  loadDraft,
  profileFor,
  readIntent,
  saveDraft,
  selectionFor,
  taskNames,
  type Draft,
} from "./draft";
import { CandidateEvidence, EligibleModelPicker } from "./EligibleModelPicker";
import { TaskFields } from "./TaskFields";
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
  const profile = draft.task
    ? profileFor(draft.task, draft.language, draft.fix)
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
            language: c.policy.language ?? "python",
            fix: c.policy.proposeFix,
            name: p.name,
            fields: fieldsFrom(c.taskConfiguration ?? {}, c.reviewPreferences),
            selection: {
              ...profileFor(
                c.taskType,
                c.policy.language ?? "python",
                c.policy.proposeFix,
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
  ) {
    setDraft((d) => ({
      ...d,
      task,
      language,
      fix,
      selection: null,
      configuration: undefined,
      dirtyConfig: true,
      fields: {
        ...defaultFields(),
        instructions: d.fields.instructions,
        lockPath:
          language === "node" ? "package-lock.json" : "requirements.lock",
        writePaths: task === "ci_failure_diagnosis" ? "" : "tests",
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
  }
  const valid =
    !!profile &&
    !!draft.selection &&
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
  return (
    <>
      <CatalogNav />
      <main className="ci-setup">
        <p className="eyebrow">
          {intent.project ? "Edit CI project" : "Set up CI"}
        </p>
        <h1>Choose a task. Pick an exact model.</h1>
        <p>
          Only verified execution profiles can be selected. Catalog listings
          alone do not make a model runnable.
        </p>
        <div className="ci-actions">
          <Link href="/projects">Back to projects</Link>
          {step !== "pick" && (
            <button disabled={checking} onClick={() => setStep("pick")}>
              Edit task and model
            </button>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
        <fieldset disabled={checking}>
          {!loaded ? (
            <p role="status">Loading project…</p>
          ) : step === "pick" ? (
            <>
              {intent.model && (
                <aside className="ci-panel">
                  <p>
                    From Explorer:{" "}
                    {origin?.key === originKey
                      ? origin.name
                      : `Model #${intent.model}`}{" "}
                    {intent.evidence && `· exact evidence #${intent.evidence}`}
                  </p>
                  {origin?.error && <p role="alert">{origin.error}</p>}
                  <p>
                    Choose the task, then explicitly choose the hosting
                    deployment. Related variants are never substituted.
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
                <label>
                  Task
                  <select
                    aria-label="Task"
                    value={draft.task ?? ""}
                    onChange={(e) =>
                      changeProfile((e.target.value as Task) || null)
                    }
                  >
                    <option value="">Choose a task</option>
                    {Object.entries(taskNames).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                    <option disabled>
                      Other — custom authoring follows in B14
                    </option>
                  </select>
                </label>
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
              </section>
              {profile && (
                <EligibleModelPicker
                  key={JSON.stringify(profile)}
                  profile={profile}
                  onPick={pick}
                  onUnauthorized={onUnauthorized}
                  exact={{ model: intent.model, evidence: intent.evidence }}
                />
              )}
              <form onSubmit={continueSetup}>
                <section className="ci-panel">
                  <h2>Selected configuration</h2>
                  {draft.label ? (
                    <p>
                      {valid ? "Selected: " : "Previous pick: "}
                      {draft.label}
                      {!valid &&
                        " — revalidation or an explicit new pick is required."}
                    </p>
                  ) : (
                    <p>
                      No model selected. Choose a provider deployment and its
                      evidence above.
                    </p>
                  )}
                  {valid && verified && (
                    <>
                      <p>
                        {verified.item.method === "benchmark_ranked"
                          ? `Benchmark-ranked selection · rank ${verified.item.rank} · score ${verified.item.score} · group ${verified.item.group}`
                          : "Supported, unranked selection — no recommendation claim."}
                      </p>
                      <CandidateEvidence item={verified.item} />
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
                {profile && (
                  <TaskFields
                    profile={profile}
                    fields={draft.fields}
                    onChange={(fields) =>
                      setDraft((d) => ({ ...d, fields, dirtyConfig: true }))
                    }
                  />
                )}
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
              <p>
                Provider keys stay in Jenkins. Project configuration is saved
                when you continue.
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
                  Done — view projects
                </button>
              </>
            )
          )}
        </fieldset>
      </main>
    </>
  );
}
