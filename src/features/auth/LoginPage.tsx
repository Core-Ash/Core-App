import { useRef, useState, type SubmitEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "./auth-context";
import { AuthLayout } from "./components/AuthLayout";
import { AuthConfigurationNotice } from "./components/AuthConfigurationNotice";
import { PasswordInput } from "./components/PasswordInput";
import { confirmSession } from "./confirm-session";
import {
  signInErrorMessage,
  validateLogin,
  type LoginErrors,
} from "./login-validation";
import { getReturnPath } from "./return-path";

export function LoginPage() {
  const { client, configurationError, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const errors = validateLogin({ email, password });
    setFieldErrors(errors);
    setAuthError(null);
    if (errors.email || errors.password) {
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    if (!client) {
      setAuthError(
        configurationError ??
          "Sign-in is unavailable. Configure VITE_AUTH_URL and restart the development server.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await client.signIn.email(
        { email: email.trim(), password, rememberMe: true },
        { disableSignal: true },
      );
      if (error) {
        setAuthError(signInErrorMessage(error));
        return;
      }

      try {
        const session = await confirmSession(client);
        if (!session) {
          setAuthError(
            "We couldn't keep you signed in. Allow cookies for this site and try again.",
          );
          return;
        }
      } catch {
        setAuthError(
          "We couldn't confirm your session. Check your connection and try signing in again.",
        );
        return;
      }
      await refresh();
      navigate(getReturnPath(location.state), { replace: true });
    } catch {
      setAuthError(
        "We couldn't reach the sign-in service. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back."
      description="Your people, your conversations, your space."
      footer={
        <>
          New to Core?{" "}
          <Link
            to="/register"
            state={{ from: getReturnPath(location.state) }}
            className="rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign up
          </Link>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        aria-busy={submitting}
        className="space-y-5"
      >
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email address
          </label>
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="you@example.com"
            value={email}
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((previous) => ({ ...previous, email: undefined }));
              setAuthError(null);
            }}
          />
          {fieldErrors.email && (
            <p
              id="email-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <PasswordInput
            ref={passwordRef}
            id="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            value={password}
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? "password-error" : undefined
            }
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((previous) => ({
                ...previous,
                password: undefined,
              }));
              setAuthError(null);
            }}
          />
          {fieldErrors.password && (
            <p
              id="password-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {fieldErrors.password}
            </p>
          )}
        </div>
        {authError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm leading-relaxed text-destructive"
          >
            {authError}
          </p>
        )}
        <AuthConfigurationNotice
          message={!client && authError ? null : configurationError}
        />
        <Button type="submit" className="h-12 w-full" disabled={submitting}>
          {submitting ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" />{" "}
              Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
