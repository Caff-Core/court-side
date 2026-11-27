# Schedule calendar UI verification

27 November 2026. Google OAuth smoke verification (#4) remains on hold.

The app shell keeps its header outside the scrolling main region. The schedule uses ReUI Frames, a facility search by name or sport with an independently scrolling list, and ReUI's event calendar in day view. Date navigation retains the server's 14-day bounds. Calendar events use the facility's time zone and public slot projection; only available slots for active accounts open the existing booking request dialog. Dragging and resizing are disabled.

The header adapts ReUI `c-avatar-35` for account actions and `c-dropdown-menu-11` for the real notification feed. The feed supports loading, empty and retry states, marking all as read, and opening the full inbox. The mark-read control sits outside the menu label so it is accessible. No sample identities or remote avatar images were retained.

Validation:

- 31 web tests passed, including facility filtering/clear search, notification-menu read state, existing booking submissions, conflicts, retry keys and access rules.
- Typecheck, lint and production build passed. jsdom's missing scroll, resize and animation APIs are stubbed in test setup; actual layout and keyboard behavior were checked separately in Chromium.
- Browser checks at 1440px and 375px verified search, no-match recovery, both menus, keyboard activation of an available calendar slot, header position after scrolling the schedule, and no horizontal document overflow.
- Light and dark mobile screenshots and desktop schedule/menu screenshots were inspected. No browser page errors were observed.
- ReUI C1–C4 and audit checklist passed for application changes. Installed component styling and motion were retained; no entrance animation was added.

The day calendar displays half-hour availability statuses; it does not add event-management CRUD or change booking policies. This verification is not a full accessibility certification.
