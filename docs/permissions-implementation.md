# Server permission implementation report

Implemented locally in Core App and the explicitly authorized sibling Core repository. No deployment, production migration, or Core-auth changes were performed.

## Catalog and compatibility

The complete 53-entry catalog is in [catalog.json](../src/features/community/permissions/catalog.json). It contains stable Core keys, Discord flag equivalents, names, descriptions, groups, resource applicability, overwrite applicability, dependencies and enforcement status. There are 19 enforced permissions, one legacy foundation permission and 33 unavailable permissions.

Core uses relational text keys, not numeric bitmasks. All 15 existing keys remain unchanged:

`administrator`, `community.manage`, `members.manage`, `roles.manage`, `channels.manage`, `channels.view`, `messages.send`, `messages.moderate`, `audit.view`, `bans.manage`, `emojis.manage`, `invites.create`, `invites.manage`, `events.create`, `events.manage`.

The enforced catalog comprises those existing permissions except `messages.moderate`, plus `expressions.create`, `nicknames.change`, `nicknames.manage`, `members.moderate`, and `messages.read_history`. `messages.moderate` remains a foundation because Core does not expose message moderation operations.

Rust owns the canonical `Core/src/permission_catalog.json`. `node scripts/sync-permission-catalog.mjs` generates the committed frontend projection; `--check` detects drift. Both editors consume this projection; backend overwrite validation consumes the canonical registry. There is no React permission-resolution engine.

## Rust and PostgreSQL

Migration `Core/migrations/0017_permission_catalog.sql` adds permission definitions and server-local nickname/timeout fields. Existing role assignments, base grants and overwrites are not changed. It preserves the existing resolver and adds a central View Channel dependency and expiring timeout restrictions. Timed-out members retain only View Channel and Read Message History; owners and Administrators are exempt.

Read Message History now guards the historical-message endpoint independently of View Channel. New server creation explicitly grants history access. **Existing servers receive no new default grants: owners must deliberately enable Read Message History for appropriate roles.** Deploying this migration without configuring that grant will restrict ordinary members' history retrieval.

The existing owner, Administrator, implicit @everyone and overwrite layers are retained. Role Allow wins at the aggregated role layer; explicit member overwrites take precedence. Category synchronization remains distinct from Neutral.

Additional enforcement changes:

- Nickname endpoints alter only server membership, with a separate own/other-member permission and hierarchy protection.
- Timeouts support removal, reason, duration up to 28 days, expiry, protected targets and audit records.
- Kick and ban now check member hierarchy. Kick no longer implies ban access.
- Role assignment cannot grant permissions absent from the actor, including Administrator through a lower role.
- Role/hierarchy mutations serialize with overwrite and moderation updates on the community row.
- Expression creation has its own permission; existing expression managers retain creation access.
- Manage Server no longer implicitly grants expression management or audit-log viewing.
- Runtime audit access is SELECT/INSERT; UPDATE/DELETE are revoked. Overwrite saves create transactional audit records.
- Unsupported catalog keys cannot be newly granted through role mutation requests.

## React editors and member integration

The role editor retains Core's dark theme and red switches, with Display, Permissions, Links and Manage Members tabs. Permission sections have descriptions, right-aligned switches and dividers. Search covers name, description, group and flag, preserves drafts, and provides an empty state. Clear Permissions requires confirmation and edits the draft. Administrator retains confirmation. Failed saves preserve drafts; role switching, settings navigation and browser unloading warn about unsaved changes.

Channel/category editors share the catalog, filter by resource, retain role/member targets and Deny/Neutral/Allow controls, and provide search, empty states, Clear Permissions, Save/Reset and discard warnings. Clearing a target resets its applicable supported overwrites to Neutral. Existing synchronization and optimistic assignment behavior remain intact.

Server member settings provide nickname and timeout dialogs using backend-provided capabilities. The member directory displays server nicknames without changing global profiles. Role assignment controls consume backend hierarchy capabilities; moderation and expression controls use their corresponding permissions.

## Unsupported features and boundaries

Voice/LiveKit media enforcement, threads, file uploads, reactions, polls, TTS/voice messages, rich link previews, cross-server expressions, mass notifications, message moderation/pinning, slowmode, webhooks, installed applications, activities, stage channels and analytics are not implemented by this change. Their catalog entries are visibly disabled and labeled unavailable, or foundation-only. Stable definitions do not imply functioning integrations.

Core invitation links and events are currently server-scoped. Channel-specific invite and event configuration is withheld until the resource contract supports it. Server-level invite and event authorization remains active.

## Validation

- Frontend: typecheck, ESLint, all 364 tests and production build passed. Build retains the existing chunk-size advisory.
- Backend: 11 unit tests and 20 HTTP tests passed. Four database tests are opt-in in the ordinary Cargo run.
- Disposable loopback PostgreSQL: permission handler/resolver regression, invitation regression and event regression were run separately. The permission regression covers restricted-runtime persistence, tri-state writes, history denial, role Allow/Deny aggregation, member precedence, View Channel dependencies, category synchronization, independent overrides, nickname isolation, timeout expiry, owner protection, equal-role moderation and Administrator self-assignment rejection.
- Upgrade fixture: applying 0017 over existing role grants preserves them and does not add history grants.
- Rust formatting passed. Strict Clippy reports older collapsible-if, unnecessary-map-or and test-module ordering warnings; it is not a clean check.
- No real signed-in browser or deployed Better Auth integration was verified. Frontend tests use fixtures; database tests exercise actual PostgreSQL and Rust handlers.

## Remaining priorities

1. Before any separately authorized deployment, review the explicit history-grant rollout and test two real signed-in accounts, including role revocation, private channels, nickname edits and timeout expiry.
2. Resolve existing strict Clippy findings and perform browser visual/responsive QA against the supplied screenshots.
3. Connect unavailable permission definitions only when their real application features exist, with corresponding backend enforcement and integration tests. Voice permissions require real media-token and track-publication enforcement.

Behavioral references: [Discord developer permissions](https://docs.discord.com/developers/topics/permissions) and [Discord permission setup FAQ](https://support.discord.com/hc/en-us/articles/206029707-Setting-Up-Permissions-FAQ).
