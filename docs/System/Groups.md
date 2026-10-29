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

Targeted device messages use the recipient's account keys. Requests and their application
replies are signed and encrypted for the two accounts, including when other devices relay
them. Update both ends together. An old reply cannot be reused for a new request.

Previously observed device owners and contact keys take precedence over shared discovery
data. Conflicting identities cause an error. If Peers cannot resolve a targeted recipient,
the message fails; it is never encrypted for the whole group as a fallback. Group broadcasts
still require matching group keys.

## Joining a group

Open **Identity → Groups**. The list summarizes each group's description,
member count, and your role. **Create group** in the persistent Identity action
bar asks for a name. **Use invite** opens the same paste-or-scan screen used for
contact invites.

Members join through [invites](./Invites.md). Inbound group invites and join
requests appear in **Identity → Activity**. The Groups section badge counts only
requests that need your decision; requests waiting on someone else do not
create false urgency. An Admin or Owner opens the group's
**Members** screen and uses **Invite people**:

- **Contacts** — pick one or more existing contacts and a role. Each contact receives a
  ready-to-accept invite; nothing needs to be copied or scanned.
- **Share a link** — issue a link/QR with a role and a mode: **I approve each join** (people
  request, you approve) or **Anyone with the link joins** (auto-admit while the link is
  valid). Pending requests and outstanding links are in **Activity**, filtered to
  this group.

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

## Who can change what

Group roles and settings require a signature from someone allowed to change them:

- The founder is whoever you saw founding the group when you created or joined it. Only the
  founder can hand the group to a new founder.
- A membership counts when an Admin or the founder signed it, for a role no higher than the
  signer's own. A member can't raise their own role, and an Admin can't change the founder's
  or an Owner's membership.
- Group settings (name, description, public role) count when an Admin or the founder signed
  them. The public role cannot exceed the signer's own role.
- Each signature carries the time it was made. A copy of an earlier membership, setting or
  release can't replace a later one, so a role someone lost stays lost.
- Package releases: see [Packages](./Packages.md#who-can-release-a-version).

If **Sync recovery** shows *Parked, not authorized*, ask the founder or an Admin to review
the affected membership, setting or release and save an authorized change. Your current
roles and settings remain in effect until an authorized update is available.
Conflicting changes signed at the same time also stay parked; saving the intended state
again resolves that conflict.

Readers can view group data and update their own profile and device information.

**When an Admin's role changes.** Memberships an Admin granted count only while that Admin is
still an Admin. Before you demote or remove an Admin, have the founder or another Admin re-sign
the memberships they granted, or those members lose their roles too.

**Re-signing.** Roles are checked against each signer's current key. Rotating your key
re-signs the memberships, settings and packages you signed (see [Identity](./Identity.md)). If
you founded a group before devices started checking signatures, run `peers groups resign --all`
once after updating, so its members keep their roles and its packages have approval for
that group on every device. It vouches for the group's rows as they are on your device,
so only re-sign a group whose current rows you trust.

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
