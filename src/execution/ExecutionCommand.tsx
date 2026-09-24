import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import {
  getCommand,
  issueToken,
  type Command,
  type ExecutionProject,
} from "./api";
export function ExecutionCommand({
  project,
  onUnauthorized,
}: {
  project: ExecutionProject;
  onUnauthorized?: () => void;
}) {
  const [command, setCommand] = useState<Command | null>(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [issued, setIssued] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    getCommand(project.id)
      .then((c) => {
        if (live) setCommand(c);
      })
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
        setError(e instanceof Error ? e.message : "Could not load CI command.");
      });
    return () => {
      live = false;
    };
  }, [project.id, retry, onUnauthorized]);
  async function mint(rotate = false) {
    setBusy(true);
    setError("");
    try {
      const r = await issueToken(project.id, rotate);
      setToken(r.token);
      setIssued(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
      setError(e instanceof Error ? e.message : "Token request failed.");
    } finally {
      setBusy(false);
    }
  }
  const config = project.configuration;
  return (
    <section className="ci-panel">
      <h2>Versioned CI setup</h2>
      <p>
        Project #{project.id} · revision #{project.executionRevisionId} ·{" "}
        {config.model.name} · {config.model.providerModelId}
      </p>
      <p>
        Bind your provider credential to{" "}
        <code>{config.model.credentialEnvVar}</code> inside Jenkins. Driftplain
        does not collect the key.
      </p>
      <p>
        Set MODELMATCH_API_URL to your backend URL and MODELMATCH_PROJECT_ID to{" "}
        {project.id}. Bind the project token to MODELMATCH_CI_TOKEN. Keep
        BUILD_TAG stable for each actual build.
      </p>
      <p>
        Prepare job-private absolute DRIFTPLAIN_INPUTS and DRIFTPLAIN_SCRATCH
        directories outside the checkout. Keep them unique per build and archive
        the generated results. Supply change.diff in the inputs directory when a
        diff is configured.
      </p>
      {config.taskType === "security_analysis" ? (
        <p>
          Set DRIFTPLAIN_SOURCE to the bounded, credential-free source export.
          The scanner runs non-root on Linux cgroup v2, with the source read
          only and no engine socket.
        </p>
      ) : (
        config.executionMode === "opencode" && (
          <p>
            The trusted launcher needs Docker access and job-private scratch at
            the same absolute path on the worker and launcher. Editor and
            validator receive no CI token or Docker socket. Preload the reviewed
            digest-pinned editor and validation images.
          </p>
        )
      )}
      {config.taskType === "ci_failure_diagnosis" && (
        <p>
          Set DRIFTPLAIN_UPSTREAM_COMMAND to your original stage command.
          Replace that selected stage with the wrapper below; do not put it in a
          global failure hook.
        </p>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            onClick={() => {
              setError("");
              setRetry((n) => n + 1);
            }}
          >
            Recheck setup availability
          </button>
        </p>
      )}
      {command ? (
        <>
          <p>
            Command revision #{command.executionRevisionId}. Eligibility is
            checked again when the agent fetches its configuration.
          </p>
          <pre tabIndex={0} aria-label="Generated Jenkins configuration">
            {command.jenkinsStage ?? command.command}
          </pre>
        </>
      ) : (
        !error && <p role="status">Checking runtime and image pins…</p>
      )}
      <button
        className="secondary-action"
        disabled={busy || !command}
        onClick={() => mint()}
      >
        Get CI token
      </button>
      {token && (
        <>
          <p>
            Copy this token into Jenkins now. It is shown once and kept only in
            this page's memory.
          </p>
          <pre aria-label="CI token">{token}</pre>
          <button onClick={() => setToken(null)}>Hide token</button>
        </>
      )}
      {issued && !token && (
        <p>
          The token already exists or is hidden. Recover it from Jenkins, or
          rotate it below.
        </p>
      )}
      <details>
        <summary>Replace a lost token</summary>
        <p>
          Rotating immediately invalidates the old token. Update Jenkins with
          the replacement before the next run.
        </p>
        <button disabled={busy || !command} onClick={() => mint(true)}>
          Rotate and invalidate old token
        </button>
      </details>
    </section>
  );
}
