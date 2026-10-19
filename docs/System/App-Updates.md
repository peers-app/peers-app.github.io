---
sidebar_position: 10
title: App updates
---

# App updates

The desktop app updates itself from the Peers release feed. This page covers when
updates download and install, the per-device settings, the update badge, and updating
another device remotely. The PWA and headless hosts do not update themselves; a browser
picks up a new PWA build when the page reloads.

## Default: install on restart

- Peers checks for an update at launch, once a day, and whenever `peers-services`
  reports a newer version (see [How devices hear about a release](#how-devices-hear-about-a-release)).
- A newer version downloads in the background.
- By default, a downloaded update installs the next time Peers quits or restarts. That
  covers quitting from the menu, the keyboard, or the last window; `peers app quit` and
  `peers app restart`; a termination signal; logging out; and the restart after device
  pairing or key rotation.

Each quit or restart reads **Install updates automatically when Peers restarts** from this
device's database at that moment, rather than trusting the value loaded at launch. Peers
quits or restarts on the current version, and the update stays downloaded, when:

- the setting is off;
- the read fails, or takes longer than five seconds;
- a later release is still downloading;
- the downloaded file is missing. Peers logs the error (`[updates]`).

A restart always relaunches Peers, whether or not it installs.

## Settings → Updates

The **Updates** tab shows the installed and latest versions, the current status, **Check
now**, and **Update & restart**. It also holds two settings. Each device keeps its own
values, which never sync to your other devices.

| Setting | Default | When off |
|---|---|---|
| **Install updates automatically when Peers restarts** | On | Updates still download, but install only when you choose **Update & restart**. |
| **Allow my other devices to update and restart this device** | On | Requests from other devices are refused. |

Turning the first setting off applies to an update that has already downloaded, too: the
next ordinary quit or restart does not install it.

On macOS, the system installer cannot give an update back once it has accepted one, so
Peers hands it over only as the update installs: for **Update & restart**, or as Peers
quits or restarts with the setting on. That quit hides Peers' windows while macOS
prepares the update. If macOS has not accepted it within two minutes, Peers quits without
installing, and the next quit tries again.

If **Update & restart** times out waiting for macOS, which can still accept the update
afterwards, that update installs the next time Peers quits, whatever the setting says.
Settings shows a note when this happens. Peers keeps that version ready until the next
restart.
Feed checks still run, but a later release downloads after that restart, because replacing
the cached download would disagree with the version the system installer has accepted.
The restart installs the accepted update even when the feed is unreachable.

## Update badge

When this device has an update available, downloading, or ready, a small yellow up-arrow
appears at the lower left of the [network status indicator](./Network-Diagnostics.md#network-status-indicator).
It stays while a newer version is known even after its download or a later check fails;
**Update & restart** then retries the download. It shows in every network state, offline
included. Open the indicator to see the version, download progress, or error, and to choose
**Update & restart**. The popover also says when the update will install on the next
restart anyway.

## Update & restart

- **Update ready** — Peers stops package runtimes, installs the update, and relaunches on
  the new version.
- **Still downloading** — Peers waits for the download, then installs.
- **No update known** — Peers checks the feed first. If there is nothing to install, it
  restarts anyway.

**Update & restart** installs whether or not **Install updates automatically when Peers
restarts** is on. If the update cannot be prepared, for example because the download fails
or the downloaded file is missing, Peers keeps running and shows the error, so you can
retry. A failed check or staging attempt is also shown alongside an update that is already
downloaded; its **Update & restart** action stays available.
Once package runtimes have stopped, if the installer cannot start or Peers is still running
30 seconds later (60 on macOS), Peers relaunches on the current version, and the update
stays available. An install during an ordinary quit exits instead of relaunching. An
installer that fails after Peers has quit cannot relaunch it; start Peers again.

## Update another device

**Identity → Devices → *device*** and **Network Viewer → View Details** show another
device's app version with **Update & restart**, or **Restart** when it is up to date. The
action asks for confirmation.

- Your device relays the request. It uses a direct connection when there is one. Your own
  devices are also reachable through the mesh.
- The target device accepts only callers it trusts as `Self`: your own devices, and users
  it has granted Self trust (see [Trust](./Trust.md#self-means-full-control)). It also requires its
  **Allow my other devices to update and restart this device** setting. Installed packages
  cannot make the request, either locally or by targeting another device, including
  indirectly through Device Operations `runTool`.
- Any host can send the request, including the PWA on a phone.
- On Linux `.deb` installs, installing prompts for an administrator password, so remote
  requests are refused there. With nobody at the machine, the prompt would leave Peers
  unresponsive, with its packages stopped, until someone answered it. Update those
  machines locally.
- The setting is a consent switch, not a security boundary. A device that trusts you as
  Self already gives you full remote access to its system contracts.

The section is hidden when the device cannot restart itself (PWA, headless), runs a build
without App Updates, or does not trust you as Self.
If a device is unreachable, **Retry** checks it again. After a restart request, the panel
refreshes its status for up to three minutes, waiting for each response before polling again.

## How devices hear about a release

Each time the desktop app connects to `peers-services`, it calls `getLatestAppVersion`,
which returns the version `peers-services` itself is running. Releases bump
`peers-services` to the same version as the desktop app and deploy it first, and every
deploy reconnects all devices, so this is a near-real-time signal.

If that version is newer than any the device knows, it runs the full update check after a
random delay of up to a minute, so devices that reconnect together do not hit the feed
together. Installers reach the feed after `peers-services` deploys, so while the feed lags,
the device checks again after about 5, 10, 20, 40, and 60 minutes, then hourly, for up to
24 hours from the first report of that release; reconnects do not reset this window. A daily
check covers devices that rarely reconnect, including those with an older update already
downloaded. Older `peers-services`
deploys without the call are ignored.

## System App Updates contract

The UI and CLI use the **System App Updates** system contract. The desktop app provides
it; other hosts provide a default that reports `supported: false` and can still relay
requests to other devices. It is not available to workflows or Assistants.

| Tool | Access level | Notes |
|---|---|---|
| `getUpdateStatus` | Reader (20) | This device's version and update state. |
| `checkForUpdates` | Owner (80) | Reads the feed now. Refuses package callers. |
| `installUpdateAndRestart` | Self (100) | Refuses package callers. Remote callers also need the device's setting. |
| `getDeviceUpdateStatus` | Reader (20) | Relays `getUpdateStatus` to another device. Local callers only. |
| `installUpdateAndRestartOnDevice` | Self (100) | Relays `installUpdateAndRestart`. Local callers only. |

The `status` observable streams the same status to the local UI. Like other observables,
it does not cross devices.

## Troubleshooting

- `peers logs -f` shows the update controller's messages, prefixed `[updates]`.
  electron-updater writes its own detail to the electron-log `main.log`.
- Unpackaged development builds never update. To exercise the flow from a dev build, set
  `PEERS_FORCE_DEV_UPDATE_CONFIG=1` and provide a `dev-app-update.yml` that points at a
  test feed.
