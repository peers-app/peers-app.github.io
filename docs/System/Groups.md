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

Peers waits for the recipient's signed identity before sending a targeted group message.
For an incoming group message, a device it has not met can introduce itself with device
info signed by a counted member's key, with a role above None and account keys matching any
identity already known for that user. Removed members and non-members (even in public groups)
cannot use this path. New members and new devices can connect through Peers Services,
including over WebRTC, without the devices first meeting directly. Signaling remains
encrypted for the member's account, and introducing a device grants no additional group
permissions.
Once a device's ownership is verified, rotating or recovering the owner's account key does
not let another member take over that device's entry. An offline device may need to reconnect
with the confirmed new key before it can receive targeted group messages again.

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

## Removing a group

**Remove group**, at the bottom of a group's **Info** tab, takes the group off your list on all
your devices. Other members keep the group, and you stay a member: they still see you in it,
but your devices stop syncing it until you restore it. If it was the group you had open, Peers
switches to Personal. Its data stays on each of your devices, so removing a group doesn't free
disk space: `peers groups purge <groupId>` deletes one device's copy (see below). **Removed
groups**, under the list on **Identity → Groups**, shows the groups you removed, and **Restore**
brings one back on all your devices. Accepting an invite to a group you removed restores it
the same way. **Remove**, in the menu next to **Save**, does the same as
**Remove group**. A restored group's apps and tools start again on each of your devices as the
restore reaches it, with no restart.

From the CLI: `peers groups remove <groupId>`, `peers groups removed`, and
`peers groups restore <groupId>`. `peers groups delete <groupId>` is an alias of `remove`,
with the same reversible behavior. Agents and scripts can also call System Host Tools'
`remove-group` and `restore-group`, for example
`peers tools run remove-group '{"groupId":"<groupId>"}'`. Packages can't call them.

`peers groups purge <groupId>` deletes a removed group's files on one device (this one, or one
of yours with `--device <id>`), and `peers groups purge --all-removed` every removed group's and
orphan's. Both only list what they'd delete until you add `--yes`. This is permanent: a group
restored after a purge can only sync its data again from another member's device.

## Colors and icons

Every group has a color and an icon. Peers shows them in **Identity → Groups**, on the group's
page, and in the group switcher. Tasks (0.33.26 and later) shows each group's color and icon,
Desk (0.4.7) and Notes (0.1.7) its color, Calendar (0.1.14) its icon beside its name and its
color on its default calendar and its tasks, and Threads (0.4.11) its icon in its color beside
its name and in the group menu. In Desk (0.4.8), a desk on one group takes that group's color and
icon until you give the desk its own. An older version of an app keeps the colors and icons it showed
before. Apps only show a group's look; you change it in Peers.

- **For everyone.** A group's admins set its color and icon for all its members. Open the group
  in **Identity → Groups**, then **Info → Change color and icon**.
- **Just for me.** Anyone can choose their own color and icon for a group, in the same dialog.
  Only you see them, on all your devices. Anything you leave unset uses the group's.
- **Personal** has only your own. It's the first row of **Identity → Groups**; click it to change
  its color and icon.

The group switcher's menu also opens the dialog for the group you're in: **Color and icon for**
*that group* (Peers 0.33.20 and later).

The dialog says which one you're changing. **For everyone** and **Just for me** sit at the top,
the line under them says who sees it, and the preview beside the group's name shows the group as
everyone sees it or as you see it. Every pick saves at once. From the switcher it opens on
**Just for me**, so a quick change is only yours. Group details opens on **For everyone** for
admins. On **For everyone**, if your own color or icon hides the group's, the dialog says so,
with **Reset mine** to go back to the group's. The preview and that note arrive in Peers 0.33.20.

