# Network Manager Context for Agents

This document provides implementation details for the Network Manager, which handles peer connection decisions in the Peers P2P system.

## File Location

`peers-device/src/connection-manager/network-manager.ts`

## Architecture Overview

```
NetworkManager
├── Subscribes to: ConnectionManager.onConnectionAdded/onConnectionRemoved
├── Tracks: All known devices across all groups
├── Maintains: Per-group connection state
└── Decides: Which devices to connect to and when
```

## Key Data Structures

### Device Tracking

```typescript
type DeviceConnectionStatus = 'notTried' | 'triedButFailed' | 'connected' | 'connectedThenDisconnected';

interface ITrackedDevice {
  deviceId: string;
  userId: string;                    // Owner of this device
  status: DeviceConnectionStatus;
  lastAttemptTime?: number;          // For retry cooldown
  failureCount: number;
  groupIds: Set<string>;             // Groups this device is relevant for
  preferredForGroups: Set<string>;   // Groups where device is marked preferred
}
```

### Group Connection State

```typescript
interface IGroupConnectionState {
  groupId: string;
  connectedDeviceIds: Set<string>;   // Devices currently connected for this group
  connectedUserIds: Set<string>;     // Users we have connectivity to
  memberUserIds: Set<string>;        // All users in group (from GroupMembers table)
}
```

### Constants

```typescript
const MAX_OWN_DEVICES = 8;           // Cap on personal device connections
const MAX_USERS_PER_GROUP = 5;       // Cap on users to connect per group
const RETRY_COOLDOWN_MS = 60_000;    // Wait before retrying failed connection
```

## Main Algorithm: `_checkForWellConnected()`

Called when connections are added/removed. Three phases:

### Phase 1: Own Device Connectivity

```typescript
// Query Devices table for all own devices
const myDevicesList = await Devices(userContext.userDataContext).list({ userId: userContext.userId });

// Track them
for (const device of myDevicesList) {
  this.trackDevice(device.deviceId, userContext.userId, [userContext.userId]);
}

// Select up to MAX_OWN_DEVICES (prioritizing preferred if > 8)
const ownDevicesToConnect = this.getOwnDevicesToConnect();
for (const deviceId of ownDevicesToConnect) {
  await this.connectToDevice(deviceId, userContext.userId);
}
```

### Phase 2: Network Discovery

```typescript
// For each data context (personal + groups)
for (const groupDataContext of allDataContexts) {
  const syncGroup = this.connectionManager.getPeerGroupDevice(groupDataContext);
  const connections = syncGroup.getConnections();
  
  // Update group state with current connections
  for (const conn of connections) {
    groupState.connectedDeviceIds.add(conn.deviceId);
    const userId = await this.getDeviceUserId(conn.deviceId);
    if (userId) groupState.connectedUserIds.add(userId);
  }
  
  // Query each peer for their network info
  for (const conn of connections) {
    const networkInfo = await syncGroup.getRemoteNetworkInfo(conn.deviceId);
    
    // Learn about devices they know
    for (const remoteConn of networkInfo.connections) {
      const userId = await this.getDeviceUserId(remoteConn.deviceId);
      if (userId) this.trackDevice(remoteConn.deviceId, userId, [groupId]);
    }
    
    // Learn which devices are preferred
    this.updatePreferredDevicesFromNetworkInfo(groupId, networkInfo);
  }
}
```

### Phase 3: User-Diverse Connections

```typescript
for (const groupDataContext of userContext.groupDataContexts.values()) {
  // Get group membership from GroupMembers table
  await this.updateGroupMembership(groupId, groupDataContext);
  
  // Calculate target: min(otherUsersInGroup, MAX_USERS_PER_GROUP)
  const targetUserCount = this.getTargetUserCount(groupId);
  const connectedOtherUserCount = [...groupState.connectedUserIds]
    .filter(id => id !== userContext.userId).length;
  
  // Connect to more users if needed
  if (connectedOtherUserCount < targetUserCount) {
    const devicesToTry = this.getDevicesToConnect(groupId, targetUserCount - connectedOtherUserCount);
    for (const deviceId of devicesToTry) {
      await this.connectToDevice(deviceId, groupId);
    }
  }
}
```

## 5-Tier Priority Algorithm: `getDevicesToConnect()`

When selecting devices to connect to for a group:

```typescript
// Partition devices by user relationship
const otherUserUnconnected = groupDevices.filter(d => 
  d.userId !== myUserId && !connectedUserIds.has(d.userId)
);
const otherUserConnected = groupDevices.filter(d => 
  d.userId !== myUserId && connectedUserIds.has(d.userId)
);
const ownDevices = groupDevices.filter(d => d.userId === myUserId);

// Build tiers (each sorted by status: connectedThenDisconnected > notTried > triedButFailed)
const tier1 = sortByStatus(otherUserUnconnected.filter(isPreferred));  // Preferred + new user
const tier2 = sortByStatus(otherUserUnconnected.filter(!isPreferred)); // Non-preferred + new user
const tier3 = [                                                         // Already-connected users
  ...sortByStatus(otherUserConnected.filter(isPreferred)),
  ...sortByStatus(otherUserConnected.filter(!isPreferred)),
];
const tier4 = sortByStatus(ownDevices.filter(isPreferred));            // Own preferred
const tier5 = sortByStatus(ownDevices.filter(!isPreferred));           // Own non-preferred

return [...tier1, ...tier2, ...tier3, ...tier4, ...tier5].slice(0, targetCount);
```

