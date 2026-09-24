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
  ) => (
    <label key={key}>
      {label}
      <textarea
        value={f[key]}
        maxLength={maxLength}
        required={required}
        rows={key === "instructions" ? 3 : 2}
        onChange={(e) => onChange({ ...f, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <section className="ci-panel">
      <h2>Task configuration</h2>
      {field(
        "instructions",
        "Additional instructions (optional)",
        false,
        16000,
      )}
      {profile.task === "ci_review" && (
        <>
          <p>
            Review receives only the prepared change diff. It cannot edit files
            or run tools.
          </p>
          {field("preferences", "Review preferences (optional)")}
        </>
      )}
      {profile.task === "security_analysis" && (
        <p>
          Security scans a bounded exported source tree, read only. Prepare it
          without .git, dependency trees, credentials or linked files. No diff
          or selected-artifact inputs.
        </p>
      )}
      {(profile.task === "test_generation" ||
        profile.task === "ci_failure_diagnosis") &&
        field("files", "Selected source files (one literal path per line)")}
      {profile.task === "test_generation" && (
        <>
          <p>
            {profile.language === "python"
              ? "Python requires pytest 9.0.3 and a complete literal suite. Plugin-dependent suites need a separately reviewed profile."
              : "Node requires Node 22 node:test and .test.js / .test.cjs / .test.mjs suites. Jest and Vitest are not this named profile."}{" "}
            Only new non-executable test files may be added. Existing source,
            tests and configuration stay immutable.
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
          )}
          <p>
            Prepare dependencies separately in this image; validation has no
            network or credentials. The committed lock must match the image.
            Zero tests, skips and unavailable validation cannot pass.
          </p>
        </>
      )}
      {profile.task === "ci_failure_diagnosis" && (
        <>
          {field("stage", "Failed upstream stage", true, 100)}
          {field("logArtifact", "Upstream log artifact path", true)}
          <p>
            The generated wrapper replaces this one upstream stage. Only its
            failed command can invoke diagnosis, once per build/stage. The
            original failure remains failed even if a proposed repair passes
            local checks.
          </p>
          {profile.proposeFix && (
            <>
              {field(
                "writePaths",
                "Exact existing production files permitted for repair",
                true,
              )}
              <p>
                Only reviewed source files under src/, app/ or lib/. No
                directories, new files, tests, configuration or dependency
                changes. No automatic commit or push.
              </p>
              {field("validationArgv", "Optional validation argv (JSON array)")}
              {field(
                "image",
                "Reviewed validation image (required when validation is configured)",
                !!f.validationArgv.trim(),
              )}
              <p>
                Without a configured validator, a repair stays explicitly
                unverified.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
