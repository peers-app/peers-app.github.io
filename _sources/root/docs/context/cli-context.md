# CLI Context for Agents

This document provides practical guidance for using the `peers` CLI to interact with the Peers application, verify UI functionality, and troubleshoot issues.

## Overview

The `peers` CLI enables agents to:
- Monitor app behavior through logs
- Control app lifecycle (restart, quit)
- Query the local database for debugging
- Inspect and interact with the UI

## Building and Running the Development CLI

When working on the CLI itself or testing changes, you can build and run the development version directly:

### Build the CLI

```bash
cd peers-cli
npm run build
```

This compiles TypeScript to `dist/peers-cli.js`.

After editing **`peers-cli`** sources, run **`npx biome check .`** in **`peers-cli/`** (or **`npm run lint:biome`** — the default **`npm run lint`** is a no-op stub) so changes meet the repo’s Biome rules before you rely on the build alone.

### Run Development CLI

```bash
# Run directly from the dist folder
node peers-cli/dist/peers-cli.js <command>

# Examples
node peers-cli/dist/peers-cli.js app status
node peers-cli/dist/peers-cli.js ui inspect --json
node peers-cli/dist/peers-cli.js logs -f
```

### Full Rebuild (SDK + Electron + CLI)

If you've made changes to the SDK or Electron app as well:

```bash
# Build SDK first (if changed)
cd peers-sdk && npm run build && cd ..

# Build Electron app (if changed)
cd peers-electron && npm run build && cd ..

# Build CLI
cd peers-cli && npm run build && cd ..

# Restart app to pick up changes
node peers-cli/dist/peers-cli.js app restart
```

### One-liner for Quick Iteration

```bash
cd peers-cli && npm run build && node dist/peers-cli.js <command>
```

### Testing After Changes

```bash
# Build and test
cd peers-cli && npm run build && \
  node dist/peers-cli.js app restart && \
  sleep 3 && \
  node dist/peers-cli.js ui inspect --text
```

## Quick Reference

```bash
# Check if app is running
peers app status

# Restart app after code changes
peers app restart

# View logs (follow mode, errors only)
peers logs -f -e

# Inspect current UI state
peers ui inspect --json

# Get just visible text
peers ui inspect --text

# Get interactive elements
peers ui inspect --elements
```

## CLI Capabilities

### Logs

Monitor console output from the Peers app:

```bash
peers logs -f              # Follow logs in real-time
peers logs -e              # Show only errors
peers logs -q "database"   # Search for specific text
peers logs --since 5       # Logs from last 5 minutes
peers logs --json          # JSON output for parsing
```

### App Lifecycle

```bash
peers app status           # Check if running
peers app restart          # Restart (after code changes)
peers app quit             # Quit the app
peers app start            # Start the app
peers app start --dev      # Start development version
```

### Database Queries

> **Permission Required:** Enable via **Help → Enable CLI Database Access**

```bash
peers db tables                                    # List all tables
peers db Users -n 100                              # Query table with limit
peers db query "SELECT * FROM Users LIMIT 10"     # Custom SQL (SELECT only)
peers db Users --json                              # JSON output
```

### UI Control

```bash
peers ui reload                                    # Refresh UI
peers ui reload --no-cache                         # Hard refresh
peers ui inspect                                   # Full UI state
peers ui inspect --json                            # JSON output
peers ui inspect --text                            # Just visible text
peers ui inspect --elements                        # Interactive elements
peers ui click "#button"                           # Click element
peers ui set "#input" "text"                       # Set input value
peers ui set "#input" "text" --clear --enter       # Clear, set, send
peers ui scroll --direction down                   # Scroll page
peers ui scroll --selector ".container" --direction up --amount 500
```

## Verifying the UI

### Check Current View

```bash
# Get route and title
peers ui inspect --json | grep -E '"(url|route|title)"'
```

Common routes:
- `threads/<id>` - Chat thread view
- `apps` - Apps/packages view
- `contacts` - Contacts view
- `data` - Data explorer view

### Verify Element Exists

```bash
# List all interactive elements
peers ui inspect --elements

# Check for specific text in UI
peers ui inspect --text | grep -i "search term"
```

