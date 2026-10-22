import { ArrowRight, BarChart3, Gauge, GitPullRequest, PlugZap } from "lucide-react";
import { Link } from "../../catalog/navigation";
import { VALUE_PROP } from "../../lib/valueProp";

// The signed-in hub: the value prop, then the three things a user can do, in the
// order they usually happen. Each card is one click; no reading required.
export function WelcomeSection({ onCreateAgent, onViewAgents }: {
  onCreateAgent: () => void;
  onViewAgents: () => void;
}) {
  return (
    <main data-motion="paused" className="home-hub relative flex flex-1 flex-col overflow-hidden px-6 py-12 sm:px-12 sm:py-16">
      <div aria-hidden className="hero-glow" />
      <div className="relative mx-auto w-full max-w-5xl">
        <span className="eyebrow"><GitPullRequest size={15} /> AI that earns its place in your CI</span>
        <h1 className="mt-5 max-w-2xl text-balance text-4xl font-semibold leading-[1.1] tracking-[-0.045em] text-gray-50 sm:text-5xl">
          {VALUE_PROP.headline}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          {VALUE_PROP.sub}
        </p>

        <ol className="home-actions" aria-label="What you can do">
          <li>
            <Link href="/benchmarks" className="home-action" aria-describedby="home-action-explore">
              <span className="home-action-top">
                <span className="home-action-step">1</span>
                <BarChart3 size={20} className="home-action-icon" aria-hidden />
              </span>
              <span className="home-action-title">Explore benchmarks</span>
              <span id="home-action-explore" className="home-action-desc">
                Compare models on public benchmark results before you commit to one.
              </span>
              <span className="home-action-go">Browse <ArrowRight size={14} /></span>
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={onCreateAgent}
              className="home-action"
              aria-label="Set up a CI agent"
              aria-describedby="home-action-setup"
            >
              <span className="home-action-top">
                <span className="home-action-step">2</span>
                <PlugZap size={20} className="home-action-icon" aria-hidden />
              </span>
              <span className="home-action-title">Set up a CI agent</span>
              <span id="home-action-setup" className="home-action-desc">
                Pick a task and a model, then paste the generated stage into Jenkins.
              </span>
              <span className="home-action-go">Start <ArrowRight size={14} /></span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={onViewAgents}
              className="home-action"
              aria-label="View my CI agents"
              aria-describedby="home-action-agents"
            >
              <span className="home-action-top">
                <span className="home-action-step">3</span>
                <Gauge size={20} className="home-action-icon" aria-hidden />
              </span>
              <span className="home-action-title">View my CI agents</span>
              <span id="home-action-agents" className="home-action-desc">
                See usage, estimated cost and results for the agents you run.
              </span>
              <span className="home-action-go">Open <ArrowRight size={14} /></span>
            </button>
          </li>
        </ol>
        <p className="mt-8 text-xs text-muted">Your pipeline. Your API key. You stay in control.</p>
      </div>
    </main>
  );
}
