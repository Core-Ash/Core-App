# Core Gaming reference UI

This document describes the preserved **design preview**, selected when `VITE_API_URL` is empty. A configured Rust backend uses the same visual layout with real data and explicit unavailable states; see [backend integration](backend-integration.md). The preview never serves as a fallback for a failing configured backend.

The supplied `Tmavé herní centrum Core Gaming.png` is the visual reference for the signed-in interface. The default dashboard has been replaced by the four-panel communication view: a community icon rail, Core Gaming channel sidebar, chat, and member activity. There are no promotional cards or welcome sections on the default page.

## Routes and styling

- `/app` is the protected default chat view. Authentication redirects still lead here.
- `/app/communities` remains a compatible entry to the same interface. Community and channel links use `/app?community=core-gaming&channel=general`.
- The `community` and `channel` query parameters select typed sample data. `view=events` and `view=members` open their corresponding views. `view=overview` opens the channel interface; unknown values fall back safely.
- `/app/settings` shows the actual signed-in profile and the existing sign-out action. The sidebar's settings icon opens it.
- `/app/messages` and `/app/friends` retain their unavailable states.

`src/styles/theme.css` owns colors, self-hosted Inter, Tailwind mappings, and layout dimensions. `src/styles/app.css` implements the reference layout. `src/styles/auth.css` retains authentication-page styling; `globals.css` provides imports and shared base rules. Desktop grid proportions were refined against the reference at **1648 × 928**, with a 94px chat header spanning both the conversation and member columns.

Below 1200px, members open in a Radix dialog. Below 800px, the community sidebar opens in a drawer from the chat header. Search collapses to a toggle, and the composer stays visible while messages scroll. Keyboard focus returns to the initiating control when dialogs close. Reduced-motion preferences and visible keyboard focus are respected.

## Session and service boundaries

All workspace routes use the existing session guard and official Better Auth client. Sign-in, registration, password validation, cookie-backed session confirmation, service errors, and logout retain their existing behavior. The profile panel reads its name and avatar from the authenticated session; the reference's **Nex** identity is never hardcoded as the current user. The displayed profile status indicates sign-in, not broadcast presence.

Typed examples are isolated in `src/features/community/preview/`. Communities, conversations, portraits, activity, voice counts, and reactions are visual samples. A visible composer note and the header's help dialog explain this. There is no fake authentication mode in application code. Test sessions belong only to `src/test/` and isolated browser QA.

The composer adds messages only to React state, labeled **Only visible to you**. They remain separated by community/channel, survive channel selection within the page, and clear when the page unmounts, reloads, or changes authenticated user. Enter adds a local message; Shift+Enter inserts a newline; IME composition is preserved. Search filters current-channel body text and author names. Reactions, including the add-reaction picker, are local UI state and reset when the message component unmounts. No browser storage or message API calls are used.

Voice, microphone/deafen actions, image/file uploads, GIFs, pinned messages, notifications, community creation, and real member activity remain unavailable. Their controls are disabled with accessible explanations. The interface never accesses the microphone or claims to establish a voice connection.

The live workspace now uses the inspected Rust Better Auth session middleware and documented profile/community/channel/message contracts. Preview data remains isolated from live data. No backend/auth repository, service settings, or deployment is changed by this frontend implementation.

## Reference assets and verification

`public/artwork/core-gaming-banner.png`, `core-gaming-landscape.png`, and the portraits in `public/avatars/` are individual asset crops from the user-supplied reference. The full screenshot is never rendered as the application or used as a page background. The faceted C logo and community symbols are SVG components. The earlier `core-landscape.svg` remains an authentication illustration. Inter is self-hosted with its license in `public/fonts/OFL.txt`.

Run `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, and `pnpm run build`. Tests cover the default chat redirect, session protection and expiry, actual profile identity, sample messages, local-only submission, channel isolation, search, reactions, emojis, unsupported controls, member expansion, and keyboard-dismissable dialogs.

Browser QA uses an isolated Chrome profile and intercepted test sessions to inspect the 1648×928 layout against the reference and exercise desktop/mobile interactions. This verifies frontend rendering and interaction only. Live sign-in, account creation, cookie persistence, and Rust integration remain unverified by this UI work.
