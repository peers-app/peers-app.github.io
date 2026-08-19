---
sidebar_position: 9
title: Network diagnostics
---

# Network diagnostics

The Network Viewer works in both the Electron desktop app and the PWA. It shows active
device connections, shared-group sync state, path type, latency, throughput, and remote
network information. Open **Network** and select **View Details** beside a connection.

## Network status indicator

The right side of the tabs strip shows the local device's live network state as a small
status mark (and a connection count on desktop):

- **Offline** — cloud-slash icon; no active device connections.
- **Syncing** — calm opacity-pulsing green dot (fade, not grow) for the first 4 seconds of
  continuous sync, then a blue indeterminate circle while sync continues. Brief flaps back
  to synced stay on the green pulse until status has been fully synced for a full second.
- **Synced** — compact green check-circle (matched to the syncing-dot size); connected with
  no active sync or recorded sync error. The checkmark appears only after synced is stable
  for 1 second following sync activity.
- **Partial group connectivity** — when the device is not fully offline but at least one
  personal or shared sync context that has other known sync peers has no live connection, a
  yellow warning count at the lower right shows how many such groups are offline.
  Personal peers are other devices of the same user (not every row in the personal
  Devices registry). Shared peers are other devices in that group, or other group members
  when no devices are known yet.
- **Groups connected** — a small top-right count of sync contexts with a live connection.
  Green when at least one group is connected; a red `0` when the device has active
  connections but no group sync contexts are live; hidden when fully offline.
- **Error** — solid red dot; at least one context's latest sync attempt failed. Open the
  popover for the error message. Brief disconnects that abort mid-sync with
  `connection has been closed` or retry timeouts (`Timeout after N retries waiting for …`)
  are not counted as sync errors.
- **Loading / unavailable** — spinner or question-mark icon while the local diagnostics
  host is starting or reconnecting.

Select the indicator to see connection, syncing-context, error, groups-connected, and
groups-offline counts, plus a simplified list of connected devices (user, device, and shared
group count) for a quick check. **Open Network Viewer** opens the full diagnostics screen. On
mobile, the same indicator appears beside the tabs menu.

## Platform-specific diagnostics

Portable connection, group, device, and sync diagnostics work in Electron and PWA.
**Troubleshoot** and raw database download require Node/OS capabilities and therefore
appear only in the Electron desktop app.

## Synchronization

Group details includes two synchronization actions:

- **Sync now** notifies connected peers that the selected personal or group context may
  have changes. It does not reset change tracking and needs no confirmation.
- **Do full sync** resets local change tracking only for the selected context, then
  normal synchronization rebuilds its state. The operation may transfer substantial data,
  requires confirmation, and should be used only to repair suspected drift.

Both actions are intentionally absent from the compact status popover.

### Local database recovery

Use **Settings → Advanced → Delete Local Database** when a device's local copy of the
current personal or group context is corrupted or stuck (for example a persistent variable
in a bad state) and you have another online device that still holds the authoritative data.

The action deletes only the active context's local database snapshot. Account credentials,
other personal or group contexts, and file storage stay in place. After the wipe, the
device must rebuild that context by synchronizing from another of your devices.

On the PWA, the local database is sql.js in memory with snapshots stored in IndexedDB
(`peers-pwa-sqlite`). A successful delete removes that context's snapshot and reloads the
app automatically so the empty database can resync. This is not the same as **Logout**,
which clears credentials and every IndexedDB database for the site.

On Electron, delete the local SQLite files for the current context, then restart the app
manually so it can resync.

Do not use this recovery path as the only copy of data. If no other online device has the
records, they cannot be rebuilt.

### Automatic record recovery

Synchronization advances its device checkpoint after valid incoming changes are stored, even
when one target record cannot be reconstructed or written. This optimistic behavior lets
unrelated records continue syncing. The failed record is added to the local-only
`SyncRecoveryQueue`, with one entry per table and record, a lifetime attempt count, and the
10 most recent bounded error details.

Recovery is requested after each normal sync with a remote device. It asks connected peers
for the record's active changes (preferred devices first, with sequential fallback), then
rematerializes through the normal table apply pipeline. Retries for the same entry/device
use a short in-memory cooldown so a bad peer is skipped without starving other devices.
A successful rematerialization clears the queue entry.

To inspect pending recovery work, query the affected personal or group context:

```bash
peers db query "SELECT * FROM SyncRecoveryQueue" --json
peers db query "SELECT * FROM SyncRecoveryQueue" --context <groupId> --json
```

An entry indicates that change history was retained but its target row is not yet known to
match. It does not stop other records or devices from synchronizing.

## Reading remote logs

Every directly connected device includes **Remote Console Logs** in its details. This
reads that device's local logs over its current connection; the logs are not copied into
the requesting device's database. The remote provider permits the request only when the
verified caller has exact `TrustLevel.Self` in the provider's personal context. `Self`
is full remote contract access, not a read-only diagnostics permission.

