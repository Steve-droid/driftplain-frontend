vi.mock("../../api/google", () => ({ googleConfig: vi.fn().mockResolvedValue({ enabled: false }) }));
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { App } from "../../App";
import { ApiError, clearToken, getToken, setToken } from "../../api/client";
import { VALUE_PROP } from "../../lib/valueProp";
import { projectsFixture, savingsFixture, chatHistoryFixture } from "../../test/fixtures";

vi.mock("../../api/projects", () => ({ listProjects: vi.fn(), createProject: vi.fn() }));
import { listProjects } from "../../api/projects";
vi.mock("../../api/savings", () => ({
  getSavings: vi.fn(),
  getRunFindings: vi.fn().mockResolvedValue({ runId: 0, findings: [] }),
}));
import { getSavings } from "../../api/savings";
vi.mock("../../api/chat", () => ({ getChatHistory: vi.fn(), postChat: vi.fn() }));
import { getChatHistory } from "../../api/chat";
// The signed-out screens call the real login/register; stub them so the routing tests
// can drive the auth toggle + onAuthed hand-off without a backend.
vi.mock("../../api/auth", () => ({ login: vi.fn(), register: vi.fn() }));
import { login, register } from "../../api/auth";

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  clearToken();
  // App now restores its phase from window.history.state (so a reload stays on the
  // dashboard). jsdom persists that across tests in a file, so reset it to mimic a fresh
  // page load — otherwise one test's navigation leaks into the next.
  window.history.replaceState(null, "", "/");
  vi.mocked(listProjects).mockReset();
  vi.mocked(getSavings).mockReset();
  vi.mocked(getChatHistory).mockReset();
  vi.mocked(login).mockReset();
  vi.mocked(register).mockReset();
});

