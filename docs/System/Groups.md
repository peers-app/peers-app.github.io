---
sidebar_position: 8
---

# Groups

Groups are shared data contexts. Records created in a group can synchronize between its
members' devices without exposing the member's personal data context.

Creating a group generates a signing key and an encryption key, stores the public keys on
the signed `Groups` record, and stores the secret key as an encrypted personal persistent
variable. Peers validates that a stored group secret derives the public keys on the group
record before using it. A mismatched or malformed key is rejected instead of being used to
encrypt new group data.

The founder also gets an explicit, signed `GroupMembers` row with the `Founder` role in the
group context, so approvals and role checks see the same membership data joiners will
receive. Groups created before this row existed are repaired the first time the founder
approves a join.

Targeted device messages use the target user's public key from the shared group's `Users`
and `Devices` records. This lets devices owned by different users exchange signaling and
administration messages without depending on the sender's local copy of the group secret.
Messages encrypted to the whole group continue to require matching group key material.

On receipt, Peers first verifies that the declared context is the device's personal context
or an enabled `Groups` record. It then resolves the sender's `Devices` and `Users` records
only inside that exact context and requires both the box and signature keys to match. Missing
or conflicting identities fail before a device handler runs; stale personal records cannot
override the identity recorded in the declared shared group.

## Joining a group

Members join through [invites](./Invites.md). Inbound group invites and join requests
also appear at the top of the **Groups** list, without opening a group. An Admin or Owner opens the group's **Members**
screen and uses **Invite people**:

- **Contacts** — pick one or more existing contacts and a role. Each contact receives a
  ready-to-accept invite; nothing needs to be copied or scanned.
- **Share a link** — issue a link/QR with a role and a mode: **I approve each join** (people
  request, you approve) or **Anyone with the link joins** (auto-admit while the link is
  valid). Pending requests and outstanding links appear below the panel.

Whichever path is used, admission is a signed **group approval** produced by the approving
Admin or Owner's device:

- The approver writes a signed `GroupMembers` row and weak `Users`/`Devices` stubs for the
  joiner in the group context.
- The joiner receives the group record, Admin+ seed memberships, their own signed membership,
  the approver's identity, and the group encryption secret boxed to the joiner's key. Personal
  `Groups` is added only when it is missing; an existing personal row is left in place so a
  local disable or leave stays authoritative.
- After import, the joiner opens a targeted connection to the approver in that group context.
  Signaling encrypts to the approver's user box key, so the group secret is not required for
  this first hop.

The group secret is validated against the signed group record before it is stored as a
personal persistent variable, so a joiner can read and write group data as soon as the
approval is imported. A member can only approve a role at or below their own.

From the CLI: `peers groups invite <groupId> <userId>`, `peers groups invite <groupId> --link`,
and `peers groups join <token>`. See [CLI](./CLI#peers-contacts-peers-groups-peers-invites--invites).

## Display names

The signed connection handshake can include optional user and device display-name hints.
Each hint is limited to 128 characters. They are presentation metadata, not identity:
device and user IDs plus the signing keys remain authoritative.

The user hint fills the brief gap before the owner's signed `Users` row reaches a group.
That signed row remains canonical and owner profile changes are copied from the owner's
personal context into each group. The device hint is stored as `reportedName` on the
existing `Devices` row and synchronizes with the group.

A device record's `name` is the local user's label, while `reportedName` is the latest
label advertised by the device owner. Interfaces prefer `name` and fall back to
`reportedName`, so another user's handshake cannot replace a local label. Updated hints
arrive on the next connection handshake; they are intentionally not included in the more
frequently exchanged network information.

## Diagnosing group connectivity

The desktop Network Viewer shows direct connections and shared-group routes. Owners can
also use the [CLI](./CLI) to inspect a directly connected device:

```bash
peers devices
peers devices status <deviceId>
peers db query "SELECT * FROM Groups" --device <deviceId> --json
peers db query "SELECT * FROM Devices" --context <groupId> --device <deviceId> --json
```

See [Network diagnostics](./Network-Diagnostics) for authorization requirements, query
limits, and the records to compare when a device is visible but signaling fails.
