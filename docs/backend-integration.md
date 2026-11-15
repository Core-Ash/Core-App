# Rust backend integration

The frontend uses the actual routes and shapes inspected in the adjacent Core repository's `API.md`, `docs/openapi.json`, `src/lib.rs`, `src/api.rs`, `src/auth.rs`, and `docs/configuration.md`. Core-auth's session and cookie settings were inspected in its `src/lib/auth.ts`. The bootstrap contract and request-latency changes are implemented in both repositories. Recheck deployed versions and configuration before release.

## Data and authentication flow

1. The official Better Auth React client signs in, confirms the cookie-backed session, and maintains session state. It retains responsibility for refresh and sign-out.
2. When that session is ready, `AppDataProvider` creates a session-specific query cache and cancellation scope. It never uses the session token as an API parameter or cache key.
3. `GET /api/v1/bootstrap` reads the linked application profile and active communities together. A 409 offers explicit profile setup through `POST /api/v1/me` with an empty JSON object. Reads never create records.
4. Bootstrap seeds the community cache before the profile query succeeds. Channels load only for a community returned by that list; messages load only for a returned, visible channel. Invalid URL selections fall back to resources the backend actually returned.
5. All writes send JSON, browser-managed cookies, and `X-Core-CSRF: 1`. Rust derives the acting identity and permissions independently; the frontend supplies no acting user, author, or owner ID.
6. Creation mutations invalidate their affected lists. Confirmed message sends merge into the channel history cache without refetching. Message submission generates one UUID nonce and reuses it when retrying an unchanged failed draft. A lost response therefore does not create duplicate messages when retried on the same page. The composer keeps failed drafts.

API failures use safe, fixed messages. 400/413/415/422 indicate input problems; 403 denies access without signing out; 404 indicates an unavailable resource; 409 indicates conflict; 429 displays the documented Retry-After seconds; network and 5xx failures offer retry. HTML, malformed JSON, and invalid response shapes fail closed. Raw errors, stack traces, credentials, and private responses are not logged.

A Rust 401 triggers one coalesced Better Auth `getSession({query:{disableCookieCache:true}})` check for concurrent failures. Requests are not replayed. If Better Auth still has a valid session, the UI explains that the application service could not accept it. If the session ended or changed, the official React session is refreshed. Auth unavailability is distinct from expiration. Query and mutation retries are disabled to prevent loops and duplicate non-idempotent creation.

Caches are keyed by resources inside a separate QueryClient for each `[auth user ID, auth session ID]` pair, with 30-second freshness and five-minute inactive garbage collection. There is no persistence or cross-account placeholder data. Session loss, auth errors, or account changes clear both caches and abort fetches. Late responses are discarded even if the transport ignores abort. Successful logout clears data immediately, before its official session refresh. Cancellation cannot undo a write already committed by Rust.

## Local configuration

Direct localhost mode, adjusting ports to the running services:

```dotenv
VITE_AUTH_URL=http://localhost:3001/api/auth
VITE_API_URL=http://localhost:3000
```

The API setting accepts either an origin or a base ending in `/api/v1`; both normalize to the same versioned base. The auth setting accepts an origin (Better Auth uses `/api/auth`) or a complete auth base URL. Production absolute URLs require public HTTPS. Do not use `.railway.internal` browser URLs.

Cookies are scoped by host, not port: use `localhost` consistently instead of mixing `localhost` and `127.0.0.1`. Core-auth's development session cookie is normally `better-auth.session_token`; Rust's `BETTER_AUTH_SESSION_COOKIE` must match. Both services must allow the exact browser origin, such as `http://localhost:5173`.

To proxy deployed services through Vite, configure `.env.development.local`:

```dotenv
VITE_AUTH_URL=https://localhost:5173/api/auth
VITE_API_URL=/api/v1
DEV_AUTH_PROXY_TARGET=https://your-core-auth-service.up.railway.app
DEV_API_PROXY_TARGET=https://your-core-service.up.railway.app
DEV_AUTH_PROXY_HTTPS=true
```

Vite verifies upstream HTTPS certificates and preserves Origin and cookie attributes. Trust its local development certificate and allow `https://localhost:5173` on both services. `DEV_AUTH_PROXY_HTTPS=false` explicitly selects local HTTP; use it only with compatible local development cookie settings. It never strips Secure or HttpOnly attributes. The Rust development proxy also accepts a loopback HTTP upstream. Proxies operate only during `pnpm dev`, not build or static preview. Existing environment files are not overwritten by this implementation.

## Vercel and cookie routing

Set public build-time variables:

```dotenv
VITE_AUTH_URL=/api/auth
VITE_API_URL=/api/v1
```

Set server-only runtime variables:

```dotenv
CORE_AUTH_PROXY_TARGET=https://your-core-auth-service.up.railway.app
CORE_API_PROXY_TARGET=https://your-core-service.up.railway.app
```

The origins have no path, credentials, query, or fragment. They are fixed by the server environment, never by a request. Rebuild when VITE variables change; apply runtime variables to each intended Vercel environment. Preview domains require their own explicit trust on both services.

