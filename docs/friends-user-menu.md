# Friends user actions menu

`UserActionsMenu.tsx` replaces the Friends page's native details dropdown. It uses Radix Dropdown Menu with a portal, bottom/end alignment, an 8px gap, 12px collision padding, automatic flipping, and viewport height constraints. Radix handles outside dismissal, Escape, arrow keys, and focus return. The Friends list controls the open user ID so only one menu is open.

The menu is 264px wide with a charcoal surface, a subtle red border/shadow, 13px corners, and three 44px action rows. Lucide icons identify View Profile, Remove Friend, and Block User. Remove Friend has a red tint and outline; Block User uses red text. Hover, keyboard focus, disabled, and reduced-motion states are included. No reference image was present in the attachment, so styling follows the written design requirements.

View Profile closes the menu and opens the existing shared profile popover. Focus transfers to the profile and returns to the three-dot trigger after dismissal. RelationshipActions continues to use the existing relationship query and authenticated friendship/block mutations. Its dropdown adapter keeps actions visible while pending and after an error, and closes on success. React Query invalidates the existing relationship caches. Self relationships omit friend/block actions. No new backend contracts or confirmation flows are added.

DM context menus reuse the same container and relationship-item styles, keeping their existing actions and context-menu behavior. Inline profile relationship buttons retain their existing layout. No server administration menus are changed.

`UserActionsMenu.test.tsx` runs under Strict Mode and checks keyboard behavior, portal rendering, exclusivity, outside dismissal, profile handoff, self actions, Rust mutation requests, list refresh, blocking state, and failure retry. Direct-navigation tests use the existing profile-name conversation action; the previously removed friend-row conversation button is not restored.

Browser QA uses intercepted fixtures only. Start the existing isolated Chrome/preview harness described in `user-profile-popovers.md`, then run:

```powershell
node --experimental-strip-types src/test/profile-popovers.browser.mjs --friends-menu
```

Screenshots and the report are written under `.artifacts/friends-menu/`. Checks cover desktop alignment, equal action heights, profile handoff, dismissal, single-menu behavior, narrow windows, resize, bottom-edge flipping, and scrolling. Fixture tests do not verify live backend integration.
