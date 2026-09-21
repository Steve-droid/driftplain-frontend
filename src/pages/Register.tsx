import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { login, register } from "../api/auth";
import { ApiError, setToken } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { GoogleSignIn } from "../components/GoogleSignIn";
import { PasswordField } from "../components/PasswordField";

// Sign-up screen. Creates the account, then logs in to obtain a JWT (register itself
// returns the new user, not a token) and hands off to the app — same auto-land as Login.
// Shares the Login layout; onSignIn returns to the Login
// page for an existing account.
export function Register({
  onAuthed,
  onSignIn,
}: {
  onAuthed: () => void;
  onSignIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The account was created but the chained auto-login failed — a recoverable state the
  // user can resolve by signing in (distinct from a register failure, where there's no
  // account yet). Renders a reassuring notice + a "Go to sign in" affordance.
  const [registeredNeedsLogin, setRegisteredNeedsLogin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passwordsMatch = confirm === "" || password === confirm;
  const canSubmit =
    email.trim() !== "" && password !== "" && password === confirm && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setRegisteredNeedsLogin(false);
    let registered = false;
    try {
      await register(email.trim(), password);
      registered = true;
      // Register returns { id, email } — no token. Log in to obtain the JWT, then
      // persist it and land exactly like the Login flow (auto sign-in after sign-up).
      const { accessToken } = await login(email.trim(), password);
      setToken(accessToken);
      onAuthed();
    } catch (err: unknown) {
      // The account WAS created but the auto-login step failed — don't make it look like
      // sign-up failed; reassure the user and point them at sign-in.
      if (registered) {
        setRegisteredNeedsLogin(true);
      } else if (err instanceof ApiError && err.code === "registration_capacity_reached")
        setError(err.message);
      else if (err instanceof ApiError && err.status === 409)
        setError("That email is already registered. Try signing in instead.");
      else if (err instanceof ApiError && err.status === 422)
        setError("Please enter a valid email and password.");
      else if (err instanceof ApiError) setError(err.message);
      else setError("Could not reach the backend.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
        <div className="mb-9">
          <p className="eyebrow">GET STARTED</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">Your next CI agent starts here.</p>
        </div>

        <GoogleSignIn onAuthed={onAuthed} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-300">
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="you@example.com"
            />
          </label>

          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

          {!passwordsMatch && (
            <div className="text-xs text-unrated">Passwords don't match.</div>
          )}

          {error && (
            <div role="alert" className="rounded-md border border-risk/40 bg-risk/10 px-3 py-2 text-sm text-risk">
              {error}
            </div>
          )}

          {registeredNeedsLogin && (
            <div className="rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-muted">
              Your account was created, but we couldn't sign you in automatically.{" "}
              <button
                type="button"
                onClick={onSignIn}
                className="font-medium text-accent transition-opacity hover:opacity-90"
              >
                Go to sign in
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="primary-action mt-2 w-full"
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <UserPlus size={15} />
            )}
            Create account
          </button>
        </form>

        <div className="mt-7 text-center text-sm text-muted">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSignIn}
            className="font-medium text-accent transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </div>
    </AuthLayout>
  );
}
