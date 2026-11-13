import { useRef, useState, type SubmitEvent } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, RotateCw } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "./auth-context";
import { AuthLayout } from "./components/AuthLayout";
import { AuthConfigurationNotice } from "./components/AuthConfigurationNotice";
import { PasswordInput } from "./components/PasswordInput";
import { confirmSession } from "./confirm-session";
import { getReturnPath } from "./return-path";
import {
  registrationPasswordPolicy,
  signUpErrorMessage,
  validateRegistration,
  type RegisterErrors,
  type RegisterValues,
} from "./register-validation";

const emptyValues: RegisterValues = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export function RegisterPage() {
  const { client, configurationError, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState<RegisterValues>(emptyValues);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [completion, setCompletion] = useState<
    "sign-in" | "session-unavailable" | null
  >(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  function update(field: keyof RegisterValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
      ...(field === "password" ? { confirmPassword: undefined } : {}),
    }));
    setAuthError(null);
  }

  async function checkSession() {
    if (!client) return;
    try {
      const session = await confirmSession(client);
      if (session) {
        await refresh();
        navigate(getReturnPath(location.state), { replace: true });
      } else {
        setCompletion("sign-in");
      }
    } catch {
      setCompletion("session-unavailable");
    }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const validation = validateRegistration(values);
    setErrors(validation);
    setAuthError(null);
    if (Object.values(validation).some(Boolean)) {
      const first = validation.name
        ? nameRef
        : validation.email
          ? emailRef
          : validation.password
            ? passwordRef
            : confirmRef;
      first.current?.focus();
      return;
    }
    if (!client) {
      setAuthError(
        configurationError ??
          "Sign-up is unavailable. Configure VITE_AUTH_URL and restart the development server.",
      );
      return;
    }

    setBusy(true);
    try {
      // Keep the form mounted until the cookie-backed session check resolves.
      // Only the official session hook can grant access to the protected app.
      const result = await client.signUp.email(
        {
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        },
        { disableSignal: true },
      );
      if (result.error) {
        setAuthError(signUpErrorMessage(result.error));
        return;
      }
      if (!result.data) {
        setAuthError("Registration could not be confirmed. Please try again.");
        return;
      }
      setValues((previous) => ({
        ...previous,
        password: "",
        confirmPassword: "",
      }));
      await checkSession();
    } catch {
      setAuthError(
        "We couldn't confirm your registration. Check your connection and try again. If you already have an account, sign in instead.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function retrySession() {
    if (busy) return;
    setBusy(true);
    try {
      await checkSession();
    } finally {
      setBusy(false);
    }
  }

  const signInLink = (
    <Link
      to="/login"
      state={{ from: getReturnPath(location.state) }}
      className="rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      Sign in
    </Link>
  );

  return (
    <AuthLayout
      title={completion ? "Registration received." : "Create your account."}
      description={
        completion
          ? "Your next step to a little more connection."
          : "Find your people. Make yourself at home."
      }
      footer={<>Already have an account? {signInLink}</>}
    >
      {completion ? (
        <div className="space-y-5">
          <div
            role="status"
            className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground"
          >
            <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
            <p>
              {completion === "session-unavailable"
                ? "Your registration was received, but we couldn't check your sign-in session. Check your connection and try again, or continue to sign in."
                : "Sign in to continue. If email verification is required for your account, complete that step first."}
            </p>
          </div>
          {completion === "session-unavailable" && (
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => {
                void retrySession();
              }}
            >
              <RotateCw
                className={busy ? "animate-spin" : ""}
                aria-hidden="true"
              />{" "}
              {busy ? "Checking session…" : "Check session again"}
            </Button>
          )}
          <Button asChild className="w-full">
            <Link to="/login" state={{ from: getReturnPath(location.state) }}>
              Continue to sign in <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          aria-busy={busy}
          className="space-y-5"
        >
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input
              ref={nameRef}
              id="name"
              name="name"
              autoComplete="name"
              required
              placeholder="What should we call you?"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <p
                id="name-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.name}
              </p>
            )}
          </div>
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
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <p
                id="email-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.email}
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
              autoComplete="new-password"
              required
              minLength={registrationPasswordPolicy.minLength}
              maxLength={registrationPasswordPolicy.maxLength}
              placeholder="Create a password"
              value={values.password}
              onChange={(event) => update("password", event.target.value)}
              disabled={busy}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={`password-help${errors.password ? " password-error" : ""}`}
            />
            <p id="password-help" className="text-xs text-muted-foreground">
              Use {registrationPasswordPolicy.minLength}–
              {registrationPasswordPolicy.maxLength} characters.
            </p>
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.password}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium">
              Confirm password
            </label>
            <PasswordInput
              ref={confirmRef}
              id="confirm-password"
              name="confirmPassword"
              visibilityLabel="confirmation password"
              autoComplete="new-password"
              required
              maxLength={registrationPasswordPolicy.maxLength}
              placeholder="Enter your password again"
              value={values.confirmPassword}
              onChange={(event) =>
                update("confirmPassword", event.target.value)
              }
              disabled={busy}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={
                errors.confirmPassword ? "confirm-password-error" : undefined
              }
            />
            {errors.confirmPassword && (
              <p
                id="confirm-password-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.confirmPassword}
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
          <Button type="submit" className="h-12 w-full" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />{" "}
                Creating account…
              </>
            ) : (
              <>
                Sign up <ArrowRight aria-hidden="true" />
              </>
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
