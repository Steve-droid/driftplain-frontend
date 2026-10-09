import type { Fields } from "./draft";
import type { Profile } from "./api";
export function TaskFields({
  profile,
  fields: f,
  onChange,
}: {
  profile: Profile;
  fields: Fields;
  onChange: (f: Fields) => void;
}) {
  const field = (
    key: keyof Fields,
    label: string,
    required = false,
    maxLength = 2000,
    hint?: string,
  ) => (
    <div key={key} className="ci-field">
      <label>
        {label}
        <textarea
          value={f[key]}
          maxLength={maxLength}
          required={required}
          rows={key === "instructions" ? 3 : 2}
          onChange={(e) => onChange({ ...f, [key]: e.target.value })}
        />
      </label>
      {hint && <p className="ci-hint">{hint}</p>}
    </div>
  );
  return (
    <section className="ci-panel">
      <h2>Configure the task</h2>
      {field(
        "instructions",
        "Additional instructions (optional)",
        false,
        16000,
      )}
      {profile.task === "ci_review" && (
        <>
          <p className="ci-hint">
            The reviewer only sees the prepared change diff. It cannot edit
            files or run tools.
          </p>
          {field("preferences", "Review preferences (optional)")}
        </>
      )}
      {profile.task === "security_analysis" && (
        <p className="ci-hint">
          The scanner reads a bounded source export, read only. Leave out
          .git, dependency trees, credentials and linked files.
        </p>
      )}
      {(profile.task === "test_generation" ||
        profile.task === "ci_failure_diagnosis") &&
        field("files", "Selected source files (one literal path per line)")}
      {profile.task === "test_generation" && (
        <>
          <p className="ci-hint">
            {profile.language === "python"
              ? "Python: pytest 9.0.3 with a complete literal suite (plugin-dependent suites need a separate profile)."
              : "Node: Node 22 node:test with .test.js / .test.cjs / .test.mjs suites (Jest and Vitest are not this profile)."}{" "}
            Only new test files are added; existing source, tests and
            configuration stay untouched.
          </p>
          {field(
            "writePaths",
            "Permitted new test directories (one per line)",
            true,
          )}
          {field("suitePaths", "Complete-suite paths (one per line)", true)}
          {field("lockPath", "Dependency lock path", true)}
          {field("lockHash", "Dependency lock SHA-256", true, 64)}
          {field(
            "image",
            "Reviewed validation image (with @sha256 digest)",
            true,
            2000,
            "Install dependencies in this image beforehand; validation runs with no network or credentials, and the lock must match. Zero tests, skips or an unavailable validator cannot pass.",
          )}
        </>
      )}
      {profile.task === "ci_failure_diagnosis" && (
        <>
          {field("stage", "Failed upstream stage", true, 100)}
          {field(
            "logArtifact",
            "Upstream log artifact path",
            true,
            2000,
            "The generated wrapper replaces this one stage. Only its failed command triggers a diagnosis, once per build; the original failure stays failed even if a proposed repair passes local checks.",
          )}
          {profile.proposeFix && (
            <>
              {field(
                "writePaths",
                "Exact existing production files permitted for repair",
                true,
                2000,
                "Reviewed source files under src/, app/ or lib/ only. No directories, new files, tests, configuration or dependency changes; nothing is committed or pushed.",
              )}
              {field("validationArgv", "Optional validation argv (JSON array)")}
              {field(
                "image",
                "Reviewed validation image (required when validation is configured)",
                !!f.validationArgv.trim(),
                2000,
                "Without a configured validator, a repair stays explicitly unverified.",
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
