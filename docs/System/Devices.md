---
sidebar_position: 9
title: Devices
---

# Devices

**Identity → Devices** lists only installations signed in to the current
account. The personal `Devices` table can also contain devices observed for
other users, but those records never appear in this account-management view.
It is separate from [Network Viewer](./Network-Diagnostics.md): Devices is
where you name, pair, and forget installations; Network Viewer is the
connection diagnostic.

The current installation is marked **This device**. Every row shows its name,
online/offline state, latest path when connected, and human-readable last seen
time. Open a row for its ID and management actions. **Forget** stays on the
detail screen rather than being a dominant list action.

## Add a device

**Add device** in the persistent Identity action bar (or **Settings → Add
another device**) opens
`#identity/devices/pair`. The new device must be signed out and showing a code.
See [Add another device](./Device-Pairing.md).

From a signed-in terminal:

```bash
peers devices pair 7-guitar-revenge-tunnel
peers pair 7-guitar-revenge-tunnel
```

Both commands are the same ceremony.

## Pending device invites

Device admission uses the same `Invites` table as [contacts](./Contacts.md) and
[groups](./Groups.md), with `type: "device"`. Nothing creates those rows yet.
No admission actions exist for those rows yet, so they stay out of
**Needs your attention** and the Devices badge. The UI will surface them only
when a real decision flow exists.
