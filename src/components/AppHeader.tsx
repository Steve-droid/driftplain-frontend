import type { MouseEvent, ReactNode } from "react";
import { Link } from "../catalog/navigation";
import { getToken } from "../api/client";
import { BRAND_NAME } from "../lib/brand";
import markUrl from "../assets/brand/driftplain-mark.svg";

export type AppSection = "benchmarks" | "setup" | "projects" | "home";

/** A setup page can send people to the explorer and back without losing its draft. */
function setupDestination() {
  const back = new URLSearchParams(window.location.search).get("setupReturn");
  return back && /^\/setup(?:\?|$)/.test(back) ? back : null;
}

/**
 * The one header every page shares: brand, the three destinations, page actions.
 * Signed-in hub pages pass `onNavigate` so moving between their own phases keeps the
 * in-app transition instead of reloading the workspace through the URL.
 */
export function AppHeader({
  current,
  actions,
  onNavigate = {},
}: {
  current?: AppSection;
  actions?: ReactNode;
  onNavigate?: Partial<Record<AppSection, () => void>>;
}) {
  const signedIn = getToken() !== null;
  const setupReturn = setupDestination();
  const page = (section: AppSection) =>
    current === section ? ("page" as const) : undefined;
  const handle = (section: AppSection) => (e: MouseEvent) => {
    const go = onNavigate[section];
    if (!go || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go();
  };
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link
          href={signedIn ? "/" : "/benchmarks"}
          className="app-brand"
          aria-label={`${BRAND_NAME} home`}
          onClick={handle("home")}
        >
          <span className="app-brand-mark">
            <img src={markUrl} alt="" className="h-4 w-4" />
          </span>
          {BRAND_NAME}
        </Link>
        <nav className="app-nav" aria-label="Main navigation">
          <Link href="/benchmarks" aria-current={page("benchmarks")}>
            Explore Benchmarks
          </Link>
          <Link
            href={setupReturn ?? "/setup"}
            aria-current={page("setup")}
            onClick={handle("setup")}
          >
            {setupReturn ? "Return to CI setup" : "Set Up CI"}
          </Link>
          <Link
            href="/projects"
            aria-current={page("projects")}
            onClick={handle("projects")}
          >
            My Projects
          </Link>
        </nav>
        <div className="app-header-actions">
          {actions ??
            (!signedIn && (
              <Link href="/" className="compact-action">
                Sign in
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}
