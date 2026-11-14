# Core-auth connection

The authoritative setup is now [backend integration](backend-integration.md). It covers the same-origin routes for **both** Core-auth and Rust, required runtime/build variables, CSRF, cookie names, trust lists, and verification limits.

## Current implementation

`src/lib/auth-client.ts` uses the official Better Auth React client. An absolute auth origin/full base URL remains supported; explicit `VITE_AUTH_URL=/api/auth` resolves to the browser's own origin. Missing or invalid configuration never falls back to an auth endpoint implicitly.

The service's inspected source mounts `/api/auth/*`, enables email/password authentication, configures a 12-character minimum (128-character Better Auth maximum), and does not require email verification for sign-in. Verification and password-reset delivery callbacks remain stubs in that source. Deployment configuration may differ and must be checked before release.

Login and registration confirm the actual cookie-backed session before navigation. The React session hook remains authoritative. Initialization, background rechecks, service failures, expired sessions, guest/protected redirects, and sign-out retain their existing tests. A stale cached user accompanied by an official 401 is treated as signed out.

## Cookie transport

Use the environment-configured Vercel function for `/api/auth/*` and `/api/v1/*`, or a controlled same-site domain arrangement. A host-only cookie on one Railway hostname does not reach another hostname automatically.

The previous hardcoded auth-only Vercel rewrite has been replaced with a configurable transport proxy. Set **both** server-only upstream origins as well as the public same-origin paths; an old deployment without the new function or variables cannot use it. Static `pnpm preview` does not execute the proxy.

Keep the frontend origin in Core-auth's trusted origins and Rust's Origin/CSRF allowlist. Preserve `HttpOnly`, `Secure`, `SameSite`, and `Path=/`. Rust must accept the exact configured primary session cookie and validate it through Core-auth; it does not use Core-auth's JWT access tokens for this browser flow. No token storage or token exchange was added.

## Verification

In this integration task, anonymous requests to the configured local Better Auth session endpoint returned HTTP 200, and Rust `/api/v1/me` returned HTTP 401 without credentials. Network-mocked tests cover official-client 401 rechecks and session isolation as well as the existing auth flows.

Successful live sign-in/registration, real cookie scope and persistence, authenticated Rust reads/writes, renewal, logout, and Vercel deployment remain unverified. No account was created, production was not deployed, and no service settings or other repositories were changed. Follow the [live verification steps](backend-integration.md#verification-status) using an authorized account.
