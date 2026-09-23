import { Link } from "../catalog/navigation";
import { BRAND_NAME } from "../lib/brand";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { ModelNamesBackdrop } from "./home/ModelNamesBackdrop";
import markUrl from "../assets/brand/driftplain-mark.svg";

/** Shared canvas keeps sign-in, registration, and the session probe visually continuous. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <div aria-hidden className="auth-glow" />
        <div className="relative z-10 flex items-center gap-3 text-lg font-semibold tracking-tight">
          <img src={markUrl} alt="" className="h-8 w-8" />
          {BRAND_NAME}
        </div>
        <ModelNamesBackdrop position="above" />
        <div className="auth-message relative z-10">
          <p className="text-balance text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-gray-50 lg:text-6xl">
            Great reviews.<br />{" "}
            <span className="text-signal">Less spend.</span>
          </p>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-muted">
            Find a model for your CI, put it to work, and see the savings backed by quality.
          </p>
          <div className="mt-10 flex items-center gap-3 text-xs text-muted">
            <span className="h-px w-8 bg-signal/60" />
            Your pipeline. Your API key. Your control.
          </div>
        </div>
        <ModelNamesBackdrop position="below" />
        <div className="relative z-10 hidden items-center gap-2 text-xs text-muted md:flex">
          Built for your next pull request <ArrowUpRight size={14} />
        </div>
      </div>
      <div className="auth-form-panel">
        <div className="w-full max-w-sm">
          {children}
          <p className="mt-6 text-center text-sm"><Link href="/benchmarks" className="text-accent">Explore Benchmarks — no account needed</Link></p>
          <p className="mt-6 text-center text-xs text-muted">
            <a href="/privacy.html" className="underline underline-offset-4 hover:text-accent">Privacy policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
