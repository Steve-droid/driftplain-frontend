import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, RotateCw, ShieldAlert, Terminal } from "lucide-react";
import type { CiSetup } from "../../types/ci";
import { getCiSetup, rotateCiToken } from "../../api/ci";
import { ApiError } from "../../api/client";

// E20: the stage is generated PER TASK (review image over the PR diff vs the security
// image over a read-only checkout); the copy names which one, and says what both
// have in common — the agent fetches its config from Driftplain at run time.
function copyForTask(setup: CiSetup | null): { title: string; blurb: string; note: string } {
  if (setup?.task === "security") {
    return {
      title: "Add the security stage to your pipeline",
      blurb:
        "Scans the whole checkout (mounted read-only) for vulnerabilities and posts each run. A critical finding fails the stage.",
      note:
        "The agent fetches this project's model from Driftplain on every run and posts the result itself — nothing else to wire.",
    };
  }
  return {
    title: "Add the review stage to your pipeline",
    blurb:
      "Reviews each pull request's diff for security and style issues and reports findings and token usage.",
    note:
      "The agent fetches this project's model and review preferences from Driftplain on every run, so changing them here applies on the next build without editing the pipeline.",
  };
}

// Fetches and shows the Jenkins stage snippet + the per-project ingest token. The
// token is mint-once: shown clearly "copy now" when present, explained as already
// minted when null. "Go to dashboard" advances to the new project's dashboard.
export function CiSetupView({
  projectId,
  onDone,
  onUnauthorized,
}: {
  projectId: number;
  onDone: () => void;
  onUnauthorized?: () => void;
}) {
  const [setup, setSetup] = useState<CiSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  // Regenerate a lost mint-once token: issue a fresh one and show it (the old token
  // stops working). The recovery for "minted but never copied".
  const regenerate = useCallback(() => {
    setRotating(true);
    setError(null);
    rotateCiToken(projectId)
      .then(setSetup)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
        else if (e instanceof ApiError) setError(e.message);
        else setError("Could not reach the backend.");
      })
      .finally(() => setRotating(false));
  }, [projectId, onUnauthorized]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getCiSetup(projectId)
      .then(setSetup)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
        else if (e instanceof ApiError) setError(e.message);
        else setError("Could not reach the backend.");
      })
      .finally(() => setLoading(false));
  }, [projectId, onUnauthorized]);

  // GET /ci-setup is MINT-ONCE (the plaintext token is returned only on the first
  // call), so the automatic fetch must fire exactly once per project — not twice. A
  // projectId-keyed ref guards against React StrictMode's double-invoke (and any
  // incidental remount) burning the token before we can show it. A *manual* retry
  // (below) is safe: a failed fetch didn't mint, and a re-mint just yields the
  // already-minted (null-token) case, never a stranded screen.
  const fetchedFor = useRef<number | null>(null);
  useEffect(() => {
    if (fetchedFor.current === projectId) return;
    fetchedFor.current = projectId;
    load();
  }, [projectId, load]);

  const copy = copyForTask(setup);

  return (
    <div className="card flex flex-col gap-5 p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-signal/15 text-signal">
          <Terminal size={15} />
        </span>
        <div className="leading-tight">
          <div className="text-lg font-semibold">{copy.title}</div>
          <div className="text-sm text-faint">{copy.blurb}</div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" />
          Loading setup…
        </div>
      )}
      {error && !loading && (
        <div className="flex flex-col gap-2">
          <div className="rounded-xl border border-risk/40 bg-risk/10 px-3 py-2 text-sm text-risk">
            {error}
          </div>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 self-start rounded-xl border border-border bg-panel-2 px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-gray-100"
          >
            <RotateCw size={14} />
            Retry
          </button>
        </div>
      )}

      {setup && !loading && (
        <>
          {/* the mint-once token */}
          {setup.token ? (
            <div className="rounded-xl border border-unrated/40 bg-unrated/10 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-unrated">
                <ShieldAlert size={13} />
                CI token, shown once. Copy it now, it can't be retrieved again.
              </div>
              <code className="num mt-1 block break-all text-sm text-gray-100">
                {setup.token}
              </code>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-panel-2 px-3 py-2.5">
              <p className="text-xs text-muted">
                CI token was already minted for this project and can't be shown again. If
                you didn't copy it, regenerate a fresh one. The old token stops working.
              </p>
              <button
                type="button"
                onClick={regenerate}
                disabled={rotating}
                className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-gray-100 disabled:opacity-40"
              >
                {rotating ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                Regenerate token
              </button>
            </div>
          )}

          {/* the snippet */}
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-muted">Jenkins stage</span>
              <span className="text-xs text-faint">{copy.note}</span>
            </div>
            <pre className="max-h-[26rem] overflow-auto rounded-xl border border-border bg-panel-2 p-4 text-xs leading-relaxed text-gray-200">
              <code>{setup.snippet}</code>
            </pre>
          </div>

          <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            <div className="flex gap-1.5">
              <dt className="text-faint">Image:</dt>
              <dd className="num truncate text-signal">{setup.imageRef}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-faint">Ingest URL:</dt>
              <dd className="num truncate text-gray-300">{setup.ciRunsUrl}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={onDone}
            className="primary-action self-start"
          >
            Go to dashboard
            <ArrowRight size={15} />
          </button>
        </>
      )}
    </div>
  );
}
