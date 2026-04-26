# ConnectionManager and SyncGroup Context for Agents

This document explains how peer connections are managed and how data synchronization works between peers. These are the two central classes in `peers-device/src/`.

## File Locations

```
peers-device/src/
  connection-manager/
    connection-manager.ts       # ConnectionManager class
    connection-state.type.ts    # IConnectionState interface
    connection-manager-priorities.ts  # Election/priority helpers
    device-messages.ts          # DeviceMessages (forwarding, routing)
  sync-group.ts                 # SyncGroup class
```

## Architecture Overview

```
ConnectionManager (one per device)
├── Owns all Connection objects (one per remote device)
├── Maps connections to per-group SyncGroups
├── Manages per-group RPC exposure on each connection
├── Handles file chunk downloads (ChunkDownloadManager)
├── Handles device message routing (DeviceMessages)
└── Pings connections every 15s, removes dead ones

SyncGroup (one per DataContext — personal DB + each group DB)
├── Implements IPeerDevice interface
├── Tracks connections and remote devices for one group
├── Syncs change records from remote peers
├── Elects preferred connections periodically
├── Maintains a network map of indirect peers
└── Manages database compaction and cleanup
```

## How They Relate

```
ConnectionManager
  ├── allConnections: { [deviceId]: Connection }     ← physical connections
  ├── connectionStates: Map<Connection, IConnectionState>  ← per-connection group state
  └── syncGroups: { [dataContextId]: SyncGroup }     ← per-group sync engines
                                                        │
SyncGroup (per group)                                   │
  ├── connections: IDeviceConnection[]    ← logical connections (subset of above)
  ├── remoteDevices: IPeerDevice[]        ← RPC proxies to remote peers
  └── changeTrackingTable                 ← tracks all local changes for sync
```

A single `Connection` (physical socket to a remote device) can serve multiple `SyncGroup`s if both peers share multiple groups. The `ConnectionManager` is responsible for wiring up the per-group RPCs on each connection and adding the connection to the appropriate `SyncGroup`s.

## Connection Lifecycle

### 1. Handshake (outside ConnectionManager)

Transport-specific code (websocket-client, websocket-server, webrtc-sidecar) establishes a socket and performs a cryptographic handshake via `Connection.doHandshake()` / `Connection.completeHandshake()`. After the handshake succeeds, the transport code calls `connectionManager.addConnection(connection)`.

Pattern varies by role:
- **Initiator (client)**: `await connection.doHandshake(address)` then `await connectionManager.addConnection(connection)`
- **Listener (server)**: Sets `connection.onHandshakeComplete = async () => { await connectionManager.addConnection(connection) }` (fires with a 10ms delay)

### 2. ConnectionManager.addConnection()

This is the main entry point. It runs synchronously first, then async:

**Synchronous (before any await):**
1. Removes any existing connection to the same remote device
2. Registers connection-level RPCs: `getFileChunkInfo`, `downloadFileChunk`, `sendDeviceMessage`, `streamChunks`
3. Registers the `groupReady` handler (critical for timing — must be available before any group setup messages arrive)

**Async:**
4. For same-user connections: sets up personal data sync immediately
5. Builds a candidate list of shared groups by checking local `GroupMembers` tables
6. For each candidate group: calls `setConnectionMembership()`

### 3. setConnectionMembership()

Called when a connection + group pair needs to be wired up. Three branches:

- **remove**: Disposes the per-group RPCs and removes from SyncGroup
- **existing**: Updates the role only
- **new** (the interesting path):
  1. Saves the remote device to `Devices(groupDataContext)` so all group members discover it via sync
  2. Registers per-group RPCs on the connection: `getNetworkInfo_{groupId}`, `listChanges_{groupId}`, `notifyOfChanges_{groupId}`
  3. Creates an `IPeerDevice` proxy that maps RPC calls to `connection.emit()`
  4. Creates a `remoteReadyPromise` (resolves when remote sends `groupReady`)
  5. Calls `syncGroup.addConnection(remoteDevice, { remoteReadyPromise })`
  6. Emits `groupReady` to the remote (with retry) to signal local RPCs are registered

### 4. groupReady Handshake

When two peers connect, both sides independently run `addConnection`. The `groupReady` mechanism ensures neither side tries to call per-group RPCs before they are registered on the remote:

