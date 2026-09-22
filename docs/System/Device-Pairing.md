---
sidebar_position: 8
title: Add another device
---

# Add another device

Device pairing signs a new Electron, PWA, or [headless](./Headless.md)
installation in to the same Peers account without displaying or manually
copying the account secret key.

The new device must be signed out. Pairing does not replace an account that is
already installed on a device.

## How it works

Pairing follows the "link a device" model used by Signal and WhatsApp: the
**new** device shows a short code, and a device that is **already signed in**
reads it and approves the transfer.

1. On the new device, open Peers and choose **Sign in from another device**. It
   shows a pairing code such as `7-guitar-revenge-tunnel` and the same code as a
   QR code.
2. On a device already signed in, choose **Add device** from the persistent
   Identity action bar (Settings links to the same screen).
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

A signed-in host without a UI approves from the command line:

```bash
peers pair 7-guitar-revenge-tunnel          # prompts before sending credentials
peers devices pair 7-guitar-revenge-tunnel  # same command
peers pair 7 guitar revenge tunnel --yes    # approve as soon as the code checks out
```

`peers pair` and `peers devices pair` work against Electron and headless hosts (pick the host with
`--auth-file`). See [CLI](./CLI.md#pair) and [Devices](./Devices.md).

### Headless as the new device

A headless host has no screen, so it prints the code (and a terminal QR code
when stdout is a TTY) instead:

```bash
npx peers-headless --pair --db ~/peers/headless/server
```

Approve it from any signed-in device or with `peers pair <code>` on a signed-in
host. The headless process installs the credentials, writes
`<db>/credentials.json` (mode 0600), and continues booting as that account in
the same process. The secret key is never passed on the command line or in the
environment. See [Headless host](./Headless.md#pair-instead-of-copying-a-secret).

## What the code protects

The code has two parts. The leading number selects a short-lived rendezvous room
on the Peers service. The three words are the password for a
[PAKE](https://en.wikipedia.org/wiki/Password-authenticated_key_agreement)
(CPace over X25519). Both devices derive the same session secret only if they
used the same words, and neither the service nor anyone else on the network
learns the words from the exchange.

Every signaling message after the PAKE (transport negotiation, and for WebRTC
the offer, answer, and ICE candidates) is authenticated with a key derived from
that secret, so the service cannot substitute its own endpoint. Once the data
transport is up, the devices complete the normal authenticated Peers
`Connection` handshake and exchange a final confirmation MAC bound to both
device identities and the session transcript, which includes which transport
was used and how it was bound (DTLS fingerprints or the connected URL). Only
then does the signed-in device offer **Approve**.

Because the words carry 24 bits of entropy, a guess has a one in ~16 million
chance. A wrong guess ends the room, and the new device rotates to a brand-new
code, so an attacker gets one attempt per code the user shows.

## Transports

The rendezvous room is only for finding each other and running the PAKE. The
credentials themselves travel over one of two data transports, negotiated right
after the PAKE:

| Transport | When | Encryption |
|---|---|---|
| **WebRTC** data channel | Electron and PWA on both ends (default) | DTLS at the transport layer |
| **Direct WebSocket** | The new device is a host that can listen, currently `peers-headless`, and the signed-in device can reach one of the URLs it advertises | Peers application-level sign+box on every message, regardless of `ws://` or `wss://` |

The new device advertises what it can host (`webrtc: true/false` and any
WebSocket URLs, for example `http://192.168.1.20:3341`). The signed-in device
tries the WebSocket URLs first, in order, with a short timeout each, and falls
back to WebRTC if none is reachable and both sides support it. If the devices
share no usable transport the ceremony fails and the new device shows a fresh
code. A PWA served over HTTPS only dials `https://`/`wss://` URLs; others are
skipped.

For the direct WebSocket the new device only admits a socket that presents a
token derived from the PAKE secret for this exact ceremony, and it accepts
exactly one. Nothing else is served on that listener while pairing runs. The
security of the credential transfer does not depend on the socket: credentials
are signed and boxed to the new device's temporary identity, and the
confirmation MAC proves both sides ran the same ceremony.

## What the service can see

`peers.app` provides the two-party signaling room and, on networks that need it,
short-lived STUN/TURN configuration. It relays only bounded, authenticated
signaling messages and never sees the pairing words or the account secret. It
does see the transport options a new device advertises (for example a LAN
address), as metadata. Account credentials are signed and encrypted directly to
the new device's temporary identity over the negotiated transport; on networks
that require TURN, only encrypted WebRTC packets transit the relay. Over a
direct WebSocket the service sees nothing after the negotiation.

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
ends the ceremony and closes the temporary connection immediately. The new
device shows a new code; the signed-in device returns to the code entry.
Temporary identities and ceremony state are kept only in memory.

If installation on the new device fails before the atomic commit, Peers rolls
back only the reservation owned by that ceremony. If initialization touched
process-wide runtime state, the PWA reloads or Electron relaunches into a
clean signed-out process rather than attempting a partial teardown; a headless
host exits non-zero and must be started again.

## Troubleshooting

- **Code not recognized:** Check each word. A word in the wrong slot is
  rejected before anything is sent. Codes expire after five minutes; if the new
  device has rotated, read the current code.
- **The devices never connect:** Confirm both devices can reach the configured
  Peers service. A restrictive network may require its TURN relay. For a
  headless destination, the signed-in device must be able to reach one of the
  advertised URLs (same LAN, or a public origin passed with `--pair-url`).
- **An unexpected device name appears on Approve:** Do not approve. Someone
  else may have entered the same code; have the new device show a fresh one.
- **The new device stays signed out:** Reopen Peers and retry with the new code.
  Failed initialization does not retain usable credentials.

Pairing is only for your own devices. To connect with another person, see
[Contacts](./Contacts.md); to join a group, see [Invites](./Invites.md).
