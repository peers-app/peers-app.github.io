---
sidebar_position: 8
title: Add another device
---

# Add another device

Device pairing signs a new Electron or PWA installation in to the same Peers
account without displaying or manually copying the account secret key.

The new device must be signed out. Pairing does not replace an account that is
already installed on a device.

## How it works

Pairing follows the "link a device" model used by Signal and WhatsApp: the
**new** device shows a short code, and a device that is **already signed in**
reads it and approves the transfer.

1. On the new device, open Peers and choose **Sign in from another device**. It
   shows a pairing code such as `7-guitar-revenge-tunnel` and the same code as a
   QR code.
2. On a device already signed in, open **Settings → Add another device**.
3. Scan the QR code with the camera inside Peers, or type the code. Codes are
   case-insensitive and can be separated by hyphens or spaces.
4. When the signed-in device shows the new device's name, choose **Approve**.
5. Wait for the new device to finish installing and reload.

Only the signed-in device approves. The new device has nothing to confirm; it
either receives credentials from a device that proved it knows the code, or it
shows a fresh code.

Devices that do not have a camera (a desktop, for example) type the code. The
code is short enough to read aloud or type from another screen; no link is
copied between devices.

## What the code protects

The code has two parts. The leading number selects a short-lived rendezvous room
on the Peers service. The three words are the password for a
[PAKE](https://en.wikipedia.org/wiki/Password-authenticated_key_agreement)
(CPace over X25519). Both devices derive the same session secret only if they
used the same words, and neither the service nor anyone else on the network
learns the words from the exchange.

Every signaling message (WebRTC offer, answer, and ICE candidates) is
authenticated with a key derived from that secret, so the service cannot
substitute its own endpoint. After the WebRTC data channel opens, the devices
complete the normal authenticated Peers `Connection` handshake and exchange a
final confirmation MAC bound to both device identities and the session
transcript. Only then does the signed-in device offer **Approve**.

Because the words carry 24 bits of entropy, a guess has a one in ~16 million
chance. A wrong guess ends the room, and the new device rotates to a brand-new
code, so an attacker gets one attempt per code the user shows.

## What the service can see

`peers.app` provides the two-party signaling room and, on networks that need it,
short-lived STUN/TURN configuration. It relays only bounded, authenticated
signaling messages and never sees the pairing words or the account secret.
Account credentials are signed and encrypted directly to the new device's
temporary identity over the WebRTC connection; on networks that require TURN,
only encrypted WebRTC packets transit the relay.

The room and its TURN credentials expire after five minutes on the service's
own clock.

## After approval

The new device installs the credentials only in memory first, initializes its
normal runtime, and commits to stable storage only if the pairing ceremony
still owns the signed-out credential reservation. It then returns a signed
installation receipt.

When the receipt arrives, the signed-in device adds the new device to the
`Devices` table of every group it belongs to, with the same trust level as
itself. The new device can therefore sync and connect in those groups without
any extra admission step.

## Failure and cleanup

Canceling, closing either screen, losing the connection, or a failed code check
ends the ceremony and closes the temporary WebRTC connection immediately. The
new device shows a new code; the signed-in device returns to the code entry.
Temporary identities and ceremony state are kept only in memory.

If installation on the new device fails before the atomic commit, Peers rolls
back only the reservation owned by that ceremony. If initialization touched
process-wide runtime state, the PWA reloads or Electron relaunches into a
clean signed-out process rather than attempting a partial teardown.

## Troubleshooting

- **Code not recognized:** Check each word. A word in the wrong slot is
  rejected before anything is sent. Codes expire after five minutes; if the new
  device has rotated, read the current code.
- **The devices never connect:** Confirm both devices can reach the configured
  Peers service. A restrictive network may require its TURN relay.
- **An unexpected device name appears on Approve:** Do not approve. Someone
  else may have entered the same code; have the new device show a fresh one.
- **The new device stays signed out:** Reopen Peers and retry with the new code.
  Failed initialization does not retain usable credentials.

Pairing is only for your own devices. To connect with another person, see
[Contacts](./Contacts.md); to join a group, see [Invites](./Invites.md).
