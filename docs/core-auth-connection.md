# Core-auth connection

Updated November 13, 2026. The frontend is configured to reach the existing Core-auth service. Public health/session endpoints and error flows have been verified; successful registration and authenticated session persistence remain unverified.

## Service and observed behavior

- Railway workspace **Core**, project **accurate-adventure**, environment **production**, service **Core-auth**.
- The user supplied **https://core-auth-production.up.railway.app**. That URL responds over HTTPS; the earlier absence of a domain in CLI metadata is no longer a connection blocker.
- Better Auth is mounted at `/api/auth/*`. The inspected source enables email/password sign-in and sign-up, with a **12–128-character** password policy. It does not require verification for sign-in; its email-delivery callbacks were stubs at the inspected commit.
- Credentialed CORS permits **http://localhost:5173**. A preflight for **https://localhost:5173** did not include an allowed-origin header, so that origin is not used for the current local setup.
- Health returned **200**, anonymous session lookup returned **200 null**, invalid sign-in returned **401 INVALID_EMAIL_OR_PASSWORD**, invalid registration returned **400**, and anonymous sign-out returned **200**.
- Chrome verified that both buttons are clickable, field validation works, and invalid sign-in reaches the real service through the local proxy and displays the expected error. No browser runtime errors were observed.
- No production account was created, and no existing user's credentials or session were used. Real session-cookie attributes and persistence after successful authentication still need an authorized account test.
- No Railway settings, other repository, or database were changed. Service variables remain unread: the earlier full variable-list request was rejected because it retrieves secrets together with public settings. It was not retried or bypassed.

## Current workspace configuration

The ignored `.env.local` contains the supplied public auth URL for production builds:

```env
VITE_AUTH_URL=https://core-auth-production.up.railway.app
VITE_API_URL=
```

The ignored `.env.development.local` overrides only development:

```env
VITE_AUTH_URL=http://localhost:5173/api/auth
DEV_AUTH_PROXY_TARGET=https://core-auth-production.up.railway.app
DEV_AUTH_PROXY_HTTPS=false
```

Run `pnpm dev` and open **http://localhost:5173**. Restart Vite after editing environment files. The current dev server was restarted with `pnpm dev --force` to refresh stale optimized dependencies left after the package-manager migration.

The browser uses the same-origin `/api/auth` proxy. Its fixed upstream is the real Core-auth HTTPS origin. Upstream certificate verification remains enabled, browser Origin is preserved, and no cookie flags are rewritten. This avoids cross-site cookie delivery for local requests. The local HTTP origin matches the service's existing trusted origin; the proxy binds to localhost and is not a production hosting solution.

The proxy defaults to local HTTPS. To use HTTPS instead, first allow **https://localhost:5173** on Core-auth, then change the development URL to `https://localhost:5173/api/auth` and `DEV_AUTH_PROXY_HTTPS` to `true`. The Vite basic-SSL plugin generates a self-signed localhost certificate; a trusted local certificate can replace it. See [Vite's HTTPS options](https://vite.dev/config/server-options.html#server-https).

Keep proxy settings in the development-specific file so a production build does not embed localhost as the auth URL. The server-only `DEV_` settings are not exposed as frontend environment variables.

## Before deploying the frontend

- Set `VITE_AUTH_URL` at build time to the intended public HTTPS auth base URL. Never use a `.railway.internal` hostname in the browser.
- Confirm Core-auth's `BETTER_AUTH_URL` and add the exact deployed frontend origin to `TRUSTED_ORIGINS`, preserving existing origins. Its Hono CORS and Better Auth origin checks must both allow that origin with credentials.
- Preserve Secure and HTTP-only cookie protections. Prefer same-site HTTPS custom domains or a same-origin production reverse proxy to avoid third-party cookie restrictions. The Vite dev proxy is unused by builds and preview. See [Better Auth cookie guidance](https://better-auth.com/docs/concepts/cookies).
- If changing the auth base URL, review its JWT issuer dependency before applying a separately authorized service configuration restart/deployment.
- Verify new-user and duplicate-email registration, valid login, reload/session restoration, guest/protected redirects, logout, and post-logout access with an authorized test account. Do not report those scenarios as passing until exercised.
- The inspected Rust backend has separate authentication and no Better Auth proxy/JWT verification. Future Rust integration remains a separate task; this frontend makes no application API calls.

The original source inspection matched Core-auth commit `5f77a85bf56dee50a8ea1590ed3e84ecfe42b0f6` and Core-Backend commit `64a3b0d7cc11751ff93db7ddfd8d5b5c81bf7c4f`. Authentication and database rules remain owned by those services.
