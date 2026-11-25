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

On a computer the strip shows your group at its left end, then your tabs, and at its right end search (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd>), notifications and the network status. In the desktop app Peers has no title bar: the strip is the window's top row, and dragging its empty space moves the window. On a Mac the window's buttons sit at the strip's left end. On Windows and Linux, minimize, maximize and close sit at its right end, and there's no menu bar: the ☰ at the strip's left end opens Peers' menu (File, Edit, View, Window and Help), and the menu's keyboard shortcuts work as before. The window's buttons stay in the strip at any zoom.

See [Working with tabs](#working-with-tabs) for switching and arranging them.

### Tabs + Console

The tab strip with the **Operator Console** docked alongside as a real, resizable panel (not an overlay). The console can be docked to the bottom, left, or right edge and resized by dragging the divider. Toggle the console with <kbd>Ctrl</kbd>+<kbd>`</kbd>.

### Full-screen

One screen at a time, with **no tab strip**. A minimal header shows the current screen plus a Home button and a search button. Navigation happens through the command palette (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd>), which can open any app or search.

Opening an app **replaces** the current screen instead of adding a tab, so you always have a single, focused view. This is non-destructive: if you had tabs open in another layout, they're left untouched and reappear when you switch back.

:::tip
The <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> command palette is always available in every layout, so you can navigate anywhere even when there's no tab strip or visible chrome.
:::

## Working with tabs

The **Tabs** and **Tabs + Console** layouts keep each open app in a tab. On a computer they sit in a strip across the top. On a phone they're in the menu behind the **☰** button at the top right.

### Arranging tabs

- **Reorder** tabs by dragging them along the strip. **Apps** always stays first.
- **Close** a tab with the **×** that appears at its right edge when you point at it. On a touch screen the × is always shown. Closing the tab you're on takes you back to the tab you used before it.

Your tab order is kept on each device.

### Switching to a recent tab

Peers remembers the order you last used your tabs in, on each device. Switching by recent use never changes the strip's order.

**On a computer**, <kbd>Ctrl</kbd>+<kbd>Tab</kbd> works like switching apps with <kbd>Cmd</kbd>+<kbd>Tab</kbd> on a Mac or <kbd>Alt</kbd>+<kbd>Tab</kbd> on Windows. It's <kbd>Ctrl</kbd> on a Mac too.

- A quick <kbd>Ctrl</kbd>+<kbd>Tab</kbd> goes back to the tab you used before this one. Press it again to come back.
- Keep holding <kbd>Ctrl</kbd> and a row of your tabs' app icons appears in the middle of the window, the most recently used first, with the highlighted tab's name under it. Press <kbd>Tab</kbd> again to move along the row (<kbd>Shift</kbd>+<kbd>Tab</kbd> moves back), or use the arrow keys or the mouse.
- Let go of <kbd>Ctrl</kbd>, or press <kbd>Enter</kbd>, to switch to the highlighted tab. <kbd>Esc</kbd> closes the row without switching.

To step through tabs in strip order instead, use **Next Tab** and **Previous Tab** in the command palette, or their keys: <kbd>Cmd</kbd>+<kbd>Option</kbd>+<kbd>→</kbd> and <kbd>Cmd</kbd>+<kbd>Option</kbd>+<kbd>←</kbd> on a Mac, or <kbd>Ctrl</kbd>+<kbd>Page Down</kbd> and <kbd>Ctrl</kbd>+<kbd>Page Up</kbd> elsewhere.

In a browser tab, <kbd>Ctrl</kbd>+<kbd>Tab</kbd> switches the browser's own tabs instead, so use the desktop app, or the command palette, there.

**On a phone**, the ☰ menu lists your open apps with the one you used most recently at the top.

- **Double-tap ☰** to jump straight back to the app you used before this one. Double-tap again to return.
- A single tap opens the menu as usual.
