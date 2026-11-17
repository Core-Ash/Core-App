# Server menu and events

`ServerDropdown.tsx` owns the server header menu. It contains Invite People, Server Settings, Create Channel, Create Event, then a separator and Copy Server ID, with privileged items omitted when unavailable to the current member. Switching servers stays in `LiveNavigationRail`; the dropdown contains no server list or Leave Server entry. The sidebar has one Events entry; Overview and Members remain within existing settings only.

The menu supports arrow navigation, Home/End, first-letter matching, Enter/Space, Escape, Tab, outside-pointer dismissal, and accessible menu semantics. Existing invitation/channel dialogs accept optional controlled opening and a return-focus reference, allowing the menu to close before opening a modal. Copy Server ID uses the actual selected community ID and browser Clipboard API, closes immediately, and reports success/failure through a polite live-region toast. It makes no backend request.

Event components and query hooks live under `src/features/events/`. `EventDialog` handles creation/editing; `ServerEvents` provides upcoming events, details, and authorized editing/cancellation. Details use the `event` query parameter within the current community's events view. Response parsing verifies community/event IDs, timestamps, and status before displaying data. API failures hide cached event content and offer retry. Permission responses come from Rust's existing role policy and are refreshed on focus and every 30 seconds while mounted.

The form accepts a name, description, local start date/time, optional local end date/time, and custom location or HTTP(S) link. It shows the browser's timezone. Dates are converted to UTC ISO strings; nonexistent calendar/DST times are rejected through a round-trip check. Ambiguous fall-back times use the browser's earlier occurrence. No upload or voice-event option is presented because those integrations do not exist. External links are validated, opened with noreferrer/noopener, and never fetched by the backend.

Creation holds a synchronous submission lock and sends a random `client_nonce`. Retrying unchanged fields reuses it. PostgreSQL enforces uniqueness per creator, and Rust returns the existing event for an identical retry or 409 for a nonce reused with different fields. Editing uses PATCH with the full supported editable fields and no nonce. Successful saves invalidate the community's event list and open the persisted event, with a creation/update notice. Cancel uses DELETE but retains the row as `cancelled`; existing members can still see its details. Started/cancelled events cannot be edited.

## Rust implementation

Core now includes the previously prepared invitation implementation plus `src/events.rs`. Migration `0006_invitations.sql` adds invitations and bans; `0007_events.sql` adds `core.community_events`, creator/nonce uniqueness, schedule indexes, constraints, and the `events.create` / `events.manage` permission keys. The runtime receives SELECT/INSERT and UPDATE on only the editable event columns, without DELETE, DDL, ownership, or authentication-table access. The runtime-role guard recognizes these precise column exceptions. Existing startup migrations and grants remain responsible for applying both migrations.

All routes use `/api/v1/communities/{community}`:

| Method | Suffix | Authorization |
| --- | --- | --- |
| GET | `/event-permissions` | Active member; returns `create` and `manage` booleans |
| GET | `/events` | Active member; upcoming/ongoing events, including cancellations, ordered by start time |
| POST | `/events` | `events.create`; validated fields and UUID client nonce |
| GET | `/events/{event}` | Active member; event must belong to this community |
| PATCH | `/events/{event}` | `events.manage`; future scheduled events only |
| DELETE | `/events/{event}` | `events.manage`; idempotent cancellation |

Lists return at most 50 events, `items`, and a nullable `next_cursor` containing `after_time` / `after_id`. Supply both cursor fields on the next request. Community and creator come from the route and verified session rather than submitted ownership fields. Rust validates nonempty name/location, field lengths, future starts, end-after-start, safe URL-like locations, and unknown input fields. Owner privileges are inherited from existing permission decisions; regular members receive no event grants by default. Creation has an additional 10-per-user budget per configured limiter window; existing IP/session limits, CSRF protection, deadlines, and sanitized errors also apply.

## Validation and release

Frontend typecheck, lint, unit tests, and production build must pass. Browser QA is implemented in `src/test/server-menu.browser.mjs`, with intercepted test-only fixtures; it checks desktop/mobile menus, focus, keyboard navigation, real clipboard copying, invitation creation UI, event creation, and server switching. Screenshots/reports are under ignored `.artifacts/server-menu/`. The script expects the local QA app at port 5187 with `VITE_AUTH_URL=/api/auth`, `VITE_API_URL=/api/v1`, and isolated Chrome debugging at port 9367. It does not exercise production authentication.

Rust's normal tests cover authentication boundaries and field validation. Opt-in PostgreSQL tests cover event permissions, persistence, idempotent creation, editing, cancellation, and invitation concurrency, using the actual migration runner and restricted runtime roles. They require empty disposable loopback databases: `CORE_EVENT_TEST_DATABASE_URL` with a database name starting `core_events_test`, and `CORE_INVITE_TEST_DATABASE_URL` starting `core_invites_test`. They never read the application `.env`.

No production migrations or deployments were performed. Configure `PUBLIC_FRONTEND_URL` for invitations and apply migrations through the existing separate migration credential before deploying the frontend. Live Better Auth, Railway, and Vercel integration remain unverified. Existing unrelated local edits were preserved.

Final checks passed: typecheck, lint, 238 frontend tests, production build, 23 normal Rust tests, and both opt-in PostgreSQL tests. Chrome QA passed with no console errors; screenshots cover desktop and 390px/320px layouts. Vite reports a non-fatal main-bundle size warning.
