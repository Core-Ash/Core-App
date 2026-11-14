# Core Web

React + TypeScript frontend for Core. Better Auth owns authentication and sessions; the Rust REST API owns application profiles, communities, channels, messages, and authorization. The frontend never connects to PostgreSQL.

The existing Core layout is preserved. With `VITE_API_URL` configured, the workspace loads real communities, text channels, and paginated messages, supports their creation and message sending, and shows the Rust application profile. With that variable empty, the existing, explicitly labelled design preview remains available. A configured but unavailable backend shows an error; it never falls back to sample data.

## Run locally

Use Node **22.13+ (22.x)** or **24.x** and **pnpm 10.12.4**, pinned in `package.json`. On Windows, use `pnpm.cmd` if PowerShell blocks the pnpm script.

```sh
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env.local`. For local services, using the example ports from their repositories:

```env
VITE_AUTH_URL=http://localhost:3001/api/auth
VITE_API_URL=http://localhost:3000
```

Set the actual ports your services use. Use the same hostname for both services, and allow `http://localhost:5173` on both. Local Core-auth must use development cookie settings, and Rust's configured cookie name must match. Then run:

```sh
pnpm run dev
```

Open Vite's printed URL. Existing process environment and mode-specific Vite files can override `.env.local`; restart after changes. For HTTPS development proxies and full service requirements, see [backend integration](docs/backend-integration.md).

## Configuration

| Variable                 | Purpose                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_AUTH_URL`          | Required for authentication. Public HTTPS Better Auth origin/full base URL, or explicit `/api/auth` for the same-origin proxy. HTTP localhost is permitted in development.     |
| `VITE_API_URL`           | Rust origin or origin with `/api/v1`; explicit `/api/v1` selects the same-origin proxy. Empty retains the labelled design preview. HTTP localhost is permitted in development. |
| `CORE_AUTH_PROXY_TARGET` | Vercel server-only environment variable: public HTTPS Core-auth origin, without `/api/auth`.                                                                                   |
| `CORE_API_PROXY_TARGET`  | Vercel server-only environment variable: public HTTPS Rust origin, without `/api/v1`.                                                                                          |
| `DEV_AUTH_PROXY_TARGET`  | Optional Vite development proxy: HTTPS Core-auth origin.                                                                                                                       |
| `DEV_API_PROXY_TARGET`   | Optional Vite development proxy: HTTPS Rust origin or HTTP localhost origin.                                                                                                   |
| `DEV_AUTH_PROXY_HTTPS`   | Defaults to `true`; controls local HTTPS for either development proxy.                                                                                                         |

`VITE_` values are public and embedded at build time. HTTPS is required for absolute production service URLs; Railway private hostnames and known private production hosts are rejected. Real environment files are ignored by Git. Never place database credentials, auth secrets, or session tokens in these variables.

## Vercel

Configure both public build-time paths and server-only upstream origins for each environment:

```env
VITE_AUTH_URL=/api/auth
VITE_API_URL=/api/v1
CORE_AUTH_PROXY_TARGET=https://your-core-auth-service.up.railway.app
CORE_API_PROXY_TARGET=https://your-core-service.up.railway.app
```

The Vercel function in `api/[...path].ts` proxies the two fixed service prefixes. `vercel.json` applies SPA fallback only outside `/api/` and disables API caching. There are no hardcoded production upstreams. `pnpm preview` serves the static build and does not run Vercel functions.

Both services must allow the exact frontend origin. Keep Core-auth's cookie host-only with `Path=/`, `HttpOnly`, `Secure`, and suitable `SameSite`; configure Rust to accept the exact primary session cookie name and validate it with Core-auth. The proxy preserves browser Cookie, Origin, CSRF headers, and all auth Set-Cookie attributes. See the [deployment and cookie checklist](docs/backend-integration.md#vercel-and-cookie-routing).

Changes here are source preparation only. No deployment or other repository changes are performed.

## Authentication and private data

`src/lib/auth-client.ts` remains the official Better Auth React client. Session initialization completes before redirects; login and registration confirm a cookie-backed session through `getSession()` before navigating. Registration retains Core-auth's inspected 12–128 character password policy and never assumes that a successful response proves a session or email delivery. Verification/reset email delivery is still a Core-auth responsibility.

The API client sends credentialed requests and `X-Core-CSRF: 1` on writes. Rust independently verifies the session and permissions. A Rust 401 triggers a coalesced official Better Auth session check without replaying the request. An active auth session produces an integration error; confirmed expiration refreshes the official session state and returns to sign-in. A 403 reports permission denial and retains sign-in.

Each auth user/session pair gets a new in-memory TanStack Query client and abort scope. Logout, expiration, account changes, and auth service errors cancel reads/writes and discard private caches. Successful sign-out clears private frontend data before the session refresh completes. Nothing persists application data or credentials to localStorage.

New identities explicitly set up their application profile with the existing idempotent `POST /api/v1/me`. An email collision requires administrative linking; the frontend never supplies a caller ID or links by email.

## Scope and structure

- `src/app/`: routing and session-scoped data provider.
- `src/features/auth/`: Better Auth session provider, guards, login, registration, logout.
- `src/lib/api/`: credentialed fetch client, safe errors, runtime response validation, actual Rust endpoint adapters.
- `src/features/community/api/`: query keys, typed hooks, selection, and mutations.
- `src/features/community/`: the live workspace and isolated, labelled visual preview.
- `src/components/`: shared UI and existing responsive layout; `src/styles/` owns theme tokens and styling.
- `api/`, `server/`: Vercel transport proxy; no auth implementation or database access.
- `src/test/`: unit-test fixtures, never an application authentication mode.

Routes `/app` and `/app/communities` show the workspace; `/app/settings` shows the profile and sign-out. `/login` and `/register` remain guest routes. Direct messages and friends remain unavailable.

The current Rust contract has no member/profile directory or avatars, permissions-discovery endpoint, update endpoints, reactions, voice, uploads, events, or live message events. Other message authors are identified by their actual member UUID; only your own avatar can come from your Better Auth identity. Search filters loaded message history. Use **Refresh history** to see new messages; there is no polling or WebSocket implementation. See [supported contracts and gaps](docs/backend-integration.md#supported-contracts-and-gaps).

## Verification

```sh
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
```

Tests mock network responses while exercising production auth/data code, including account isolation, cancellation, 401/403 handling, nonce retries, cursor pagination, onboarding, creation, and proxy cookie/header behavior. They preserve the existing login, registration, routing, and preview tests.

Anonymous local service checks confirmed a responding Better Auth session endpoint and a Rust `/api/v1/me` response of **401** without a cookie. Successful live registration/sign-in, cookie persistence and renewal through both services, authenticated Rust reads/writes, and authenticated logout remain **unverified**. No account was created and no deployment was performed. Follow the [live verification steps](docs/backend-integration.md#verification-status) with an authorized account before release.
