import { Link } from "../catalog/navigation";
import { BRAND_NAME } from "../lib/brand";
import { LogOut } from "lucide-react";
import { WelcomeSection } from "../components/home/WelcomeSection";
import markUrl from "../assets/brand/driftplain-mark.svg";

// One post-login hub. Both destinations are available immediately; small screens
// use normal document scrolling so no part of the illustration becomes inaccessible.
export function Home({ onViewAgents, onCreateAgent, onLogout }: {
  onViewAgents: () => void;
  onCreateAgent: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="home-page flex min-h-full flex-col">
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-panel">
            <img src={markUrl} alt="" className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">{BRAND_NAME}</span>
        </div>
        <nav aria-label="Main navigation" className="flex flex-wrap gap-3 px-3 text-xs sm:gap-6 sm:text-sm">
          <Link href="/benchmarks">Explore Benchmarks</Link>
          <button onClick={onCreateAgent}>Set Up CI</button>
          <button onClick={onViewAgents}>My Projects</button>
        </nav>
        <button onClick={onLogout} aria-label="Log out"
          className="flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-muted transition-colors hover:border-muted hover:text-gray-100">
          <LogOut size={15} />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </header>
      <WelcomeSection onCreateAgent={onCreateAgent} onViewAgents={onViewAgents} />
    </div>
  );
}
