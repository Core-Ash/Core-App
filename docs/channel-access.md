# Channel access viewer

Open the gear in a text channel header, then **Permissions → View Channel Access**. The viewer shows effective member totals, role colors/counts/override states, allowed and denied member pages, highest assigned roles, and all backend explanations contributing to the effective result. Public names and avatars now resolve through migration 0005's linked Better Auth projection; initials are used when absent. The same profile card is reused throughout the workspace. Search is a literal case-insensitive name/username substring, debounced by 300 ms. Role counts may overlap and are not a sum of effective access.

## Contract and authorization

`GET /api/v1/communities/{community_id}/channels/{channel_id}/access`

| Query | Meaning |
| --- | --- |
| `access` | `allowed` (default) or `denied` |
| `search` | Up to 100 Unicode characters; searches display name and username |
| `role_id` | Optional assigned role UUID; membership in a role is a filter, not a permission decision |
| `limit` | 1–100, default 50 |
| `after_id` | Member UUID from `next_cursor`; ascending UUID keyset pagination |

The response contains `channel: {id, community_id, name}`, `total_allowed`, `total_denied`, `filtered_total`, `roles`, `items`, and nullable `next_cursor`. Totals cover all active members regardless of search/role filters. `filtered_total` covers the selected access group and filters before pagination. Roles include `id`, `name`, nullable hex `color`, `position`, active `member_count`, and `access` (`allowed`, `denied`, `inherited`, `none`). Members include `id`, `username`, `display_name`, nullable HTTPS `avatar_url`, `allowed`, nullable `highest_role`, and `sources: [{kind, role_id?, role_name?}]`. Email and authentication identities are never exposed. Multiple sources are displayed without recomputing access in React.

The Rust handler requires a validated Better Auth session, a linked application profile, active community membership, effective `channels.view`, and effective `channels.manage` for the requested channel. Active owners satisfy those grants. A channel must belong to the path's community; mismatches and policy failures return 403 without membership metadata. The UI settings control is discoverable by visible-channel users, but inspection succeeds only after backend authorization. Hiding controls is not an authorization boundary. Existing 401/403/429/service-error handling remains in use, with no raw diagnostics or credentials in the UI.

## One authoritative evaluator

Migration `Core/migrations/0004_channel_access.sql` introduces `core.permission_decisions(community, channel, permission, optional_user)`. Authorization guards, visible-channel filtering, message reads/writes, and the viewer all use this function. It is stable SQL with invoker rights, and its execution is revoked from PUBLIC.

Precedence:

1. Require active membership, a known permission key, and valid channel/community scope. A departed owner cannot bypass membership.
2. The active community owner receives access.
3. Any explicit member or assigned-role denial wins for non-owners. A member allow cannot override a role denial; this preserves Core's existing deny-first policy.
4. Without a denial, a member allow, channel role allow, or community role grant permits access. All contributing grants are returned.
5. Otherwise deny. Membership alone is not an implicit `@everyone` permission.

`inherited` means a community role grant. Core has no category model, default-server grant, or special administrator permission. A role named Administrator is an ordinary role; it does not bypass denials. These semantics remain unavailable instead of being fabricated. Highest role uses descending `position`, then name/UUID for stable ties; rank/color are display metadata and do not grant access.

## Database and release requirements

Migration 0004 adds nullable role colors, nonnegative role ordering (default 0), and `core.channel_member_permissions`, with membership/channel composite foreign keys that prohibit cross-community assignments. Existing role grants and overrides remain intact. No permission-editing endpoint or UI is introduced; reviewed administrative tooling owns permission writes.

Before running the updated Rust service, apply migration 0004 using migration credentials and grant the restricted runtime role SELECT on `core.channel_member_permissions` and EXECUTE on `core.permission_decisions(uuid, uuid, text, uuid)`. The exact template is in `Core/docs/runtime-role.sql`. The runtime role needs no new writes and no auth-schema access. Startup checks the new schema and privileges. Existing cookie, CSRF, CORS, public environment variables, and proxies remain unchanged. Deploy the matching backend before the frontend. No production migration, grant, deployment, or existing service restart was performed during implementation.

## Performance and freshness

The endpoint evaluates members in bulk, computes counts and the page in SQL, aggregates role counts once, and retrieves highest roles in one set operation. There are a fixed five application queries inside a repeatable-read, read-only transaction: two authorization decisions, channel metadata, role metadata/counts, and the member summary/page. The identity extractor has its existing profile lookup. No per-member or per-role round trips occur. Only up to `limit` members are returned; role metadata is returned as a whole. Separate page requests are live snapshots and can reflect concurrent membership changes; results deduplicate by member ID.

Queries are session-scoped and keyed by community, channel, search, role, and access group. Filters reset the cursor. Obsolete reads consume AbortSignal; late responses cannot replace the selected channel. The viewer fetches only when opened, rechecks on focus and every 30 seconds while mounted, and offers Refresh access. Successful member admission invalidates that community's channel-access query prefix. Future permission, role, membership-removal, or category mutations must invalidate `queryKeys.channelAccess(communityId)` when their endpoints exist. Background polling handles changes made outside this frontend, with up to a 30-second delay. Failed revalidation hides cached membership results. Session loss/account changes use the existing cache-clearing and cancellation scope.

## Verification

Frontend tests exercise settings navigation, lazy loading, totals/sources, debounced server search, role/access filters, pagination, stale-request cancellation, denied access after revocation, and invalidation after member admission. Runtime contract tests reject unsafe or malformed metadata and cross-scope responses. The existing authentication/session tests remain enabled.

Rust HTTP tests include the new protected route. `Core/scripts/test_channel_access.py` runs through the existing disposable local PostgreSQL harness against the actual Rust binary. It compares viewer decisions with real channel-list and message-read authorization for role grants, member allow/deny, conflicting roles, owner bypass, missing grants, manager authorization, inactive membership, filters/search/cursors, and bulk pagination. It checks cross-community constraints and verifies that a role named Administrator does not introduce unsupported bypass semantics. PostgreSQL is real; Better Auth is mocked at its existing protocol boundary. This does not prove deployed browser cookies, live Core-auth integration, or production migration state.

On 2026-11-16, TypeScript, lint, 169 frontend tests, and the production build passed. Rust build, formatting, Clippy with warnings denied, and all 19 HTTP tests passed. The isolated PostgreSQL suite also passed, including 1,120-member pagination and manager/owner membership or permission revocation, then removed its temporary database and cluster. No dependency or lockfile changes were needed.
