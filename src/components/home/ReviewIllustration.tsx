import { ArrowDown, Check, GitPullRequest, ShieldCheck, Sparkles } from "lucide-react";
import { HOW_IT_WORKS_STEPS } from "../../lib/valueProp";

/** A conceptual example, deliberately separate from real account metrics. */
export function ReviewIllustration() {
  return (
    <figure className="review-illustration" aria-label="Illustration: find a model, review a pull request, and track reported usage and results">
      <figcaption className="mb-6 flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
        <span>A pull request, reimagined</span><span className="rounded-full border border-border px-2.5 py-1 tracking-[0.1em]">Illustrative flow</span>
      </figcaption>
      <div className="illustration-stage illustration-model">
        <div className="flex items-center gap-3">
          <span className="illustration-icon text-accent"><Sparkles size={19} /></span>
          <div><p className="text-xs text-muted">01 / {HOW_IT_WORKS_STEPS[0]}</p><p className="mt-1 text-sm font-medium">Compare source-backed results</p></div>
        </div>
        <div className="mt-5 flex gap-2" aria-hidden>
          <span className="model-chip">Benchmark</span><span className="model-chip">Version</span><span className="model-chip">Source</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-signal"><Check size={14} /> Selected</span>
        </div>
      </div>
      <div className="illustration-connector" aria-hidden><ArrowDown size={16} /></div>
      <div className="illustration-stage illustration-review">
        <div className="flex items-center gap-3">
          <span className="illustration-icon text-signal"><GitPullRequest size={19} /></span>
          <div><p className="text-xs text-muted">02 / {HOW_IT_WORKS_STEPS[1]}</p><p className="mt-1 text-sm font-medium">A second look at every change</p></div>
        </div>
        <div className="mt-5 space-y-2 border-l border-border pl-4" aria-hidden>
          <div className="code-line w-4/5" /><div className="code-line w-3/5" />
          <div className="review-line flex items-center gap-2 rounded-md bg-signal/10 px-2 py-2 text-[11px] text-signal"><Check size={12} /> Review complete</div>
        </div>
      </div>
      <div className="illustration-connector" aria-hidden><ArrowDown size={16} /></div>
      <div className="illustration-stage illustration-savings">
        <div className="flex items-center gap-3">
          <span className="illustration-icon text-banked"><ShieldCheck size={19} /></span>
          <div><p className="text-xs text-muted">03 / {HOW_IT_WORKS_STEPS[2]}</p><p className="mt-1 text-sm font-medium">Usage, estimated cost and findings.</p></div>
        </div>
        <div className="mt-5 grid grid-cols-[65px_1fr] items-center gap-x-3 gap-y-2.5 text-[11px] text-muted" aria-hidden>
          <span>Input</span><span className="h-1.5 rounded-full bg-gray-600" />
          <span>Output</span><span className="savings-bar h-1.5 w-1/3 rounded-full bg-signal" />
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted">Estimates show their limits. Feedback is not a quality guarantee.</p>
      </div>
    </figure>
  );
}
