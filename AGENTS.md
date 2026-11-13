# Core Web conventions

- This repository is exclusively the React web frontend. Keep features under `src/features/`, shared UI under `src/components/`, and app setup under `src/app/`.
- Use the pnpm version pinned in `package.json` and preserve `pnpm-lock.yaml`. Use `pnpm.cmd` on Windows if PowerShell blocks pnpm scripts. Install with `pnpm install --frozen-lockfile`; do not create npm or Yarn lockfiles. Node 22.13+ (22.x) or 24.x is supported.
- Use strict TypeScript, React function components, Tailwind theme tokens, source-owned shadcn/ui components, and `@/` imports. Keep forms and navigation accessible and responsive.
- Better Auth is a separate existing service. Use only the official React client in `src/lib/auth-client.ts` and its session APIs. Never implement an auth server, mock authentication in the application, or manual token storage/forwarding.
- Wait for session initialization before redirecting. Keep credentials/errors out of logs; handle service failures without exposing protected content. Test fixtures belong only in test files or `src/test/`.
- All application data must flow through the Rust backend. Never connect the frontend directly to PostgreSQL. `VITE_API_URL` is reserved; do not invent backend endpoints or an authentication contract.
- Only public configuration belongs in `VITE_` variables. Keep real `.env` files and secrets out of Git.
- The current product scope is sign-in, registration, logout, and a session-backed welcome page. Registration must follow Core-auth's password policy and verify the cookie-backed session before navigating. A successful sign-up response alone is not proof of a session or email delivery. Mark future functionality clearly as unavailable. Do not add messaging, WebSockets, or other platform implementations without a new request.
- Run `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, and `pnpm run build` after meaningful changes. Unit-test fixtures are not evidence of live service integration; report unverified integration explicitly.
- No deployment or changes to other repositories are authorized by setup work.