describe("App routing", () => {
  it("shows Login when there is no token", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("lands on the home hub (value prop) after sign-in", async () => {
    setToken("jwt");
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    render(<App />);
    // the home hero shows the value prop headline
    expect(await screen.findByRole("heading", { name: VALUE_PROP.headline })).toBeInTheDocument();
  });

  it("home → View my agents lands on the dashboard", async () => {
    setToken("jwt");
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    vi.mocked(getSavings).mockResolvedValue(savingsFixture);
    vi.mocked(getChatHistory).mockResolvedValue(chatHistoryFixture);
    render(<App />);

    fireEvent.click((await screen.findAllByRole("button", { name: /view my ci agents/i }))[0]);
    // the dashboard's agent switcher is the tell
    expect(await screen.findByLabelText("Select CI-Agent")).toBeInTheDocument();
  });

  it("a new user can open setup directly from the home hero", async () => {
    setToken("jwt");
    vi.mocked(listProjects).mockResolvedValue([]);
    render(<App />);

    fireEvent.click((await screen.findAllByRole("button", { name: /set up a ci agent/i }))[0]);
    expect(await screen.findByRole("heading", { name: "Choose a task. Pick an exact model." })).toBeInTheDocument();
  });

  it("the dashboard logo returns to the home hub", async () => {
    setToken("jwt");
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    vi.mocked(getSavings).mockResolvedValue(savingsFixture);
    vi.mocked(getChatHistory).mockResolvedValue(chatHistoryFixture);
    render(<App />);

    fireEvent.click((await screen.findAllByRole("button", { name: /view my ci agents/i }))[0]);
    await screen.findByLabelText("Select CI-Agent");
    fireEvent.click(screen.getByRole("button", { name: /^home$/i }));
    expect(await screen.findByRole("heading", { name: VALUE_PROP.headline })).toBeInTheDocument();
  });

  it("returns to Login when the projects probe 401s", async () => {
    setToken("jwt");
    vi.mocked(listProjects).mockRejectedValue(new ApiError(401, "expired"));
    render(<App />);
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("logging out from the home hub clears the token and returns to Login", async () => {
    setToken("jwt");
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    render(<App />);
    await screen.findByRole("heading", { name: VALUE_PROP.headline });

    fireEvent.click(screen.getByRole("button", { name: /log out/i }));

    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });
});

describe("App auth-view toggle", () => {
  function fillRegister(email: string, password: string) {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: password },
    });
  }

  it("the Login 'Sign up' link switches to the Register view", () => {
    render(<App />);
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    // Register is the only auth screen with a confirm-password field + Create account.
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("Register's onAuthed runs the SAME authed → home/project-probe flow as Login", async () => {
    // register → auto-login resolves a token → onAuthed → the projects probe → home hub,
    // exactly like the Login path.
    vi.mocked(register).mockResolvedValue({ id: 1, email: "new@example.com" , chatEnabled: false });
    vi.mocked(login).mockResolvedValue({ accessToken: "jwt-reg", tokenType: "bearer" });
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
    fillRegister("new@example.com", "hunter2");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByRole("heading", { name: VALUE_PROP.headline }),
    ).toBeInTheDocument();
    expect(listProjects).toHaveBeenCalled();
  });

  it("Register's 'Sign in' link toggles back to the Login view", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});

// Browsers may defer a transition's DOM callback until after it was skipped.
// Exercise real App navigation against that ordering, especially sign-out.
describe("Navigation transitions", () => {
  const originalTransition = Object.getOwnPropertyDescriptor(document, "startViewTransition");
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  afterEach(() => {
    if (originalTransition) Object.defineProperty(document, "startViewTransition", originalTransition);
    else Reflect.deleteProperty(document, "startViewTransition");
    if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
    else Reflect.deleteProperty(window, "matchMedia");
  });

  function deferTransitions(reduced = false) {
    const updates: Array<() => void> = [];
    const skipped = vi.fn();
    const start = vi.fn((update: () => void) => {
      updates.push(update);
      return { skipTransition: skipped, ready: Promise.resolve(), finished: new Promise(() => {}) };
    });
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: start });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: reduced }) });
    return { updates, skipped, start };
  }

  it("a skipped pending navigation cannot restore protected content after sign-out", async () => {
    const { updates, skipped } = deferTransitions();
    setToken("jwt");
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    render(<App />);
    await waitFor(() => expect(updates).toHaveLength(1));
    act(() => updates.shift()!());
    fireEvent.click(screen.getAllByRole("button", { name: /view my ci agents/i })[0]);
    expect(updates).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    act(() => updates.shift()!());
    expect(skipped).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "CI agents dashboard" })).not.toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  it("the most recent destination wins when navigation is requested twice before a snapshot", async () => {
    const { updates } = deferTransitions();
    setToken("jwt");
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    render(<App />);
    await waitFor(() => expect(updates).toHaveLength(1));
    act(() => updates.shift()!());
    fireEvent.click(screen.getAllByRole("button", { name: /view my ci agents/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /set up a ci agent/i })[0]);
    act(() => { for (const update of updates) update(); });
    expect(screen.getByRole("heading", { name: "Choose a task. Pick an exact model." })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/setup");
    expect(getSavings).not.toHaveBeenCalled();
  });

  it("reduced motion navigates immediately without capturing snapshots", async () => {
    const { start } = deferTransitions(true);
    setToken("jwt");
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /set up a ci agent/i }))[0]);
    expect(screen.getByRole("heading", { name: "Choose a task. Pick an exact model." })).toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();
  });

  it("a fresh sign-in lands at home even after a previous dashboard session", async () => {
    window.history.replaceState({ mmPhase: "dashboard" }, "");
    vi.mocked(login).mockResolvedValue({ accessToken: "new-jwt", tokenType: "bearer" });
    vi.mocked(listProjects).mockResolvedValue(projectsFixture);
    render(<App />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("region", { name: "Home" })).toBeInTheDocument();
    expect(window.history.state.mmPhase).toBe("home");
  });
});