A color is one of the ten Peers palette colors or any color you pick. An icon is any
[Bootstrap icon](https://icons.getbootstrap.com/) or one emoji: search by name or keyword, or
paste an emoji into the search box. A new group starts with the palette color you use least,
and you can pick another as you create it. Creating it from the group switcher also lets you
pick its icon; otherwise it starts with the people icon. You can change both later.

What a group shows, field by field: your own choice, then the group's, then a palette color
picked from the group's id (the same on every device) and the people icon. Personal is blue
with the person icon until you change it.

**Older versions of Peers** show a Bootstrap icon chosen for everyone, but not emoji, colors, or
anyone's own choices. Update every device to see them.

**Who can set the group's look.** Peers' screens and tools let only admins change the look for
everyone. That isn't enforced when it syncs, so a member who can write to the group could still
change it outside them; an admin can remove a member who misuses it. Every value is checked
before it's shown, so a bad one only ever shows as the default.

**From the CLI or an agent**, use the [System Groups](#system-groups) tools:

```bash
peers tools run listGroups '{}'
peers tools run setGroupAppearance '{"groupId":"<groupId>","layer":"mine","look":{"color":"teal","icon":"🏠"}}'
peers tools run setGroupAppearance '{"groupId":"<groupId>","layer":"everyone","look":{"color":"#3a7bd5","icon":"bi:house-fill"}}'
peers tools run create-group '{"name":"Book club","color":"amber","iconClassName":"bi:book-fill"}'
```

`look` replaces the whole layer: a field you leave out is cleared, and `"look": null` resets it.
Colors are `blue`, `teal`, `red`, `amber`, `purple`, `orange`, `green`, `pink`, `violet`,
`slate`, or `#rrggbb`. Icons are `bi:<Bootstrap icon name>` or one emoji; a Bootstrap class
such as `bi-book-fill` is read as `bi:book-fill`. Any other color or icon is refused with the
reason, except an icon named for another icon set, such as `lucide:home`: it's saved, but this
Peers doesn't draw it, so the group goes on showing the icon it would have without it.

### System Groups

System Groups (`00mwp7oetrqei28l7f4zz840n`, v1, dev) lists the user's groups with their names
and looks, and saves a look. It answers only on the device itself.

| Member | What it does |
|---|---|
| `listGroups` | Personal first, then the groups by name: `groupId`, `name`, `personal`, and the `icon`, `color` and `colorHex` each is shown with. |
| `groups` (observable) | The same list, kept current as groups are joined, left or renamed and as looks change. |
| `getGroupAppearance({ groupId })` | Both layers, for an editor: `everyone` (the group's), `mine` (yours), `shown`, and `canEditEveryone`. |
| `setGroupAppearance({ groupId, layer, look })` | Replaces one layer: `mine` for your own, `everyone` for the group's (admins only; not for Personal). |

- A caller in Personal sees every group you're in; a caller in a group sees only that group.
- The reads need Reader; `setGroupAppearance` needs Writer in the context it's called in
  (Personal, where you have every right, for Peers and the CLI). Packages can't set a look, and a
  package's screen can't either.
- `listGroups`, `groups` and `shown` give only values this Peers can draw: `bi:<name>` or one
  emoji, a palette name or lowercase `#rrggbb`, plus `colorHex`. `everyone` and `mine` are
  checked the same way, but keep an icon from another set, so an editor sends it back unchanged.
- Packages may read, but only for you: a call acting for someone else, or arriving from another
  device, is refused. Saving is for you (the UI, the CLI, an agent). A package can't save a look,
  even one acting for you under an [Acts for you grant](./Delegates.md); it opens the
  color-and-icon dialog instead. For packages, see
  [Groups, colors and icons](../Packages/declaring-a-package.md#groups-colors-and-icons).

## Who can change what

Group roles and settings require a signature from someone allowed to change them:

- The founder is whoever you saw founding the group when you created or joined it. Only the
  founder can hand the group to a new founder.
- A membership counts when an Admin or the founder signed it, for a role no higher than the
  signer's own. A member can't raise their own role, and an Admin can't change the founder's
  or an Owner's membership.
- A membership names the member's signing key, and the role belongs to that key. A device that
  proves the member's user ID with any other key gets only the group's public role, and a
  profile someone else wrote for the member doesn't carry their role. When a member rotates
  their key, their profile carries the old key's signed handover, so their role follows them.
- Group settings (name, description, public role) count when an Admin or the founder signed
  them. The public role cannot exceed the signer's own role.
- Each signature carries the time it was made. A copy of an earlier membership, setting or
  release can't replace a later one, so a role someone lost stays lost. When authorized
  changes are signed around the same time on different devices, every device keeps the
  later-signed change.
- Package releases: see [Packages](./Packages.md#who-can-release-a-version).

If **Sync recovery** shows *Parked, not authorized*, ask the founder or an Admin to review
the affected membership, setting or release and save an authorized change. Your current
roles and settings remain in effect until an authorized update is available.
Peers can apply a parked change once a missing signer's membership or verified profile
becomes available.
Conflicting changes signed in the same millisecond also stay parked; saving the intended state
again resolves that conflict.
If a save reports that the record changed while signing, review the latest state and save again.

Readers can view group data and update their own profile and device information.
Group settings also have a [Files tab](./Files.md#seeing-your-files), which lists the group's
files as this device holds them and shows the group's retention.

Each device publishes its own entry in the group's device list, signed with its owner's key.
Once a device's owner has signed for it, nobody else can claim that device or remove its entry.
Targeted messages require a verified device owner and are encrypted for that owner's account.

**When an Admin's role changes.** Memberships an Admin granted count only while that Admin is
still an Admin. Before you demote or remove an Admin, have the founder or another Admin re-sign
the memberships they granted, or those members lose their roles too.

**Re-signing.** Roles are checked against each signer's current key. Rotating your key
re-signs the memberships, settings and packages you signed (see [Identity](./Identity.md)). If
you founded a group before devices started checking signatures, run `peers groups resign --all`
after updating, so its members keep their roles and its packages have approval for that group
on every device. Run it again once the group's other devices (yours and other members') have
updated too: a device that receives the re-signed rows while still on an older version stores
them without the fields that version doesn't know, and after it updates it treats them as
unsigned, so the group's apps don't start there and its roles don't count. Re-signing again
replaces those rows, and it is safe to repeat. Re-signing also binds each membership to the member's key as your
device knows it, so run it again for a member who recovered a lost key: a recovered key has
no handover from the old one. It vouches for the group's rows as they are on your device,
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
