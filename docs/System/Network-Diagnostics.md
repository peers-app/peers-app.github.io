---
sidebar_position: 9
title: Network diagnostics
---

# Network diagnostics

The desktop Network Viewer shows active device connections, shared-group sync state, path
type, latency, throughput, and remote network information. Open **Network** in the desktop
app and select **View Details** beside a connection.

## Reading remote logs

Every directly connected device includes **Remote Console Logs** in its details. This
reads that device's local logs over its current connection; the logs are not copied into
the requesting desktop database. The remote provider permits the request only when the
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

### Family Hub receiver and answer checkpoints

For the temporary Family Hub diagnostics, query the target device with Process
`electron` and Message words `[WebRTC-Diagnostic]`. A successful receiver/answer path
contains these stages for one connection ID:

1. `routed-offer-received`
2. `sidecar-connect-queued` and `sidecar-signal-queued`
3. `go-connect-received` and `go-signal-received`
4. `go-offer-applying` and `go-offer-applied`
5. `go-answer-created`, `go-signal-emitting`, and `go-signal-emitted`
6. `sidecar-signal-received`
7. `signal-route-result` with `routeResult=200`
8. Later `status-transition` checkpoints, or a timeout followed by `connection-cleanup`

The first missing stage identifies the broken boundary. `sidecar-unavailable` now
corresponds to a retriable 503 instead of a false 200. An answer route result of `TTL0`,
`non-200`, or `rejected` isolates the independent return route.

These checkpoints contain only connection, device, data-context, role, signal-type,
readiness, status, and response-classification fields. They never include SDP, ICE
candidates, TURN credentials, auth tokens, public keys, device-message payloads, or full
route responses.

The temporary Electron checkpoints are isolated in
`peers-electron/src/server/connections/wrtc-trace.ts` and its calls from
`webrtc-sidecar.ts`. The matching Go checkpoints are isolated in
`peers-webrtc/diagnostics.go` and calls from `main.go` and `connection.go`. Remove those
helpers and call sites after the Family Hub diagnosis; keep the authenticated-readiness
503 and awaited answer-route handling.
