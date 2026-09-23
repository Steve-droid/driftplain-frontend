import { useCallback, useEffect, useState } from "react";
import { CatalogApp, CatalogNav } from "./catalog/CatalogApp";
import { useLocation } from "./catalog/navigation";
import { Loader2 } from "lucide-react";
import { ApiError, clearToken, getToken } from "./api/client";
import { listProjects } from "./api/projects";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import { Onboarding } from "./pages/Onboarding";
import { AuthLayout } from "./components/AuthLayout";
import { PageSurface } from "./components/PageSurface";
import { usePageTransition } from "./lib/usePageTransition";

type Phase = "loading" | "home" | "onboarding" | "dashboard";

// Top-level auth + navigation gate (no router yet). Token presence picks Login vs the
// app; once signed in, the user lands on the home hub (phase "home"), which routes into
// the dashboard or the create-agent flow. The existing agent
// (project) API validates the session before showing the hub. A 401 clears the token →
// Login. ("Agent" is the user-facing name for a project running the CI code-review
// agent — the data/types/API stay `project`.)
function AuthenticatedApp() {
  const [authed, setAuthed] = useState(() => getToken() !== null);
  // Which signed-out screen to show. Toggled by the Login/Register footer links; only
  // consulted while !authed (the auth gate below). Reset to "login" on sign-out
  // (handleUnauthorized) so a logout never strands the user on the register view.
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [phase, setPhase] = useState<Phase>("loading");
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  const { transition, cancel } = usePageTransition();

  const handleUnauthorized = useCallback(() => {
    cancel();
    setActiveProjectId(null);
    window.history.replaceState({ mmPhase: "home" }, "");
    clearToken();
    setAuthed(false);
    setAuthView("login");
  }, [cancel]);

  const handleAuthed = () => {
    window.history.replaceState({ mmPhase: window.location.pathname === "/setup" ? "onboarding" : window.location.pathname === "/projects" ? "dashboard" : "home" }, "");
    setPhase("loading");
    setAuthed(true);
  };

  // Deliberate sign-out from the home hub. Identical session-clear to the 401 path
  // (drop the token, fall back to Login) — aliased so the intent reads clearly.
  const handleLogout = handleUnauthorized;

  // Navigate between phases AND record it in browser history, so the browser Back/
  // Forward buttons move through the app (e.g. dashboard → home) instead of leaving the
  // site entirely. No router yet — this is the minimal history integration.
  const go = useCallback((next: Phase) => {
    transition(() => {
      setPhase(next);
      window.history.pushState({ mmPhase: next }, "");
      window.scrollTo?.({ top: 0, behavior: "instant" });
    }, next === "home" && phase === "onboarding" ? "back"
      : next === "onboarding" || phase === "onboarding" ? "forward" : "rise");
  }, [phase, transition]);

  // Restore the phase when the user presses Back/Forward.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const p = (e.state as { mmPhase?: Phase } | null)?.mmPhase;
      if (authed && (p === "home" || p === "onboarding" || p === "dashboard")) {
        transition(() => {
          setPhase(p);
          window.scrollTo?.({ top: 0, behavior: "instant" });
        }, p === "home" && phase === "onboarding" ? "back"
          : p === "onboarding" || phase === "onboarding" ? "forward" : "rise");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [authed, phase, transition]);

  // On sign-in (or a reload while signed in), validate the session using the projects
  // probe, then land on the RESTORED phase. `window.history.state` survives a reload and
  // the app records `mmPhase` there on every navigation, so a refresh on the dashboard
  // stays on the dashboard instead of always bouncing to home. First-ever load (no saved
  // state) defaults to the home hub.
  useEffect(() => {
    if (!authed) return;
    let live = true;
    const landOn = () => {
      const saved = (window.history.state as { mmPhase?: Phase } | null)?.mmPhase;
      const restored: Phase =
        saved === "dashboard" || saved === "onboarding" || saved === "home"
          ? saved
          : window.location.pathname === "/setup" ? "onboarding" : window.location.pathname === "/projects" ? "dashboard" : "home";
      // Seed the landing history entry only when there isn't one yet (replace, not push,
      // so Back from home leaves the app cleanly); on a reload we keep the saved entry.
      if (saved == null) window.history.replaceState({ mmPhase: restored }, "");
      transition(() => setPhase(restored));
    };
    listProjects()
      .then(() => {
        if (live) landOn();
      })
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401) handleUnauthorized();
        // Couldn't reach the backend — still land; the dashboard/onboarding
        // will surface the real error if the user enters them.
        else landOn();
      });
    return () => {
      live = false;
    };
  }, [authed, handleUnauthorized, transition]);

  if (!authed)
    return authView === "register" ? (
      <Register
        onAuthed={handleAuthed}
        onSignIn={() => setAuthView("login")}
      />
    ) : (
      <Login
        onAuthed={handleAuthed}
        onRegister={() => setAuthView("register")}
      />
    );

  if (phase === "loading") {
    return (
      <AuthLayout>
        <div role="status" className="flex min-h-64 items-center gap-3 text-sm text-muted">
          <Loader2 size={18} className="animate-spin text-accent" />
          Opening your workspace…
        </div>
      </AuthLayout>
    );
  }

  if (phase === "home") {
    return (
      <PageSurface key="home" name="Home"><Home
        onViewAgents={() => go("dashboard")}
        onCreateAgent={() => go("onboarding")}
        onLogout={handleLogout}
      /></PageSurface>
    );
  }

  if (phase === "onboarding") {
    return (
      <PageSurface key="onboarding" name="Set up a CI agent"><Onboarding
        onUnauthorized={handleUnauthorized}
        onHome={() => go("home")}
        // Always allow returning to the dashboard — with defer-create a project may
        // already exist mid-wizard (e.g. a CI-setup failure after create), so the user
        // must never be trapped on the wizard. An empty dashboard just shows the
        // "no agents yet" state.
        onCancel={() => go("dashboard")}
        onDone={(projectId) => {
          setActiveProjectId(projectId);
          go("dashboard");
        }}
      /></PageSurface>
    );
  }

  return (
    <PageSurface key="dashboard" name="CI agents dashboard"><Dashboard
      initialProjectId={activeProjectId}
      onNewProject={() => go("onboarding")}
      onHome={() => go("home")}
      onUnauthorized={handleUnauthorized}
    /></PageSurface>
  );
}


export function App() {
  const location = useLocation();
  const path = location.split("?")[0];
  const publicRoute = /^\/(benchmarks|models|compare|evidence)(\/|$)/.test(path);
  return publicRoute ? <><CatalogNav /><CatalogApp location={location} /></> : <AuthenticatedApp key={path} />;
}