### Verify After Actions

After clicking or typing, verify the action worked:

```bash
# Check if route changed
peers ui inspect --json | grep '"route"'

# Check if text appeared
peers ui inspect --text | grep "expected text"

# Check if element state changed (e.g., button disabled)
peers ui inspect --json | grep -A5 "selector-of-element"
```

## Common Selectors

### Peers App UI Elements

| Element | Selector | Notes |
|---------|----------|-------|
| Chat editor | `.editor-container [contenteditable='true']` | Rich text editor |
| Send button | `div.border.rounded > div:nth-child(2) > div.float-end.small > button.btn.btn-sm` | In chat view |
| Send on Enter checkbox | `#sendOnEnter` | Toggle checkbox |
| Chat scroll container | `.h-100.overflow-auto` | For scrolling chat history |

### Tab Navigation

The main tabs in the header bar are `<div>` elements with React `onClick` handlers. The `--elements` inspector finds the close buttons inside tabs, not the tabs themselves. To click tabs, target the parent div directly:

```bash
# Tab selector pattern
peers ui click "div.d-flex.flex-grow-1.overflow-auto > div:nth-child(N)"
```

| Index | Tab | Selector |
|-------|-----|----------|
| 1 | Apps | `div.d-flex.flex-grow-1.overflow-auto > div:nth-child(1)` |
| 2 | Data | `div.d-flex.flex-grow-1.overflow-auto > div:nth-child(2)` |
| 3 | Network | `div.d-flex.flex-grow-1.overflow-auto > div:nth-child(3)` |
| 4 | Groups | `div.d-flex.flex-grow-1.overflow-auto > div:nth-child(4)` |
| 5 | Home | `div.d-flex.flex-grow-1.overflow-auto > div:nth-child(5)` |
| 6 | Threads | `div.d-flex.flex-grow-1.overflow-auto > div:nth-child(6)` |

**Note:** Tab indices may change if tabs are opened/closed. The tabs shown are the currently open tabs, not a fixed set. Use `peers ui inspect --text | head -1` to see the current tab order.

### App Launcher

Apps in the launcher are `<div>` elements with `onClick` handlers and a `title` attribute containing the app name. Click apps by their title:

```bash
# Click any app by name
peers ui click 'div[title="App Name"]'

# Examples
peers ui click 'div[title="Daily Planner"]'
peers ui click 'div[title="Settings"]'
peers ui click 'div[title="Threads"]'
peers ui click 'div[title="Network"]'
```

**Note:** You must be on the Apps tab to click apps. Navigate there first with:
```bash
peers ui click "div.d-flex.flex-grow-1.overflow-auto > div:nth-child(1)"
```

### Finding Selectors

When you need to find a selector:

1. **Get all elements with text:**
   ```bash
   peers ui inspect --elements
   ```

2. **Search for specific element:**
   ```bash
   peers ui inspect --json | node -e "
   const data = require('fs').readFileSync('/dev/stdin', 'utf8');
   const json = JSON.parse(data.slice(data.indexOf('{')));
   json.elements.filter(e => e.text?.includes('Search Term')).forEach(e => {
     console.log(e.text, '|', e.selector);
   });
   "
   ```

3. **Use simpler selectors when possible:**
   - IDs: `#elementId`
   - Classes: `.class-name`
   - Attributes: `[data-testid="value"]`
   - Combinations: `button.btn-primary`

## Scrolling

**Important:** The main content in Peers is usually inside scrollable containers, not the main window.

```bash
# Scroll within chat container (NOT the window)
peers ui scroll --selector ".h-100.overflow-auto" --direction up --amount 10000

# Scroll to bottom
peers ui scroll --selector ".h-100.overflow-auto" --direction down --amount 10000
```

If `peers ui scroll --direction down` doesn't work, you need to find the scrollable container.

## Setting Text in Rich Text Editors

The chat input uses a contentEditable rich text editor (Lexical), not a standard `<input>` or `<textarea>`.