```
Device A                              Device B
  │                                     │
  │── addConnection()                   │
  │   register 'groupReady' handler     │── addConnection()
  │   setConnectionMembership(g1)       │   register 'groupReady' handler
  │     register RPCs for g1            │   setConnectionMembership(g1)
  │     emit groupReady(g1) ──────────► │     register RPCs for g1
  │     SyncGroup waits for B...        │     emit groupReady(g1)
  │ ◄────────────────────────────────── │     SyncGroup waits for A...
  │   resolved! start sync              │
  │                                     │   resolved! start sync
```

The `groupReady` handler is registered synchronously at the top of `addConnection` (before any async work). The emit retries up to 3 times with a 2-second timeout per attempt, handling the case where the remote hasn't started `addConnection` yet. If the remote never sends `groupReady` (e.g., it doesn't share the group), the SyncGroup times out after 15 seconds and proceeds without that peer for that group.

### 5. Connection Health

Every 15 seconds, `pingAllConnections()` pings all connections. Metrics are tracked per-connection:
- Latency: rolling window of last 10 measurements
- Error rate: exponentially weighted moving average (weight 0.1)
- After 3 consecutive ping failures, the connection is removed

### 6. removeConnection()

Cleans up everything:
1. Calls all per-group `disposeFn`s (which remove RPCs and call `syncGroup.removeConnection()`)
2. Removes connection-level RPC listeners
3. Deletes from `connectionStates` and `allConnections`
4. Fires `onConnectionRemoved` observable
5. Closes the socket

## SyncGroup: Per-Group Sync Engine

### addConnection()

When a remote device is added to a SyncGroup:

1. Creates an `IDeviceConnection` tracking object (latency, error rate, timestamps)
2. Wraps the remote device's RPC methods with `retryOnErrorOrTimeout` for resilience
3. Starts a periodic resync timer (default: `RESYNC_INTERVAL`)
4. Waits for the `remoteReadyPromise` (or falls back to polling `getNetworkInfo` for test compatibility)
5. Once ready, runs `electPreferredConnections()` to determine sync priorities

### Sync Algorithm (_syncWithRemoteDevice)

```
1. Load DeviceSyncInfo for this remote device (stores timestampAppliedLast)
2. Get remote's network info (includes their timestampLastApplied)
3. If remote's timestamp <= our last applied, skip (already synced)
4. Sync priority tables first (TableDefinitions, Groups)
5. Cursor through remaining changes:
   - Filter: supersededAt doesn't exist, appliedAt in range, exclude priority tables
   - Sort by createdAt, page size from CHANGES_PAGE_SIZE
   - Apply changes in batches
6. Save updated timestampAppliedLast
7. Update transitive sync info (if remote is synced with device C, record that)
```

### Change Notification Flow

```
Local change → ChangeTrackingTable.dataChanged fires
  → SyncGroup.onNewChange() debounces (NOTIFY_CHANGE_DELAY)
  → notifyRemoteDevicesOfChanges() sends to priority peers
  → Remote peer's notifyOfChanges() triggers syncWithRemoteDevice()
```

### Preferred Connection Election

Periodically (every `RESYNC_INTERVAL`) and after adding connections, the SyncGroup runs `electPreferredConnections()`:

1. Fetches `getNetworkInfo()` from all remote devices (with caching)
2. Calls `electDevices()` (from peers-sdk) with local connections and all network info
3. Result: `preferredDeviceIds` (peers we should sync with) and `preferredByDeviceIds` (peers that prefer us)
4. Only syncs with preferred peers during normal operation (non-preferred peers are kept as fallbacks)

Election is coalesced: only one election runs at a time, with at most one queued.

### Network Map

The SyncGroup maintains a `networkMap` — a graph of which devices are connected to which other devices (learned from `getNetworkInfo()` responses). Used for:
- `getPathToDevice()`: determines if a device is reachable directly, indirectly, or unknown
- `reportRemoteDeviceConnectedIds()`: used by DeviceMessages for forwarding

### Applying Changes

`applyChanges()` groups changes by table name and applies them in priority order:
1. Users, Devices, Groups, PersistentVars, PeerTypes, Packages (system tables first)
2. All other tables sorted by earliest change timestamp
3. Files last (least priority)

