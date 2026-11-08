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

## Finding and reconnecting to devices

Peers starts connecting as soon as it has your identity and device lists, before every app
has loaded. It tries the devices it knows, from your own device list and each group's, and
keeps enough healthy connections to reach your data. On a desktop or headless host, local
connections start alongside Peers Services instead of waiting for it.

A desktop or headless host also publishes the local network addresses it accepts connections
on. They're signed with your account's key and stored with the device in your own device list
and in each of its groups. Other desktops and headless hosts can use those addresses to
reconnect directly, even while Peers Services is unavailable. If a device moves networks or
changes its address, Peers can find it through another connected device or Peers Services.
A device answering at an address must still prove it is the device expected. The phone app
publishes no addresses; connecting to it needs another connected device or Peers Services
to relay the connection setup.

Members of a group can see the local network addresses of your devices in that group, and keep
them after you leave it. Each device also remembers, on itself only, which devices it connected
to recently and how, so after a restart it tries those first.

When you come back to the app, it checks its connections and reconnects at once, even after a
short absence. Healthy connections stay open. To catch up on a group's data, a device with
Writer access or above in that group needs to be online: Readers can't supply new group data.

A brand-new device may not know any of its group's devices yet. Pair it with an awake device,
or accept the group invitation while the inviting device is online: that device gives it its
first connection. When Peers knows no device to try, for example two of your own devices that
have never met, it falls back to a broadcast through Peers Services. It retries after a few
seconds, then less often. That fallback can miss when Services is busy, so keeping the
introducing device online is the reliable way to finish joining.

The phone app keeps its Peers Services connection up by reconnecting automatically. If it
can't connect, check its internet access, open an awake device that holds your data, and use
**Connections → Troubleshoot**.

## What is encrypted, on which transport

Peers authenticates both devices and encrypts all traffic after connection
setup, including RPC calls, sync traffic, and file streams. Encryption is
required on every supported transport; you don't need to enable it separately
for local connections, remote connections, or pairing.

| Transport | Used for | What to expect |
|---|---|---|
| `ws://` (LAN, headless, Electron) | Same-network devices, `peers-headless` hosts | Device traffic is encrypted even without TLS |
| `wss://` / `https://` (TLS WebSocket) | Direct peers and the Services signaling link; Services relays device messages, while sync needs a direct device connection | Device traffic is encrypted, with TLS providing additional protection |
| `wrtc://` (WebRTC data channel) | Peers whose listeners are unreachable; the PWA’s only device transport | Device traffic is encrypted |
| Device pairing socket | Credential transfer to a new device | Encrypted, including the credential transfer; the rendezvous that sets it up runs through the Peers service (see [What the service can see](./Device-Pairing.md#what-the-service-can-see)) |

**Which transport two devices use.** Desktop and headless hosts prefer a WebSocket when either
can reach the other's listener (the desktop app listens on port 3333). WebRTC can connect them
when their listeners are unreachable. On a local network a WebSocket is usually several times
faster, so desktop and headless hosts periodically try to replace WebRTC with a WebSocket.
Allow inbound TCP port 3333 on desktop hosts to enable this on your LAN. `peers devices`
shows each connection's address; WebRTC ones start with `wrtc://`. An upgrade can interrupt
calls in flight; see [Remote call failures](../Packages/contracts.md#remote-tool-calls-across-devices).

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

## Using Peers in a browser

The PWA runs one tab per account in a browser profile. Other tabs show **Peers is open in
another tab**. Choose **Use it here** to move the device to that tab. Peers finishes pending
work and saves its data before the new tab starts. The old tab then shows the same choice.
If the owner is frozen in the background, return to it so it can finish the handover.
Peers requires a browser with Web Locks to keep your data safe across tabs. If your browser
cannot start Peers, update it or use a supported browser.

Sandbox packages run while the PWA is open, and pause when the browser freezes it. Scheduled
work catches up when the page resumes or the app is reopened. Privileged packages require
desktop or headless. Packages that use the internet fetch from the browser, so they reach only
sites that allow it. Weather can refresh and Voice Hub can call OpenAI with your configured key.
News's default feeds fail with a browser read error; see [System HTTP in a browser](./HTTP#in-a-browser).

## Pending device invites

Device admission uses the same `Invites` table as [contacts](./Contacts.md) and
[groups](./Groups.md), with `type: "device"`. Nothing creates those rows yet.
No admission actions exist for those rows yet, so they stay out of
**Needs your attention** and the Devices badge. The UI will surface them only
when a real decision flow exists.