```bash
# Set text in the chat editor
peers ui set ".editor-container [contenteditable='true']" "Your message"

# Clear and set
peers ui set ".editor-container [contenteditable='true']" "New message" --clear

# Set and press Enter (to send if "Send on Enter" is enabled)
peers ui set ".editor-container [contenteditable='true']" "Message" --enter
```

## Troubleshooting

### App Not Responding

```bash
# Check status
peers app status

# If not running, start it
peers app start

# If running but unresponsive, restart
peers app restart

# Watch logs for errors
peers logs -f -e
```

### Click Not Working

1. **Element not found:** The selector might be wrong or the element isn't rendered yet
   ```bash
   # Verify element exists
   peers ui inspect --elements | grep "part-of-selector"
   ```

2. **Wrong element clicked:** Selectors can match multiple elements
   ```bash
   # Use more specific selector or the full path from inspect
   peers ui inspect --json  # Get exact selector
   ```

3. **Element disabled:** Check if the element has `disabled` attribute
   ```bash
   peers ui inspect --json | grep -A3 '"selector".*your-selector'
   ```

4. **Clicking React `<div>` elements:** The `--elements` inspector only finds `<button>`, `<a>`, and `<input>` elements. For `<div>` elements with `onClick` handlers (like tabs), you need to construct the selector manually. See the [Tab Navigation](#tab-navigation) section.

### Set Not Working

1. **Not a text input:** Element must be `<input>`, `<textarea>`, or `contentEditable`
   
2. **Element not focused:** The set command focuses first, but complex UIs may interfere

3. **React/Vue state not updating:** The command dispatches `input` and `change` events, but some frameworks need specific handling

### Scroll Not Working

1. **Scrolling wrong element:** The window might not be scrollable; find the scrollable container
   ```bash
   # Look for overflow-auto or overflow-scroll classes
   peers ui inspect --json | grep -i "overflow"
   ```

2. **Container not found:** Verify the selector matches an element
   ```bash
   peers ui click ".your-scroll-container"  # Test if selector works
   ```

### UI State Stale

After actions, wait a moment for the UI to update:

```bash
# Simple approach: sleep between commands
peers ui click "#button" && sleep 0.5 && peers ui inspect --text
```

## Workflows

### After Making Code Changes

```bash
# 1. Rebuild (if needed)
cd peers-electron && npm run build

# 2. Restart app
peers app restart

# 3. Wait for app to start
sleep 3

# 4. Check for errors
peers logs -e

# 5. Verify UI is working
peers ui inspect --text
```

### Test UI Interaction

```bash
# 1. Inspect current state
peers ui inspect

# 2. Find element to interact with
peers ui inspect --elements

# 3. Perform action
peers ui click "selector"
# or
peers ui set "selector" "text"

# 4. Verify result
peers ui inspect --text
```

### Debugging Data Issues

```bash
# Check database state
peers db tables
peers db query "SELECT COUNT(*) FROM Messages"

# Look for errors in logs
peers logs -q "error" --since 10
```

## Security Notes

- The CLI connects via WebSocket to `127.0.0.1:9337` (local only)
- Authentication token is stored in `~/peers/cli/cli-auth.json`
- Database access requires explicit user permission (resets on app restart)
- Only read-only database queries are allowed (SELECT, PRAGMA)

## Tips for Agents

1. **Always verify after actions:** Don't assume clicks/sets worked; check with `inspect`

2. **Use `--json` for parsing:** When you need to process results programmatically

3. **Prefer ID selectors:** `#elementId` is more reliable than complex paths

4. **Check logs for errors:** `peers logs -e` shows only errors

5. **Scroll within containers:** Main content is usually in scrollable divs, not the window

6. **Rich text editors need special handling:** Use `[contenteditable='true']` selector

7. **Tab navigation:** Tabs are `<div>` elements with `onClick` handlers, not `<button>` elements. The `--elements` inspector finds close buttons inside tabs. Use the parent div selector: `div.d-flex.flex-grow-1.overflow-auto > div:nth-child(N)`

8. **Database permission resets:** User must re-enable after each app restart

9. **Clicking apps:** Apps in the launcher have `title` attributes. Use `div[title="App Name"]` to click them