1. Leave Process empty for all processes, or enter `pwa` or `electron`.
2. Optionally select a level, time range, and message words.
3. Select **Load logs** or **Refresh**.
4. Use **Export JSON** to preserve a bounded diagnostic trace.

The panel issues only a bounded read, has row and timeout limits, and requires a direct
connection. Cross-account attempts are sent to the provider so its current Self grant is
authoritative; permission denials are shown unchanged. The result is a bounded newest-first
page. When it says additional matching rows were omitted, narrow the time, level, process,
or message filter. Console log retention is currently approximately 24 hours.

For browser signaling and ICE lifecycle messages, filter to `BrowserWebRTC`. Do not share
an exported trace without reviewing application-provided log context for private data.

During local PWA development, Vite may continue serving an optimized copy of a linked SDK
or device package after that package changes. If remote behavior or warning text does not
match the source, restart the PWA with `yarn dev --force` before drawing conclusions from
the trace.

## Fresh same-account devices

Installing the PWA from a new origin or clearing its site data creates a new local database
and device ID. Signing in restores the account identity and keys, but it does not restore
the old installation's device record.

Current clients bootstrap this case automatically. A personal-context device message
includes signed source-device identity and uses the account box key when the target device
is not yet in the local `Devices` table. The receiver accepts the new device only when its
signed device ID, user ID, signing key, and box key exactly match the receiver's account.
After validating the message, the receiver saves the new device observation and normal
protocol discovery and sync continue. This does not admit unknown devices to shared-group
or cross-user contexts.

Two log messages identify older or unsuccessful bootstrap attempts:

- `Could not establish a publicBoxKey ... sending as signed plain text` means the sender
  had no recipient or group encryption key. A current client should not use this fallback
  for an unknown target in its personal context.
- `Sending device is not known in dataContext` during supported-protocol discovery means
  the receiver could not validate a preexisting device row or a fresh signed same-account
  identity.

If either message repeats between same-account devices, confirm both devices run a build
with fresh-device bootstrap, that both signed in to the same user ID and keys, and that an
online mesh route exists between them. A single initial connection attempt should create
the missing `Devices` row; manual database repair should not be necessary.

## Inspecting a shared-group database context

The `peers db` CLI reads the personal data context by default. When investigating
membership or synchronized group records, explicitly select the group ID; otherwise a
query can return a valid but misleading personal-context view.

```bash
peers db tables --context <groupId> --json
peers db query "SELECT * FROM Devices" --context <groupId> --json
```

Useful identity checks include `Groups`, `GroupMembers`, `Users`, `Devices`, and
`UserTrustLevels`. Verify that the group has its public keys and signature, active members
have signed user records, and each target device maps to the expected user.

For device labels, `Devices.name` is a local label and takes precedence over
`Devices.reportedName`, the bounded name last advertised by the device owner in a signed
handshake. A missing `reportedName` can mean the devices have not reconnected since the
name changed or one peer predates handshake display metadata; it does not indicate an
identity or synchronization failure.

Without `--device`, these commands query only the desktop app to which the CLI is connected.
A local `DeviceSyncTracking` checkpoint records changes that local app has applied from
another device; it is not proof that the other device has pulled the local app's latest
records.

For a directly connected device, query the target's actual database through the headless
Electron bridge:

```bash
peers devices
peers devices status <deviceId>
peers db query "SELECT * FROM PersistentVars WHERE name LIKE 'groupSecretKey_%'" \
  --device <deviceId> --json
peers logs --device <deviceId> --since 30 --json
```

`--device` requires a device ID; malformed remote targeting fails instead of querying the
local desktop. Remote database output marks truncation in the human summary, or writes a
warning to stderr when `--json` keeps stdout row-oriented. Remote log follow mode reports
polling errors and stops after three consecutive failures; a successful poll resets the
counter.

The target authorizes every call from the verified connection identity and requires exact
`TrustLevel.Self` in its personal context. Remote SQL is restricted to one bounded read-only
statement and can return at most 500 rows or 1 MB. These calls do not expose shell, filesystem,
UI, or process-lifecycle control.

## Interpreting a WebRTC attempt

- No target device in Phase 2 remote network information indicates a group-discovery or
  membership problem.
- A target that is visible but never selected indicates candidate, status, or cooldown
  logic.
- Protocol discovery errors indicate that routed device messaging did not reach the
  target.
- An offer with no returned answer indicates a receiver signaling path problem.
- An answer followed by ICE failure indicates a connectivity or TURN problem.
- An open data channel followed by a handshake error indicates a Peers connection
  handshake problem.

Use timestamps, device IDs, group IDs, and the WebRTC connection ID to correlate the PWA
trace with the desktop Network Viewer.
