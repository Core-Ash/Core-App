# Channel and private-message mentions

The shared `MessageComposer` uses `MentionAutocomplete`, with data supplied by
`ChannelMentionComposer` or `ConversationMentionComposer`. Channel search reuses
the permission-filtered, paginated member API and a channel-scoped eligible-role
API. It debounces requests by 180 ms, uses React Query caches and abort signals,
and clears the composer on channel/conversation navigation. DMs search only their
participants and never suggest roles or mass mentions.

Selection inserts a readable label and stores its stable target UUID separately.
The composer tracks the actual textarea selection, supports keyboard and pointer
selection, preserves surrounding text, and handles composition input. Editing
inside a mention removes its identity. Core-to-Core copies include validated
clipboard metadata; ordinary pasted text remains ordinary text. Emails and plain
`@everyone` text are never automatically promoted into notifications.

## Wire representation

Message creation and editing accept an optional `mentions` array:

```json
{
  "body": "Hi @Ash",
  "mentions": [
    { "kind": "user", "id": "11111111-1111-4111-8111-111111111111", "start": 3, "end": 7 }
  ]
}
```

`start` is inclusive and `end` exclusive, both measured in UTF-16 code units.
Kinds are `user`, `role`, `everyone`, and `here`. Special mentions have no `id`.
Creation also requires the existing `client_nonce`. Outbound serialization strips
display metadata; Rust validates ordered, non-overlapping spans, Unicode
boundaries, target scope, effective permissions, and the server's mention limit.
Invalid targets produce a generic validation error that does not reveal private
membership. Private conversations reject role and special mentions.

Migration `Core/migrations/0019_mentions.sql` adds JSONB metadata with an empty
default to both message tables. Existing bodies and nonce behavior are retained.
Responses resolve current public profiles and role labels/colors, with safe
fallbacks for missing targets. React renders labels as text, and user mentions
open the existing profile popover. Optimistic messages retain the selected
profiles and spans; confirmation replaces them with the backend response. Failed
sends retain metadata in the existing retry outbox.

## Backend endpoints

All paths use the existing authenticated `/api/v1` boundary:

- `GET /channels/{id}/mention-roles?search=...`: eligible roles and mass mentions;
  also returns `here_available: false`.
- `PATCH /channels/{scope}/messages/{id}` and
  `PATCH /conversations/{scope}/messages/{id}`: author-only edits with validated
  `body` and `mentions`. Channel edits also retain keyword AutoMod checks.
- `DELETE` on those message paths: author-only soft deletion.
- `GET /mention-notifications`: the caller's latest 100 accessible mention
  records, with message and channel/conversation references.

Role mentionability and `messages.mention_everyone` use the existing effective
permission engine, including owner/administrator and channel/member overrides.
The permission catalog now marks this permission enforced. Message send/edit
rate limits remain authoritative in Rust. Private message blocking remains in
force, and mentioning someone never changes membership.

## Notification semantics

Database triggers enqueue one durable job per inserted or changed mention list,
inside the message transaction. A backend worker polls once per second and handles
at most ten batches of 100 members per tick, using transactional row locks,
keyset cursors, and one set-based recipient insert per batch. It filters channel
access, history access, active membership, blocking, channel mute/notification
preferences, and category mute preferences. It excludes the sender and members
who joined after the event was queued.

There is at most one notification per message and recipient, across direct,
role, and mass targets. Edits can notify newly eligible recipients; existing
recipients are never alerted a second time for that message. Removing a mention
does not erase the historical event. Deleting the message removes its jobs and
notifications. Retrieval rechecks access and hides deleted messages. Failed or
rolled-back sends never enqueue a job. DMs have no other persistent alert system
to duplicate; mention events share the same unique-message policy.

`@here` is recognized, styled, and permission-checked, but creates no recipient
alerts while Core lacks reliable presence. No WebSockets, browser push, or
notification inbox/read-state UI is added. Notification retrieval is available
through Rust for future consumers.

## Validation and rollout

The implementation is local and has not been deployed. Migration 0019 has only
been applied to disposable loopback test databases. Startup migrations reconcile
the new runtime grants; manual provisioning must grant the equivalent table,
sequence, and message-column privileges documented in Core's migration runner.
Deploy the backend and migrate before enabling the new frontend against it.

Run the frontend's typecheck, lint, tests, and build. The backend's focused
integration suite uses its existing disposable TLS PostgreSQL harness:

```powershell
$env:CARGO_TARGET_DIR = (Resolve-Path './target/security-build').Path
cargo build --locked --target-dir target/security-build
.\.venv\Scripts\python.exe scripts/test_local_security.py --suite mentions
```

This tests actual Rust HTTP handlers and restricted PostgreSQL runtime grants,
including migration checks, permissions, renamed labels, notification suppression,
deduplication, edits/deletion, blocked DMs, group DMs, and a 220-member fan-out.
Its Better Auth session endpoint is mocked at the existing protocol boundary;
deployed cookie routing and real browser/mobile integration remain unverified.
