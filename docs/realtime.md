# Real-time messaging

Core uses one native WebSocket per authenticated browser tab. HTTP remains responsible for every persistent mutation; PostgreSQL remains authoritative. No messaging broker, auth replacement, or new frontend state library is used.

## Transport and authentication

The frontend waits for the existing application profile cache, then calls `POST /api/v1/realtime/ticket` through the normal cookie-authenticated, CSRF-protected Rust API. Rust issues a random, single-use ticket valid for 30 seconds. The browser connects to `GET /api/v1/realtime` with subprotocols `core.v1` and `core.ticket.<ticket>`. The ticket stays in memory and never enters a URL or browser storage.

The handshake requires an exact allowed Origin and revalidates the original Better Auth credential. Cookie upgrades remain supported directly. Long-lived connections are bounded by the verified session expiration and periodically revalidate with Better Auth. Revoked sessions close with 4401; authentication outages close with retryable 1013. Cookies, SameSite, CSRF rules, and the official Better Auth React client remain unchanged.

## Deployment configuration

Set the **Rust service's** `REALTIME_PUBLIC_URL` to its public `wss://<backend-host>/api/v1/realtime` endpoint when the frontend's HTTP API uses the existing fetch-based proxy. That proxy still carries the ticket request; the socket connects directly to Rust. Do not route an upgrade through the existing `proxyServiceRequest` fetch handler.

Without this setting the ticket returns `/api/v1/realtime`, suitable for a same-origin upgrade-capable reverse proxy. Vite's API proxy enables WebSocket forwarding. Production requires WSS; local development may use WS on loopback.

`REALTIME_ALLOWED_ORIGINS` defaults to Rust's CORS origin list. Configure exact frontend origins, without wildcards. Additional Rust settings:

| Setting | Default |
| --- | --- |
| `REALTIME_HEARTBEAT_SECONDS` | 25 |
| `REALTIME_REAUTH_SECONDS` | 60 |
| `REALTIME_MAX_CONNECTIONS` | 5000 |
| `REALTIME_MAX_CONNECTIONS_PER_USER` | 10 |
| `REALTIME_MAX_SUBSCRIPTIONS` | 50 |
| `REALTIME_MAX_MESSAGE_BYTES` | 8192 |
| `REALTIME_MAX_OUTGOING_BYTES` | 262144 |
| `REALTIME_QUEUE_CAPACITY` | 256 |

Railway metadata inspected on 2026-11-28 reported one running Core backend instance and one configured replica. No deployment, environment variable, database migration, or infrastructure setting was changed. The public WSS route and two real Better Auth browser sessions still require deployment verification.

## Protocol and authorization

Version 1 envelopes contain `version`, `type`, `event_id`, process-local `seq`, `server_time`, `conversation`, and `data`. Conversation kinds are `channel`, `direct`, `group`, and `thread`. Client requests use `data.conversation_type` and `data.conversation_id`; optional request IDs are echoed in acknowledgments.

Subscription requests are authorized using the existing Rust permission and membership checks. Every queued conversation event is checked again immediately before delivery. Private threads use thread access checks rather than parent-channel membership alone. Blocked direct conversations cannot receive live events. Permission-affecting HTTP mutations request rechecks and send a content-free permission refresh signal. Revoked subscriptions receive `conversation.access_revoked` and lose their loaded message cache.

The hub supports multiple tabs per user, bounded outgoing queues, connection/subscription caps, incoming frame limits, frame rate limits, ping/pong, idle detection, and graceful shutdown. Slow consumers close and reconnect. Oversized conversation events become resync requests. Registry locks are synchronous, short-lived, and never span async operations. Delivery checks currently cost a database authorization check per receiving connection; benchmark and batch recipient checks before substantially increasing the connection ceiling.

## Events and cache reconciliation

Committed HTTP handlers publish message creation, edits, deletion, reactions, forwarding, and thread activity. Replies use normal message DTOs with their existing metadata. Reaction delivery hydrates viewer-specific `me` flags for each recipient. Deletion events contain only the message ID and deletion time. Mention outbox processing emits account-scoped notification invalidations after its transaction commits.

The React client multiplexes conversation subscriptions over one socket, reference-counts consumers, and closes on session disposal. Message/reaction events update the existing paginated caches and preserve cursor boundaries. IDs and author/nonces reconcile optimistic sends in either HTTP/WS arrival order. Older edits cannot overwrite newer edits; deletion remains terminal. Reaction snapshots replace counts instead of incrementing them, and late mutation callbacks avoid overwriting a newer socket update. Message edits/deletions use targeted cache updates on the sender as well. Scroll following changes only for new messages or initial history, preserving position during edits and reactions.

Subscribe acknowledgments trigger a history refresh while subsequent events are buffered and then replayed. Reconnect obtains a fresh ticket, restores subscriptions, and repeats this reconciliation. Backoff is exponential with jitter and a roughly 30-second ceiling. Event-ID deduplication and per-message sequence tracking are bounded. HTTP message polling remains a fallback when the socket is unavailable; normal connected message events do not trigger full history refetches. Conversation previews are updated in the existing sidebar cache; previously unseen conversations trigger a list refresh.

Typing carries only server-owned identity and display name. It is throttled, never persisted, and expires in the UI after seven seconds. Sending an empty draft or leaving a conversation sends a stop event. Public thread summaries update parent-message indicators and thread lists. Private-thread details are delivered only to authorized thread subscribers.

## Delivery guarantees and limitations

Publication is best effort after commit. There is no durable message-event replay or exactly-once guarantee. Sequence numbers reset on process restart; reconnect and window-focus history reconciliation restore authoritative state. A commit followed by a process crash can lose its live notification. The existing durable mention outbox remains dedicated to mention notifications.

The hub and upgrade tickets are process-local. Multiple replicas, rolling-deployment overlap, or independent Rust processes require shared routing plus cross-process event delivery before they can reliably serve all recipients. PostgreSQL LISTEN/NOTIFY, an outbox, or a broker can be added behind the publication boundary later.

No persisted read-state/read-receipt API or authoritative unread counter exists in the inspected source, so this change does not invent one. Channel-wide unread badges and cross-device read positions require that persistence contract. There is no new visible read-receipt feature.

The local integration suite uses real HTTP/WebSocket clients and disposable PostgreSQL with a test-only Better Auth server. It is evidence of local transport and authorization behavior, not live Better Auth or Railway integration. Run backend tests and the disposable suite from Core; run `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, and `pnpm run build` from Core App.

Validated on 2026-11-28: TypeScript, ESLint, production build, and 427 frontend tests passed. Rust unit/HTTP tests passed (43 tests; four separate opt-in database tests remain ignored). The disposable PostgreSQL suite passed startup migration regressions, real WebSocket authentication and delivery across channels/DMs/groups/threads, private-thread payload protection, forwarding, failed-mutation silence, reaction personalization, typing, access revocation, session revocation/expiry, and existing mention/message-feature regressions. The production build reports a large JavaScript chunk warning. Both repository Graphify graphs were refreshed with local code extraction only.
