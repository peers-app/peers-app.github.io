---
sidebar_position: 9
title: Devices
---

# Devices

**Identity → Devices** lists only installations signed in to the current
account. The personal `Devices` table can also contain devices observed for
other users, but those records never appear in this account-management view.
It is separate from [Network Viewer](./Network-Diagnostics.md): Devices is
where you name, pair, and forget installations; Network Viewer is the
connection diagnostic.

The current installation is marked **This device**. Every row shows its name,
online/offline state, latest path when connected, and human-readable last seen
time. Open a row for its ID and management actions. **Forget** stays on the
detail screen rather than being a dominant list action.

## Add a device

**Add device** in the persistent Identity action bar (or **Settings → Add
another device**) opens
`#identity/devices/pair`. The new device must be signed out and showing a code.
See [Add another device](./Device-Pairing.md).

From a signed-in terminal:

```bash
peers devices pair 7-guitar-revenge-tunnel
peers pair 7-guitar-revenge-tunnel
```

Both commands are the same ceremony.

## What is encrypted, on which transport

Every connection between two Peers devices starts with a signed handshake in
which each side proves its device identity. From that handshake both sides
derive a per-connection key pair (an ephemeral X25519 exchange combined with the
devices' static keys, run through HKDF-SHA256), and from then on **every frame on
the link is sealed with ChaCha20-Poly1305**: RPC calls, sync traffic, file and
database chunk streams, everything. The only cleartext byte per frame is a type
marker; frame types, payload shapes, and sizes of the inner messages are not
visible on the wire. Keys are per connection and forward secret: a device key
leaked later does not decrypt a captured session.

The frame layer runs the same way on every transport, so confidentiality never
depends on classifying a URL or trusting a certificate:

| Transport | Used for | Frame layer | Underneath |
|---|---|---|---|
| `ws://` (LAN, headless, Electron) | Same-network devices, `peers-headless` hosts | ChaCha20-Poly1305 per frame | Plain TCP; the frame layer is the only encryption |
| `wss://` / `https://` (cloud relay, `peers-services`) | Devices that cannot reach each other directly | ChaCha20-Poly1305 per frame | TLS, with the certificate verified for hostname URLs (LAN IP URLs are dialed without a certificate check because they never present one) |
| `wrtc://` (WebRTC data channel) | Electron and PWA peers through NAT | ChaCha20-Poly1305 per frame | DTLS from WebRTC |
| Device pairing socket | Credential transfer to a new device | ChaCha20-Poly1305 per frame | PAKE-derived admission token; credentials are additionally boxed to the new device's temporary identity |

**Legacy peers.** A device running a build that predates the frame layer does
not advertise it in its signed handshake. Against such a peer the connection
falls back to the previous behaviour: each RPC message is individually signed
and boxed when the transport is not already secure, and raw streams (chunk and
database downloads) are not encrypted at the application layer. The device logs
one warning per legacy connection naming the remote device and transport. A
future release will refuse handshakes from legacy peers.

`peers devices` ([CLI](./CLI.md#peers-devices--direct-connections)) marks each
verified connection `encrypted` or `legacy`.

## Pending device invites

Device admission uses the same `Invites` table as [contacts](./Contacts.md) and
[groups](./Groups.md), with `type: "device"`. Nothing creates those rows yet.
No admission actions exist for those rows yet, so they stay out of
**Needs your attention** and the Devices badge. The UI will surface them only
when a real decision flow exists.
