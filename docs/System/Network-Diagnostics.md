---
sidebar_position: 9
title: Network diagnostics
---

# Network diagnostics

The desktop Network Viewer shows active device connections, shared-group sync state, path
type, latency, throughput, and remote network information. Open **Network** in the desktop
app and select **View Details** beside a connection.

## Reading logs from your PWA

When the selected device belongs to the same user, its details include **Remote Console
Logs**. This reads the PWA's local logs directly over its current device connection; the
logs are not copied into the desktop database.

1. Enter a process such as `pwa`.
2. Optionally select a level, time range, and message words.
3. Select **Load logs** or **Refresh**.
4. Use **Export JSON** to preserve a bounded diagnostic trace.

The query is read-only, has row and timeout limits, and is allowed only across a direct
same-user connection. Logs from another user's device cannot be read through this panel.
The result is a bounded newest-first page; when it says additional matching rows were
omitted, narrow the time, level, process, or message filter.

For browser signaling and ICE lifecycle messages, filter to `BrowserWebRTC`. Do not share
an exported trace without reviewing application-provided log context for private data.

During local PWA development, Vite may continue serving an optimized copy of a linked SDK
or device package after that package changes. If remote behavior or warning text does not
match the source, restart the PWA with `yarn dev --force` before drawing conclusions from
the trace.

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

These commands query only the desktop app to which the CLI is connected. A local
`DeviceSyncTracking` checkpoint records changes that local app has applied from another
device; it is not proof that the other device has pulled the local app's latest records.
Confirming a remote device's actual database contents requires running the query there or
using an authorized remote diagnostic.

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

Use timestamps, device IDs, group IDs, and the connectivity run ID to correlate the PWA
trace with the desktop Network Viewer.
