---
sidebar_position: 2
---

# Choosing a layout

Peers lets you pick how the desktop shell is arranged. The **root layout** controls the top-level chrome — tab strip, full-screen header, and whether the Operator Console sits beside your apps as a real panel.

Your choice is stored **per device** (it does not sync across machines). Changing it takes effect immediately — no restart.

## How to switch

**Settings → Appearance**

1. Open **Settings**.
2. Open the **Appearance** tab.
3. Use the **Layout** dropdown and pick one of the built-in layouts.

**Command palette**

Press **Cmd+K** (macOS) or **Ctrl+K** (Windows/Linux) and run one of:

- **Use Tabs Layout**
- **Use Tabs + Console Layout**
- **Use Full-screen Layout**

## Built-in layouts

### Tabs (default)

The classic Peers shell: a tab strip across the top and one app per tab. This is the default for new devices.

### Tabs + Console

Same tab strip, with the **Operator Console** as a docked, resizable panel instead of an overlay. The console and your apps sit side by side (or stacked); neither covers the other.

- **Toggle** the console with **Ctrl+\`** (backtick), or the **Toggle Console** command in the palette.
- **Dock** it to the bottom, left, or right from the console header.
- **Drag** the divider to resize; maximize from the header to fill the layout body.

The console panel is only part of this layout. On **Tabs** or **Full-screen**, toggling the console has no visible effect until you switch to **Tabs + Console**.

### Full-screen

One screen at a time — no tab strip. A thin header shows the current screen title, an **Apps** (home) control, and a hint to open the command palette.

- Navigate with **Cmd/Ctrl+K** (search apps and commands).
- Opening an app **replaces** the current screen instead of adding a tab.
- Tabs you had open under another layout are left alone and come back if you switch back to **Tabs** or **Tabs + Console**.

## Tips

- Prefer **Tabs + Console** on a large monitor when you want a persistent console without covering app content.
- Prefer **Full-screen** when you want maximum space and are comfortable navigating with the palette.
- Layout is a device preference, like color mode — set it separately on each machine.
