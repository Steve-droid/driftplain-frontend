import { useId, useState } from "react";
import {
  FlaskConical,
  GitPullRequest,
  Info,
  PenLine,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import type { Task } from "./api";
import { taskDescriptions, taskNames } from "./draft";

const icons: Record<Task, typeof Info> = {
  ci_review: GitPullRequest,
  security_analysis: ShieldCheck,
  test_generation: FlaskConical,
  ci_failure_diagnosis: Stethoscope,
  other: PenLine,
};

/**
 * One short sentence on hover or focus; a tap on the info icon pins it open for touch.
 * The description is also the radio's accessible description, so screen readers hear it.
 */
function Tip({ id, text }: { id: string; text: string }) {
  const [pinned, setPinned] = useState(false);
  return (
    <span className={`ci-tip${pinned ? " ci-tip-open" : ""}`}>
      <button
        type="button"
        className="ci-tip-trigger"
        aria-label="What does this task do?"
        aria-expanded={pinned}
        onClick={() => setPinned((v) => !v)}
        onBlur={() => setPinned(false)}
      >
        <Info size={14} aria-hidden />
      </button>
      <span role="tooltip" id={id} className="ci-tip-bubble">
        {text}
      </span>
    </span>
  );
}

export function TaskPicker({
  value,
  onChange,
}: {
  value: Task | null;
  onChange: (task: Task) => void;
}) {
  const base = useId();
  return (
    <fieldset className="ci-tasks" aria-label="Task">
      {(Object.keys(taskNames) as Task[]).map((task) => {
        const Icon = icons[task];
        const tip = `${base}-${task}`;
        return (
          <div
            key={task}
            className={`ci-task${value === task ? " ci-task-selected" : ""}`}
          >
            <label>
              <input
                type="radio"
                name={`${base}-task`}
                value={task}
                checked={value === task}
                aria-describedby={tip}
                onChange={() => onChange(task)}
              />
              <span className="ci-task-icon">
                <Icon size={18} aria-hidden />
              </span>
              <span className="ci-task-name">{taskNames[task]}</span>
            </label>
            <Tip id={tip} text={taskDescriptions[task]} />
          </div>
        );
      })}
    </fieldset>
  );
}
