import { Check } from "lucide-react";

const SETUP_STEPS = [
  "Choose a task",
  "Pick a model",
  "Configure",
  "Connect Jenkins",
  "Add to pipeline",
] as const;

/** The whole happy path at a glance: done steps ticked, the current one highlighted. */
export function SetupSteps({ current }: { current: number }) {
  return (
    <ol className="ci-steps" aria-label="Setup progress">
      {SETUP_STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li
            key={label}
            className={`ci-step ci-step-${state}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="ci-step-marker" aria-hidden>
              {state === "done" ? <Check size={12} /> : n}
            </span>
            <span className="ci-step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
