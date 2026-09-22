---
sidebar_position: 6
title: Identity
---

# Identity

Identity is the account-management home for people, groups, your devices,
invites, and public account information. Open it as one top-level app; its
sections use distinct routes, so links, reloads, and browser back/forward keep
the selected place.

- **Activity** — requests that need your decision, work waiting on someone
  else, and invite history.
- **People** — contacts and people known through shared groups.
- **Groups** — shared spaces with member counts and your role.
- **Devices** — installations signed in to your account.
- **Account** — your public identity values and Peers Services registration.

Wide screens use a left sidebar. Narrow screens use a horizontal section strip.
The content pane is the only vertical scroll area, so long lists do not create
nested scrollbars.

## Common actions

The action bar remains visible while section content scrolls:

- **Add person** creates a signed contact invitation.
- **Create group** opens the route-backed group form.
- **Add device** starts the account pairing flow.
- **Use invite** previews a pasted, scanned, or opened invite and identifies
  whether it is for a contact or group before anything changes.

On narrow screens, the three add actions are grouped under **Add**.

## Routes

Canonical routes begin with `identity/`:

```text
identity/activity
identity/activity/accept
identity/people
identity/people/invite
identity/people/share
identity/people/:userId
identity/groups
identity/groups/new
identity/groups/:groupId
identity/devices
identity/devices/pair
identity/devices/:deviceId
identity/account
```

Older `contacts`, `groups`, `devices`, `invites`, and `account` links are
rewritten to these routes. Query parameters and detail IDs are preserved.

## Identity values and settings

**Identity → Account** is the place to copy your User ID, public signing key,
public encryption key, and current Device ID. These values are useful for
diagnostics but are not needed in normal lists.

**Settings → User** stays focused on editing the display name, adding another
device, and host-specific sign out. The app version appears in the persistent
Settings footer.

## Host-only operations

The System Identity and System Invites contracts control sensitive local-host
operations such as sign in, sign out, pairing, and invite decisions. They are
available to the local UI and CLI host transport only. Mesh callers, including
another device with Self trust, cannot resolve these host contracts remotely.

See [Contacts](./Contacts.md), [Groups](./Groups.md),
[Devices](./Devices.md), [Invites](./Invites.md), and
[Add another device](./Device-Pairing.md) for the individual flows.
