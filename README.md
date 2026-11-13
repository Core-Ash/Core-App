# Core Web

The React web frontend for **Core**, a communication platform. This template includes matching sign-in and sign-up screens, cookie-based Better Auth integration, protected routing, and a responsive home dashboard. Servers, direct messages, friends, and settings are explicitly marked as future features.

## Local development

Use Node.js **22.13+ (22.x)** or **24.x**, with **pnpm 10.12.4** (pinned in `package.json`). The `pnpm-lock.yaml` file records the installed dependencies. If pnpm is not installed, follow the [pnpm installation guide](https://pnpm.io/installation) and install the pinned version.

```sh
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env.local` (`Copy-Item .env.example .env.local` in PowerShell, or `cp .env.example .env.local` in a Unix shell), then configure:

```env
VITE_AUTH_URL=https://your-auth-service.example.com
VITE_API_URL=
```

```sh
pnpm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. On Windows, use `pnpm.cmd` if PowerShell blocks the `pnpm.ps1` script. Use pnpm for dependency changes and commit `pnpm-lock.yaml`; avoid mixing package managers.

| Variable        | Purpose                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `VITE_AUTH_URL` | Required for sign-in and sign-up. Core-auth's public HTTPS origin, or its complete authentication base URL. |
| `VITE_API_URL`  | Reserved for future Rust backend integration. Currently unused; it can remain empty.                        |

The supplied Core-auth public URL is now configured in this workspace's ignored `.env.local`. Development-specific settings live in `.env.development.local`: the browser calls `http://localhost:5173/api/auth`, and Vite proxies those calls to Core-auth over HTTPS. This uses the service's already-allowed local origin and keeps cookies first-party. Production builds use the public auth URL from `.env.local`, not the development proxy URL. See the [connection notes](docs/core-auth-connection.md) for verified behavior and deployment requirements.

Vite exposes `VITE_` variables to the browser **at build time**. Restart the development server after editing them, and rebuild for changes to production configuration. Never put database URLs, Better Auth secrets, API keys, or other private credentials here. Actual `.env` files are ignored by Git.

Without a valid auth URL, both auth pages show a setup message. Their submit buttons remain clickable for form validation and show an explicit configuration error on a valid submission; no authentication requests are made. Buttons are disabled only while a request is in progress. HTTPS is required outside localhost. Railway's private `.railway.internal` hostnames are explicitly rejected in browser configuration. Real environment files remain ignored by Git.

`DEV_AUTH_PROXY_TARGET` is a server-only HTTPS origin. `DEV_AUTH_PROXY_HTTPS` defaults to `true`; the current local setup explicitly uses `false` because Core-auth already trusts `http://localhost:5173`, while its HTTPS localhost origin is not currently allowed. The proxy listens on localhost, verifies the upstream HTTPS certificate, and preserves Origin and cookie attributes. For local HTTPS, allow `https://localhost:5173` on Core-auth, set `DEV_AUTH_PROXY_HTTPS=true`, and use that HTTPS origin in the development-only `VITE_AUTH_URL`. This option never relaxes production HTTPS requirements or strips cookie flags.

## Authentication

`src/lib/auth-client.ts` creates the official `better-auth/react` client with credentialed requests. `AuthProvider` uses the client's `useSession()` hook as the session source. Startup restores the session from the service; focus changes and a 60-second interval revalidate an active session. No application code reads, writes, or forwards session tokens.

Sign-in calls `signIn.email()`; sign-up calls `signUp.email()` with the trimmed name/email and the unchanged password. Both use the official client's `getSession()` to confirm a cookie-backed session before refreshing the React session hook and navigating. A successful response without a persistent session cannot unlock `/app`. Sign-in reports a cookie/session problem instead of silently returning to the login screen.

Registration validates all four fields, including exact password confirmation. Core-auth's inspected policy is **12–128 characters** (12 configured by the service, 128 from its unchanged Better Auth default); server validation remains authoritative. Keep `src/features/auth/register-validation.ts` aligned if that policy changes. The current service does not require email verification for sign-in, and normally creates a session after registration. The frontend still checks the actual session rather than assuming this behavior. Without a session it displays a confirmation and a sign-in link, mentions any required verification, and never claims that an email was delivered. A failed session check can be retried without repeating account creation. Core-auth's current verification/reset email delivery callbacks are stubs.

Logout calls `signOut()`, refreshes the session, and returns to `/login`. Guards wait for the initial session lookup; later background checks preserve guest form input. Unauthorized sessions are treated as signed out, while other service/network errors display a retry screen and hide protected content. An intended `/app` destination is preserved across sign-in/sign-up links, including its search and hash. API errors are mapped to safe UI messages rather than printing server details or responses.

The client uses Better Auth's default `/api/auth` base path when given an origin. Core-auth is mounted there. For a different server base path, set `VITE_AUTH_URL` to the full path, such as `https://auth.example.com/custom/auth`. Confirm the actual deployed service configuration before connecting. This frontend requires email/password authentication and sign-up to remain enabled on that service. Password recovery, email delivery, social login, and an authentication server are outside this frontend's scope.

Check these settings on the **existing auth service**:

- Its public Better Auth base URL and base path must match the frontend configuration.
- Enable email/password authentication. If email verification is required, accounts must complete that process through the service's existing flow.
- Add the exact frontend origins to Better Auth's `trustedOrigins`. The current local proxy uses the already-allowed **http://localhost:5173**. An HTTPS local origin must be added before switching to it; preserve other existing origins.
- Configure credentialed CORS for those exact origins, including preflight handling and `Access-Control-Allow-Credentials: true`. A wildcard origin cannot be used with credentials.
- Keep production session cookies HTTP-only and secure. If frontend and auth are on different **sites**, cookie delivery may require `SameSite=None; Secure`; browser third-party cookie restrictions can still prevent it. Prefer same-site custom domains or an appropriately secured same-origin proxy when necessary. Do not disable CSRF/origin validation to work around cookie issues.

These are service configuration requirements; no other repository or Railway deployment is modified here. See the official [Better Auth client documentation](https://better-auth.com/docs/concepts/client), [session management](https://better-auth.com/docs/concepts/session-management), and [cookie guidance](https://better-auth.com/docs/concepts/cookies).

## Routes

| Route          | Behavior                                                       |
| -------------- | -------------------------------------------------------------- |
| `/`            | Wait for the session, then redirect to `/app` or `/login`.     |
| `/login`       | Guest login; authenticated visitors redirect to `/app`.        |
| `/register`    | Guest registration; authenticated visitors redirect to `/app`. |
| `/app`         | Protected home with actual session profile information.        |
| Any other path | Public 404 page.                                               |

Client route guards control presentation. The existing auth service remains the authority for sessions, and future backend endpoints must enforce authorization independently.

## Architecture and conventions

- React, strict TypeScript, Vite, React Router, Tailwind CSS, source-owned shadcn/ui components with Radix primitives, and Lucide icons.
- `src/app/`: application entry and routing.
- `src/components/ui/`: reusable shadcn/ui primitives, adapted to Core's theme. `components.json` configures the CLI for future additions.
- `src/components/common/` and `layout/`: branding, avatars, shared states, and responsive navigation. The mobile drawer includes focus trapping, Escape dismissal, and focus restoration.
- `src/features/auth/`: the official-client session provider, guards, login, and logout.
- `src/features/home/`: session-backed welcome dashboard and clearly labeled placeholders.
- `src/lib/`: configuration, auth client, and class-name utilities.
- `src/styles/globals.css`: dark theme tokens and shared styling. Imports use `@/` for `src/`.

**All future application data must flow through the Rust backend.** The frontend must never connect to PostgreSQL. Better Auth owns identity and sessions; the Rust API owns business logic and authorization. There are no backend API calls in this template. Inspect the Rust authentication contract before adding cookies, token exchange, or authorization headers to future requests.

React Router 7 is the newest major compatible with the installed Node 22.14 environment; Router 8 requires Node 22.22+. TypeScript 6 is used because the current TypeScript ESLint tooling supports versions below 6.1. Dependencies were resolved from stable releases without bypassing peer or engine constraints.

## Verification and production build

```sh
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run preview
```

`build` generates the static frontend in `dist/`. `preview` is for local inspection of that build, not a production server. A production host must serve `dist/` over HTTPS and rewrite non-file SPA routes (such as `/app` and `/login`) to `index.html`. Nothing is deployed by this repository's scripts.

Vitest and Testing Library cover sign-up validation and service errors, verified/absent/unavailable post-sign-up sessions, safe session retries, sign-in with blocked cookies, routing, startup and background session behavior, expiry, redirect safety, logout, and configuration safety. Test fixtures are isolated from the application; there is no mock authentication mode in the frontend.

Live connectivity is now verified against the supplied Core-auth URL: health returns 200, anonymous session lookup returns `200 null`, invalid credentials return `401 INVALID_EMAIL_OR_PASSWORD`, invalid registration data returns 400, and anonymous sign-out returns 200. Chrome verified both submit buttons, form validation, real error feedback, and same-origin proxy requests without runtime errors. No test account or authenticated session was created.

Successful registration, valid sign-in, actual session-cookie persistence, and authenticated logout remain **unverified** without an existing authorized account or approved test registration. Runtime Railway variables remain unread; the earlier variable-list request was rejected because it retrieves secrets with public settings. The connection was established through the provided URL and observable public responses instead; no service configuration was changed. See the [connection notes](docs/core-auth-connection.md) for remaining requirements.

Once a public endpoint or approved same-origin proxy is available, verify new/existing-email registration, invalid inputs and mismatched passwords, valid/invalid sign-in, reload on `/app`, authenticated access to `/login` and `/register`, direct protected access, logout, post-logout access, session expiration, and real browser cookies/CORS. Successful registration and sign-in require an authorized test account or controlled test-user creation; neither is fabricated locally or exercised against production without working service access.

The initial dependency audit reports a moderate `minimatch` advisory in development-only ESLint tooling. The patched major removes public APIs, while upstream tooling still requests older majors, so no cross-major transitive override or forced downgrade is applied. Recheck updates with `pnpm audit`; this issue is not included in the production bundle. Advisory: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
