import { ArrowRight, GitPullRequest } from "lucide-react";
import { VALUE_PROP } from "../../lib/valueProp";
import { ReviewIllustration } from "./ReviewIllustration";

export function WelcomeSection({ onCreateAgent, onViewAgents }: {
  onCreateAgent: () => void;
  onViewAgents: () => void;
}) {
  return (
    <main className="home-hero relative flex flex-1 flex-col justify-center overflow-hidden px-6 py-10 sm:px-12">
      <div aria-hidden className="hero-glow" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.12fr_1fr] lg:gap-16">
        <div>
          <span className="eyebrow"><GitPullRequest size={15} /> AI that earns its place in your CI</span>
          <h1 className="mt-6 max-w-xl text-balance text-4xl font-semibold leading-[1.1] tracking-[-0.045em] text-gray-50 sm:text-5xl xl:text-6xl">
            {VALUE_PROP.headline}
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            {VALUE_PROP.sub}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <button onClick={onCreateAgent} className="primary-action">Set up a CI agent <ArrowRight size={16} /></button>
            <button onClick={onViewAgents} className="secondary-action">View my CI agents</button>
          </div>
          <p className="mt-5 text-xs text-muted">Your pipeline. Your API key. You stay in control.</p>
        </div>
        <ReviewIllustration />
      </div>
    </main>
  );
}