The catch-all Vercel function uses the supported [Node.js Web Handler](https://vercel.com/docs/functions/runtimes/node-js). It routes only `/api/auth/*` and `/api/v1/*`, excludes API paths from SPA fallback, enforces same-origin browser writes, caps request bodies, applies an upstream deadline, rejects redirects, and returns no-store responses. It preserves Cookie, browser Origin, Content-Type, and X-Core-CSRF; all Core-auth Set-Cookie headers retain their attributes. It discards caller Authorization/forwarding headers and ignores cookies issued by Rust. It neither implements authentication nor parses session credentials. Unit tests exercise the same handler; local static Vite builds do not validate Vercel packaging or deployment.

Required service settings:

- Core-auth must trust the exact frontend origin and keep email/password authentication enabled. Keep host-only cookies with `Path=/`, `HttpOnly`, `Secure` in production, and the existing suitable SameSite policy. A Domain restricted to a Railway hostname would not work on a Vercel response; configure cookie scope on the owning service instead of stripping attributes in the proxy.
- Rust's `CORS_ORIGINS` must include the exact frontend origin even behind the proxy: the same allowlist validates Origin on cookie writes. Never replace it with a wildcard or disable CSRF.
- Rust's `BETTER_AUTH_SESSION_COOKIE` must match Core-auth's primary cookie exactly, normally `__Secure-better-auth.session_token` in production. The cookie must cover both `/api/auth` and `/api/v1`.
- Rust's `BETTER_AUTH_INTERNAL_URL` must reach the existing Core-auth `/api/auth` base. Its authoritative `get-session` validation and all resource authorization remain enabled. No Better Auth secret belongs in Rust or the frontend.
- Direct cross-origin mode additionally requires credentialed CORS for exact origins, including Content-Type and X-Core-CSRF in Rust's allowed headers. A host-only auth cookie on one Railway hostname is not sent to another. Use the supplied same-origin proxy or controlled same-site custom domains with deliberately scoped cookies; `credentials: include` alone cannot fix domain scope or third-party-cookie blocking.

The inspected Core-auth source uses host-only cookies, production Secure/HttpOnly, and SameSite=Lax; this is compatible with the recommended same-origin routing when Path is `/` and the service trusts the frontend origin. Actual deployed cookie attributes and authenticated persistence have not been observed in this task. See [Better Auth cookies](https://better-auth.com/docs/concepts/cookies) and [session management](https://better-auth.com/docs/concepts/session-management).

## Supported contracts and gaps

| Operation          | Existing Rust contract                                                                      | Frontend behavior                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Workspace bootstrap | GET `/api/v1/bootstrap`; `{profile,communities:{items:[...]}}` | Shared profile query seeds the community cache. |
| Profile read/setup | GET/POST `/api/v1/me`; `{id,username,email,display_name,avatar_url}` | Shared current-user query, explicit onboarding, current public name/avatar, settings, account panel. |
| Communities        | GET/POST `/api/v1/communities`; list `{items:[{id,name,owner_id}]}`, creation `{name}`      | Dynamic rail/picker, selection, empty/error states, create dialog.                                      |
| Channels           | GET/POST `/api/v1/communities/{id}/channels`; `{id,name,topic,position}`, creation `{name}` | Dynamic text channel list/selection and permission-checked creation.                                    |
| Message history    | GET `/api/v1/channels/{id}/messages?limit=50`; `{items,next_cursor}`                        | Cursor-based older pages, chronological display, de-duplication, loaded-history search, manual refresh. |
| Send message       | POST `/api/v1/channels/{id}/messages`; `{body,client_nonce}`                                | 1–4000 Unicode characters, retry-safe nonce, preserved failed drafts, confirmed-response cache update.             |
| Admit member | POST `/api/v1/communities/{id}/members`; `{user_id: UUID}`; bodyless 201 | Owners enter an existing application member ID on Members, even without channels. Validates UUIDs, prevents duplicate submissions, preserves failed input, and confirms successful admission. |
| Community members | GET `/api/v1/communities/{id}/members` | Active members can read/search/paginate public community profiles and roles. |
| Channel members | GET `/api/v1/communities/{community_id}/channels/{channel_id}/members` | Sidebar shows only active effective viewers; shared public profile cards and permission evaluator. |
| Channel access | GET `/api/v1/communities/{community_id}/channels/{channel_id}/access` | Manager-authorized overview, effective allowed/denied member pages, server search/role filters, and backend explanations. Requires migration 0004. See [contract and precedence](channel-access.md). |

Lists contain at most 100 communities/channels; those endpoints expose no pagination. Names contain 1–100 characters. Body/field validation and authorization remain authoritative in Rust. The owner and members with the relevant grant can create channels. The new access-inspection endpoint requires effective view and channel-management permission; a visible channel alone does not grant inspection. No unsupported update/delete routes are called even though the reusable transport supports PUT/PATCH/DELETE.

Message records now include a nullable public `author` profile alongside `author_id`, body, timestamps, and nonce. Rust batches profile resolution for the authorized page; the frontend displays those names/avatars without per-user requests. Missing profiles retain a safe UUID fallback. Deleted bodies remain hidden, edited records are marked, and React escapes message text. Member presence is not inferred from sessions.

The access viewer and new scoped community/channel member reads use the same public name/avatar projection from linked Better Auth records. See [member profile contracts and migration 0005](member-profiles.md). Community updates, profile edits, events, reactions, permission editing, voice, uploads, notifications, and real-time updates still need backend contracts. No WebSockets, JWT exchange, bearer token storage, frontend database queries, or invented endpoints were added.

Missing or invalid VITE_API_URL displays a configuration error without attempting API requests. The application has no sample workspace fallback, sample identities, simulated sends, or local-only reactions. Production response handling accepts Rust's empty membership 201 even when intermediaries omit Content-Length; reads and typed entity responses still require a valid JSON payload.

The Members view is independent of channel loading and availability. It lists real community members; the right sidebar uses channel-effective visibility. Only owners see admission controls, and Rust rechecks ownership on every POST; hiding the form is not an authorization boundary. The target must supply their application UUID from Settings, not their Better Auth ID or email. A nonexistent target or duplicate membership may produce a validation/conflict response. Admission invalidates member and access-inspector caches.

**Backend gaps:** profile/community/channel/message updates and deletes, membership removal, friends/requests, and global user directory reads have no routes in the inspected `Core/src/lib.rs`. Full update/delete acceptance criteria require a separate backend change with documented authorization, request/response shapes, and persistence behavior. Channel-access and member-profile features add backend source, migrations 0004/0005, and runtime-grant requirements in the adjacent Core repository. Existing trusted-origin, cookie, CORS, CSRF, and proxy requirements above remain necessary. No deployment or existing database migration was performed, and no dependencies were added.

## Verification status

Validation on 2026-11-15 passed: `pnpm.cmd run typecheck`, `pnpm.cmd run lint`, `pnpm.cmd test` (161 tests across 16 files), and `pnpm.cmd run build`. These are local source/build checks and mocked integration tests, not proof of authenticated PostgreSQL persistence. No dependencies or lockfiles changed.

Unit tests cover the transport, exact URLs, CSRF, errors, malformed responses, cancellation, deduplication, startup gating, session expiration, 401 rechecks, 403 handling, account switches, logout clearing, profile onboarding, creation, cursor pagination, nonce retry behavior, escaped content, and proxy header/cookie behavior. Membership tests cover empty 201 responses, owners/non-owners, validation, permission denial, retained input, duplicate submission, confirmed success, and communities with no channels. Composer tests cover persisted-send announcements, failures/retry, Unicode limits, IME/multiline input, and duplicate submission. Missing-config tests assert no network calls or sample workspace at `/app`, `/app/communities`, and Settings. Existing sign-in/registration/guard tests remain in the suite. TanStack Query's [cancellation support](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) is connected to the fetch AbortSignal.

Anonymous checks on 2026-11-15 against the configured local services observed Better Auth `get-session` HTTP 200, Rust `/health/live` HTTP 200, and Rust `/api/v1/bootstrap` and `/api/v1/me` HTTP 401 without credentials. These prove reachability and anonymous rejection at the checked routes, not authenticated integration. No credentials were supplied or logged and no test account was created.

Before release, use an authorized account to check sign-in/registration, actual Set-Cookie scope and flags, reload restoration, explicit new-profile setup, existing-email collisions, community/channel creation and selection, message pagination/sending, permission denial, revoked sessions, account switching, and logout. Verify that Rust receives and independently validates the real session through the deployed proxy. Confirm that reads/writes fail without a session and that auth/service failures hide private data. Email delivery still requires the owning Core-auth service configuration.

Successful authenticated browser flows, runtime Vercel variables, function packaging/routing, deployed CORS/CSRF, and production cookie delivery remain unverified. Nothing in this task deploys or changes service configuration.

## Request latency

The signed-in workspace starts with `GET /api/v1/bootstrap`: `{profile, communities: {items: [...]}}`. This protected endpoint validates the session once, returns only the current user's profile and active communities, and has the same 409 onboarding behavior as GET /me. Deploy the matching backend before this frontend. An explicit onboarding POST is still required for new accounts.

Profile observers share the bootstrap request; the validated community list seeds the session-scoped query cache. Channels and message history still require backend authorization. A confirmed message response updates only that channel's existing cache; cursor boundaries and older pages remain intact, retries deduplicate by server ID or author/nonce, and cleared caches stay empty. A pending send is visibly marked until confirmation. Failed sends retain their draft and nonce. This does not add realtime synchronization: use Refresh history to load other users' messages until WebSockets are implemented.

`vercel.json` places API functions in `fra1` near the Railway Europe services; static assets still use Vercel's edge network. Preserve same-origin API URLs and server-only upstream variables. The proxy forwards numeric `Server-Timing` stages so the browser Network panel can distinguish backend authentication, rate-limit, and handler costs. It does not cache credentials or sessions.