## Helper Methods

### `trackDevice(deviceId, userId, groupIds)`
Registers a device we learn about. Creates or updates `ITrackedDevice` entry.

### `updateDeviceStatus(deviceId, status)`
Updates connection status after attempt. Resets `failureCount` on success.

### `shouldRetryDevice(deviceId)`
Checks if device can be retried (not connected, not in cooldown).

### `getDeviceUserId(deviceId)`
Looks up userId for a device. Checks cache first, then the personal Devices table, then falls back to searching Devices tables across all group data contexts. This group-context fallback is how cross-user devices are discovered: when `setConnectionMembership` saves a device to a group context and it syncs to other group members, those members can resolve the device's userId without ever having connected to it directly.

### `updatePreferredDevicesFromNetworkInfo(groupId, networkInfo)`
Marks devices as preferred based on peer's `preferredDeviceIds`.

### `updateGroupMembership(groupId, dataContext)`
Populates `memberUserIds` from GroupMembers table.

### `getTargetUserCount(groupId)`
Returns `min(otherUsersInGroup, MAX_USERS_PER_GROUP)`.

### `getOwnDevicesToConnect()`
Returns own devices to connect to. All if ≤8, else top 8 by preference/status.

### `updateTrackingFromConnection(connection, removed)`
Called when connections add/remove. Updates tracking state.

## Integration Points

### ConnectionManager Events

```typescript
// On connection added
this.connectionManager.onConnectionAdded.subscribe(connection => {
  this.updateTrackingFromConnection(connection, false);  // Track as connected
  this.checkForWellConnected(connection);                // Re-evaluate connectivity
});

// On connection removed
this.connectionManager.onConnectionRemoved.subscribe(connection => {
  this.updateTrackingFromConnection(connection, true);   // Mark as disconnected
  this.checkForWellConnected();                          // Find replacements
});
```

### Devices Table Subscription (Cross-User Discovery)

The NetworkManager subscribes to `Devices.dataChanged` across all group data contexts. When a new device record arrives via group sync (e.g., another group member's device info propagated through `setConnectionMembership`), `checkForWellConnected()` is triggered so the device can be discovered and connected to.

Subscriptions are managed per-group and track group add/remove via `Groups.dataChanged`, following the same lifecycle pattern as `ConnectionManager.setupGroupMembersSubscription`.

### `connectToDevice()`

Updates tracking on success/failure:
- Success: Status updated by `updateTrackingFromConnection` when connection event fires
- Failure: Immediately calls `updateDeviceStatus(deviceId, 'triedButFailed')`

## Bootstrap Case

When a group has 0 connections, the system uses a broadcast discovery:

```typescript
if (connections.length === 0) {
  // Send message with empty toDeviceId - broadcasts to find any device for this group
  const response = await this.connectionManager.sendDeviceMessage({
    dataContextId: groupId,
    payload: 0,
    toDeviceId: '',  // Empty = broadcast
  });
  if (response?.statusCode === 200) {
    const targetDeviceId = response.hops.pop();
    await this.connectToDevice(targetDeviceId, groupId);
  }
}
```

## Key Design Decisions

1. **User diversity over device count**: Being connected to 3 different users is better than 10 devices owned by the same user.

2. **Preferred devices first**: Devices marked as preferred by other peers are likely reliable hubs.

3. **Separate own-device handling**: Personal data sync is independent of group connectivity.

4. **Dynamic targets**: Small groups need fewer connections than the maximum.

5. **Retry cooldown**: Failed connections wait 60s before retrying to avoid hammering.

6. **Status history**: `connectedThenDisconnected` devices are preferred over `notTried` (known good).

7. **Cross-user discovery via group Devices**: When `setConnectionMembership` sets up per-group sync, it also saves the remote device to `Devices(groupDataContext)`. This record propagates through group sync to all group members, enabling them to resolve cross-user device IDs in `getDeviceUserId()` and connect to devices they've never directly seen. This is critical for PWA clients that cannot LAN-scan.

## Common Debugging

### Check tracked devices
The `trackedDevices` Map contains all known devices. In development, you can log:
```typescript
console.log([...this.trackedDevices.values()].map(d => ({
  deviceId: d.deviceId.slice(0, 8),
  userId: d.userId.slice(0, 8),
  status: d.status,
  groups: [...d.groupIds],
  preferred: [...d.preferredForGroups]
})));
```

### Check group state
```typescript
console.log([...this.groupConnectionStates.entries()].map(([id, s]) => ({
  groupId: id.slice(0, 8),
  connected: [...s.connectedDeviceIds].map(d => d.slice(0, 8)),
  users: [...s.connectedUserIds].map(u => u.slice(0, 8)),
  members: [...s.memberUserIds].map(m => m.slice(0, 8))
})));
```

## Related Files

- `peers-device/src/connection-manager/connection-manager.ts` - Manages actual connections
- `peers-device/src/sync-group.ts` - Per-group sync logic, `getRemoteNetworkInfo()`
- `peers-sdk/src/data/group-members.ts` - GroupMembers table for membership queries
- `peers-sdk/src/data/devices.ts` - Devices table for device ownership lookup
- `peers-sdk/src/types/peer-device.ts` - `INetworkInfo`, `IDeviceConnection` interfaces
