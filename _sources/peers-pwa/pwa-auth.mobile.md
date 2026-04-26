# PWA Auth Tests (Mobile Viewport)

Read `CLAUDE.md` in this directory first for general instructions.

These are the same tests as `pwa-auth.md` but executed in a mobile viewport (375x812, simulating an iPhone). The UI is responsive so the same elements should be present, but layout may differ.

## Initial Setup

Before running any tests, resize the browser to a mobile viewport:

1. `browser_navigate` to `http://localhost:5182`
2. `browser_resize` with `width: 375`, `height: 812`
3. `browser_lock`

---

## Test 1: Create New User Account (Mobile)

### Setup

4. `browser_snapshot` — check if on setup screen or already logged in
5. If already logged in, follow the "Logging Out" procedure from `CLAUDE.md`, then `browser_snapshot` to confirm the setup screen

### Execute

6. `browser_snapshot` — verify "Welcome to Peers" heading is visible
7. `browser_click` the "I'm a New User" button
8. `browser_snapshot` — verify "Create Account" button is visible
9. `browser_click` the "Create Account" button
10. Poll with `browser_snapshot` every 2-3s until the "System Apps" heading appears (timeout ~15s)
11. `browser_snapshot` — check for welcome modal
12. If visible, `browser_click` "Skip for now"

### Verify

13. `browser_snapshot` — confirm app grid with Settings, Threads, Contacts buttons
14. Verify buttons are properly laid out for mobile width (not clipped or overlapping)
15. `browser_console_messages` — check for unexpected errors

### Pass criteria

- Same as desktop test, plus: UI renders correctly at 375px width without overflow or clipping

---

## Test 2: Login With Existing Account (Mobile)

### Setup

16. Follow the "Logging Out" procedure from `CLAUDE.md`
17. `browser_snapshot` — verify setup screen

### Execute

18. `browser_click` the "I'm an Existing User" button
19. `browser_snapshot` — verify login form with User ID and Secret Key fields
20. `browser_fill` the "User ID" input with `00m87fbwu96jzf8qnwllly0fd`
21. `browser_fill` the "Secret Key" input with `1wh_REBpElDkrlTkjePiqqjIDh2FuWclB1oM8DRKQ8IP3UahxB1Rx5BMfytFB32eAOv7lks8ugfbPqsAv4d6Ag`
22. `browser_click` the "Sign In" button
23. Poll with `browser_snapshot` every 2-3s until the "System Apps" heading appears (timeout ~15s)
24. `browser_snapshot` — check for welcome modal
25. If visible, `browser_click` "Skip for now"

### Verify

26. `browser_snapshot` — confirm app grid is loaded
27. `browser_click` the "Settings" button
28. `browser_snapshot` — verify User ID field shows `00m87fbwu96jzf8qnwllly0fd`
29. Verify the settings page is usable at mobile width (fields not truncated, scrollable)
30. `browser_console_messages` — check for unexpected errors

### Cleanup

31. `browser_unlock`

### Pass criteria

- Same as desktop test, plus: login form and settings page render correctly at 375px width
- Input fields are usable (not too small to tap, labels visible)
- No horizontal scroll required for primary content
