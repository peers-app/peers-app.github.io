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
- **Update available** — a small yellow up-arrow at the lower left when this desktop app
  has an update available, downloading, or ready to install, including one whose download
  failed. It appears in every network state, offline included. See [App updates](./App-Updates.md).

Select the indicator to see connections, groups connected, and the last successful sync.
When an update is available, the popover starts with its version, download progress, and
**Update & restart**.
Syncing contexts, groups offline, and sync errors appear only when their counts are above
zero. Groups offline is shown in yellow. A simplified list of connected devices (user, device, and shared group count) is
included for a quick check. **Open Network Viewer** opens the full diagnostics screen.
**Sync recovery** appears in this popover only when records need attention or changes are
missing (see [Missing change check](#missing-change-check)); the same pane is always
available from Network Viewer. On mobile, the same indicator appears beside the
tabs menu.

## Platform-specific diagnostics

Portable connection, group, device, and sync diagnostics work in Electron and PWA.
**Troubleshoot** requires Node/OS capabilities and therefore appears only in the
Electron desktop app.

## Synchronization

A group starts syncing with a newly connected peer once that peer reports it has
set the group up too. If the report doesn't arrive within 15 seconds
(`groupReady timeout for device …` in the log), the device tries the peer anyway.
A peer that isn't syncing the group (`… dropping it until it is ready`) is tried
again with backoff for as long as the connection stays open, so you don't need to
reconnect it.

Group details includes two synchronization actions:

- **Sync now** notifies connected peers that the selected personal or group context may
  have changes. It does not reset change tracking and needs no confirmation.
- **Do full sync** resets local change tracking only for the selected context, then
  normal synchronization rebuilds its state. The operation may transfer substantial data,
  requires confirmation, and should be used only to repair suspected drift.

Both actions are intentionally absent from the compact status popover.

After the authorization update, update both ends of a remote connection. Older builds
cannot send accepted remote requests to an updated device. Keep device clocks accurate:
requests more than five minutes in the future or a day old are refused. Restarting a device
does not make a delivered request eligible to execute again; if a response was lost, check
the result before submitting a new operation.

### Local database recovery

Use **Settings → Advanced → Delete Local Database** when a device's local copy of the
current personal or group context is corrupted or stuck (for example a persistent variable
in a bad state) and you have another online device that still holds the authoritative data.

The action deletes only the active context's local database. Account credentials,
other personal or group contexts, and file storage stay in place. After the wipe, the
device must rebuild that context by synchronizing from another of your devices.

On the PWA, each context's database is kept in the browser's file storage (see
[Using Peers in a browser](./Devices.md#using-peers-in-a-browser)). A successful delete
removes that context's database and reloads the app automatically so the empty database
can resync. This is not the same as **Logout**, which clears credentials and local account
data. Databases used by another account still open in a different tab stay until that account
also signs out.

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

Recovery is requested after each normal sync with a remote device. What happens next
depends on the latest error:

- **Schema validation** (`Validation on insert failed`, `Validation on update failed`,
  `ZodError`, or Zod's issue JSON such as `"code": "invalid_type"`, or `"code": "custom"`
  for a failed field check such as `Invalid id`) is parked. Peer
  retry stops, the entry stays in the queue, and local history is tried again once
  per process start, when a new change for that record arrives, and when you press
  **Retry**. Dropping the entry would be unsafe: an older
  device can reject a row written by a newer schema, and after it upgrades the change
  is already known so it would never be written.
- **Unique-key conflicts** (`UNIQUE constraint failed`) are resolved only when that
  table defines a rule for combining duplicates. `PersistentVars` combines duplicate
  variables, retaining the newer value. `GroupMembers` combines duplicate memberships
  for the same user and group when they grant the same access, as happens when several
  devices approve one join at once. Memberships that grant different access, and
  tables without a rule, stay parked for a person. If the conflicting record is later
  removed, the entry can clear automatically after further sync or an app restart.
  If a device on an older Peers version still shows a resolved conflict, update it and
  use **Retry** on its recovery entry.
- **Not authorized** (`Write not authorized`): the change isn't signed by someone allowed to
  make it, such as a membership only an Admin may grant or a release only an Admin may make
  (see [Groups](./Groups.md#who-can-change-what)). Ask the founder or an Admin to review the
  affected change and save an authorized update. Your existing roles, settings and running
  package version remain in effect until an authorized update is available.
- **Missing history** (`No full write found`, `Last full write has no value`, and
  similar) and **transient** errors (locks, closed connections, anything unrecognized)
  keep asking peers. The delay starts at one minute and doubles after each unresolved
  peer sweep, up to one hour. An empty history response and a transport failure both
  count as a sweep. Schema and unique failures are not asked of peers on those sweeps.

Creating the local sync groups recounts every recovery queue at startup, including
groups this device belongs to, before any peer connects. That recount fills
`stuckRecoveryCount` and schedules the next time a retrying entry will cross the
10-minute stuck age.

A successful rematerialization clears the queue entry. An operator can also clear it
from **Sync recovery**, a pane of Network Viewer (like Troubleshoot). The network status overlay focuses the Network tab, opening one if needed, with that pane already selected. Each row has short explanations of the status and of each action. **Details** under Latest error and under Record expands the full text. The record view shows when that change was written, the row **Keep** will snapshot, and the queued change when that history differs. Dates inside a record use the same encoding as change history.

| Action | Effect |
| --- | --- |
| Retry | Try the change again. An unauthorized change needs an authorized update; Retry alone does not approve it. |
| Keep this device's version | Snapshot the row this device will keep: the queued row when it is stored here, otherwise the other row that holds the same unique value. When both rows are stored, the other record is deleted everywhere. When only the other row is stored, that row is kept and this queued id is tombstoned. Disabled when this device has no row to keep. |
| Delete everywhere | Write a tracked delete for the queued record. |
| Ignore on this device | Remove the local queue entry only. Other devices keep theirs. |

Retry needs Admin of the group. **Keep this device's version** and **Delete everywhere** need
Owner, because other devices receive the change they write. **Ignore on this device** needs only
membership, so anyone can clear an entry on their own device. If that record fails to sync
again later, the entry comes back.

The tabs-strip indicator turns yellow when any entry is parked, or has been retrying
for at least 5 attempts over 10 minutes. Offline keeps the cloud-slash icon and turns
yellow as well. Sync activity (green pulse, blue spinner) still shows; red sync errors
stay red. The count is `stuckRecoveryCount` on the System Network Diagnostics `status`
observable. The recovery screen reloads when that observable changes.

The same queue is available from System Network Diagnostics `getSyncRecoveryEntries`
and System Network Control `retrySyncRecovery` / `resolveSyncRecovery`.
Each call is authorized in the context it names, as the signed-in user. Reading the
queue requires Reader, and so does a resolve with `ignoreLocal`. Retry and
`resetDeviceSyncInfo` require Admin. A resolve with `keepLocal` or `deleteEverywhere`, and
`resetChangeTracking`, require Owner. A named context below that level is rejected
and is not changed. Omitting the context lists or updates only the contexts the user
can access at that level, and a reset that skips any context reports those names.
Calling `getSyncRecoveryEntries` with no context lists every readable personal and
group queue on this device, which is what the Sync Recovery screen shows. The status
indicator counts stuck entries across those same queues.
`resetChangeTracking` and `resetDeviceSyncInfo` reset the named context, or every
context the signed-in user can access at the required level when the context id is omitted.

To inspect pending recovery work, query the affected personal or group context:

```bash
peers db query "SELECT * FROM SyncRecoveryQueue" --json
peers db query "SELECT * FROM SyncRecoveryQueue" --context <groupId> --json
```

An entry indicates that change history was retained but its target row is not yet known to
match. It does not stop other records or devices from synchronizing.

### Missing change check

Once a day, each device checks for changes it is missing from connected devices in its
personal and group contexts. The check only reports; it does not repair anything automatically.
Very recent changes may not appear in a check yet.

Findings turn the tabs-strip indicator yellow and appear under **Missing changes** at the top
of **Sync recovery**, one row per context and device. Expand **Show changes** to see the affected
tables and records.

| Action | Effect |
| --- | --- |
| Check now | Check every context against connected devices. For a large comparison, run it again to continue the check. |
| Repair | Retrieve the missing changes from the listed device and apply them, then check again. Keep both devices connected. Large repairs may need another Repair. |

After restarting Peers, run **Check now** or wait for the next daily check to see current
findings. Devices on versions without this feature are skipped; an older local host shows
that the missing change check is unavailable. If changes keep going missing after repair,
report the problem with the affected context and device names.

For package authors, **System Sync Check** exposes `countChanges` to devices with Reader access
in the call's group context. Its `getSyncGaps`, `checkSyncGaps`, and `repairSyncGaps` tools serve
local callers; `checkSyncGaps` and `repairSyncGaps` refuse package callers. The local `status`
observable supplies `missingChangeCount` for status displays.

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

A connected device's details also show its app version with **Update & restart** when that
device trusts you as `Self` and can restart itself. See
[Update another device](./App-Updates.md#update-another-device).

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
protocol discovery and sync continue.

In a shared group, current senders also attach signed device info. A receiver can accept an
unmet device when the group's verified authority counts its owner as a member with the same
signing key and a role above None. The device ID and signature must verify, and its account
keys must match any identity the receiver already knows for that user. Replies and follow-up
signaling use the member's account encryption key.
New members and new devices can therefore connect through Peers Services, including over
WebRTC when a device has no WebSocket listener, without first meeting directly.

Same-account devices also start shared-group sync from the personal `Groups` list, even
when the new install's group database is still empty. That lets the first peer pull
`GroupMembers` and the rest of the group context. Cross-user connections still require a
local Writer+ membership (or equivalent `getUserRole`) before group sync starts.

Two log messages identify older or unsuccessful bootstrap attempts:

- `Could not establish a publicBoxKey ... sending as signed plain text` means the sender
  had no recipient or group encryption key. A current client should not use this fallback
  for an unknown target in its personal context.
- `Sending device is not known in dataContext` during supported-protocol discovery means
  the receiver could not validate a preexisting device row or a fresh signed same-account
  or counted-member identity. In a group this can still happen with an older sender that
  omits device info, or when the sender's owner is not a counted member with the presented
  key (including a removed member or role None). A public group's default role does not
  qualify an unknown device. Invalid device signatures and conflicting identity keys are
  also refused, with source-identity validation errors.

If either message repeats between same-account devices, confirm both devices run a build
with fresh-device bootstrap, that both signed in to the same user ID and keys, and that an
online mesh route exists between them. A single initial connection attempt should create
the missing `Devices` row; manual database repair should not be necessary.

For a shared-group connection, update both devices to a build with group-device introductions
and confirm that the sender has an active, signed membership for its current key with a role
above None. Compare any existing `Users` records for conflicting signing or encryption keys.
The group's public role alone does not admit a new device.

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

## When a device is slow to reconnect

Peers tries the devices it knows from your own and your groups' device lists as soon as it can,
then keeps a healthy set of connections. Desktop local connections can start while Services
is still connecting. A desktop or headless device first dials the addresses the other device
published (see [Finding and reconnecting to devices](./Devices.md#finding-and-reconnecting-to-devices)),
and can also find it through another connected device or Peers Services. A broadcast is only
a fallback when a context has no known devices to try;
it is not required to find known group devices through Services. Empty personal device lists
also use this fallback. If discovery finds no device, Peers retries less frequently. Returning to
the app, a network change, or a new Services connection allows a fresh discovery attempt.

Returning to the app or coming back online starts a check immediately, even after a short
absence. Existing links are checked and healthy links are kept, including
ones that take a few seconds to answer. Keep the phone app visible and an awake Writer or
owner online for each group whose data you need. The PWA reconnects Services automatically;
you do not need to wait for a discovery rescan.

If this is a new device with empty lists, keep the device you paired with or joined through
online until the first sync completes. Without that first connection, broadcast discovery
can fail on a busy Services instance. Reopening the introducing device is more useful than
repeatedly restarting the new one. **Troubleshoot** shows recent connection attempts and
whether some contexts are waiting for connection capacity.

## A direct Wi-Fi connection from the phone app

The phone app connects straight to a desktop on the same Wi-Fi over WebTransport (see
[Your phone on your home network](./Phone-on-Home-Network.md)). To check it:

- **On the phone,** **Network Viewer → Local Device → Direct on Wi-Fi** shows Chrome's
  permission: **Allowed**, a **Connect** button while Chrome hasn't been asked, or how to undo a
  block. A connection made this way has an address starting `wt://`.
- **On the desktop,** the log shows `[WebTransport] Listening on UDP 3333 (certificates …)` once
  the server is up; the two values are the certificate fingerprints in its published address.
  `[Sidecar/Go] WebTransport session opened (connectionId=wt:… origin=https://peers.app)` and
  `WebTransport session closed (… reason=… framesIn=… framesOut=…)` bracket each session. A
  `[WebTransport] Server not running: …` line means the UDP port was taken or the key couldn't
  be read, and the desktop publishes no direct address.
- **In `getMeshStats`,** the `webtransport` path counts these dials and connections; a dial the
  published address won also counts in `dialHints.addressWins`. Devices older than this path
  leave it out. A dial that ran out of time fails with `socket-timeout`, and its detail says
  where. `No WebTransport session within 2000 ms` means the desktop never answered at that
  address. `No handshake within 5000 ms of the session opening` means it answered, but the two
  devices didn't finish connecting.
- **The phone's log** shows `[LocalNetwork] Chrome's local-network permission: …` when it
  changes, and `[LocalNetwork] Android seems to be blocking Chrome from the local network` when
  dials to an online desktop keep failing at once.
- **When a WebTransport connection ends,** the phone's log shows `[WebTransport] Session to …
  ended: …`, with what was still waiting to be sent. `[WebTransport] A write has been stuck for
  5 s; closing the session` means a write did not complete in time. The phone closes that
  connection and reconnects on its own, over WebTransport or WebRTC.

If the permission is allowed but the phone still connects through Services:

- An existing WebRTC connection stays open; direct Wi-Fi is used for new connections.
- Check that both are on the same network, not a guest network.
- Check that the desktop's firewall allows UDP port 3333.
- Check that the desktop is newer than 0.30.6: the desktop's row in **Identity → Devices** syncs
  its published addresses, and an older desktop publishes none for the phone.

## Interpreting a WebRTC attempt

On desktop and headless hosts WebRTC runs in the `peers-webrtc` sidecar process, which the
Runtime (`peers-device`) supervises. The **Troubleshoot** row *WebRTC sidecar (Go/Pion)*
distinguishes three states: not registered (no binary was found at startup), registered but
not ready (the sidecar is starting, restarting after a crash, or gave up after repeated
failures), and available. While the sidecar is not ready the host stops advertising `wrtc`
to peers. Another host can use WebSocket if its listener is reachable; a PWA needs
WebRTC and must wait for the sidecar to recover. Look for `[Sidecar]` or `[WebRTC]` lines in the logs.

- No known target in the group device list indicates a group-discovery or
  membership problem.
- A target that advertises only `ws` even though it runs the desktop app means its sidecar
  is down. Desktop and headless hosts can use a reachable WebSocket listener; a PWA
  needs the target's WebRTC sidecar to recover.
- A connection that stays on `wrtc://` on the same network can indicate an unreachable
  listener. Allow inbound TCP port 3333 on desktop hosts and check that the devices can reach
  each other's LAN addresses. Desktop and headless hosts retry a
  WebSocket periodically; a network change can take time to be picked up. Look for
  `[NetworkManager] <deviceId> stays on WebRTC: <reason>` or
  `Moved <deviceId> from WebRTC to a WebSocket` in the logs.
- A target that is visible but never selected indicates candidate, status, or cooldown
  logic.
- Protocol discovery errors indicate that routed device messaging did not reach the
  target.
- An offer with no returned answer indicates a receiver signaling path problem.
- An answer followed by ICE failure indicates a connectivity or TURN problem.
- An open data channel followed by a handshake error indicates a Peers connection
  handshake problem.
- A connection that hasn't authenticated 10 seconds after the data channel opened ends that
  attempt, allowing Peers to try another available device. The log
  line `[WebRTC] Handshake with <deviceId> stalled: … (dialing; 0 frames received, 1 sent)`
  identifies whether this device was dialing or answering and counts the frames it observed.
  Zero frames received means this device received no frames before the deadline; compare
  both devices' logs to investigate where communication stopped.

Use timestamps, device IDs, group IDs, and the WebRTC connection ID to correlate the PWA
trace with the desktop Network Viewer.

### Reading the route of a WebRTC connection

Each WebRTC connection logs the network route it uses: which pair of ICE candidates
carries its traffic, and how much has crossed it. Both ends log the same connection ID,
so you can line up the two views of one connection.

- **Desktop and headless hosts** log `[Sidecar/Go] Route at connect`, `Route at disconnect`
  and `Route after the route changed`, each with `(connectionId=… route=…)`.
- **The PWA** logs `[WebRTC] Route at open for <deviceId> (<connectionId>, dialing|answering): …`,
  plus `at disconnect` and `after the route changed`. When a handshake stalls, it also logs
  `[WebRTC] Route when the handshake stalled for …`.

A route reads like this:

```text
selected host/udp/lan-v4 wifi → prflx/udp/lan-v4, 4.0 KB out, 0.5 KB in, last in 6.0 s ago,
checks sent 6, answered 1, received 2; also srflx/udp/public-v4 → host/udp/lan-v4 succeeded,
2.0 KB in, 5 checks received; pairs 2 succeeded, 1 failed; local 1 host, 1 srflx;
remote 1 host(mdns), 1 prflx
```

- **`selected`** is the pair this device sends on, written as local candidate → remote candidate.
  Each candidate is `type/protocol/class`:
  - the type is `host`, `srflx` (the address a STUN server saw), `prflx` (learned from the other
    side's checks) or `relay` (TURN);
  - the class is `lan-v4`, `lan-v6`, `public-v4`, `public-v6`, `cgnat-v4`, `link-local-v6`, `mdns`,
    or `hidden` when the browser withholds the address.

  The PWA adds the network adapter when Chrome reports one, such as `wifi` or `cellular`.
  Addresses themselves are never logged.
- **`last in … ago`** and the **check counts** show whether anything still arrives on the
  selected pair. If the other side's checks keep arriving on a pair listed under `also`, the
  two ends are using different routes. Traffic then flows only one way, and the connection
  goes `disconnected` a few seconds after it opened.
- **`pairs`** counts the candidate pairs by state. **`local`** and **`remote`** count the
  candidates each side offered. The desktop line adds **`remote signaled`**, the candidates the
  other side sent. A `host(mdns)` in `remote signaled` with no matching remote `host` suggests this
  device couldn't resolve the other side's hidden (`.local`) address.

## Measuring connection speed

Read the current device's measurements, or a directly connected phone's:

```bash
peers tools run getMeshStats '{}' --json
peers tools run getMeshStats '{}' --device <phone-device-id> --json
```

Use a device ID from **Devices**. Remote access requires Self trust on the target;
sharing a group alone does not grant access. Older devices that do not provide
`getMeshStats` report it as unavailable. Update the target before collecting a baseline.

The `stats` result contains current episodes, recent finished episodes, recent
attempts and discovery broadcasts, counters since startup, and percentiles.
By default the tool returns the **latest 50** attempts and broadcasts. Set `limit`
from 0 to 500 to change both lists; counters, episodes, and percentiles stay complete.
Use 0 for a summary or 500 for a full buffered baseline:

```bash
peers tools run getMeshStats '{"limit":500}' --device <phone-device-id> --json
```

History retains up to 20 episodes and 500 attempts and broadcasts until the
runtime restarts. `unfinishedAttempts` counts attempts whose observation ended
before an outcome was available. Durations are numbers in milliseconds.
Wall-clock fields identify when events happened.

An episode starts at startup, resume/foreground, a network change, or loss of the
last connection to a device. Episodes can overlap, but a resume while a resume
episode is still active joins it, so one wake counts once. Each ends when coverage is
restored, or after five minutes with `outcome: "unfinished"`. A new device that
doesn't know any other device yet keeps its episode open until it learns of one,
so its first connection is still measured.

| Metric | How to read it |
| --- | --- |
| `T_first` | Time to the first admitted device other than Peers Services. |
| `T_own` | Time to the first admitted device belonging to this account. |
| `T_cover` | Time until every context with a possible source has a ready, usable connection. |
| `T_resume` | `T_cover` for a resume episode. |
| `repairStart` | Time from a connection loss to the next outgoing dial in that episode. |
| `readyToDialMs` | Startup gate before connection setup: from page navigation on the PWA, or runtime initialization on a host. |

Coverage uses the same decisions as connection planning: a ready own device for personal data,
and a ready Writer-or-higher device for group data. Services and pending dials never count.
A group with no other possible Writer source has a zero target and is marked `excluded`.
A group with Writer members but no known device remains unmet while discovery is attempted.
An empty personal device list remains a discovery target but is excluded from `T_cover`:
it does not establish whether another own device exists. It is still shown in `coverage`.
`coverage` reports the current targets and `limitedByCapacity` when an unmet context cannot
fit. Compared with earlier measurements, Reader-only links no longer satisfy group coverage,
and an empty device list does not exclude a group with possible Writer sources.

After a resume, an existing connection counts only after it answers; a newly admitted connection
also counts once ready. A missing duration means the event was not observed before the episode
ended, not zero.

Percentiles use only observed durations in finished episodes, with `count` for
each sample. Compare that count and unfinished episodes alongside p50/p95/p99:
slow or incomplete episodes must not disappear from the interpretation. The
connectivity bench asserts startup ordering and known-device discovery.

Planned attempts include priority (Services, coverage, repair, or redundancy). Attempts show why and where a dial was made, authenticated versus expected
identity, admission or failure, and readiness and first successful sync for each
context. Stage times are offsets from `queuedAt`. A device dial succeeds only when the
expected device authenticates and is admitted, including when it connects back to you.
A different device answering at a stored address is refused before admission and recorded
as `identity-mismatch`. A failed dial records why it ended; starting an offer is not success.
Cancelled work is distinct from failure. `doubleDial` marks an outgoing
dial overlapping an incoming attempt or connection. `offline` means TTL0, no route,
or a signaling timeout without an answer; it is an observed failure, not a
presence guarantee. A WebRTC offer alone is never counted as a connection.

Peers reconnects automatically after an unsuccessful automatic device connection. You can
leave Peers open while a sleeping device wakes or connectivity returns. Reconnection may
take longer after repeated drops. If a configured server was the device's last connection,
Peers reconnects to it promptly so it can reach other devices again. Waking the app, changing
networks, or learning updated device information can help Peers reconnect sooner. In the PWA, keep the app visible while
waiting for a connection. Automatic reconnection can wait when all connection slots are
occupied. Explicit direct-connection
requests return their result to the caller, which decides whether to try again.

Attempt records and `[Mesh]` lines include a `retry` number on automatic retries. `ttl0`
means the route could not reach the device; it does not prove the device is offline.
A device that just disconnected after a stable connection is retried sooner while it may
be restarting or changing networks. If it stays unreachable, retries become less frequent.
`no-route` waits for a relay connection. `sender-not-known` waits for identity information
or another connection from that user; update older devices if it persists. `trust-refused`
retries slowly, and sooner after a trust or membership change: check the contact's trust and
group membership. Socket and signaling timeout
reasons mean setup did not complete; check that the other device is awake and online.
`capacity` waits for a connection slot. `cancelled` and `superseded` do not penalize the device.

An episode hidden with the PWA ends with `page-hidden`; a connection loss already covered
by other peers ends with `still-covered`. Both have outcome `not-measured`, are counted in
`unmeasuredEpisodes`, and are excluded from latency percentiles. Look at these counts
alongside unfinished episodes so hiding the page or keeping redundant links is visible.

Counters include outgoing dials per admitted outgoing connection, by path,
failure reasons, incoming admissions, offline dials, and discovery broadcasts
with their answers or TTL0 results. A ratio with no admitted outgoing connections
is `null`. LAN discovery probes are separate: `lanScan.scans` counts full or
cached scan passes, `probes` counts sockets tried, and `connected` counts probes
whose socket opened. Unanswered probes make no attempt record or log line. A
successful probe becomes an attempt at socket open, so its stage times exclude
the preceding probe wait. Per-hour rates are averages since startup, not a rolling window.

`dialHints` shows how much published addresses help: `addressDials` counts dials that tried a
device's published addresses, `addressWins` those an address won, and `protocolQueries` and
`protocolQueriesSkipped` the relayed protocol lookups made, and skipped because the device's
published protocols were known. Older devices leave `dialHints` out.
`recipient-unknown` means this device has not yet received the target's verified identity.
Keep the devices online so their device lists can catch up.

Each attempt outcome and episode summary produces one `[Mesh]` line with a JSON
payload; intermediate stages are available through the tool. Each admitted
connection removal also emits a compact `[Mesh] lost` line immediately, with
`deviceId`, `path`, `livedMs` since admission, and `replaced`. A replacement is
logged but does not start a connection-loss episode. Filter and tail:

```bash
peers logs --search '[Mesh]' --since 30 --full
peers logs --device <phone-device-id> --search '[Mesh]' --since 30 --json
peers logs --search '[Mesh]' --follow --full
```

Peers Services collects attempts and relay/churn counters but disables episodes
and coverage measurement. Its episode lists are empty and percentile sample
counts are zero. It emits no `[Mesh] attempt`, `[Mesh] episode`, or `[Mesh] lost`
lines; its existing connection and disconnect logs remain available.

Services emits one `[Mesh] services` JSON line each minute, skipped
when every value is zero. `directRelays`, `floodsForwarded`, `floodsPruned`,
`connects` and `disconnects` are counts during that interval. A forwarded flood
counts once regardless of how many recipients it has; a pruned flood has no
recipients and ends in TTL0. `pendingEmits` and `concurrentConnections` are current
gauges of device-message sends and admitted connections. Hosts expose the same
cumulative counters through `getMeshStats`, without the periodic log.

Read the deployed Services stdout stream with:

```bash
az webapp log tail --name peers-services --resource-group peers-services | rg '\[Mesh\] services'
```

These lines appear after Services has been deployed with measurement support.
