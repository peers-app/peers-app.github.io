---
sidebar_position: 9
title: Your phone on your home network
---

# Your phone on your home network

The Peers phone app (the PWA you install from peers.app) can connect straight to your desktop
when both are on the same Wi-Fi. Your data then syncs between them without going through
Peers Services, so it keeps working when Services is down or your home internet is out.

Without it, the phone needs Peers Services or another already-connected device to relay
connection setup. The data still goes directly between your devices, but the phone can't
reconnect from scratch while Services is unreachable.

## Turning it on

The first time the phone app sees one of your desktops offering a direct connection, the home
screen shows a card: **Connect directly to your devices on this Wi-Fi**. Tap **Connect**.
Chrome then asks whether peers.app may connect to devices on your local network. Choose
**Allow**.

The card appears once. If you tap **Not now**, or dismiss Chrome's question, you can turn it on
later from **Network Viewer**: the **Direct on Wi-Fi** row in **Local Device** has the same
**Connect** button.

Once allowed, the phone can make new connections directly when it's on the same Wi-Fi as one
of your desktops. Existing WebRTC connections stay as they are. Automatic connections never
ask for permission, and the app skips this path when the browser reports mobile data.

## If you said no

Chrome remembers a refusal. To change it: Chrome → **Settings** → **Site settings** →
**All sites** → **peers.app**, then allow devices on your local network. **Network Viewer**
shows the same steps while the permission is blocked.

## If Android blocks Chrome

Android has its own setting for which apps may reach devices on your network. If it's off for
Chrome, direct connections fail even after you allowed them in Chrome. The phone app may show
a notice when Android appears to be blocking it. Check Android **Settings** → **Apps** →
**Chrome** → **Permissions** → **Nearby devices** → **Allow**. The browser cannot confirm
that this is the cause; if it is already allowed, check the desktop and its firewall.

## What you need

- **The desktop app, or a headless host with WebRTC,** on a version newer than 0.30.6.
  Desktops publish the direct address themselves; there's nothing to set up on them.
- **Both devices on the same network.** Guest Wi-Fi networks usually keep devices apart, so a
  phone on a guest network can't connect directly.
- **UDP port 3333 open on the desktop** (the same number as the desktop's TCP listener). The
  desktop app's WebRTC already uses UDP, so a firewall that allows it usually allows this too.
- **Chrome on Android.** Other browsers, iPhones included, aren't supported yet: the phone
  app keeps connecting through Peers Services there.

## What others can see

A desktop's direct address is stored with that device in your own device list and in each of
its groups, signed with your account's key, like its other local network addresses (see
[Finding and reconnecting to devices](./Devices.md#finding-and-reconnecting-to-devices)).
It adds nothing about you beyond those addresses. Anyone on your network can open a connection
to it, as with the desktop's TCP listener, but every connection must still prove which device it
is before any data moves.

See also: [Devices](./Devices.md), [Network diagnostics](./Network-Diagnostics.md#a-direct-wi-fi-connection-from-the-phone-app).
