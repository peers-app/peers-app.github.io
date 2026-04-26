# PWA Auth Tests (Desktop)

Read `CLAUDE.md` in this directory first for general instructions.

## Test 1: Create New User Account

### Setup

1. `browser_navigate` to `http://localhost:5182`
2. `browser_lock`
3. `browser_snapshot` — check if the app is on the setup screen ("Welcome to Peers" heading) or already logged in (app grid with "System Apps" heading)
4. If already logged in, follow the "Logging Out" procedure from `CLAUDE.md`, then `browser_snapshot` again to confirm you're on the setup screen

### Execute

5. `browser_snapshot` — verify "Welcome to Peers" heading is visible
6. `browser_click` the "I'm a New User" button (text contains "New User")
7. `browser_snapshot` — verify the new user confirmation screen appears with "Create Account" button
8. `browser_click` the "Create Account" button
9. The page reloads. Poll with `browser_snapshot` every 2-3s until the "System Apps" heading appears (timeout after ~15s)
10. `browser_snapshot` — check if a welcome modal is visible (look for "Skip for now" button)
11. If the welcome modal is visible, `browser_click` "Skip for now"

### Verify

12. `browser_snapshot` — confirm the app grid is visible with these buttons:
    - "Settings"
    - "Threads"
    - "Contacts"
13. `browser_console_messages` — check for unexpected errors (see `CLAUDE.md` for the allowlist)

### Cleanup

14. `browser_unlock`

### Pass criteria

- "Welcome to Peers" was visible on the setup screen
- "Create Account" succeeded and the app grid loaded
- Settings, Threads, and Contacts buttons are all visible
- No unexpected console errors

---

## Test 2: Login With Existing Account

### Setup

1. If continuing from Test 1, you should still be logged in. Follow the "Logging Out" procedure from `CLAUDE.md`
2. If starting fresh: `browser_navigate` to `http://localhost:5182`, then `browser_lock`
3. `browser_snapshot` — verify you are on the setup screen ("Welcome to Peers" heading)

### Execute

4. `browser_click` the "I'm an Existing User" button (text contains "Existing User")
5. `browser_snapshot` — verify the login form appears with "User ID" and "Secret Key" input fields
6. `browser_fill` the "User ID" input with `00m87fbwu96jzf8qnwllly0fd`
7. `browser_fill` the "Secret Key" input with `1wh_REBpElDkrlTkjePiqqjIDh2FuWclB1oM8DRKQ8IP3UahxB1Rx5BMfytFB32eAOv7lks8ugfbPqsAv4d6Ag`
8. `browser_click` the "Sign In" button
9. The page reloads. Poll with `browser_snapshot` every 2-3s until the "System Apps" heading appears (timeout after ~15s)
10. `browser_snapshot` — check if a welcome modal is visible
11. If the welcome modal is visible, `browser_click` "Skip for now"

### Verify

12. `browser_snapshot` — confirm the app grid is loaded
13. `browser_click` the "Settings" button
14. `browser_snapshot` — on the settings page, verify the User ID field displays `00m87fbwu96jzf8qnwllly0fd`
15. `browser_console_messages` — check for unexpected errors (see `CLAUDE.md` for the allowlist)

### Cleanup

16. `browser_unlock`

### Pass criteria

- Login form accepted the credentials without error
- App grid loaded after sign-in
- Settings page shows the correct User ID (`00m87fbwu96jzf8qnwllly0fd`)
- No unexpected console errors