For each table, it walks the data source chain to find a `TrackedDataSource` with an `applyChanges` method. Changes that reference unknown tables trigger a fallback table lookup via `TableContainer.getFallbackTable()`.

### Insert Change Resolution

Insert changes (op: 'set', path: '/') no longer store the full record value to save space. When syncing, `resolveInsertChangeValues()` batch-looks up the current records from the source tables and fills in the values.

## IConnectionState

```typescript
interface IConnectionState {
  remoteUserId: string;
  remoteDevices: { [groupId_deviceId: string]: IPeerDevice };  // per-group device proxies
  disposeFns: { [groupId: string]: () => any };                // per-group cleanup
  groupReadyResolvers: Map<string, () => void>;   // pending groupReady promises
  remoteReadyGroups: Set<string>;                  // groups remote has signaled ready
}
```

Keyed by `Connection` in `ConnectionManager.connectionStates`. One entry per physical connection, containing per-group state for all groups shared over that connection.

## Key RPCs Per Connection

### Connection-level (always registered)
| RPC | Purpose |
|-----|---------|
| `getFileChunkInfo` | Query chunk availability |
| `downloadFileChunk` | Download a single chunk |
| `streamChunks` | Streaming multi-chunk download (binary transports only) |
| `sendDeviceMessage` | Route device messages |
| `groupReady` | Signal per-group RPC readiness |

### Per-group (registered in setConnectionMembership)
| RPC | Purpose |
|-----|---------|
| `getNetworkInfo_{groupId}` | Get remote's sync state and connections for this group |
| `listChanges_{groupId}` | Query remote's change tracking table |
| `notifyOfChanges_{groupId}` | Tell remote we have new changes |

## Group Lifecycle Events

### New group added (setupGroup)
When a group is added to the local user, `setupGroup()`:
1. Sets up a `GroupMembers` subscription for dynamic membership changes
2. Checks all existing connections for membership in the new group
3. Calls `setConnectionMembership()` for qualifying connections

### Group removed (teardownGroup)
1. Cleans up the `GroupMembers` subscription
2. Calls per-group `disposeFn` on all connections
3. Disposes and deletes the `SyncGroup`

### Membership change (setupGroupMembersSubscription)
A `GroupMembers.dataChanged` subscription fires `setConnectionMembership()` for all connections belonging to the affected user. This handles dynamic role changes and member removal.

## Database Maintenance

`SyncGroup` provides maintenance operations:

- **compactDatabase()**: Removes orphaned change tracking entries, old data locks, compacts TrackedDataSource tables, runs VACUUM
- **resetChangeTracking()**: Nuclear option — clears all change records and re-tracks from current data. Development/testing only
- **resetAllDeviceSyncInfo()**: Clears sync progress with all peers, forcing full re-sync
- **cleanupOrphanedChangeTrackingEntries()**: Finds change records for tables that no longer exist in SQLite

## Testing

Tests use mock sockets that directly wire handler maps between two ConnectionManagers:

```typescript
// Mock socket: emit goes to other side's handlers
emit(eventName, args, callback) {
  const handler = otherSideHandlers.get(eventName);
  if (handler) {
    setImmediate(() => handler(args, callback));
  } else {
    callback(new Error(`No handler for ${eventName}`));
  }
}
```

Both `addConnection` calls are made via `Promise.all` to simulate the real concurrent behavior. Tests call `SyncGroup.addConnection` directly (without `remoteReadyPromise`), which falls back to the `waitForRemoteDeviceToBeReady` polling loop.

## Related Files

- `peers-device/src/connection-manager/network-manager.ts` — Decides WHICH devices to connect to (see `network-manager-context.md`)
- `peers-device/src/tracked-data-source.ts` — Wraps data sources with change tracking
- `peers-device/src/chunk-download-manager.ts` — Manages file chunk downloads across peers
- `peers-sdk/src/device/connection.ts` — `Connection` class (handshake, RPC, encryption)
- `peers-sdk/src/types/peer-device.ts` — `IPeerDevice`, `INetworkInfo`, `IDeviceConnection`
- `peers-sdk/src/device/binary-peer-connection-v2.ts` — Binary message encoding/decoding
