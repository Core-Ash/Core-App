# Link invitations

The React implementation lives in `src/features/invites/`. It makes real HTTP requests through the existing Rust API transport. There are no application fixtures, synthetic invitations, manual token forwarding, or direct database connections.

The invitation backend is now implemented in the adjacent Core repository (`src/invites.rs`, `src/invites_tests.rs`, and migration `0006_invitations.sql`). The subsequent server-dropdown task explicitly authorized modifying both repositories. The previous review patch has been applied to source and removed from this repository. No production migration or deployment has been performed. No Core-auth changes are needed.

## Frontend behavior

- `/invite/:code` is public. Its preview uses `credentials: omit`; membership checks and acceptance use the existing cookie-backed API client.
- Login and registration preserve a strictly validated local invitation destination. Existing session confirmation remains mandatory. Opening a link never joins.
- Acceptance explicitly provisions the existing Rust application profile if needed, then accepts the invitation. The community and profile caches are invalidated before selecting the joined server.
- Invite People opens a dialog. A clearly labeled Generate Invite Link button creates the first link. Later opens reuse the link held in the current session's query cache and revalidate its public preview. Reloading, logout, session replacement, or cache expiry can discard it. The server stores hashes only and cannot recover raw links.
- Authorized users can choose expiration/usage limits, copy links, and generate additional links. Earlier links remain active until revoked.
- Server Settings → Invites lists actual response metadata with pagination and revocation. Members retains the existing directory; user-reference admission was removed. Creation and management are separate permissions.
- Existing owner channel creation continues to use ownership returned by Rust, even before the invitation-permissions endpoint is available. Delegated channel creation uses the backend permission result.
- Invalid, exhausted, revoked, and expired links display Invite Invalid. Temporary service errors offer retry. Existing members can open the server even after the link's last use was consumed.
- Global `no-referrer` policy, request-specific `referrerPolicy`, and image referrer policies reduce token leakage. No raw tokens are persisted to browser storage. Do not add page-URL analytics to invitation pages.

## Rust contract

All paths are under `/api/v1`; communities are Core's existing server abstraction.

| Method | Path | Access and result |
| --- | --- | --- |
| GET | `/invites/{code}` | Public, rate limited, safe server name/icon/banner/description/member count and expiry; no internal IDs or identity data |
| GET | `/invites/{code}/status` | Verified session and application profile; `{already_member, community_id}` where the ID is null for outsiders |
| POST | `/invites/{code}/accept` | Verified session and application profile; atomically joins or returns existing membership |
| GET | `/communities/{id}/invite-permissions` | Active members only; `{create, manage, manage_channels, owner}` from existing permission decisions |
| POST | `/communities/{id}/invites` | `invites.create`; body `{expires_in_seconds, max_uses}`; returns `{id, code, url, expires_at, max_uses, uses}` |
| GET | `/communities/{id}/invites?before={uuid}` | `invites.manage`; up to 50 `{id, creator, created_at, expires_at, max_uses, uses, status}` entries plus `next_cursor` |
| DELETE | `/communities/{community}/invites/{id}` | `invites.manage`; idempotent revocation, scoped to the community, HTTP 204 |
| DELETE | `/communities/{id}/membership` | Active non-owner members may leave; HTTP 204 |

Public preview is deliberately independent of authentication. The separate private status endpoint avoids varying/caching a public response by identity. A new account can receive 409 from status until `/me` provisions its application profile. Acceptance does that only after the user clicks Join Server.

Error responses use the existing sanitized JSON envelope: 404 for unusable invitations, 403 for forbidden/banned users, 429 with Retry-After for rate limits, and 503 for unavailable dependencies. Accept always revalidates against PostgreSQL, including expiry after acquiring locks.

## Migration and security behavior

`0006_invitations.sql` adds `core.community_invites`, `core.community_bans`, optional community presentation fields, invitation lookup/list indexes, and an active-membership count index. Existing opaque Better Auth IDs remain mapped through `core.users`; invitation creator/membership foreign keys use application UUIDs.

Tokens combine two independent OS-random v4 UUIDs (244 random bits), encoded as 64 lowercase URL-safe hex characters. Only SHA-256 digests are stored, with a unique constraint. Raw codes appear only in the creation response and shared URL. Listing never returns hashes or tokens. Existing request logs use matched route templates rather than actual invitation paths.

Creation defaults to seven days when expiry is omitted. Explicit null means never. Expiration is allowlisted to 1800, 3600, 21600, 43200, 86400, or 604800 seconds; uses are null or 1, 5, 10, 25, 50, 100. Existing owner permission semantics apply; other members need an explicit `invites.create`/`invites.manage` grant. No new grants are given to the Member role automatically.

Acceptance uses an invitation row lock plus a per-user transaction advisory lock, serializing concurrent accepts across different links too. Membership creation/reactivation, default Member role assignment, and usage increments share one transaction. Unique membership constraints remain the backstop. Existing members consume no use. Rejoining clears previous role assignments before assigning Member, so leaving cannot restore privileged roles. Missing default roles fail closed. Banned users cannot accept. There was no existing ban model; the new ban table is writable only by administrative database credentials. A ban-management UI/API is outside this change.

The existing PostgreSQL-backed rate limiter applies an IP budget to public lookups and verified-user budgets to creation and acceptance. Endpoint-specific limits are 60 previews/IP, 10 creations/user, and 20 accepts/user per configured rate-limit window. Revocation/list/status retain the global limits. Preview responses are `no-store` to avoid stale validity decisions.

Runtime grants are explicit: SELECT/INSERT invitations, UPDATE only invitation `uses`/`revoked_at`, SELECT bans, UPDATE only membership `left_at`, and DELETE member-role links for safe rejoining. The runtime-role guard is updated for these precise exceptions; ownership, broad UPDATE/DELETE, authentication-table access, and DDL remain prohibited. Migrations use the existing separate migration credential and checksum/locking runner.

## Runtime configuration

Set Core's `PUBLIC_FRONTEND_URL` to the exact public frontend origin (HTTPS outside localhost, no trailing slash or path). Include that origin in `CORS_ORIGINS`. Keep `MIGRATION_DATABASE_URL` separate from `DATABASE_URL` as required by Core's startup migration runner. Deploy the matching backend and apply migrations through that existing workflow before releasing the frontend. This work changes local source only.

## Verification

- Frontend `pnpm run typecheck`, `pnpm run lint`, `pnpm test` (238 tests across 24 files), and `pnpm run build` passed. Vite reports a non-fatal bundle-size warning for the main JavaScript chunk.
- The applied backend compiled and passed its token/settings tests and HTTP authentication/security tests, including the public-preview/private-mutation boundary.
- A disposable PostgreSQL 17 database on loopback passed an additional transactional test using the restricted runtime role. It applies the actual migrations/grants and verifies 20 concurrent accepts of a five-use link yield exactly five joins, retries do not consume uses, separate links racing for one user consume one use total, banned users are rejected, permission and revocation checks hold, expired links fail, leaving/rejoining avoids duplicates, delegated creation does not grant management, and missing default roles roll back admission and accounting.
- That database test is opt-in (`cargo test postgres_invitation -- --ignored`). It requires `CORE_INVITE_TEST_DATABASE_URL` pointing to an **empty, disposable loopback database** whose name begins `core_invites_test`, with credentials permitted to create test roles. It never reads `.env` and creates a small auth table solely as a test fixture for the public-profile view.
- Unit fixtures and direct handler/database tests do not establish live Better Auth, Railway, Vercel proxy, authenticated browser, clipboard, or production integration. Those remain unverified until a real end-to-end test is performed against the deployed backend.
