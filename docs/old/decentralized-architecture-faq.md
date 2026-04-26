# Decentralized P2P Architecture FAQ

## Overview

This document addresses common concerns about the Peers decentralized architecture and explains how the P2P design solves traditional distributed system problems.

## Common Concerns & How They're Solved

### "How can users access group databases if they're not in GroupMembers yet?"

**Answer**: There are no remote group databases to "access" - every group database is fully replicated locally on each member's device.

**How it works**:
- When a user joins a group, they receive a complete copy of the group database through P2P sync
- All database operations happen locally for maximum performance and offline capability
- Changes sync between peers automatically when connections are available

### "Who hosts the group databases?"

**Answer**: Everyone and no one - each group database exists as identical copies on every member's device.

**Benefits**:
- No single point of failure
- Perfect offline operation
- No hosting costs or infrastructure management
- Automatic geographic distribution and redundancy

### "How do you handle data consistency between Groups and GroupMembers tables?"

**Answer**: The separation creates a two-phase consensus system:

1. **User Intent** (Groups table in personal DB): "I want to participate in Group X"
2. **Group Authority** (GroupMembers table in group DB): "User Y is actually a member of Group X"

**How reconciliation works**:
- Users can optimistically add groups to their Groups table
- The PeerConnectionManager checks both tables when establishing connections
- If a user isn't in GroupMembers, they simply won't receive group data through P2P sync
- This creates natural invitation/approval workflows without complex coordination

### "What about network partitions and offline operation?"

**Answer**: This is where the architecture truly shines.

**Offline Operation**:
```typescript
// Works completely offline - all data is local
const messages = await messagesTable.list()
await messagesTable.save(newMessage)
```

**Reconnection**:
```typescript
// Automatic incremental sync when peers reconnect
// See sync-device.ts lines 318-345 for batched change application
```

**Transitive Syncing**:
- If Device A can't reach Device C, but both can reach Device B
- Device A syncs with B, B syncs with C
- Eventually A becomes consistent with C through B
- See `sync-device.ts:356-373` for implementation

### "How do you handle user identity and authentication?"

**Answer**: User identity is established through asymmetric cryptography with user-controlled private keys.

**Cryptographic Foundation**:
- Each user generates their own public-private key pairs using NaCl (TweetNaCl)
- Users maintain complete control over their private keys - no central authority
- Identity = public key, authentication = digital signatures

**Handshake Process** (see `connection.ts:196-271`):
```typescript
// 1. Exchange signed device info containing public keys
const remoteDeviceInfo = openSignedObject(remoteDeviceInfoSigned);

// 2. Create encrypted handshake using receiver's public key  
const handshake = this.localDevice.boxDataForDevice(handshake, remoteDeviceInfo);

// 3. Verify signatures and establish trusted connection
this.trustLevel = await this.getTrustLevel(remoteDeviceInfo, true);
```

**Access Control Through Membership**:
1. User expresses intent by adding group to their Groups table
2. Existing group members add the user's **public key identity** to GroupMembers table
3. PeerConnectionManager verifies cryptographic identity during connection
4. User receives complete group database through authenticated P2P sync

**Security Benefits**:
- **No passwords or tokens** - identity is cryptographic
- **User sovereignty** - private keys never leave user's control
- **No central authority** - can't be compromised or shut down
- **Perfect revocation** - remove from GroupMembers and connection becomes untrusted

### "What about performance with many connections?"

**Answer**: The system is designed for intelligent connection management.

**Connection Efficiency**:
```typescript
// Physical connections shared between multiple groups
// See peer-connection-manager.ts:94-113
connectionState.remoteDevices[groupId_deviceId] = remoteDevice;
```

**Smart Syncing**:
- Preferred connection election (most reliable peers prioritized)
- Batched change application
- Incremental sync based on timestamps
- Connection pooling and automatic cleanup

**Resource Management**:
- Maximum connection limits per device
- Automatic removal of slow/unreliable connections
- Efficient change tracking and compaction

## Architecture Benefits

### 1. **True Decentralization**
- No servers to maintain or scale
- No single points of failure
- Natural geographic distribution

### 2. **Offline-First Design**
- Full functionality without network
- Automatic sync when connections resume
- Perfect for mobile and unreliable networks

### 3. **Elegant Consistency Model**
- User intent vs. group authority separation
- Change tracking ensures eventual consistency
- Transitive syncing through peer networks

### 4. **Scalable P2P Design**
- Connection sharing across groups
- Intelligent peer selection
- Resource-aware connection management

### 5. **Simple Security Model**
- Membership IS authentication
- Group-level access control
- No complex credential management

## Key Implementation Details

### Change Tracking & Sync
```typescript
// Every change is tracked with timestamps
// Incremental sync ensures minimal data transfer
// See sync-device.ts for full implementation
await this.applyChanges(changeBatch, remoteDevice);
```

### Group-Aware Connection Management
```typescript
// Connections automatically routed to appropriate groups
// Based on membership in both Groups and GroupMembers tables
// See peer-connection-manager.ts:161-165
const membership = await GroupMembers(dataContext)
  .findOne({ userId: remoteUserId, groupId: dataContext.dataContextId });
```

### Transitive Syncing
```typescript
// Devices can sync through intermediary peers
// Maintains consistency without direct connections
// See sync-device.ts:356-373
for (const conn of networkInfoStart.connections) {
  syncInfo.timestampAppliedLast = conn.timestampLastApplied;
}
```

## Comparison to Traditional Architectures

| Traditional (Server-Based) | Peers (P2P Decentralized) |
|---------------------------|---------------------------|
| Central database servers | Local database copies |
| Network calls for data | Local queries only |
| Username/password authentication | Cryptographic identity (public keys) |
| Server-managed user accounts | User-controlled private keys |
| Session tokens and cookies | Digital signatures |
| Complex credential management | Membership-based access |
| Single points of failure | Fully distributed |
| Requires constant connectivity | Offline-first design |
| Scaling requires infrastructure | Scales with user growth |
| Account recovery via email/SMS | Key management is user responsibility |

## Conclusion

The Peers architecture solves distributed system problems through **inversion of control**:

- Instead of accessing remote data, replicate locally
- Instead of managing credentials, manage membership  
- Instead of coordinating transactions, track and sync changes
- Instead of preventing offline work, embrace and sync later

This creates a system that's simultaneously more robust, more performant, and simpler to understand than traditional server-based architectures.