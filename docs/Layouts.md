---
sidebar_position: 2
---

# Layouts

Peers lets you choose the **root layout** — the top-level shell that frames the whole app. The layout you pick is remembered **per device**, so you can use one layout on a laptop and a different one on a large monitor.

## Choosing a layout

There are two ways to switch:

- **Settings → Appearance.** Open Settings and use the **Layout** picker next to Color Mode.
- **Command palette.** Press <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> and run **"Use … Layout"** (for example, *Use Full-screen Layout*).

Switching takes effect immediately — no reload.

## Built-in layouts

### Tabs (default)

The classic Peers shell: a tab strip across the top with one app per tab. This is the default and matches how Peers has always worked.

### Tabs + Console

The tab strip with the **Operator Console** docked alongside as a real, resizable panel (not an overlay). The console can be docked to the bottom, left, or right edge and resized by dragging the divider. Toggle the console with <kbd>Ctrl</kbd>+<kbd>`</kbd>.

### Full-screen

One screen at a time, with **no tab strip**. A minimal header shows the current screen plus a Home button and a search button. Navigation happens through the command palette (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd>), which can open any app or search.

Opening an app **replaces** the current screen instead of adding a tab, so you always have a single, focused view. This is non-destructive: if you had tabs open in another layout, they're left untouched and reappear when you switch back.

:::tip
The <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> command palette is always available in every layout, so you can navigate anywhere even when there's no tab strip or visible chrome.
:::
