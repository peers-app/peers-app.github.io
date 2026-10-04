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

### Signing key

The **Signing key** card on Identity → Account shows the current public key,
any earlier keys this host replaced (with when and why), and what the key
registry on Peers Services reports when it can be reached.

**Rotate signing key** publishes a new key through every anchor on the profile
that can be written to (Peers Services, during a recovery-email session). An
https anchor cannot be written to from here, so when one is on the profile the
card shows a document instead; place it at every https anchor, then **I've
published this** waits until every anchor lists the new key. Only then does
the host rotate and restart. Until then the current key keeps working. A
handshake that presents a different key is accepted only when those anchors
confirm it. The database
key is stored separately from the signing key, so a rotation does not
re-encrypt the database. Secret values (group keys, service tokens) are
re-encrypted under the new key; the old key stays in the credential store
until that finishes, so a crash mid-way is picked up at the next start rather
than leaving a value nothing can open. When a device is paired again onto an account whose
old database files it cannot open, those files are moved aside as
`<file>.stale-<timestamp>` rather than deleted.

A device that still holds the old key shows **This device holds an old key**
once an anchor has confirmed the new one. Pair that device again; the notice
clears on its next start, once the device holds the confirmed key.

`peers keys show` prints the key and the anchors. `peers keys rotate` does the
same as the card. See [CLI](./CLI.md#keys) and
[Key Registry](./Key-Registry.md#user-key-rotation).

### Recovery email

The **Recovery email** card binds a mailbox at Peers Services. **Send rotation
code**, then **Open session**, then **Rotate signing key** publishes the new
key there. The session lasts about ten minutes. Without a mailbox, Peers
Services refuses the write and the key on this device stays as it is, because
every anchor on the profile must list the new key. If the signing
key is lost and no mailbox is bound, there is no way back into the account.
Removing the mailbox opts out of that factor. A **passkey** on the same
screen opens the same kind of session. A passkey belongs to a website, so the
card works in the web app; the desktop window is not served from a site and
says so. See
[Writing to the peers-services anchor](./Key-Registry.md#writing-to-the-peers-services-anchor).

### Anchors

The **Anchors** card lists the places peers already trust for this account.
**Add** publishes the new list at those places, then stores it here. An https
address has to be serving the new list before the command finishes. **Remove**
does the same with the shorter list. With no anchors left, a lost key cannot
be recovered. `peers keys anchors list`, `add --url`, and `remove --url` do
the same from a signed-in host. A contact adopts the new list only after an
anchor already on record publishes it.

### How peers decide which key is yours

The key on your personal `Users` row is the key on record. The `anchors` on
that same row are the places peers ask before they believe a different key.
A new user with Peers Services configured starts with that service as the
only anchor. With services off, the list is empty and a different key is
never confirmed. A contact invite carries that list, and the new contact
stores it with the key. That is the list later checks use.

Your signature on the row covers your name and keys, not the anchor list.
The list on record is the anchors' decision, not the row author's, so a peer
that keeps its own list beside your profile still holds a row you signed,
and a peer on an older release that does not store the list at all still
verifies it.

A handshake, or a profile row from another device, that presents a new key
is checked against those anchors. One confirming answer and no veto accepts
a rotation immediately: the previous key co-signed the new one. Anything
else — a veto, no answer, or a new key nobody co-signed — leaves the old key
in place. A row that tries to replace the anchor list at the same time keeps
the list already on record; the rest of the row (name, picture) still
applies. The list changes only when an anchor you already trust publishes the
new list. A contact row that arrives with no anchors on record yet accepts
the first list it is given with the key already on record; that is a trust
decision made once, when the contact is added, the same as the key itself.

Your own device, holding the old key, learns it has been replaced when an
anchor confirms the new one. It does not adopt that key. It has to be paired
again. The reverse case is handled at startup: when a device holds a key its
own profile row does not (a rotation that stored the new key but stopped
before re-signing the row, or credentials an operator replaced after
publishing the key), the row follows the device key once the anchors on
record confirm it. If they do not, the row is left as it is and the device
does not publish its key over it.

### Lost your key

A recovery is a new key that the anchors list without the old key's
signature. Peers that still hold the old key see a notice and wait 72 hours,
measured from when they first saw the new key. After that, with no objection,
they adopt it. A device that still holds the old key can contest it. The
contest is signed by that key, carried to contacts in the handshake, and
posted where Peers Services can be reached. A contest holds the new key until
someone who can see the notice accepts it. An attacker who controls an anchor
but not the old key cannot produce that contest.

On a signed-out desktop, `peers keys email session --user <userId>` opens a
session from the recovery mailbox, and `peers keys recover --user <userId>`
publishes the new key and signs this host in. `peers keys recover --user
<userId> --manual` prints a document for an operator instead. A headless host
is never signed out; see
[Headless › Recovering a lost key](./Headless.md#recovering-a-lost-key).
Groups do not follow the recovered key; a member invites the device again.
Values wrapped under the lost key stay unreadable. The account screen shows
the same notice, with **Contest** on your own account and **Accept the new
key** for a contact.

## Host-only operations

The System Identity and System Invites contracts control sensitive local-host
operations such as sign in, sign out, pairing, and invite decisions. They are
available to the local UI and CLI host transport only. Mesh callers, including
another device with Self trust, cannot resolve these host contracts remotely.

See [Contacts](./Contacts.md), [Groups](./Groups.md),
[Devices](./Devices.md), [Invites](./Invites.md), and
[Add another device](./Device-Pairing.md) for the individual flows.
