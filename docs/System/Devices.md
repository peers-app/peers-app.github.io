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
detail screen rather than being a dominant list action. For another desktop
device, the detail screen also shows its app version and **Update & restart**
(see [Update another device](./App-Updates.md#update-another-device)).

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

Peers authenticates both devices and encrypts all traffic after connection
setup, including RPC calls, sync traffic, and file streams. Encryption is
required on every supported transport; you don't need to enable it separately
for local connections, remote connections, or pairing.

| Transport | Used for | What to expect |
|---|---|---|
| `ws://` (LAN, headless, Electron) | Same-network devices, `peers-headless` hosts | Device traffic is encrypted even without TLS |
| `wss://` / `https://` (cloud relay, `peers-services`) | Devices that cannot reach each other directly | Device traffic is encrypted, with TLS providing additional protection |
| `wrtc://` (WebRTC data channel) | Electron and PWA peers through NAT | Device traffic is encrypted |
| Device pairing socket | Credential transfer to a new device | Encrypted, including the credential transfer; the rendezvous that sets it up runs through the Peers service (see [What the service can see](./Device-Pairing.md#what-the-service-can-see)) |

**Older devices.** A device on a build from before 0.25.7 can't encrypt frames,
so connections to and from it are refused with "Device … does not support frame
encryption; update Peers on that device to connect". Your other devices can't
connect to it, so update it on the device itself:

- **Desktop app:** it checks the release feed at launch, downloads the update,
  and installs it the next time Peers quits (see [App updates](./App-Updates.md)).
- **PWA:** reload the page.
- **Headless host:** it doesn't update itself. Rebuild it from a current
  `peers-headless` (`npm run build`) and start it again.

`peers devices` ([CLI](./CLI.md#peers-devices--direct-connections)) marks each
verified connection `encrypted`.

Your own devices trust each other as Self, so you can control one from another (see
[Trust](./Trust.md)): administer its packages with `peers packages … --device <deviceId>`
(see [Administering your other devices](./Packages.md#administering-your-other-devices)),
inspect or screenshot its UI with `peers ui … --device <deviceId>`, and restart it with
`peers app restart --device <deviceId>` (see [System Host Shell](./Host-Shell.md)).

## Pending device invites

Device admission uses the same `Invites` table as [contacts](./Contacts.md) and
[groups](./Groups.md), with `type: "device"`. Nothing creates those rows yet.
No admission actions exist for those rows yet, so they stay out of
**Needs your attention** and the Devices badge. The UI will surface them only
when a real decision flow exists.
