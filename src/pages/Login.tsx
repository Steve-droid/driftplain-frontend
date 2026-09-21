import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { login } from "../api/auth";
import { ApiError, setToken } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { GoogleSignIn } from "../components/GoogleSignIn";
import { PasswordField } from "../components/PasswordField";

// Exchange credentials for a JWT, then open the home hub. Authentication forms
// share a responsive branded canvas; API/error behavior stays local to each form.
export function Login({
  onAuthed,
  onRegister,
}: {
  onAuthed: () => void;
  onRegister: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim() !== "" && password !== "" && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { accessToken } = await login(email.trim(), password);
      setToken(accessToken);
      onAuthed();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401)
        setError("Invalid email or password.");
      else if (err instanceof ApiError) setError(err.message);
      else setError("Could not reach the backend.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
        <div className="mb-9">
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">Sign in to your Driftplain workspace.</p>
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

          <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />

          {error && (
            <div role="alert" className="rounded-md border border-risk/40 bg-risk/10 px-3 py-2 text-sm text-risk">
              {error}
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
              <LogIn size={15} />
            )}
            Sign in
          </button>
        </form>

        <div className="mt-7 text-center text-sm text-muted">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={onRegister}
            className="font-medium text-accent transition-opacity hover:opacity-90"
          >
            Sign up
          </button>
        </div>
    </AuthLayout>
  );
}
