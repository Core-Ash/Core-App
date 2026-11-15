# Member profiles and directories

## Root cause

The sidebar was a hardcoded `UnavailableMembers` component, with no member-fetching hook or ordinary member-read endpoint. The manager-only access inspector was not a suitable substitute. Message records carried author UUIDs without public profiles, and the frontend substituted IDs for other authors. This was missing functionality rather than a discovered CORS or cookie failure.

Inspection on 2026-11-16 confirmed that the configured Core and Core-auth database host/port/name match, that the live auth user table has `id`, `name`, and `image`, and that `core.users.auth_user_id` exists. This inspection read catalog metadata only, without printing credentials or user records. `core.memberships.user_id` references the application UUID in `core.users.id`; the unique `auth_user_id` links it to Better Auth. No accounts, credentials, or identity mappings are created or changed by member reads.

## Backend and database

Migration `Core/migrations/0005_public_profiles.sql` adds `core.public_profiles`, a security-barrier read-only projection of four public fields: application `id`, Core `username`, `display_name`, and nullable `avatar_url`. It joins Better Auth's existing `auth."user"` by the verified ID link. Name/image updates appear on the next backend read. Core's stored name is retained when the auth record is missing/unlinked or its name is blank; no email-based linking occurs. Names retain Core's existing 80-character bound.

The view creator needs access to the linked Core user fields and Better Auth's `id`, `name`, and `image`. Runtime receives only SELECT on the public view, with no auth-schema usage, direct auth-table/column read, or view-write grant. PUBLIC receives no access. Existing startup privilege checks continue to reject raw auth-table access. The view uses its owner's underlying read permissions to allow this deliberately narrow projection; the migration role must be trusted and separate from runtime. Migration 0005 requires the existing Core-auth schema, preserves all user/membership/message records, and adds no new identity system. Existing migrations are unchanged.

Rust normalizes avatar URLs centrally: only absolute HTTPS URLs without embedded credentials are returned; absent/invalid values become null. The client validates the same public response shape and uses initials when an image is absent or fails to load. Email, auth IDs, session metadata, passwords, and tokens are excluded from directory, access-inspector, and message-author profiles. The current user's private `/me` response retains its existing email field.

## Contracts

| Endpoint under `/api/v1` | Policy and response |
| --- | --- |
| GET `/communities/{id}/members` | Active community members can read the community directory. Does not expose channel access. |
| GET `/communities/{community_id}/channels/{channel_id}/members` | Caller must effectively view that channel in that community; returns only active members for whom the shared evaluator grants view. Does not require management permission or expose denied-member metadata. |
| GET `/channels/{id}/messages` | Existing view policy, now includes `author: PublicProfile \| null` using one batch for all distinct authors in the page. |
| POST `/channels/{id}/messages` | Existing send policy/nonce deduplication, with the same resolved `author` on creation and retries. |
| GET `/communities/{community_id}/channels/{channel_id}/access` | Existing manager-only policy, now uses the same live public name/avatar projection. |
| GET/POST `/me`, GET `/bootstrap` | Own profile now has current public name and nullable `avatar_url`, alongside existing private fields. |

Both member endpoints accept `search` (literal, case-insensitive display-name/username substring, up to 100 Unicode characters), `limit` (1–100, default 50), and optional `after_id` UUID keyset cursor. They return `{community_id, channel_id: UUID|null, total, items, next_cursor: UUID|null}`. `total` counts matching visible members before pagination. Each item contains the public profile, `community_id`, RFC 3339 `joined_at`, and `roles: [{id,name,color,position}]` ordered by descending rank then name/UUID. The membership is identified by `(community_id,id)`; no new membership ID is invented. No presence field is returned.

Rust validates the Better Auth session on every request, checks active membership and channel scope, and uses the existing `core.permission_decisions` evaluator. Owners, role/member allows, and deny precedence are unchanged. Unsupported administrator/category semantics are not fabricated. Filtering, counts, pagination, and role aggregation happen in a single set-based query after authorization inside a repeatable-read, read-only transaction. No per-member lookup occurs. Unauthorized/cross-community requests return 403 without profiles; missing/expired sessions return 401. Invalid filters return 400. Other errors use existing safe API handling.

Message author resolution batches actual author IDs from authorized message results, never a caller-supplied list. Former members retain attribution because their message references the stable application UUID. Missing auth records fall back to the stored application profile; an absent application author returns null and the UI labels the actual UUID safely. Message IDs, timestamps, nonce behavior, content, and history ordering are preserved.

## Frontend

`MemberDirectory` loads channel-visible members automatically in the wide sidebar and when the existing member toggle opens the narrow dialog. The Members page loads the community directory independently of channels. It reuses the existing dark theme, sidebar scrolling, mobile dialog/focus restoration, avatars, and buttons. Members group by highest backend-ordered role with actual role colors; loaded group counts are labelled as such. Search is debounced 300 ms, pages are loaded explicitly, and loading, empty, error, and retry states are provided. No online, idle, DND, game activity, or session-derived presence is invented.

`MemberIdentity` supplies the same profile card to the directory, message authors, and access inspector. It shows public name/username/UUID, avatar, and already-loaded roles/join date where available; clicking never makes per-user API requests. Settings and the account panel also consume the public name/avatar from Rust. Friends remain unavailable rather than being simulated.

Query keys include session scope, community, channel, and search. Obsolete requests are cancelled and late responses discarded. Closing the sidebar stops its polling. Directories recheck on focus, manual refresh, and every 30 seconds while mounted; a failed revalidation hides cached rows. Confirmed member admission invalidates both that community's member queries and access inspector. Future removal, role, permission, or profile mutation hooks should invalidate those resource prefixes; no such write endpoints exist yet. Backend permission decisions are uncached and use current data per request. Cross-request UI updates are eventual, with the polling interval as a bound while visible. Historical message profile changes appear when history is refreshed.

## Rollout and verification

Apply pending migrations 0004 and 0005 with migration credentials, then grant the restricted runtime role SELECT on `core.public_profiles` in addition to migration 0004's documented SELECT/EXECUTE grants. The template is `Core/docs/runtime-role.sql`. Deploy the matching backend before the frontend: the new message/profile fields are validated strictly. Existing public environment variables, cookie, CORS, CSRF, and proxy settings are unchanged. No dependencies or lockfiles changed. No existing database migration, grant, deployment, or service restart was performed here.

The disposable local PostgreSQL suite tests real auth-schema name/image joins and updates, ordinary-member authorization, private channel role/member denials, cross-community isolation, departed authors, missing auth records, avatar sanitization, restricted runtime grants, literal search, and 1,007-member pagination. It runs the actual Rust binary with real PostgreSQL and a mocked Better Auth session service; its database/cluster are removed afterward. Existing permission/security regression suites also pass. Frontend tests exercise the sidebar toggle, resolved authors, profile cards/avatars, search, pages, cancellation, invalidation, empty/errors, and malformed contracts. Successful live Core-auth sign-in and deployed browser-cookie flows remain unverified.

Validation on 2026-11-16 passed: TypeScript, lint, all 179 frontend tests across 20 files, production build, Rust build/formatting/Clippy, all 19 HTTP tests, and the expanded disposable PostgreSQL suite. Only read-only catalog metadata was inspected in the configured existing database; migrations and test records were confined to the disposable cluster.
