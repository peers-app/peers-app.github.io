# OpenCode First-Run: Spawn Terminal for User

When users install peers-electron and use the OpenCode agent from the Peers UI, it fails until they run `opencode` once from a terminal. This roadmap item: **spawn a terminal for the user and run opencode** — doing the first terminal run automatically.

## Approach

Instead of trying to fix PATH or env programmatically, we open the user's native terminal application and run `opencode` in it. Whatever needs to happen on first run (auth, PATH loading, etc.) happens in that real terminal context.

---

## Implementation

### 1. Add `spawnOpenCodeTerminal()` in peers-electron

Create a new module (e.g. `peers-electron/src/server/opencode-terminal.ts`) that opens the platform's default terminal and runs `opencode`:

**macOS** (AppleScript):

```typescript
execSync(`osascript -e 'tell application "Terminal" to do script "opencode"'`, { stdio: 'ignore' });
```

- Opens Terminal.app with a new window and runs `opencode`
- User may be prompted for Accessibility permission the first time (standard macOS security)

**Windows**:

```typescript
spawn('cmd', ['/k', 'opencode'], { detached: true, stdio: 'ignore' });
```

- Opens a new CMD window, runs opencode, keeps window open (`/k`)

**Linux** (try common terminals):

```typescript
// Try gnome-terminal, konsole, xterm in order
const terminals = [
  ['gnome-terminal', '--', 'bash', '-c', 'opencode; exec bash'],
  ['konsole', '-e', 'opencode'],
  ['xterm', '-e', 'opencode'],
];
// Try each until one succeeds
```

### 2. When to Spawn

Call `spawnOpenCodeTerminal()` **only when we actually install** opencode (i.e. when `installOpenCode()` performs a fresh download and install, not when it skips because opencode already exists).

**Implementation**:

- Modify `peers-electron/src/server/opencode-installer.ts` to return `{ installed: boolean }` (or similar) indicating whether we did a fresh install
- In `peers-electron/src/server/main.ts`, after `installOpenCode()`:

```typescript
const { installed } = await installOpenCode();
if (installed) {
  spawnOpenCodeTerminal().catch(err => console.warn('Could not spawn OpenCode terminal:', err));
}
```

### 3. Command to Run

Run `opencode` with no arguments. That starts the OpenCode TUI, which:

- Lets the user complete auth if needed (`opencode auth login` can be run from within)
- Or they can just explore / run a quick task
- The terminal stays open for them to interact

Alternative: run `opencode run "Hello"` for a quick non-interactive test — but that might fail on auth before the user can complete it. Running plain `opencode` (TUI) is safer for first-run.

---

## Key Files

| File | Change |
|------|--------|
| `peers-electron/src/server/opencode-terminal.ts` | **New**: `spawnOpenCodeTerminal()` with platform-specific terminal spawning |
| `peers-electron/src/server/opencode-installer.ts` | Return `{ installed: boolean }` from `installOpenCode()` |
| `peers-electron/src/server/main.ts` | Call `spawnOpenCodeTerminal()` when installOpenCode reports fresh install |

---

## Platform Notes

**macOS**: May require "Accessibility" permission for AppleScript to control Terminal. Users will see the standard macOS prompt. If denied, we can fall back to `open -a Terminal` with a temp script, though that's less reliable.

**Windows**: `start cmd /k opencode` could also work via `execSync`; `spawn` with `detached: true` avoids blocking.

**Linux**: Desktop environment varies (GNOME, KDE, etc.). Try `gnome-terminal`, `konsole`, `xterm` in that order. If none exist, log and skip (user can run manually).

---

## Verification

- Fresh install of peers-electron (or delete `~/.opencode` to simulate)
- Launch app from Dock/Finder
- After OpenCode install completes, a terminal window should open with `opencode` running
- User completes any first-run setup (auth, etc.) in that terminal
- Subsequent OpenCode assistant usage from Peers UI should work
