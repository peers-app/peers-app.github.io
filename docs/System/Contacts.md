---
sidebar_position: 7
---

# Contacts

A contact is another Peers user whose public identity (user ID, signing key,
and encryption key) you have saved. Connecting does not share an account
secret or sign either person in on another device.

Contacts are made through [invites](./Invites.md). Both people do not need to
be online at the same time.

## Invite someone

1. Open **Contacts** and choose **Invite**.
2. Show the QR code, or use **Copy link** or **Share…** to send the link through
   any messaging app.
3. When they accept, they appear in your contact list and you appear in theirs.

If they are not reachable when they accept, their reply is queued and delivered
when a route becomes available (a direct connection, a shared device, or the
Peers mailbox). The invite appears under **Pending contact invites** until then.
**Show history** includes invites that were accepted, declined, expired, or revoked.
The section stays hidden when there are no contact invites; once one has been resolved,
only **Show history** remains until you open it. There is no separate Invites tab;
`/invites` opens Contacts.

A one-off contact invite expires after seven days by default and can be used
once. Anyone who has the link before it is used can accept it, so send it only
to the person you mean.

## Your profile QR

**Account → Profile QR** shows a long-lived invite that you can print, add to a
business card, or keep on your phone. Anyone who scans it can send you a contact
**request**. Nothing happens until you confirm the request under **Contacts →
Pending**.

**Regenerate** replaces the profile QR and revokes every invite link you have
issued so far. Use it if a code has leaked.

## Accept an invite

From **Contacts** choose **Accept invite**, then paste the link or code, or use
**Scan QR** on a device with a camera. Peers verifies the inviter's signature
and expiry and shows who is inviting you before you accept. Pick a trust level
for the new contact at the same time; you can change it later from the contact's
details.

Links opened on a device where Peers is installed go straight to this screen.
See [Invites](./Invites.md#opening-an-invite-link) for what happens when a link
is opened elsewhere.

## Inviting a contact to a group

Once someone is a contact, they can be invited into any of your groups directly
with no new link: see [Groups](./Groups.md#joining-a-group).

## Trust

Saving a contact does not grant them anything beyond the ability to address you
on the Peers network. Trust remains an explicit local choice that you set on the
contact.

To sign in a new installation to your own account, use
[Add another device](./Device-Pairing.md) instead.
