---
sidebar_position: 9
title: Devices
---

# Devices

**Devices** lists the installations signed in to this account: this device, every other
device Peers knows about, and whether each one is connected right now.

Open it from the Devices app. The row for this device is editable — that name is the
label other screens use for this installation. Other rows show trust, last seen, and a
live connection summary (online state and whether the path is direct or indirect).
**Forget** removes a device from this account.

Connection diagnostics beyond that summary stay on
[Network Viewer](./Network-Diagnostics.md).

## Add a device

**Add a device** (or **Settings → Add another device**) opens pairing on this screen.
The new device must be signed out and showing a code. See
[Add another device](./Device-Pairing.md).

From a signed-in terminal:

```bash
peers devices pair 7-guitar-revenge-tunnel
peers pair 7-guitar-revenge-tunnel
```

Both commands are the same ceremony.

## Pending device invites

When a device invite exists, it appears under **Pending device invites**, the same
`Invites` table used by [Contacts](./Contacts.md) and [Groups](./Groups.md), filtered to
`type: "device"`. Nothing creates those rows yet, so the section stays hidden. When a
device needs an existing member's approval before it can join a group, that request
will show up here.
