# Friends and public identities

The frontend uses the existing cookie-authenticated Rust API and session-scoped TanStack Query cache. Better Auth remains the session authority. Friendship data never goes through the auth service, and the frontend never accesses PostgreSQL.

## Identity policy

Public usernames use 2–32 ASCII letters, digits or underscores, trimmed at creation and rename. Capitalization is preserved; exact tag lookup compares the base username case-insensitively and requires the complete four-digit tag. `admin`, `administrator`, `system`, `core`, `support`, `everyone`, `here` and `deleteduser` are reserved, case-insensitively. No spaces, Unicode confusables, control characters or embedded `#` are accepted.

The username and discriminator live in separate `auth."user"` columns. The existing text Better Auth ID and linked application UUID stay unchanged. Formatted names are derived, never stored or used as relationship keys. Display names stay separate and are preserved when usernames change.

Core migration `0008_friends_identity.sql` backfills existing auth users, preserves valid existing allocations, and provides the four-digit format, non-null and global uniqueness constraints. Invalid existing display names get the safe public username `Player` while retaining their original display name. Migration `0009_identity_registration.sql` adds explicit registration usernames and upgrades the unique index to a named unique constraint. Migrations use Core's transactional, checksum-verified ledger: restarts skip completed migrations, and a failure rolls the transaction back. Do not edit previously applied migration contents.

An auth-table trigger allocates the discriminator in the same PostgreSQL transaction as the auth user insert. A transaction-scoped advisory lock serializes allocations. Starting at a cryptographically random UUID-derived offset, the allocator searches at most 10,000 indexed candidates. The unique constraint remains authoritative. Leading zeros are retained. Exhaustion aborts insertion; the Better Auth creation hook also gives a safe capacity error before creation when capacity is already full. No cross-service transaction or post-signup repair job is necessary: an inserted auth account always has an identity. Failed client session confirmation still uses the existing retry/sign-in flow.

Core-auth supports `username` as an additional user field and returns both fields. Clients cannot choose a discriminator. Direct auth profile updates cannot change either identity field. Username changes go through Rust's rate-limited `PATCH /me/username`, which preserves the discriminator, auth ID, application ID and all relationships. Legacy registration clients that supply only a name receive a validated fallback identity.

## API contract

Paths below are relative to the existing `/api/v1` base. No new auth transport is introduced.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/me` (also `/bootstrap`) | Existing current profile, now including discriminator |
| PATCH | `/me/username` | `{ "username": "Dragon" }`; returns refreshed current profile |
| GET | `/users/lookup?username=Ash%230007` | Exact public profile lookup |
| GET | `/friends` | Accepted friends |
| GET | `/friends/requests` | Pending requests with `incoming`, `created_at`, `profile` |
| POST | `/friends/requests` | `{ "username": "Ash#0007" }`; returns request ID and `pending` or `accepted` |
| POST | `/friends/requests/{id}/accept` | Recipient accepts; 204 |
| POST | `/friends/requests/{id}/decline` | Recipient declines; 204 |
| DELETE | `/friends/requests/{id}` | Sender cancels; 204 |
| DELETE | `/friends/{userId}` | Removes mutual friendship; 204 |
| GET | `/users/blocked` | Accounts blocked by the viewer |
| POST / DELETE | `/users/{userId}/block` | Block / unblock; 204 |
| GET | `/friends/{userId}/relationship` | Viewer-specific state and request ID; never reveals another user's block |
| GET | `/friends/summary` | Exact friends, incoming, outgoing and blocked counts |

Lists return `{ items, next_cursor }` and support `limit` (1–100, default 50) and `after_id`. The UI loads 50 at a time and deduplicates IDs. Profiles contain only public fields; email is limited to the existing self-profile contract. Internal IDs identify API resources and are never rendered as identity labels.

Every protected operation validates the existing Better Auth session. Acting IDs come from that session. Parameterized SQL, canonical unordered-pair uniqueness and pair-specific transaction locks protect request, accept, removal and block races. A reciprocal send accepts the existing request. Blocking removes the friendship and cancels pending requests in one transaction; neither blocking nor friendship changes server membership. The PostgreSQL rate limiter limits sends to 15, lookups to 30 and renames to 5 per configured rate-limit window, in addition to existing global limits.

## Frontend behavior

The rail opens `/app/friends`; the page shares the existing rail and account panel. All, Pending, Blocked and Add Friend use real APIs. Profile cards opened from friends, members and chat reuse relationship controls and Copy Username. Account settings expose username editing. Successful mutations invalidate relationship lists and counts; rename refreshes self-profile, members, message authors and channel access. Failed mutations preserve confirmed list state and display retryable errors. Refresh and window-focus revalidation use the current query architecture; there is no invented realtime transport.

Presence and direct messages remain unavailable. Online is disabled, and no Message action or fake conversations are exposed.

## Validation and rollout

Frontend: `pnpm.cmd run typecheck`, `pnpm.cmd run lint`, `pnpm.cmd test`, `pnpm.cmd run build`.

`src/test/friends.browser.mjs` checks the actual React UI in isolated headless Chrome at 1440px, 375px and 320px. It exercises list and profile menus, request submission, pending requests, layout overflow and browser errors. Screenshots and the check log are saved under the ignored `.artifacts/friends/` directory. Its browser-intercepted fixtures validate UI behavior only; real-service integration is covered separately below.

Core-auth: its pinned pnpm runs typecheck, lint, tests and build. Core: `cargo fmt --all --check`, `cargo test --locked`, `cargo clippy --locked --all-targets -- -D warnings`; use an isolated target directory if a running executable locks the normal build.

Core's `.venv/Scripts/python.exe scripts/test_local_security.py --suite friends` starts a disposable loopback PostgreSQL cluster, the real built Core-auth service and the real Rust binary. It covers concurrent real registrations, cookie sessions, migration preservation, global uniqueness and exhaustion, exact lookup, authorization, request lifecycle, reciprocal concurrency, rename/session preservation and blocking privacy/cleanup. Build Core-auth first and Core into `target/friends-build` or set `CARGO_TARGET_DIR` explicitly. The default security suite remains available for backend regressions.

Deploy the reviewed Core migrations before the new Core-auth version, then deploy frontend and service changes together. This implementation does not itself change Railway/Vercel or apply production migrations. Local service tests do not verify deployed cookies, production proxy routing or live migration data. The previous Discord screenshot was not included in this request; the provided structural requirements guide the layout.
