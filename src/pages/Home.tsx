import { LogOut } from "lucide-react";
import { WelcomeSection } from "../components/home/WelcomeSection";
import { AppHeader } from "../components/AppHeader";

// One post-login hub. Both destinations are available immediately; small screens
// use normal document scrolling so no part of the illustration becomes inaccessible.
export function Home({ onViewAgents, onCreateAgent, onLogout }: {
  onViewAgents: () => void;
  onCreateAgent: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="home-page flex min-h-full flex-col">
      <AppHeader
        current="home"
        onNavigate={{ home: () => {}, setup: onCreateAgent, projects: onViewAgents }}
        actions={
          <button onClick={onLogout} aria-label="Log out" className="compact-action">
            <LogOut size={14} />
            <span className="hidden sm:inline">Log out</span>
          </button>
        }
      />
      <WelcomeSection onCreateAgent={onCreateAgent} onViewAgents={onViewAgents} />
    </div>
  );
}
