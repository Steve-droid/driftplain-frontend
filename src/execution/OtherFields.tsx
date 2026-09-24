import type { Profile } from "./api";
import type { Fields } from "./draft";
import { limits, otherConfig, templates } from "./other";
const limitNames: Record<string, string> = {
  maxBytes: "Total input bytes",
  maxFileBytes: "Bytes per file",
  maxContextTokens: "Context tokens",
  maxSeconds: "Wall time (seconds)",
  maxTokens: "Token ceiling",
  maxIterations: "Step ceiling",
  maxAttempts: "Attempt ceiling",
  maxProcesses: "Process ceiling",
  cpuMillis: "CPU (millicores)",
  memoryMiB: "Memory (MiB)",
  maxOutputBytes: "Output bytes",
};
export function OtherFields({
  profile,
  fields: f,
  onChange,
}: {
  profile: Profile;
  fields: Fields;
  onChange: (f: Fields) => void;
}) {
  const set = (k: keyof Fields, v: string) => onChange({ ...f, [k]: v });
  let error = "";
  let config;
  try {
    config = otherConfig(profile.mode, f);
  } catch (e) {
    error = e instanceof Error ? e.message : "Invalid custom configuration.";
  }
  return (
    <section className="ci-panel" aria-label="Custom task configuration">
      <h2>Define your custom task</h2>
      <label>
        Editable starter template
        <select
          value={f.template}
          onChange={(e) => set("template", e.target.value)}
        >
          <option value="">Choose a starting point</option>
          {Object.entries(templates).map(([k, t]) => (
            <option key={k} value={k}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!Object.hasOwn(templates, f.template)}
        onClick={() => {
          const t = templates[f.template as keyof typeof templates];
          if (t)
            onChange({
              ...f,
              label: t.label,
              systemPrompt: t.systemPrompt,
              instructions: t.instructions,
            });
        }}
      >
        Replace prompt text with template
      </button>
      <p>
        Templates replace the label and prompts only. Edit every word before
        saving; no benchmark is matched to this custom task.
      </p>
      <label>
        Task label
        <input
          required
          maxLength={100}
          value={f.label}
          onChange={(e) => set("label", e.target.value)}
        />
      </label>
      <label>
        System prompt
        <textarea
          required
          aria-label="System prompt"
          maxLength={8000}
          rows={5}
          value={f.systemPrompt}
          onChange={(e) => set("systemPrompt", e.target.value)}
        />
      </label>
      <label>
        Task instructions
        <textarea
          required
          aria-label="Task instructions"
          maxLength={16000}
          rows={7}
          value={f.instructions}
          onChange={(e) => set("instructions", e.target.value)}
        />
      </label>
      <p>
        Prompts are literal text. CI variables, shell expressions and template
        markers are not expanded. Prompts cannot grant execution permissions.
      </p>
      <label className="ci-checkbox">
        <input
          type="checkbox"
          checked={f.diff === "true"}
          onChange={(e) => set("diff", String(e.target.checked))}
        />
        Include prepared diff
      </label>
      <label>
        Input files (one literal relative file per line)
        <textarea
          maxLength={16000}
          value={f.files}
          onChange={(e) => set("files", e.target.value)}
        />
      </label>
      <label>
        Input artifacts (one literal name per line)
        <textarea
          maxLength={1300}
          value={f.artifacts}
          onChange={(e) => set("artifacts", e.target.value)}
        />
      </label>
      <p>
        Up to 100 files and 20 named artifacts, explicitly prepared by Jenkins.
        No directory uploads, globs, traversal or symlinks. Oversize inputs fail
        instead of being silently truncated.
      </p>
      {profile.mode === "opencode" && (
        <>
          <label>
            Permitted write paths (one per line)
            <textarea
              required
              maxLength={15500}
              value={f.writePaths}
              onChange={(e) => set("writePaths", e.target.value)}
            />
          </label>
          <label>
            Maintainer validation commands (JSON)
            <textarea
              maxLength={16000}
              rows={8}
              value={f.validationCommands}
              onChange={(e) => set("validationCommands", e.target.value)}
              spellCheck={false}
            />
          </label>
          <p>
            Up to five unique commands. Each needs id, argv (a literal string
            array), environmentImage (reviewed image@sha256:digest), required
            (true/false), and maxSeconds (1–600). An empty array means
            validation is not run.
          </p>
          <details>
            <summary>Validation example and isolation</summary>
            <pre>
              {JSON.stringify(
                [
                  {
                    id: "docs",
                    argv: ["python", "check_docs.py"],
                    environmentImage:
                      "registry/your-checks@sha256:" + "a".repeat(64),
                    required: true,
                    maxSeconds: 120,
                  },
                ],
                null,
                2,
              )}
            </pre>
            <p>
              Replace the example image with your own reviewed digest and
              preload it. Validation runs separately with no credentials,
              network or writable source. Dependencies must already be in the
              image. Command success is not evidence of named test coverage.
            </p>
          </details>
        </>
      )}
      <details>
        <summary>Input and resource limits</summary>
        {Object.entries(limits)
          .filter(
            ([k]) =>
              profile.mode === "opencode" ||
              !["maxIterations", "maxAttempts"].includes(k),
          )
          .map(([k, [, min, max]]) => (
            <label key={k}>
              {limitNames[k]}
              <input
                type="number"
                required
                min={min}
                max={max}
                step={1}
                value={f[k as keyof Fields]}
                onChange={(e) => set(k as keyof Fields, e.target.value)}
              />
            </label>
          ))}
      </details>
      <h3>Effective capabilities and output</h3>
      {profile.mode === "single_call" ? (
        <p>
          custom_single_call · One generation request. Report only; no tools,
          writes or executable validation.
        </p>
      ) : (
        <p>
          custom_opencode · Bounded tools and edits in a disposable copy,
          limited to the permitted paths. Returns a report and patch artifacts.
          Configured checks run again against the final patch. No automatic
          commit, push, PR or deployment.
        </p>
      )}
      {profile.mode === "opencode" && (
        <p>
          {config?.validationCommands?.length
            ? "Required failed or unavailable validation fails the check."
            : "No validation configured: changes are unverified; validation is not run, never passed."}
        </p>
      )}
      <details open>
        <summary>Exact prompt preview</summary>
        <h4>System prompt</h4>
        <pre aria-label="System prompt preview">{f.systemPrompt}</pre>
        <h4>Task instructions</h4>
        <pre aria-label="Task instructions preview">{f.instructions}</pre>
      </details>
      {error && <p role="status">Configuration incomplete: {error}</p>}
    </section>
  );
}
