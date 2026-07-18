---
sidebar_position: 8
title: Add another device
---

# Add another device

Device pairing signs a new Electron or PWA installation in to the same Peers
account without displaying or manually copying the account secret key.

The destination must be signed out. Pairing does not replace an account that is
already installed on a device.

## Pair with a QR code

1. On a signed-in device, open **Settings** and choose **Add another device**.
2. Keep the invitation open. It expires after five minutes.
3. On the signed-out device, scan the QR code with its normal camera and open
   the Peers link.
4. Wait for both devices to show the remote device name and the same six-digit
   number.
5. Compare the numbers directly. If either the device or number is unexpected,
   reject the request.
6. Choose **Numbers match — approve** on both devices.
7. Wait for the destination to finish initializing and reload.

The link can also be copied to the destination. For manual entry, paste the
complete pairing link or versioned token; there is no separate short,
low-entropy pairing code.

## What the service can see

The invitation secret is stored after `#` in the link. Browsers do not include
URL fragments in normal HTTP requests, and Peers removes the fragment from the
address bar as soon as the destination captures it.

`peers.app` provides a short-lived, two-party WebRTC signaling room. It relays
only bounded offer, answer, and ICE messages. Each signaling message is
authenticated with a key derived from the invitation, so the service cannot
silently replace a WebRTC endpoint.

The service sets the room's authoritative expiry using its own clock. After a
source creates the room or a destination joins it, that room member can obtain
short-lived STUN/TURN configuration. TURN credentials expire with the room and
are not available to clients that have not joined it.

After the WebRTC data channel opens, the devices complete the normal Peers
authenticated `Connection` handshake using the source device identity and a
temporary in-memory destination identity. The six-digit comparison value binds
the invitation, both identities, endpoint nonces, and WebRTC certificate
fingerprints. Before approval, pairing also applies strict message-size,
concurrency, aggregate-memory, and reassembly-time limits; violating them
closes the temporary peer.

Account credentials are signed and encrypted directly to that temporary
destination identity. They are never sent as a signaling payload or retained
by `peers.app`; on networks that require TURN, encrypted WebRTC packets may
transit the relay. Credentials are sent only after both devices approve. The
destination first reserves its signed-out credential store and initializes its
normal Peers runtime using the received credentials only in memory. It commits
the credentials to stable storage only if the pairing ceremony still owns that
reservation, then returns a signed installation receipt. Another tab or sign-in
cannot overwrite or clear that in-progress installation.

## Failure and cleanup

Rejecting, canceling, closing either endpoint, losing the connection, or
reaching the five-minute timeout marks the ceremony canceled and closes the
temporary WebRTC connection immediately. Source room deletion is best-effort
cleanup after the data path is closed, so a slow signaling service cannot keep
credential transfer available. Temporary identities and ceremony state are
kept only in memory.

If destination initialization fails or is canceled before the atomic commit,
Peers rolls back only the reservation or credential revision owned by that
ceremony. If initialization touched process-wide runtime state, the PWA reloads
or Electron relaunches into a clean signed-out process rather than attempting a
partial teardown.

## Troubleshooting

- **Invitation is invalid or expired:** Create a new invitation on the signed-in
  device and keep the screen open.
- **The devices never connect:** Confirm both devices can reach the configured
  Peers service. A restrictive network may require its TURN relay.
- **The numbers differ:** Reject on both devices. Do not retry with the same
  invitation; create a new one.
- **An unexpected device name appears:** Reject the request and confirm which
  device opened the invitation.
- **The destination stays signed out:** Reopen Peers and retry with a new
  invitation. Failed initialization does not retain usable credentials.

This pairing flow is a temporary bridge. It intentionally reuses normal Peers
connections and platform WebRTC implementations rather than introducing a
durable pairing transport or persistent pairing records.
