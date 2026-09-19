---
sidebar_position: 7
---

# Invites

Invites are how people connect on Peers: adding a [contact](./Contacts.md),
inviting someone into a [group](./Groups.md), or joining a group from a link.
One model covers all of them so that every flow works the same way and none of
them require both people to be online at once.

Adding one of your own devices is different — it transfers your account secret —
and uses [device pairing](./Device-Pairing.md) instead.

## The invite token

An invite is a small signed token. It carries the inviter's public identity,
what it grants (a contact connection, or membership in a specific group with a
role), how it can be used (once or many times, until an expiry), and the
inviter's signature. The token is encoded once and can be shown as a QR code, a
link, or plain text:

| Form | Example | Use |
|------|---------|-----|
| Link | `https://peers.app/i#eyJ…` | Messaging apps, email, QR codes |
| Deep link | `peers://i#eyJ…` | Opens the installed desktop app directly |
| Code | `eyJ…` | Paste anywhere; devices without a camera |

The token lives after the `#` in the link. Browsers never send URL fragments to
the server, so the `peers.app` web page that hosts the link can display and
hand it to the app without ever seeing it.

Because the token is signed, whoever accepts it can verify who issued it before
doing anything. Because it names the grant, it cannot be used for anything
else: a contact invite cannot join a group, and a group invite cannot grant a
higher role than it states.

## Invite modes

**Contact invites** connect two people. A one-off invite is used once and
expires after seven days by default. Your **profile QR** (Account → Profile QR)
is a long-lived, reusable variant that produces contact *requests* you confirm
individually.

**Group invites** have a role and a mode:

- **Direct** — the inviter picks an existing contact. The contact sees a
  ready-to-accept invite; no link changes hands. This is the simplest path once
  two people are connected.
- **Link, approve each join** — anyone with the link can *request* to join. The
  inviter approves or denies each request. Default lifetime seven days.
- **Link, anyone joins** — anyone with the link is admitted automatically as
  long as the link is valid. Default lifetime one day, maximum 30 days. Use it
  for a quick "everyone in this room" moment and let it expire.

Only Admin or Owner members can issue group invites, and a link cannot grant a
role above the issuer's own.

## Pending invites

Every invite you issue or receive is a row in your personal `Invites` table,
synced across your devices. The UI lists them under **Contacts**, each group's
**Invite people** panel, and the **Invites** screen; the CLI shows them with
`peers invites`.

Rows are `pending` until resolved, then `accepted`, `declined`, `expired`,
`revoked`, or `used`. Pending rows expire with their token (inbound requests
after 30 days) and resolved rows are purged after 30 days.

Actions on a row:

| Row | Actions |
|-----|---------|
| Inbound direct group invite or contact request | Accept · Decline |
| Inbound join request for my link | Approve (optionally with a different role) · Deny |
| My outstanding invite | Revoke |

**Regenerate** on the Account screen revokes *every* token you have issued by
bumping an invite epoch that all your tokens carry.

## Delivery

Accepting an invite sends a reply to the inviter. Peers tries, in order:

1. a direct connection to any of the inviter's devices;
2. the Peers mesh, addressed to the inviter's user so any of their devices or
   a shared group peer can forward it;
3. the Peers **mailbox** on `peers.app`;
4. otherwise the reply is kept locally as `queued` and retried when connections
   change and every five minutes.

Replies are signed by the sender and encrypted to the recipient's key before
they leave the device. The mailbox stores only that ciphertext, for at most 30
days, with per-sender rate limits and per-recipient quotas. An account can opt
out of receiving mailbox messages (`PUT /api/v1/mailbox/settings`); invites then
still work whenever both parties share a connection or a mesh route.

None of this requires `peers.app`. Two devices on the same network, or any
chain of connected Peers devices, can complete every flow described here.

## Opening an invite link

`https://peers.app/i#…` opens a small page that reads the token from the
fragment on the client and offers:

- **Open in Peers** — a `peers://` deep link for the installed desktop app;
- **Open in the web app** — for the PWA;
- the token as a QR code and as copyable text for another device.

The page never sends the token anywhere. Inside the app, the token lands on the
**Accept an invite** screen, which shows the inviter and the grant before you
confirm.

## Security notes

- A signed token proves *who issued it*; it does not prove who is holding it.
  Treat unused one-off links like a key and send them to one person.
- Accepting a contact invite sets a trust level you choose; the default is the
  lowest. Trust is always a local decision.
- Group approvals include the group's encryption secret boxed to the joiner, so
  a new member can read and write group data immediately. Only an Admin or
  Owner who holds the secret can produce an approval.
- Auto-admit links are re-verified by the inviter's device at join time: the
  signature, expiry, epoch, and the issuer's current role must all still be
  valid.
